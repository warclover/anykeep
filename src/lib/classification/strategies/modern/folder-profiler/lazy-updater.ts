/**
 * 智能分类 v5.0 - 懒更新机制
 *
 * 判断文件夹画像是否需要更新（4 个触发条件）
 */

import type { LoggerService } from "../shared/logger";
import type { FolderProfile, LazyUpdateTrigger } from "./types";

/**
 * 懒更新器配置
 */
export interface LazyUpdaterConfig {
  /** 时间阈值（天） */
  timeThresholdDays: number;
  /** 新增书签阈值 */
  newBookmarksThreshold: number;
  /** 准确率阈值 */
  accuracyThreshold: number;
}

/**
 * 懒更新器类
 */
export class LazyUpdater {
  private logger: LoggerService;
  private config: LazyUpdaterConfig;

  constructor(logger: LoggerService, config?: Partial<LazyUpdaterConfig>) {
    this.logger = logger.child({ service: "LazyUpdater" });

    this.config = {
      timeThresholdDays: config?.timeThresholdDays ?? 7,
      newBookmarksThreshold: config?.newBookmarksThreshold ?? 10,
      accuracyThreshold: config?.accuracyThreshold ?? 0.85,
    };
  }

  /**
   * 检查是否需要更新文件夹画像
   */
  shouldUpdate(
    profile: FolderProfile,
    currentBookmarkCount: number,
  ): LazyUpdateTrigger {
    // 条件 4: 手动触发标记（优先级最高）
    if (profile.needsUpdate) {
      return {
        shouldUpdate: true,
        reason: "manual_trigger",
      };
    }

    // 条件 1: 时间阈值（7 天未更新）
    const daysSinceUpdate = this.getDaysSince(profile.lastUpdatedAt);
    if (daysSinceUpdate > this.config.timeThresholdDays) {
      return {
        shouldUpdate: true,
        reason: "time_threshold",
        details: { daysSinceUpdate },
      };
    }

    // 条件 2: 新增书签阈值（新增 10+ 条）
    const newBookmarksCount = currentBookmarkCount - profile.bookmarkCount;
    if (newBookmarksCount >= this.config.newBookmarksThreshold) {
      return {
        shouldUpdate: true,
        reason: "bookmark_threshold",
        details: { newBookmarksCount },
      };
    }

    // 条件 3: 分类准确率下降（<85%）
    if (
      profile.avgClassificationScore !== undefined &&
      profile.avgClassificationScore !== null &&
      profile.avgClassificationScore < this.config.accuracyThreshold
    ) {
      return {
        shouldUpdate: true,
        reason: "accuracy_drop",
        details: { currentAccuracy: profile.avgClassificationScore },
      };
    }

    // 不需要更新
    return {
      shouldUpdate: false,
      reason: "none",
    };
  }

  /**
   * 计算距离指定日期的天数
   */
  private getDaysSince(date: Date): number {
    return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  }
}
