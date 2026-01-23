/**
 * V5.5 异步命名队列
 *
 * 在文件夹创建后，异步优化命名
 * 使用 LLM 生成 MECE 保证的文件夹名称
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { V55FeatureFlags } from "../integration/v55-feature-flag";

interface NamingTask {
  folderId: number;
  userId: string;
  clusterTitles: string[];
}

/**
 * 异步命名队列
 * 特点：非阻塞、串行处理、失败降级
 */
export class AsyncNamingQueue {
  private processing = false;
  private queue: NamingTask[] = [];

  constructor(private supabase: SupabaseClient) {}

  /**
   * 入队命名任务（非阻塞）
   */
  enqueue(task: NamingTask): void {
    if (!V55FeatureFlags.V55_ASYNC_NAMING_ENABLED) {
      logger.debug(
        { folderId: task.folderId },
        "V5.5: Async naming disabled, skipping",
      );
      return;
    }

    this.queue.push(task);
    this.processNext();
  }

  /**
   * 处理下一个任务
   */
  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const task = this.queue.shift();
    if (!task) return;

    try {
      // 生成优化名称
      const optimizedName = await this.generateOptimizedName(
        task.userId,
        task.clusterTitles,
      );

      if (optimizedName) {
        // 更新文件夹名称
        const { error } = await this.supabase
          .from("folders")
          .update({
            name: optimizedName,
            is_naming_pending: false,
          })
          .eq("id", task.folderId);

        if (error) {
          throw error;
        }

        logger.info(
          {
            folderId: task.folderId,
            optimizedName,
          },
          "V5.5: Folder name optimized",
        );
      } else {
        // 无法生成优化名称，移除 pending 标记
        await this.clearPendingFlag(task.folderId);
      }
    } catch (error) {
      logger.error({ task, error }, "V5.5: Async naming failed");
      // 失败时移除 pending 标记，保留临时名称
      await this.clearPendingFlag(task.folderId);
    } finally {
      this.processing = false;
      // 继续处理下一个任务
      if (this.queue.length > 0) {
        // 使用 setTimeout 避免栈溢出
        setTimeout(() => this.processNext(), 100);
      }
    }
  }

  /**
   * 生成优化的文件夹名称
   * 基于标题提取关键主题词
   */
  private async generateOptimizedName(
    userId: string,
    clusterTitles: string[],
  ): Promise<string | null> {
    try {
      // 获取用户现有文件夹名称（用于 MECE 检查）
      const { data: existingFolders } = await this.supabase
        .from("folders")
        .select("name")
        .eq("user_id", userId)
        .is("deleted_at", null);

      const existingNames = existingFolders?.map((f) => f.name) || [];

      // 简单的关键词提取算法（可后续替换为 LLM）
      const name = this.extractKeyTopic(clusterTitles, existingNames);

      return name;
    } catch (error) {
      logger.error(
        { userId, error },
        "V5.5: Failed to generate optimized name",
      );
      return null;
    }
  }

  /**
   * 提取关键主题词
   * 简单算法：统计词频 + 排除停用词 + 排除现有名称
   */
  private extractKeyTopic(titles: string[], existingNames: string[]): string {
    const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));
    const wordCounts = new Map<string, number>();

    // 分词并统计
    for (const title of titles) {
      const words = title
        .split(/[\s,，、：:·\-—]+/)
        .filter((w) => w.length >= 2 && w.length <= 12);
      for (const word of words) {
        if (!this.isStopWord(word) && !existingSet.has(word.toLowerCase())) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }

    // 找出最高频词
    let maxWord = "";
    let maxCount = 0;

    for (const [word, count] of wordCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxWord = word;
      }
    }

    return maxWord || "未分类主题";
  }

  /**
   * 停用词判断
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      // 中文停用词
      "的",
      "是",
      "在",
      "有",
      "和",
      "与",
      "了",
      "为",
      "以",
      "这",
      "那",
      "个",
      "一",
      "不",
      "上",
      "下",
      "中",
      "大",
      "小",
      "好",
      "很",
      "会",
      "能",
      "要",
      "我",
      "你",
      "他",
      "她",
      "它",
      "我们",
      "如何",
      "什么",
      "怎么",
      "为什么",
      // 英文停用词
      "the",
      "a",
      "an",
      "is",
      "are",
      "of",
      "to",
      "and",
      "in",
      "on",
      "for",
      "with",
      "by",
      "from",
      "at",
      "as",
      "this",
      "that",
      "it",
      "its",
      "how",
      "what",
      "why",
      "when",
      "where",
      "which",
      "who",
    ]);
    return stopWords.has(word.toLowerCase());
  }

  /**
   * 清除 pending 标记
   */
  private async clearPendingFlag(folderId: number): Promise<void> {
    await this.supabase
      .from("folders")
      .update({ is_naming_pending: false })
      .eq("id", folderId);
  }

  /**
   * 获取队列长度（用于监控）
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}
