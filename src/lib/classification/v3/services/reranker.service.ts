/**
 * V4.0 语义重排序服务
 *
 * 对分类候选结果进行智能重排序，综合考虑：
 * 1. 语义相似度（基础分数）
 * 2. 用户偏好（历史选择频率）
 * 3. 时间衰减（最近使用的文件夹优先）
 * 4. 文件夹质量（健康度评分）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { v42Table } from "@/lib/supabase/v42-types";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 候选项输入
 */
export interface RerankCandidate {
  folderId: number;
  folderName: string;
  score: number; // 原始分数 (0-100)
  matcherName: string; // 来源匹配器
  reason?: string;
}

/**
 * 重排序后的候选项
 */
export interface RerankedCandidate extends RerankCandidate {
  finalScore: number; // 最终分数
  rankingFactors: {
    baseScore: number;
    preferenceBoost: number;
    recencyBoost: number;
    qualityBoost: number;
  };
}

/**
 * 重排序配置
 */
export interface RerankConfig {
  /** 用户偏好权重 (0-1) */
  preferenceWeight: number;
  /** 时间衰减权重 (0-1) */
  recencyWeight: number;
  /** 文件夹质量权重 (0-1) */
  qualityWeight: number;
  /** 历史回溯天数 */
  lookbackDays: number;
  /** 最大返回候选数 */
  maxCandidates: number;
}

const DEFAULT_CONFIG: RerankConfig = {
  preferenceWeight: 0.2,
  recencyWeight: 0.15,
  qualityWeight: 0.1,
  lookbackDays: 90,
  maxCandidates: 5,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 语义重排序服务
 */
export class RerankerService {
  private supabase: SupabaseClient<Database>;
  private config: RerankConfig;

  // 用户偏好缓存 (userId -> folderId -> { count, lastUsed })
  private preferenceCache: Map<
    string,
    Map<number, { count: number; lastUsed: Date }>
  > = new Map();

  // 文件夹质量缓存 (folderId -> score)
  private qualityCache: Map<number, number> = new Map();

  // 缓存过期时间 (5 分钟)
  private cacheTTL = 5 * 60 * 1000;
  private preferenceCacheTime = 0;
  private qualityCacheTime = 0;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<RerankConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 对候选列表进行重排序
   */
  async rerank(
    userId: string,
    candidates: RerankCandidate[],
  ): Promise<RerankedCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }

    const startTime = performance.now();

    try {
      // 1. 加载用户偏好
      await this.loadUserPreferences(userId);

      // 2. 加载文件夹质量分数
      const folderIds = candidates.map((c) => c.folderId);
      await this.loadFolderQuality(folderIds);

      // 3. 计算每个候选项的最终分数
      const reranked: RerankedCandidate[] = candidates.map((candidate) => {
        const factors = this.calculateRankingFactors(userId, candidate);
        const finalScore = this.computeFinalScore(candidate.score, factors);

        return {
          ...candidate,
          finalScore,
          rankingFactors: factors,
        };
      });

      // 4. 按最终分数排序
      reranked.sort((a, b) => b.finalScore - a.finalScore);

      // 5. 限制返回数量
      const result = reranked.slice(0, this.config.maxCandidates);

      const durationMs = Math.round(performance.now() - startTime);
      logger.debug(
        {
          userId,
          inputCount: candidates.length,
          outputCount: result.length,
          durationMs,
          topScore: result[0]?.finalScore,
        },
        "Reranking completed",
      );

      return result;
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Reranking failed, returning original order",
      );

      // 失败时返回原始顺序
      return candidates
        .slice(0, this.config.maxCandidates)
        .map((c) => ({
          ...c,
          finalScore: c.score,
          rankingFactors: {
            baseScore: c.score,
            preferenceBoost: 0,
            recencyBoost: 0,
            qualityBoost: 0,
          },
        }));
    }
  }

  /**
   * 加载用户偏好数据
   */
  private async loadUserPreferences(userId: string): Promise<void> {
    const now = Date.now();
    if (
      this.preferenceCache.has(userId) &&
      now - this.preferenceCacheTime < this.cacheTTL
    ) {
      return; // 使用缓存
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.lookbackDays);

    // 从反馈表获取用户选择历史
    const { data: feedbacksRaw } = await this.supabase
      .from("classification_feedback")
      .select("folder_id, created_at")
      .eq("user_id", userId)
      .eq("feedback_type", "confirm")
      .gte("created_at", cutoffDate.toISOString());

    // 从书签表获取用户分类历史
    const { data: bookmarksRaw } = await this.supabase
      .from("bookmarks")
      .select("folder_id, created_at")
      .eq("user_id", userId)
      .not("folder_id", "is", null)
      .gte("created_at", cutoffDate.toISOString());

    // 类型断言 (使用 as unknown 避免类型不兼容错误)
    type FolderDateRow = { folder_id: number | null; created_at: string };
    const feedbacks = (feedbacksRaw || []) as unknown as FolderDateRow[];
    const bookmarks = (bookmarksRaw || []) as unknown as FolderDateRow[];

    // 合并统计
    const preferences = new Map<number, { count: number; lastUsed: Date }>();

    for (const item of [...feedbacks, ...bookmarks]) {
      const folderId = item.folder_id;
      if (!folderId) continue;

      const existing = preferences.get(folderId);
      const itemDate = new Date(item.created_at);

      if (existing) {
        existing.count++;
        if (itemDate > existing.lastUsed) {
          existing.lastUsed = itemDate;
        }
      } else {
        preferences.set(folderId, { count: 1, lastUsed: itemDate });
      }
    }

    this.preferenceCache.set(userId, preferences);
    this.preferenceCacheTime = now;
  }

  /**
   * 加载文件夹质量分数
   */
  private async loadFolderQuality(folderIds: number[]): Promise<void> {
    const now = Date.now();
    const uncached = folderIds.filter(
      (id) =>
        !this.qualityCache.has(id) ||
        now - this.qualityCacheTime >= this.cacheTTL,
    );

    if (uncached.length === 0) {
      return; // 全部命中缓存
    }

    // 获取文件夹画像
    // Note: folder_profiles 是 V4.2 新增表
    const { data: profilesData } = await v42Table(this.supabase)
      .from("folder_profiles")
      .select("folder_id, bookmark_count, internal_similarity, top_tags")
      .in("folder_id", uncached);

    // 类型断言
    type FolderProfile = {
      folder_id: number;
      bookmark_count: number;
      internal_similarity: number | null;
      top_tags: string[] | null;
    };
    const profiles = profilesData as FolderProfile[] | null;

    // 计算质量分数
    for (const folderId of uncached) {
      const profile = profiles?.find((p) => p.folder_id === folderId);

      let quality = 50; // 默认中等质量

      if (profile) {
        // 书签数量加分
        const bookmarkCount = profile.bookmark_count || 0;
        if (bookmarkCount >= 10) quality += 20;
        else if (bookmarkCount >= 5) quality += 10;
        else if (bookmarkCount >= 3) quality += 5;

        // 内部相似度加分
        const similarity = profile.internal_similarity || 0;
        quality += Math.round(similarity * 20);

        // 标签丰富度加分
        const tagCount = profile.top_tags?.length || 0;
        if (tagCount >= 5) quality += 10;
        else if (tagCount >= 3) quality += 5;
      }

      this.qualityCache.set(folderId, Math.min(100, quality));
    }

    this.qualityCacheTime = now;
  }

  /**
   * 计算排序因子
   */
  private calculateRankingFactors(
    userId: string,
    candidate: RerankCandidate,
  ): RerankedCandidate["rankingFactors"] {
    const baseScore = candidate.score;

    // 1. 用户偏好加分
    const preferences = this.preferenceCache.get(userId);
    const pref = preferences?.get(candidate.folderId);
    let preferenceBoost = 0;

    if (pref) {
      // 使用次数越多，加分越高（对数衰减）
      preferenceBoost = Math.min(15, Math.log2(pref.count + 1) * 5);
    }

    // 2. 时间衰减加分
    let recencyBoost = 0;
    if (pref?.lastUsed) {
      const daysSinceUse = Math.floor(
        (Date.now() - pref.lastUsed.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceUse <= 7) {
        recencyBoost = 10; // 最近一周
      } else if (daysSinceUse <= 30) {
        recencyBoost = 5; // 最近一月
      } else if (daysSinceUse <= 90) {
        recencyBoost = 2; // 最近三月
      }
    }

    // 3. 文件夹质量加分
    const quality = this.qualityCache.get(candidate.folderId) || 50;
    const qualityBoost = Math.round(((quality - 50) / 50) * 10); // -10 to +10

    return {
      baseScore,
      preferenceBoost,
      recencyBoost,
      qualityBoost,
    };
  }

  /**
   * 计算最终分数
   */
  private computeFinalScore(
    baseScore: number,
    factors: RerankedCandidate["rankingFactors"],
  ): number {
    const weightedBoost =
      factors.preferenceBoost * this.config.preferenceWeight +
      factors.recencyBoost * this.config.recencyWeight +
      factors.qualityBoost * this.config.qualityWeight;

    // 最终分数 = 基础分数 + 加权加分
    // 限制在 0-100 范围内
    return Math.min(100, Math.max(0, baseScore + weightedBoost));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.preferenceCache.clear();
    this.qualityCache.clear();
    this.preferenceCacheTime = 0;
    this.qualityCacheTime = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RerankConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// 工厂函数（已废弃，请使用 service-factory.ts）
// ============================================================================

let rerankerInstance: RerankerService | null = null;

/**
 * 获取重排序服务实例（单例）
 *
 * @deprecated 请使用 `import { getReranker } from './service-factory'` 代替
 */
export function getReranker(
  supabase: SupabaseClient<Database>,
  config?: Partial<RerankConfig>,
): RerankerService {
  if (!rerankerInstance) {
    rerankerInstance = new RerankerService(supabase, config);
  }
  return rerankerInstance;
}

/**
 * 重置重排序服务（测试用）
 *
 * @deprecated 请使用 `import { cleanupV4Services } from './service-factory'` 代替
 */
export function resetReranker(): void {
  rerankerInstance = null;
}
