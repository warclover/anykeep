/**
 * V5.5 晶体生长服务
 *
 * 核心服务：处理进入 Inbox 的书签
 * - 静默自动创建文件夹（用户无需确认）
 * - 支持影子模式（仅记录不执行）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { UnifiedQuotaService } from "../quota/unified-quota.service";
import { ChaosPoolManager } from "./chaos-pool.manager";
import { NucleusDetector } from "./nucleus-detector";
import { AsyncNamingQueue } from "./async-naming-queue";
import { V55FeatureFlags } from "../integration/v55-feature-flag";
import type { CrystalGrowthResult, NucleusResult } from "./types";
import { CRYSTAL_CONFIG } from "./types";

export class CrystalGrowthService {
  private quotaService: UnifiedQuotaService;
  private chaosPoolManager: ChaosPoolManager;
  private nucleusDetector: NucleusDetector;
  private namingQueue: AsyncNamingQueue;

  constructor(private supabase: SupabaseClient) {
    this.quotaService = new UnifiedQuotaService(supabase);
    this.chaosPoolManager = new ChaosPoolManager(supabase);
    this.nucleusDetector = new NucleusDetector(supabase);
    this.namingQueue = new AsyncNamingQueue(supabase);
  }

  /**
   * 处理进入 Inbox 的书签
   * 核心原则：静默自动，用户无需任何操作
   */
  async processInboxBookmark(
    userId: string,
    bookmark: { id: number; title: string; url?: string },
  ): Promise<CrystalGrowthResult> {
    const startTime = performance.now();

    // 检查用户是否在灰度范围内
    if (!V55FeatureFlags.isUserInRollout(userId)) {
      return { action: "POOLED", latencyMs: performance.now() - startTime };
    }

    try {
      // Step 1: 检查配额
      const quota = await this.quotaService.checkQuota(userId);

      if (!quota.allowed) {
        // 配额不足：静默进入 Inbox，不打扰用户
        if (!quota.health.passed) {
          return {
            action: "QUOTA_BLOCKED",
            notification: {
              type: "info",
              message: `智能分类已暂停：${quota.health.reason}`,
            },
            latencyMs: performance.now() - startTime,
          };
        }

        logger.info(
          { userId, quota },
          "V5.5: Quota exceeded, staying in inbox",
        );
        return { action: "POOLED", latencyMs: performance.now() - startTime };
      }

      // Step 2: 加入混沌池
      await this.chaosPoolManager.add(userId, bookmark.id);

      // Step 3: 检测晶核
      const nucleus = await this.nucleusDetector.detect(
        userId,
        bookmark.id,
        CRYSTAL_CONFIG.NUCLEATION_THRESHOLD,
      );

      if (!nucleus.formed) {
        // 未形成晶核：静默等待更多相似书签
        logger.debug(
          {
            userId,
            bookmarkId: bookmark.id,
            neighborsFound: nucleus.neighborsCount,
            latencyMs: performance.now() - startTime,
          },
          "V5.5: Nucleus not formed, pooled",
        );

        return { action: "POOLED", latencyMs: performance.now() - startTime };
      }

      // Step 4: 晶核形成
      // 影子模式：仅记录日志，不实际创建
      if (V55FeatureFlags.V55_SHADOW_MODE) {
        return this.shadowLog(userId, bookmark, nucleus, startTime);
      }

      // 正式模式：静默创建文件夹
      const result = await this.crystallize(userId, nucleus);
      result.latencyMs = performance.now() - startTime;

      logger.info(
        {
          userId,
          bookmarkId: bookmark.id,
          folderId: result.folderId,
          folderName: result.folderName,
          clusterSize: nucleus.clusterBookmarkIds.length,
          latencyMs: result.latencyMs,
        },
        "V5.5: Crystallized - folder created silently",
      );

      return result;
    } catch (error) {
      logger.error({ userId, bookmark, error }, "V5.5: Crystal growth failed");
      return { action: "POOLED", latencyMs: performance.now() - startTime };
    }
  }

  /**
   * 影子模式：记录日志但不执行创建
   */
  private shadowLog(
    userId: string,
    bookmark: { id: number; title: string },
    nucleus: NucleusResult,
    startTime: number,
  ): CrystalGrowthResult {
    const tempName = this.generateTempName(nucleus.clusterTitles);

    logger.info(
      {
        userId,
        bookmarkId: bookmark.id,
        mode: "SHADOW",
        wouldCreate: {
          folderName: tempName,
          clusterSize: nucleus.clusterBookmarkIds.length,
          clusterBookmarkIds: nucleus.clusterBookmarkIds,
          clusterTitles: nucleus.clusterTitles,
          avgSimilarity: nucleus.avgSimilarity,
        },
        latencyMs: performance.now() - startTime,
      },
      "V5.5 [SHADOW]: Would crystallize - folder would be created",
    );

    return {
      action: "SHADOW_LOGGED",
      folderName: tempName,
      clusterSize: nucleus.clusterBookmarkIds.length,
      latencyMs: performance.now() - startTime,
    };
  }

  /**
   * 结晶：静默创建文件夹并移动书签
   * 使用事务函数保证原子性
   */
  private async crystallize(
    userId: string,
    nucleus: NucleusResult,
  ): Promise<CrystalGrowthResult> {
    // 生成临时名称（快速响应）
    const tempName = this.generateTempName(nucleus.clusterTitles);

    // 使用事务函数原子化执行
    const { data, error } = await this.supabase.rpc("crystallize_folder", {
      p_user_id: userId,
      p_folder_name: tempName,
      p_bookmark_ids: nucleus.clusterBookmarkIds,
      p_ai_source: "CRYSTAL_GROWTH",
    });

    if (error || !data || data.length === 0) {
      throw new Error(`Failed to crystallize: ${error?.message}`);
    }

    const result = data[0];

    // 异步优化命名（后台进行，不阻塞）
    this.namingQueue.enqueue({
      folderId: result.folder_id,
      userId,
      clusterTitles: nucleus.clusterTitles,
    });

    return {
      action: "CRYSTALLIZED",
      folderId: result.folder_id,
      folderName: tempName,
      isNewFolder: true,
      clusterSize: nucleus.clusterBookmarkIds.length,
      notification: {
        type: "success",
        message: `已为您创建「${tempName}」文件夹，收录 ${nucleus.clusterBookmarkIds.length} 条相关内容`,
      },
    };
  }

  /**
   * 生成临时名称（毫秒级响应）
   * 提取高频词作为临时名称
   */
  private generateTempName(titles: string[]): string {
    const allWords = titles.join(" ").split(/[\s,，、：:]+/);
    const wordCounts = new Map<string, number>();

    for (const word of allWords) {
      if (word.length >= 2 && word.length <= 10 && !this.isStopWord(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    let maxWord = "新主题";
    let maxCount = 0;

    for (const [word, count] of wordCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxWord = word;
      }
    }

    return maxWord;
  }

  /**
   * 停用词过滤
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
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
    ]);
    return stopWords.has(word.toLowerCase());
  }
}
