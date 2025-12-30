/**
 * 模式检测分析器
 *
 * 检测用户收藏行为中的模式
 *
 * @module ai-agent/async-analysis/analyzers
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import { BaseAnalyzer } from "./base-analyzer";
import { PATTERN_DETECTION_THRESHOLDS } from "../constants";
import type {
  AsyncAnalysisTask,
  AnalyzerOutput,
  AnalysisTaskType,
  PatternDetectionResult,
  DetectedPattern,
} from "../types";
import type {
  ProactiveInsight,
  SuggestedAction,
} from "../../proactive-briefing";

/**
 * 模式检测分析器
 *
 * 检测以下模式：
 * 1. 时间模式 - 特定时间段的收藏习惯
 * 2. 主题变化 - 关注点转移
 * 3. 收藏高峰 - 短期内大量收藏
 * 4. 沉寂主题 - 长时间未更新的主题
 * 5. 冲突/互补内容 - 观点冲突或互补的内容
 */
export class PatternDetectionAnalyzer extends BaseAnalyzer {
  readonly type: AnalysisTaskType = "pattern_detection";

  protected async doAnalyze(task: AsyncAnalysisTask): Promise<AnalyzerOutput> {
    const { userId } = task;

    // 获取用户收藏历史
    const history = await this.fetchCollectionHistory(userId);

    if (history.length === 0) {
      return this.createEmptyResult({ patterns: [] });
    }

    const patterns: DetectedPattern[] = [];

    // 检测各类模式
    patterns.push(...this.detectTimePatterns(history));
    patterns.push(...this.detectTopicShifts(history));
    patterns.push(...this.detectCollectionSpikes(history));
    patterns.push(...this.detectDormantTopics(history));

    // 按置信度排序
    patterns.sort((a, b) => b.confidence - a.confidence);

    const result: PatternDetectionResult = {
      patterns,
      detectedAt: new Date().toISOString(),
    };

    return {
      data: result,
      insights: this.generateInsights(patterns),
      suggestedActions: this.generateSuggestedActions(patterns),
    };
  }

  /**
   * 获取收藏历史
   */
  private async fetchCollectionHistory(
    userId: string,
  ): Promise<CollectionHistoryItem[]> {
    logger.debug(
      { module: "AsyncAnalysis", userId },
      "Fetching collection history for pattern detection",
    );

    // 模拟数据，实际实现从数据库获取
    return [];
  }

  /**
   * 检测时间模式
   */
  private detectTimePatterns(
    history: CollectionHistoryItem[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 按星期几分组
    const dayOfWeekCounts = new Map<number, number>();
    for (const item of history) {
      const dayOfWeek = new Date(item.createdAt).getDay();
      dayOfWeekCounts.set(dayOfWeek, (dayOfWeekCounts.get(dayOfWeek) ?? 0) + 1);
    }

    // 找出高频日
    const avgCount = history.length / 7;
    const threshold = avgCount * 1.5;

    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    for (const [day, count] of dayOfWeekCounts) {
      if (
        count > threshold &&
        count >= PATTERN_DETECTION_THRESHOLDS.MIN_PATTERN_OCCURRENCES
      ) {
        patterns.push({
          id: `pattern_day_${day}_${Date.now()}`,
          type: "time_based",
          description: `您通常在${dayNames[day]}收藏较多内容`,
          bookmarkIds: history
            .filter((h) => new Date(h.createdAt).getDay() === day)
            .map((h) => h.id),
          confidence: Math.min(count / (avgCount * 2), 1),
          metadata: { dayOfWeek: day, count },
        });
      }
    }

    // 按小时分组（工作时间 vs 休息时间）
    const hourCounts = { work: 0, rest: 0 };
    for (const item of history) {
      const hour = new Date(item.createdAt).getHours();
      if (hour >= 9 && hour < 18) {
        hourCounts.work++;
      } else {
        hourCounts.rest++;
      }
    }

    const total = hourCounts.work + hourCounts.rest;
    if (total > 0) {
      const workRatio = hourCounts.work / total;
      if (workRatio > 0.7) {
        patterns.push({
          id: `pattern_work_hours_${Date.now()}`,
          type: "time_based",
          description: "您主要在工作时间收藏内容",
          bookmarkIds: [],
          confidence: workRatio,
          metadata: { workRatio },
        });
      } else if (workRatio < 0.3) {
        patterns.push({
          id: `pattern_rest_hours_${Date.now()}`,
          type: "time_based",
          description: "您主要在休息时间收藏内容",
          bookmarkIds: [],
          confidence: 1 - workRatio,
          metadata: { restRatio: 1 - workRatio },
        });
      }
    }

    return patterns;
  }

  /**
   * 检测主题变化
   */
  private detectTopicShifts(
    history: CollectionHistoryItem[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    if (history.length < 10) {
      return patterns;
    }

    // 按时间排序
    const sorted = [...history].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // 分为前半部分和后半部分
    const midPoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midPoint);
    const secondHalf = sorted.slice(midPoint);

    // 统计标签频率
    const firstTags = this.countTags(firstHalf);
    const secondTags = this.countTags(secondHalf);

    // 找出新增的热门标签
    for (const [tag, count] of secondTags) {
      const prevCount = firstTags.get(tag) ?? 0;
      if (count >= 3 && count > prevCount * 2) {
        patterns.push({
          id: `pattern_shift_${tag}_${Date.now()}`,
          type: "topic_shift",
          description: `您最近开始关注「${tag}」领域`,
          bookmarkIds: secondHalf
            .filter((h) => h.tags.includes(tag))
            .map((h) => h.id),
          confidence: Math.min((count - prevCount) / count, 0.9),
          metadata: { newTopic: tag, growth: count - prevCount },
        });
      }
    }

    // 找出减少的标签
    for (const [tag, count] of firstTags) {
      const currCount = secondTags.get(tag) ?? 0;
      if (count >= 3 && currCount < count * 0.3) {
        patterns.push({
          id: `pattern_decline_${tag}_${Date.now()}`,
          type: "dormant_topic",
          description: `您对「${tag}」的关注度下降`,
          bookmarkIds: firstHalf
            .filter((h) => h.tags.includes(tag))
            .map((h) => h.id),
          confidence: Math.min((count - currCount) / count, 0.8),
          metadata: { topic: tag, decline: count - currCount },
        });
      }
    }

    return patterns;
  }

  /**
   * 检测收藏高峰
   */
  private detectCollectionSpikes(
    history: CollectionHistoryItem[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // 按天分组
    const dailyCounts = new Map<string, CollectionHistoryItem[]>();
    for (const item of history) {
      const dateKey = new Date(item.createdAt).toISOString().slice(0, 10);
      const existing = dailyCounts.get(dateKey) ?? [];
      existing.push(item);
      dailyCounts.set(dateKey, existing);
    }

    if (dailyCounts.size < 7) {
      return patterns;
    }

    // 计算平均值
    const counts = Array.from(dailyCounts.values()).map(
      (items) => items.length,
    );
    const avgDaily = counts.reduce((a, b) => a + b, 0) / counts.length;
    const threshold =
      avgDaily * PATTERN_DETECTION_THRESHOLDS.SPIKE_THRESHOLD_MULTIPLIER;

    // 找出高峰日
    for (const [date, items] of dailyCounts) {
      if (items.length > threshold && items.length >= 5) {
        patterns.push({
          id: `pattern_spike_${date}_${Date.now()}`,
          type: "collection_spike",
          description: `${date} 您收藏了 ${items.length} 条内容（平均 ${avgDaily.toFixed(1)} 条/天）`,
          bookmarkIds: items.map((i) => i.id),
          confidence: Math.min(items.length / (avgDaily * 3), 1),
          metadata: { date, count: items.length, avgDaily },
        });
      }
    }

    return patterns;
  }

  /**
   * 检测沉寂主题
   */
  private detectDormantTopics(
    history: CollectionHistoryItem[],
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    const now = Date.now();
    const dormantThresholdMs =
      PATTERN_DETECTION_THRESHOLDS.DORMANT_TOPIC_DAYS * 24 * 60 * 60 * 1000;

    // 按标签分组，找出最后更新时间
    const tagLastUpdate = new Map<
      string,
      { lastUpdate: number; items: CollectionHistoryItem[] }
    >();

    for (const item of history) {
      const itemTime = new Date(item.createdAt).getTime();
      for (const tag of item.tags) {
        const existing = tagLastUpdate.get(tag);
        if (!existing) {
          tagLastUpdate.set(tag, { lastUpdate: itemTime, items: [item] });
        } else {
          existing.items.push(item);
          if (itemTime > existing.lastUpdate) {
            existing.lastUpdate = itemTime;
          }
        }
      }
    }

    // 找出沉寂的主题
    for (const [tag, data] of tagLastUpdate) {
      if (
        data.items.length >= 3 &&
        now - data.lastUpdate > dormantThresholdMs
      ) {
        const daysSinceUpdate = Math.floor(
          (now - data.lastUpdate) / (24 * 60 * 60 * 1000),
        );
        patterns.push({
          id: `pattern_dormant_${tag}_${Date.now()}`,
          type: "dormant_topic",
          description: `「${tag}」已有 ${daysSinceUpdate} 天未更新`,
          bookmarkIds: data.items.map((i) => i.id),
          confidence: Math.min(daysSinceUpdate / 60, 0.9),
          metadata: {
            topic: tag,
            daysSinceUpdate,
            itemCount: data.items.length,
          },
        });
      }
    }

    return patterns;
  }

  /**
   * 统计标签频率
   */
  private countTags(items: CollectionHistoryItem[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }

  /**
   * 生成洞察
   */
  private generateInsights(patterns: DetectedPattern[]): ProactiveInsight[] {
    const insights: ProactiveInsight[] = [];
    const now = new Date().toISOString();

    // 主题变化洞察
    const topicShifts = patterns.filter((p) => p.type === "topic_shift");
    if (topicShifts.length > 0) {
      const topics = topicShifts.map(
        (p) => (p.metadata as { newTopic: string }).newTopic,
      );
      insights.push({
        id: `insight_topic_shift_${Date.now()}`,
        type: "pattern_detected",
        title: "发现关注点转移",
        summary: `您最近开始关注：${topics.join("、")}`,
        priority: 6,
        relatedBookmarkIds: topicShifts.flatMap((p) => p.bookmarkIds),
        createdAt: now,
        isRead: false,
      });
    }

    // 沉寂主题洞察
    const dormantTopics = patterns.filter((p) => p.type === "dormant_topic");
    if (dormantTopics.length > 0) {
      insights.push({
        id: `insight_dormant_${Date.now()}`,
        type: "recommendation",
        title: "有些主题已沉寂",
        summary: `${dormantTopics.length} 个主题长时间未更新，是否需要回顾或归档？`,
        priority: 4,
        relatedBookmarkIds: dormantTopics
          .flatMap((p) => p.bookmarkIds)
          .slice(0, 10),
        createdAt: now,
        isRead: false,
      });
    }

    return insights;
  }

  /**
   * 生成建议操作
   */
  private generateSuggestedActions(
    patterns: DetectedPattern[],
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // 新兴主题深入学习建议
    const topicShift = patterns.find((p) => p.type === "topic_shift");
    if (topicShift) {
      const newTopic = (topicShift.metadata as { newTopic: string }).newTopic;
      actions.push({
        id: `action_learn_${Date.now()}`,
        type: "start_learning",
        label: `深入学习「${newTopic}」`,
        description: "生成学习路径和相关推荐",
        affectedCount: topicShift.bookmarkIds.length,
        executeParams: {
          skillId: "learning_path",
          topic: newTopic,
          bookmarkIds: topicShift.bookmarkIds,
        },
      });
    }

    // 沉寂主题回顾建议
    const dormant = patterns.find((p) => p.type === "dormant_topic");
    if (dormant) {
      actions.push({
        id: `action_review_dormant_${Date.now()}`,
        type: "review_unread",
        label: "回顾沉寂内容",
        description: "复习一下之前收藏的内容",
        affectedCount: dormant.bookmarkIds.length,
        executeParams: {
          skillId: "knowledge_review",
          bookmarkIds: dormant.bookmarkIds,
        },
      });
    }

    return actions;
  }
}

/**
 * 收藏历史项
 */
interface CollectionHistoryItem {
  id: number;
  title: string;
  tags: string[];
  createdAt: string;
  platform?: string;
}
