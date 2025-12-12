/**
 * AI Summary Repository Interface
 *
 * 仓库层接口定义
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import type {
  QualityLogEntry,
  QualityStats,
  UserFeedback,
  ProviderName,
} from "../summary.types";

// ============================================================================
// Summary Repository
// ============================================================================

/**
 * 摘要仓库接口
 *
 * 负责书签摘要数据的存取
 */
export interface ISummaryRepository {
  /**
   * 更新书签摘要
   *
   * @param bookmarkId - 书签 ID
   * @param summary - 摘要文本
   * @param tags - 标签数组
   */
  updateBookmarkSummary(
    bookmarkId: number,
    summary: string,
    tags: string[],
  ): Promise<void>;

  /**
   * 获取书签摘要
   *
   * @param bookmarkId - 书签 ID
   * @returns 摘要和标签
   */
  getBookmarkSummary(bookmarkId: number): Promise<BookmarkSummaryData | null>;

  /**
   * 批量更新摘要
   *
   * @param updates - 更新数据数组
   */
  batchUpdateSummaries(updates: BatchSummaryUpdate[]): Promise<void>;

  /**
   * 获取需要生成摘要的书签
   *
   * @param userId - 用户 ID
   * @param limit - 限制数量
   * @returns 书签数据列表
   */
  getBookmarksNeedingSummary(
    userId: string,
    limit?: number,
  ): Promise<BookmarkForSummary[]>;

  /**
   * 检查书签是否存在
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @returns 是否存在
   */
  bookmarkExists(bookmarkId: number, userId: string): Promise<boolean>;
}

/**
 * 书签摘要数据
 */
export interface BookmarkSummaryData {
  summary: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 批量更新数据
 */
export interface BatchSummaryUpdate {
  bookmarkId: number;
  summary: string;
  tags: string[];
}

/**
 * 需要生成摘要的书签数据
 */
export interface BookmarkForSummary {
  id: number;
  userId: string;
  title: string;
  url: string;
  description?: string;
  content?: string;
}

// ============================================================================
// Quality Log Repository
// ============================================================================

/**
 * 质量日志仓库接口
 *
 * 负责质量追踪数据的存取
 */
export interface IQualityLogRepository {
  /**
   * 记录质量日志
   *
   * @param log - 质量日志条目
   */
  logQuality(log: QualityLogEntry): Promise<void>;

  /**
   * 获取质量统计
   *
   * @param userId - 用户 ID
   * @param timeRange - 时间范围
   * @returns 质量统计
   */
  getQualityStats(userId: string, timeRange?: TimeRange): Promise<QualityStats>;

  /**
   * 记录用户反馈
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @param rating - 评分
   * @param feedback - 文字反馈
   */
  recordUserFeedback(
    bookmarkId: number,
    userId: string,
    rating: number,
    feedback?: string,
  ): Promise<void>;

  /**
   * 获取用户反馈列表
   *
   * @param userId - 用户 ID
   * @param limit - 限制数量
   * @returns 反馈列表
   */
  getUserFeedbacks(userId: string, limit?: number): Promise<UserFeedback[]>;

  /**
   * 获取 Provider 使用统计
   *
   * @param userId - 用户 ID
   * @param timeRange - 时间范围
   * @returns Provider 使用统计
   */
  getProviderUsageStats(
    userId: string,
    timeRange?: TimeRange,
  ): Promise<ProviderUsageStats>;

  /**
   * 清理过期日志
   *
   * @param daysOld - 保留天数
   * @returns 删除的记录数
   */
  cleanupOldLogs(daysOld: number): Promise<number>;
}

/**
 * 时间范围
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Provider 使用统计
 */
export interface ProviderUsageStats {
  /** 总调用次数 */
  totalCalls: number;
  /** 按 Provider 分布 */
  byProvider: Record<ProviderName, ProviderCallStats>;
  /** 时间段内的趋势 */
  trend?: DailyUsage[];
}

/**
 * Provider 调用统计
 */
export interface ProviderCallStats {
  /** 调用次数 */
  count: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failedCount: number;
  /** 平均延迟 */
  avgLatencyMs: number;
  /** 总 Token 消耗 */
  totalTokens: number;
}

/**
 * 每日使用量
 */
export interface DailyUsage {
  date: string;
  count: number;
  provider: ProviderName;
}
