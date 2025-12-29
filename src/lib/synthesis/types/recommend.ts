/**
 * 综述推荐类型定义
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { SynthesisSourceType, SynthesisDepthMode } from "../types";

/**
 * 推荐主题
 */
export interface RecommendedTopic {
  /** 唯一标识 */
  id: string;
  /** 主题标题 */
  title: string;
  /** 主题描述 */
  description: string;
  /** 来源类型 */
  sourceType: SynthesisSourceType;
  /** 来源 ID (文件夹/标签) */
  sourceId?: string;
  /** 书签 ID 列表 (手动选择模式) */
  bookmarkIds?: string[];
  /** 书签数量 */
  bookmarkCount: number;
  /** 相关性评分 (0-1) */
  relevanceScore: number;
  /** 建议的深度模式 */
  suggestedDepthMode: SynthesisDepthMode;
  /** 推荐原因 */
  reason?: string;
  /** 代表书签 */
  sampleBookmarks?: Array<{
    id: string;
    title: string;
  }>;
}

/**
 * 推荐偏好设置
 */
export interface SynthesisRecommendPreferences {
  /** 是否启用推荐 */
  enabled: boolean;
  /** 已忽略的主题 ID 列表 */
  dismissedTopics: string[];
  /** 上次显示时间 */
  lastShownAt: string | null;
  /** 今日已显示次数 */
  dailyShowCount: number;
  /** 今日日期 */
  dailyShowDate: string | null;
}

/**
 * 推荐 API 响应
 */
export interface SynthesisRecommendResponse {
  success: boolean;
  data: {
    /** 推荐列表 */
    recommendations: RecommendedTopic[];
    /** 用户总书签数 */
    totalBookmarks: number;
    /** 是否有资格生成综述 */
    eligibleForSynthesis: boolean;
    /** 推荐偏好 */
    preferences?: SynthesisRecommendPreferences;
  };
}

/**
 * 推荐显示限制配置
 */
export const RECOMMEND_LIMITS = {
  /** 每日最大显示次数 */
  MAX_DAILY_SHOWS: 3,
  /** 两次显示之间的最小间隔（毫秒）*/
  MIN_SHOW_INTERVAL: 30 * 60 * 1000, // 30 分钟
  /** 气泡自动关闭时间（毫秒）*/
  AUTO_DISMISS_DELAY: 5000,
  /** 最小书签数量要求 */
  MIN_BOOKMARKS_FOR_RECOMMEND: 5,
} as const;
