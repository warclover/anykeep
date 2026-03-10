/**
 * Profile Updater Service
 * V4.2 画像自动更新服务
 *
 * @description 自动维护和更新来源画像
 * - 定期刷新统计数据
 * - 衰减过期权重
 * - 合并相似来源
 * - 清理无效画像
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import { fastPathCacheManager } from "@/lib/cache/fast-path-cache";
import { LEARNING_LIMITS, FAST_PATH_THRESHOLDS } from "@/lib/trust-mode/config";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 更新任务类型
 */
export type UpdateTaskType =
  | "refresh_stats"
  | "decay_weights"
  | "merge_similar"
  | "cleanup_stale"
  | "rebuild_cache";

/**
 * 更新任务结果
 */
export interface UpdateTaskResult {
  taskType: UpdateTaskType;
  success: boolean;
  processed: number;
  errors: number;
  duration: number;
  details?: Record<string, unknown>;
}

/**
 * 更新配置
 */
export interface UpdateConfig {
  /** 衰减周期（天） */
  decayPeriodDays: number;
  /** 衰减因子 */
  decayFactor: number;
  /** 过期天数（超过此天数未更新则清理） */
  staleDays: number;
  /** 合并相似度阈值 */
  mergeThreshold: number;
  /** 最小样本数（低于此数可能被清理） */
  minSamples: number;
}

/**
 * 画像健康状态
 */
export interface ProfileHealthStatus {
  userId: string;
  totalProfiles: number;
  healthyProfiles: number;
  staleProfiles: number;
  lowSampleProfiles: number;
  duplicateProfiles: number;
  lastUpdated: Date | null;
  recommendations: string[];
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  decayPeriodDays: LEARNING_LIMITS.EXCLUSION_DECAY_DAYS,
  decayFactor: 0.9,
  staleDays: 90,
  mergeThreshold: 0.85,
  minSamples: FAST_PATH_THRESHOLDS.MIN_SOURCE_SAMPLES,
};

// ============================================================================
// 画像更新器
// ============================================================================

/**
 * 画像更新器
 */
export class ProfileUpdater {
  private config: UpdateConfig;

  constructor(config: Partial<UpdateConfig> = {}) {
    this.config = { ...DEFAULT_UPDATE_CONFIG, ...config };
  }

  /**
   * 执行全量更新
   */
  async runFullUpdate(userId: string): Promise<UpdateTaskResult[]> {
    const results: UpdateTaskResult[] = [];

    // 1. 刷新统计
    results.push(await this.refreshStats(userId));

    // 2. 衰减权重
    results.push(await this.decayWeights(userId));

    // 3. 合并相似来源
    results.push(await this.mergeSimilar(userId));

    // 4. 清理过期画像
    results.push(await this.cleanupStale(userId));

    // 5. 重建缓存
    results.push(await this.rebuildCache(userId));

    return results;
  }

  /**
   * 刷新统计数据
   */
  async refreshStats(userId: string): Promise<UpdateTaskResult> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      const supabase = await createClient();

      // 获取所有来源画像
      const profiles = await sourceProfileService.findAllByUserId(userId);

      for (const profile of profiles) {
        try {
          // 重新计算统计数据
          const { data: bookmarks } = await supabase
            .from("bookmarks")
            .select("folder_id")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .ilike("url", `%${profile.sourceId}%`)
            .limit(200);

          if (bookmarks && bookmarks.length > 0) {
            // 统计文件夹分布
            const folderCounts = new Map<number, number>();
            for (const b of bookmarks) {
              if (b.folder_id) {
                folderCounts.set(
                  b.folder_id,
                  (folderCounts.get(b.folder_id) || 0) + 1,
                );
              }
            }

            // 更新高频文件夹
            const sortedFolders = [...folderCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([folderId]) => folderId);

            // 更新画像
            await supabase
              .from("source_profiles")
              .update({
                frequent_folders: sortedFolders,
                sample_count: bookmarks.length,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("source_id", profile.sourceId);

            processed++;
          }
        } catch (error) {
          logger.error(
            { error, sourceId: profile.sourceId },
            "Failed to refresh stats",
          );
          errors++;
        }
      }

      return {
        taskType: "refresh_stats",
        success: errors === 0,
        processed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskType: "refresh_stats",
        success: false,
        processed,
        errors: errors + 1,
        duration: Date.now() - startTime,
        details: { error: String(error) },
      };
    }
  }

  /**
   * 衰减权重
   */
  async decayWeights(userId: string): Promise<UpdateTaskResult> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      const supabase = await createClient();
      const decayDate = new Date();
      decayDate.setDate(decayDate.getDate() - this.config.decayPeriodDays);

      // 获取需要衰减的画像
      const { data: profiles } = await supabase
        .from("source_profiles")
        .select("*")
        .eq("user_id", userId)
        .lt("last_seen_at", decayDate.toISOString());

      if (!profiles || profiles.length === 0) {
        return {
          taskType: "decay_weights",
          success: true,
          processed: 0,
          errors: 0,
          duration: Date.now() - startTime,
        };
      }

      for (const profile of profiles) {
        try {
          // 计算衰减后的可信度
          const newTrustScore = Math.max(
            30,
            Math.floor(profile.trust_score * this.config.decayFactor),
          );

          // 计算衰减后的平均置信度
          const newAvgConfidence = profile.avg_confidence
            ? Math.floor(profile.avg_confidence * this.config.decayFactor)
            : null;

          await supabase
            .from("source_profiles")
            .update({
              trust_score: newTrustScore,
              avg_confidence: newAvgConfidence,
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

          processed++;
        } catch (error) {
          logger.error(
            { error, profileId: profile.id },
            "Failed to decay weights",
          );
          errors++;
        }
      }

      return {
        taskType: "decay_weights",
        success: errors === 0,
        processed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskType: "decay_weights",
        success: false,
        processed,
        errors: errors + 1,
        duration: Date.now() - startTime,
        details: { error: String(error) },
      };
    }
  }

  /**
   * 合并相似来源
   */
  async mergeSimilar(userId: string): Promise<UpdateTaskResult> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;
    const merged: string[] = [];

    try {
      const profiles = await sourceProfileService.findAllByUserId(userId);

      // 按域名分组
      const domainGroups = new Map<string, typeof profiles>();

      for (const profile of profiles) {
        // 提取基础域名
        const baseDomain = this.extractBaseDomain(profile.sourceId);
        const group = domainGroups.get(baseDomain) || [];
        group.push(profile);
        domainGroups.set(baseDomain, group);
      }

      // 处理每个分组
      for (const [baseDomain, group] of domainGroups.entries()) {
        if (group.length <= 1) continue;

        try {
          // 找到主要画像（样本数最多）
          const primary = group.reduce((a, b) =>
            a.sampleCount > b.sampleCount ? a : b,
          );

          // 合并其他画像到主要画像
          for (const profile of group) {
            if (profile.sourceId === primary.sourceId) continue;

            // 检查相似度
            const similarity = this.calculateSimilarity(primary, profile);
            if (similarity < this.config.mergeThreshold) continue;

            // 合并域名
            const mergedDomains = [
              ...new Set([...primary.domains, ...profile.domains]),
            ];

            // 合并文件夹
            const mergedFolders = [
              ...new Set([
                ...primary.frequentFolders,
                ...profile.frequentFolders,
              ]),
            ].slice(0, 10);

            // 更新主画像
            const supabase = await createClient();
            await supabase
              .from("source_profiles")
              .update({
                domains: mergedDomains,
                frequent_folders: mergedFolders,
                sample_count: primary.sampleCount + profile.sampleCount,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("source_id", primary.sourceId);

            // 删除被合并的画像
            await sourceProfileService.delete(userId, profile.sourceId);

            merged.push(`${profile.sourceId} -> ${primary.sourceId}`);
            processed++;
          }
        } catch (error) {
          logger.error({ error, baseDomain }, "Failed to merge profiles");
          errors++;
        }
      }

      return {
        taskType: "merge_similar",
        success: errors === 0,
        processed,
        errors,
        duration: Date.now() - startTime,
        details: { merged },
      };
    } catch (error) {
      return {
        taskType: "merge_similar",
        success: false,
        processed,
        errors: errors + 1,
        duration: Date.now() - startTime,
        details: { error: String(error) },
      };
    }
  }

  /**
   * 清理过期画像
   */
  async cleanupStale(userId: string): Promise<UpdateTaskResult> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;
    const deleted: string[] = [];

    try {
      const supabase = await createClient();
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - this.config.staleDays);

      // 获取过期画像
      const { data: staleProfiles } = await supabase
        .from("source_profiles")
        .select("source_id, sample_count, last_seen_at")
        .eq("user_id", userId)
        .lt("last_seen_at", staleDate.toISOString())
        .lt("sample_count", this.config.minSamples);

      if (!staleProfiles || staleProfiles.length === 0) {
        return {
          taskType: "cleanup_stale",
          success: true,
          processed: 0,
          errors: 0,
          duration: Date.now() - startTime,
        };
      }

      for (const profile of staleProfiles) {
        try {
          await sourceProfileService.delete(userId, profile.source_id);
          deleted.push(profile.source_id);
          processed++;
        } catch (error) {
          logger.error(
            { error, sourceId: profile.source_id },
            "Failed to delete stale profile",
          );
          errors++;
        }
      }

      return {
        taskType: "cleanup_stale",
        success: errors === 0,
        processed,
        errors,
        duration: Date.now() - startTime,
        details: { deleted },
      };
    } catch (error) {
      return {
        taskType: "cleanup_stale",
        success: false,
        processed,
        errors: errors + 1,
        duration: Date.now() - startTime,
        details: { error: String(error) },
      };
    }
  }

  /**
   * 重建缓存
   */
  async rebuildCache(userId: string): Promise<UpdateTaskResult> {
    const startTime = Date.now();

    try {
      // 清除旧缓存
      fastPathCacheManager.clearUserCache(userId);

      // 预热新缓存
      await fastPathCacheManager.warmupUserCache(userId);

      return {
        taskType: "rebuild_cache",
        success: true,
        processed: 1,
        errors: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskType: "rebuild_cache",
        success: false,
        processed: 0,
        errors: 1,
        duration: Date.now() - startTime,
        details: { error: String(error) },
      };
    }
  }

  /**
   * 获取画像健康状态
   */
  async getHealthStatus(userId: string): Promise<ProfileHealthStatus> {
    const profiles = await sourceProfileService.findAllByUserId(userId);

    const now = new Date();
    const staleDays = this.config.staleDays;
    const minSamples = this.config.minSamples;

    let healthyProfiles = 0;
    let staleProfiles = 0;
    let lowSampleProfiles = 0;
    let lastUpdated: Date | null = null;

    // 检查重复
    const domainCounts = new Map<string, number>();

    for (const profile of profiles) {
      const lastSeen = profile.lastSeenAt ? new Date(profile.lastSeenAt) : null;
      const daysSinceLastSeen = lastSeen
        ? Math.floor(
            (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24),
          )
        : Infinity;

      if (daysSinceLastSeen > staleDays) {
        staleProfiles++;
      } else if (profile.sampleCount < minSamples) {
        lowSampleProfiles++;
      } else {
        healthyProfiles++;
      }

      if (lastSeen && (!lastUpdated || lastSeen > lastUpdated)) {
        lastUpdated = lastSeen;
      }

      // 统计域名
      const baseDomain = this.extractBaseDomain(profile.sourceId);
      domainCounts.set(baseDomain, (domainCounts.get(baseDomain) || 0) + 1);
    }

    // 计算重复画像
    const duplicateProfiles = [...domainCounts.values()].filter(
      (c) => c > 1,
    ).length;

    // 生成建议
    const recommendations: string[] = [];

    if (staleProfiles > profiles.length * 0.2) {
      recommendations.push(
        `${staleProfiles} 个画像超过 ${staleDays} 天未更新，建议清理`,
      );
    }

    if (lowSampleProfiles > profiles.length * 0.3) {
      recommendations.push(
        `${lowSampleProfiles} 个画像样本不足，可能影响分类准确性`,
      );
    }

    if (duplicateProfiles > 0) {
      recommendations.push(
        `发现 ${duplicateProfiles} 组可能重复的画像，建议合并`,
      );
    }

    if (healthyProfiles < 10 && profiles.length > 0) {
      recommendations.push("健康画像数量较少，建议继续积累分类数据");
    }

    return {
      userId,
      totalProfiles: profiles.length,
      healthyProfiles,
      staleProfiles,
      lowSampleProfiles,
      duplicateProfiles,
      lastUpdated,
      recommendations,
    };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 提取基础域名
   */
  private extractBaseDomain(sourceId: string): string {
    // 移除常见前缀和子域
    return sourceId
      .replace(/^(www\.|m\.|mobile\.)/, "")
      .replace(/^mp\.weixin\.qq\.com\//, "weixin/")
      .split("/")[0]
      .split("?")[0];
  }

  /**
   * 计算画像相似度
   */
  private calculateSimilarity(
    a: { domains: string[]; frequentFolders: number[] },
    b: { domains: string[]; frequentFolders: number[] },
  ): number {
    // 域名重叠
    const domainOverlap =
      a.domains.filter((d) => b.domains.includes(d)).length /
      Math.max(a.domains.length, b.domains.length, 1);

    // 文件夹重叠
    const folderOverlap =
      a.frequentFolders.filter((f) => b.frequentFolders.includes(f)).length /
      Math.max(a.frequentFolders.length, b.frequentFolders.length, 1);

    // 加权平均
    return domainOverlap * 0.4 + folderOverlap * 0.6;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const profileUpdater = new ProfileUpdater();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 调度定期更新任务
 */
export function scheduleProfileUpdates(
  userId: string,
  intervalHours = 24,
): NodeJS.Timeout {
  return setInterval(
    async () => {
      try {
        await profileUpdater.runFullUpdate(userId);
      } catch (error) {
        logger.error({ error, userId }, "Scheduled profile update failed");
      }
    },
    intervalHours * 60 * 60 * 1000,
  );
}
