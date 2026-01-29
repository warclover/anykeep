/**
 * AI 标签匹配监控指标
 *
 * 统计标签匹配命中率、置信度分布等指标
 * 用于优化和评估 AI 标签匹配系统效果
 *
 * @module @/lib/classification/v5/classification-pipeline/tag-match-metrics
 * @version 1.0.0
 * @since 2026-01-23
 */

import { logger as baseLogger } from "@/lib/logger";
import type { FolderId } from "@/lib/shared/types";

const logger = baseLogger.child({ module: "tag-match-metrics" });

/**
 * 匹配类型
 */
export type MatchType =
  | "exact_name"
  | "core_tag"
  | "related_tag"
  | "semantic"
  | "none";

/**
 * 单次匹配记录
 */
export interface MatchRecord {
  timestamp: number;
  bookmarkId: string;
  userId: string;
  matchType: MatchType;
  confidence: number;
  matchedTags: string[];
  folderId?: number | string;
  duration: number; // 匹配耗时 (ms)
}

/**
 * 聚合统计结果
 */
export interface MatchStats {
  /** 总请求数 */
  totalRequests: number;
  /** 匹配成功数 */
  matchedCount: number;
  /** 命中率 */
  hitRate: number;
  /** 按匹配类型统计 */
  byMatchType: Record<MatchType, number>;
  /** 置信度分布 */
  confidenceDistribution: {
    high: number; // >= 0.95
    medium: number; // 0.85 - 0.95
    low: number; // < 0.85
  };
  /** 平均置信度 */
  avgConfidence: number;
  /** 平均匹配耗时 (ms) */
  avgDuration: number;
  /** 统计时间范围 */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * AI 标签匹配监控指标收集器
 */
export class TagMatchMetrics {
  /** 匹配记录缓存 */
  private records: MatchRecord[] = [];
  /** 最大缓存记录数 */
  private maxRecords: number;
  /** 统计窗口 (ms) */
  private windowMs: number;

  constructor(options?: { maxRecords?: number; windowMs?: number }) {
    this.maxRecords = options?.maxRecords ?? 10000;
    this.windowMs = options?.windowMs ?? 24 * 60 * 60 * 1000; // 默认 24 小时
  }

  /**
   * 记录一次匹配
   */
  record(record: Omit<MatchRecord, "timestamp">): void {
    const fullRecord: MatchRecord = {
      ...record,
      timestamp: Date.now(),
    };

    this.records.push(fullRecord);

    // 清理过期记录
    this.cleanup();

    // 日志记录
    logger.debug(
      {
        matchType: record.matchType,
        confidence: record.confidence,
        duration: record.duration,
      },
      "标签匹配记录",
    );
  }

  /**
   * 记录匹配成功
   */
  recordMatch(
    bookmarkId: string,
    userId: string,
    matchType: Exclude<MatchType, "none">,
    confidence: number,
    matchedTags: string[],
    folderId: FolderId,
    duration: number,
  ): void {
    this.record({
      bookmarkId,
      userId,
      matchType,
      confidence,
      matchedTags,
      folderId,
      duration,
    });
  }

  /**
   * 记录匹配失败（无匹配）
   */
  recordNoMatch(bookmarkId: string, userId: string, duration: number): void {
    this.record({
      bookmarkId,
      userId,
      matchType: "none",
      confidence: 0,
      matchedTags: [],
      duration,
    });
  }

  /**
   * 获取统计数据
   */
  getStats(windowMs?: number): MatchStats {
    const window = windowMs ?? this.windowMs;
    const cutoff = Date.now() - window;
    const relevantRecords = this.records.filter((r) => r.timestamp >= cutoff);

    const totalRequests = relevantRecords.length;
    const matchedRecords = relevantRecords.filter(
      (r) => r.matchType !== "none",
    );
    const matchedCount = matchedRecords.length;

    // 按匹配类型统计
    const byMatchType: Record<MatchType, number> = {
      exact_name: 0,
      core_tag: 0,
      related_tag: 0,
      semantic: 0,
      none: 0,
    };

    for (const record of relevantRecords) {
      byMatchType[record.matchType]++;
    }

    // 置信度分布
    const confidenceDistribution = {
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalConfidence = 0;
    for (const record of matchedRecords) {
      totalConfidence += record.confidence;
      if (record.confidence >= 0.95) {
        confidenceDistribution.high++;
      } else if (record.confidence >= 0.85) {
        confidenceDistribution.medium++;
      } else {
        confidenceDistribution.low++;
      }
    }

    // 平均耗时
    const totalDuration = relevantRecords.reduce(
      (sum, r) => sum + r.duration,
      0,
    );

    const stats: MatchStats = {
      totalRequests,
      matchedCount,
      hitRate: totalRequests > 0 ? matchedCount / totalRequests : 0,
      byMatchType,
      confidenceDistribution,
      avgConfidence: matchedCount > 0 ? totalConfidence / matchedCount : 0,
      avgDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      timeRange: {
        start: cutoff,
        end: Date.now(),
      },
    };

    return stats;
  }

  /**
   * 获取用户级别统计
   */
  getUserStats(userId: string, windowMs?: number): MatchStats {
    const window = windowMs ?? this.windowMs;
    const cutoff = Date.now() - window;
    const userRecords = this.records.filter(
      (r) => r.userId === userId && r.timestamp >= cutoff,
    );

    // 复用统计逻辑
    const tempMetrics = new TagMatchMetrics({ maxRecords: userRecords.length });
    for (const record of userRecords) {
      tempMetrics.records.push(record);
    }
    return tempMetrics.getStats(window);
  }

  /**
   * 导出统计报告（用于监控仪表盘）
   */
  exportReport(): {
    stats: MatchStats;
    summary: string;
    recommendations: string[];
  } {
    const stats = this.getStats();
    const recommendations: string[] = [];

    // 生成建议
    if (stats.hitRate < 0.3) {
      recommendations.push(
        "命中率低于 30%，建议检查文件夹标签画像是否及时更新",
      );
    }

    if (stats.avgConfidence < 0.85) {
      recommendations.push("平均置信度偏低，建议优化同义词映射或调整匹配阈值");
    }

    if (stats.avgDuration > 50) {
      recommendations.push("平均耗时超过 50ms，建议优化缓存策略");
    }

    if (stats.byMatchType.exact_name < stats.matchedCount * 0.3) {
      recommendations.push(
        "精确匹配占比低于 30%，建议检查标签与文件夹命名一致性",
      );
    }

    const summary = `
AI 标签匹配统计报告
==================
时间范围: ${new Date(stats.timeRange.start).toISOString()} - ${new Date(stats.timeRange.end).toISOString()}

总请求数: ${stats.totalRequests}
匹配成功: ${stats.matchedCount}
命中率: ${(stats.hitRate * 100).toFixed(1)}%

匹配类型分布:
  - 精确匹配: ${stats.byMatchType.exact_name} (${((stats.byMatchType.exact_name / stats.totalRequests) * 100 || 0).toFixed(1)}%)
  - 核心标签: ${stats.byMatchType.core_tag} (${((stats.byMatchType.core_tag / stats.totalRequests) * 100 || 0).toFixed(1)}%)
  - 相关标签: ${stats.byMatchType.related_tag} (${((stats.byMatchType.related_tag / stats.totalRequests) * 100 || 0).toFixed(1)}%)
  - 无匹配: ${stats.byMatchType.none} (${((stats.byMatchType.none / stats.totalRequests) * 100 || 0).toFixed(1)}%)

置信度分布:
  - 高 (≥0.95): ${stats.confidenceDistribution.high}
  - 中 (0.85-0.95): ${stats.confidenceDistribution.medium}
  - 低 (<0.85): ${stats.confidenceDistribution.low}

平均置信度: ${stats.avgConfidence.toFixed(3)}
平均耗时: ${stats.avgDuration.toFixed(1)}ms
    `.trim();

    return { stats, summary, recommendations };
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;

    // 清理过期记录
    this.records = this.records.filter((r) => r.timestamp >= cutoff);

    // 如果超过最大记录数，删除最旧的
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * 重置所有记录
   */
  reset(): void {
    this.records = [];
    logger.info("标签匹配指标已重置");
  }

  /**
   * 获取记录数
   */
  getRecordCount(): number {
    return this.records.length;
  }
}

// 导出单例实例
export const tagMatchMetrics = new TagMatchMetrics();
