/**
 * 偏好学习服务
 *
 * 异步记录用户行为，自动更新偏好
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  AIPreferences,
  LearnedPreferences,
  LearningEvent,
  LearningEventType,
} from "./types";
import { preferencesService } from "./preferences-service";

// =============================================================================
// 常量配置
// =============================================================================

/** 常用标签数量上限 */
const MAX_FREQUENT_TAGS = 10;

/** 常用文件夹数量上限 */
const MAX_FREQUENT_FOLDERS = 5;

/** 更新频率限制（毫秒），防止过于频繁的数据库写入 */
const UPDATE_DEBOUNCE_MS = 30 * 1000; // 30 seconds

/** 最近更新时间缓存 */
const lastUpdateTime = new Map<string, number>();

// =============================================================================
// 学习服务类
// =============================================================================

/**
 * 偏好学习服务
 *
 * 异步记录工具调用行为，自动学习用户偏好
 */
export class PreferenceLearningService {
  /** 待处理的事件队列 */
  private eventQueue: Map<string, LearningEvent[]> = new Map();

  /**
   * 记录工具使用行为
   *
   * 异步执行，不阻塞主流程
   *
   * @param userId - 用户 ID
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param success - 是否执行成功
   */
  async recordToolUsage(
    userId: string,
    toolName: string,
    params: unknown,
    success: boolean,
  ): Promise<void> {
    // 异步执行，不阻塞主流程
    setImmediate(async () => {
      try {
        // 只记录成功的调用
        if (!success) return;

        // 根据工具类型提取学习事件
        const events = this.extractLearningEvents(toolName, params);
        if (events.length === 0) return;

        // 添加到事件队列
        this.addToQueue(userId, events);

        // 检查是否需要批量更新
        await this.checkAndFlush(userId);
      } catch (error) {
        logger.warn(
          { userId, toolName, error },
          "PreferenceLearningService: Failed to record tool usage",
        );
      }
    });
  }

  /**
   * 强制刷新某用户的待处理事件
   */
  async flush(userId: string): Promise<void> {
    const events = this.eventQueue.get(userId);
    if (!events || events.length === 0) return;

    try {
      await this.processEvents(userId, events);
      this.eventQueue.delete(userId);
      lastUpdateTime.set(userId, Date.now());
    } catch (error) {
      logger.error(
        { userId, error },
        "PreferenceLearningService: Failed to flush events",
      );
    }
  }

  /**
   * 记录标签使用
   */
  async recordTagUsage(userId: string, tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    const events: LearningEvent[] = tags.map((tag) => ({
      type: "tag_used" as LearningEventType,
      data: { tag },
      timestamp: new Date().toISOString(),
    }));

    this.addToQueue(userId, events);
    await this.checkAndFlush(userId);
  }

  /**
   * 记录文件夹使用
   */
  async recordFolderUsage(userId: string, folderId: number): Promise<void> {
    const event: LearningEvent = {
      type: "folder_used",
      data: { folderId },
      timestamp: new Date().toISOString(),
    };

    this.addToQueue(userId, [event]);
    await this.checkAndFlush(userId);
  }

  /**
   * 记录导出格式使用
   */
  async recordExportFormat(userId: string, format: string): Promise<void> {
    const event: LearningEvent = {
      type: "export_format_used",
      data: { format },
      timestamp: new Date().toISOString(),
    };

    this.addToQueue(userId, [event]);
    await this.checkAndFlush(userId);
  }

  /**
   * 从工具调用中提取学习事件
   */
  private extractLearningEvents(
    toolName: string,
    params: unknown,
  ): LearningEvent[] {
    const events: LearningEvent[] = [];
    const now = new Date().toISOString();

    // 类型安全的参数访问
    const p = params as Record<string, unknown>;

    switch (toolName) {
      case "batch_tags":
        // 批量标签操作 - 记录使用的标签
        if (Array.isArray(p?.tags)) {
          for (const tag of p.tags) {
            if (typeof tag === "string") {
              events.push({
                type: "tag_used",
                data: { tag },
                timestamp: now,
              });
            }
          }
        }
        break;

      case "list_by_folder":
      case "move_bookmarks":
        // 文件夹相关操作 - 记录使用的文件夹
        if (typeof p?.folder_id === "number") {
          events.push({
            type: "folder_used",
            data: { folderId: p.folder_id },
            timestamp: now,
          });
        }
        break;

      case "export_bookmarks":
        // 导出操作 - 记录导出格式
        if (typeof p?.format === "string") {
          events.push({
            type: "export_format_used",
            data: { format: p.format },
            timestamp: now,
          });
        }
        break;

      case "search_bookmarks":
        // 搜索操作 - 记录查询模式（可选，用于未来分析）
        if (typeof p?.query === "string" && p.query.length > 2) {
          events.push({
            type: "query_pattern",
            data: { query: p.query },
            timestamp: now,
          });
        }
        break;
    }

    return events;
  }

  /**
   * 添加事件到队列
   */
  private addToQueue(userId: string, events: LearningEvent[]): void {
    const existing = this.eventQueue.get(userId) ?? [];
    this.eventQueue.set(userId, [...existing, ...events]);
  }

  /**
   * 检查是否需要刷新
   */
  private async checkAndFlush(userId: string): Promise<void> {
    const lastUpdate = lastUpdateTime.get(userId) ?? 0;
    const events = this.eventQueue.get(userId);

    // 如果距离上次更新超过防抖时间，或队列中事件过多，则刷新
    if (
      Date.now() - lastUpdate > UPDATE_DEBOUNCE_MS ||
      (events && events.length >= 10)
    ) {
      await this.flush(userId);
    }
  }

  /**
   * 处理事件队列，更新偏好
   */
  private async processEvents(
    userId: string,
    events: LearningEvent[],
  ): Promise<void> {
    // 获取当前偏好
    const current = await preferencesService.getPreferences(userId, true);
    const learned = { ...current.learned };

    // 统计各类事件
    const tagCounts = new Map<string, number>();
    const folderCounts = new Map<number, number>();
    let latestExportFormat: string | undefined;

    for (const event of events) {
      switch (event.type) {
        case "tag_used": {
          const tag = (event.data as { tag: string }).tag;
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          break;
        }
        case "folder_used": {
          const folderId = (event.data as { folderId: number }).folderId;
          folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
          break;
        }
        case "export_format_used": {
          latestExportFormat = (event.data as { format: string }).format;
          break;
        }
      }
    }

    // 更新常用标签
    if (tagCounts.size > 0) {
      learned.frequentTags = this.mergeFrequentItems(
        learned.frequentTags,
        Array.from(tagCounts.keys()),
        MAX_FREQUENT_TAGS,
      );
    }

    // 更新常用文件夹
    if (folderCounts.size > 0) {
      learned.frequentFolders = this.mergeFrequentFolders(
        learned.frequentFolders,
        Array.from(folderCounts.keys()),
        MAX_FREQUENT_FOLDERS,
      );
    }

    // 更新偏好导出格式
    if (latestExportFormat) {
      learned.preferredExportFormat = latestExportFormat;
    }

    // 更新时间戳
    learned.lastUpdated = new Date().toISOString();

    // 保存到数据库
    await this.saveLearnedPreferences(userId, learned);

    logger.debug(
      {
        userId,
        eventCount: events.length,
        tagCount: tagCounts.size,
        folderCount: folderCounts.size,
      },
      "PreferenceLearningService: Processed events",
    );
  }

  /**
   * 合并常用项目
   */
  private mergeFrequentItems(
    existing: string[],
    newItems: string[],
    maxCount: number,
  ): string[] {
    // 新项目优先（最近使用）
    const combined = [...new Set([...newItems, ...existing])];
    return combined.slice(0, maxCount);
  }

  /**
   * 合并常用文件夹
   */
  private mergeFrequentFolders(
    existing: number[],
    newFolders: number[],
    maxCount: number,
  ): number[] {
    // 新文件夹优先（最近使用）
    const combined = [...new Set([...newFolders, ...existing])];
    return combined.slice(0, maxCount);
  }

  /**
   * 保存学习到的偏好
   */
  private async saveLearnedPreferences(
    userId: string,
    learned: LearnedPreferences,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // 尝试使用 JSONB 部分更新（RPC 可能不存在）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)(
        "update_ai_learned_preferences",
        {
          p_user_id: userId,
          p_learned: learned,
        },
      );

      if (error) {
        // 如果 RPC 不存在，回退到完整更新
        if (error.message.includes("does not exist")) {
          const current = await preferencesService.getPreferences(userId, true);
          const updated: AIPreferences = {
            ...current,
            learned,
          };

          await supabase
            .from("profiles")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ ai_preferences: updated } as any)
            .eq("id", userId);
        } else {
          throw error;
        }
      }

      // 清除缓存
      preferencesService.invalidateCache(userId);
    } catch (error) {
      logger.error(
        { userId, error },
        "PreferenceLearningService: Failed to save learned preferences",
      );
    }
  }
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局学习服务实例
 */
export const preferenceLearningService = new PreferenceLearningService();

/**
 * 便捷函数：记录工具使用
 */
export function recordToolUsage(
  userId: string,
  toolName: string,
  params: unknown,
  success: boolean,
): void {
  preferenceLearningService.recordToolUsage(userId, toolName, params, success);
}
