/**
 * V5.5 分类器集成
 *
 * 将晶体生长服务集成到现有分类流程
 * 在书签进入 Inbox 时触发检测
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CrystalGrowthService } from "../crystal-growth/crystal-growth.service";
import { V55FeatureFlags } from "./v55-feature-flag";
import { logger } from "@/lib/logger";
import type { CrystalGrowthResult } from "../crystal-growth/types";

/**
 * V5.5 分类器
 * 作为现有分类流程的补充层
 */
export class V55Classifier {
  private crystalService: CrystalGrowthService;

  constructor(private supabase: SupabaseClient) {
    this.crystalService = new CrystalGrowthService(supabase);
  }

  /**
   * 处理进入 Inbox 的书签（异步触发）
   * 不阻塞主流程，后台执行晶体生长检测
   */
  triggerCrystalGrowthAsync(
    userId: string,
    bookmarkId: number,
    title: string,
  ): void {
    // 检查 v5.5 是否启用
    if (!V55FeatureFlags.V55_ENABLED) {
      return;
    }

    // 检查用户是否在灰度范围
    if (!V55FeatureFlags.isUserInRollout(userId)) {
      return;
    }

    // 使用 queueMicrotask 确保不阻塞主流程
    queueMicrotask(async () => {
      try {
        const result = await this.crystalService.processInboxBookmark(userId, {
          id: bookmarkId,
          title,
        });

        if (V55FeatureFlags.V55_DEBUG_LOG) {
          logger.debug(
            {
              userId,
              bookmarkId,
              result,
            },
            "V5.5: Async crystal growth completed",
          );
        }
      } catch (error) {
        logger.error(
          {
            userId,
            bookmarkId,
            error,
          },
          "V5.5: Async crystal growth failed",
        );
      }
    });
  }

  /**
   * 同步处理（用于测试或特殊场景）
   */
  async processCrystalGrowth(
    userId: string,
    bookmark: { id: number; title: string },
  ): Promise<CrystalGrowthResult> {
    return this.crystalService.processInboxBookmark(userId, bookmark);
  }

  /**
   * 检查 v5.5 是否对用户启用
   */
  isEnabledForUser(userId: string): boolean {
    return (
      V55FeatureFlags.V55_ENABLED && V55FeatureFlags.isUserInRollout(userId)
    );
  }
}

/**
 * 创建 V55Classifier 工厂
 * 使用 WeakMap 按 supabase 实例缓存，避免跨用户共享问题
 */
const classifierCache = new WeakMap<SupabaseClient, V55Classifier>();

export function getV55Classifier(supabase: SupabaseClient): V55Classifier {
  let instance = classifierCache.get(supabase);
  if (!instance) {
    instance = new V55Classifier(supabase);
    classifierCache.set(supabase, instance);
  }
  return instance;
}

/**
 * 重置缓存（用于测试）
 */
export function resetV55Classifier(): void {
  // WeakMap 会自动清理，此处为兼容性保留
}
