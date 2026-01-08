/**
 * 主题聚类分析器
 *
 * 基于书签内容和标签，自动发现主题聚类
 *
 * @module ai-agent/async-analysis/analyzers
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import { BaseAnalyzer } from "./base-analyzer";
import { TOPIC_CLUSTERING_THRESHOLDS } from "../constants";
import type {
  AsyncAnalysisTask,
  AnalyzerOutput,
  AnalysisTaskType,
  TopicClusteringResult,
  TopicCluster,
} from "../types";
import type {
  ProactiveInsight,
  SuggestedAction,
} from "../../proactive-briefing";

/**
 * 主题聚类分析器
 *
 * 分析用户收藏内容，发现主题聚类：
 * 1. 基于标签的简单聚类
 * 2. 基于向量相似度的语义聚类（需要嵌入向量）
 * 3. 识别新兴主题（最近新增较多的主题）
 */
export class TopicClusteringAnalyzer extends BaseAnalyzer {
  readonly type: AnalysisTaskType = "topic_clustering";

  protected async doAnalyze(task: AsyncAnalysisTask): Promise<AnalyzerOutput> {
    const { userId } = task;

    // 获取用户书签数据
    const bookmarks = await this.fetchUserBookmarks(userId);

    if (bookmarks.length === 0) {
      return this.createEmptyResult({ clusters: [], uncategorized: [] });
    }

    // 执行聚类
    const clusteringResult = await this.performClustering(bookmarks);

    // 生成洞察
    const insights = this.generateInsights(clusteringResult);

    // 生成建议操作
    const suggestedActions = this.generateSuggestedActions(clusteringResult);

    return {
      data: clusteringResult,
      insights,
      suggestedActions,
    };
  }

  /**
   * 获取用户书签
   *
   * P2: 异步分析任务 - 集成 Supabase 数据查询 (配合 ENABLE_ASYNC_ANALYSIS Feature Flag)
   */
  private async fetchUserBookmarks(
    userId: string,
  ): Promise<BookmarkForClustering[]> {
    // 模拟数据获取
    // 实际实现应该从数据库获取
    logger.debug(
      { module: "AsyncAnalysis", userId },
      "Fetching bookmarks for clustering",
    );

    // 返回空数组，实际实现会从数据库获取
    return [];
  }

  /**
   * 执行聚类分析
   */
  private async performClustering(
    bookmarks: BookmarkForClustering[],
  ): Promise<TopicClusteringResult> {
    const clusterMap = new Map<string, BookmarkForClustering[]>();
    const uncategorized: number[] = [];

    // 基于标签的简单聚类
    for (const bookmark of bookmarks) {
      if (bookmark.tags.length === 0) {
        uncategorized.push(bookmark.id);
        continue;
      }

      // 使用第一个标签作为主要聚类依据
      const primaryTag = bookmark.tags[0];
      const existing = clusterMap.get(primaryTag) ?? [];
      existing.push(bookmark);
      clusterMap.set(primaryTag, existing);
    }

    // 转换为聚类结果
    const clusters: TopicCluster[] = [];
    const now = Date.now();
    const emergingThresholdMs =
      TOPIC_CLUSTERING_THRESHOLDS.EMERGING_TOPIC_DAYS * 24 * 60 * 60 * 1000;

    for (const [topic, items] of clusterMap) {
      if (items.length < TOPIC_CLUSTERING_THRESHOLDS.MIN_CLUSTER_SIZE) {
        // 太小的聚类归入未分类
        uncategorized.push(...items.map((b) => b.id));
        continue;
      }

      // 计算新兴主题
      const recentCount = items.filter(
        (b) => now - new Date(b.createdAt).getTime() < emergingThresholdMs,
      ).length;
      const isEmerging =
        recentCount / items.length >
        TOPIC_CLUSTERING_THRESHOLDS.EMERGING_TOPIC_THRESHOLD;

      // 提取关键词（去重所有标签）
      const allTags = items.flatMap((b) => b.tags);
      const keywords = [...new Set(allTags)].slice(0, 5);

      clusters.push({
        id: `cluster_${topic}_${Date.now()}`,
        topic,
        keywords,
        bookmarkIds: items.map((b) => b.id),
        confidence: Math.min(items.length / 10, 1), // 简单置信度计算
        isEmerging,
      });
    }

    // 按大小排序
    clusters.sort((a, b) => b.bookmarkIds.length - a.bookmarkIds.length);

    return {
      clusters,
      uncategorized,
      clusteredAt: new Date().toISOString(),
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(result: TopicClusteringResult): ProactiveInsight[] {
    const insights: ProactiveInsight[] = [];
    const now = new Date().toISOString();

    // 新兴主题洞察
    const emergingTopics = result.clusters.filter((c) => c.isEmerging);
    if (emergingTopics.length > 0) {
      insights.push({
        id: `insight_emerging_${Date.now()}`,
        type: "topic_emergence",
        title: "发现新兴关注点",
        summary: `最近您开始关注 ${emergingTopics.map((t) => t.topic).join("、")} 等主题`,
        priority: 6,
        relatedBookmarkIds: emergingTopics.flatMap((t) => t.bookmarkIds),
        createdAt: now,
        isRead: false,
      });
    }

    // 大型聚类洞察
    const largeCluster = result.clusters.find(
      (c) => c.bookmarkIds.length >= 10,
    );
    if (largeCluster) {
      insights.push({
        id: `insight_large_cluster_${Date.now()}`,
        type: "pattern_detected",
        title: `${largeCluster.topic} 是您的核心关注领域`,
        summary: `您已收藏 ${largeCluster.bookmarkIds.length} 条相关内容，建议进行主题合成`,
        priority: 8,
        relatedBookmarkIds: largeCluster.bookmarkIds,
        createdAt: now,
        isRead: false,
      });
    }

    // 未分类内容洞察
    if (result.uncategorized.length > 5) {
      insights.push({
        id: `insight_uncategorized_${Date.now()}`,
        type: "recommendation",
        title: "有内容需要整理",
        summary: `${result.uncategorized.length} 条收藏尚未分类，建议添加标签`,
        priority: 4,
        relatedBookmarkIds: result.uncategorized.slice(0, 10),
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
    result: TopicClusteringResult,
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // 主题合成建议
    const synthesisCandidate = result.clusters.find(
      (c) => c.bookmarkIds.length >= 5,
    );
    if (synthesisCandidate) {
      actions.push({
        id: `action_synthesis_${Date.now()}`,
        type: "organize_topic",
        label: `合成「${synthesisCandidate.topic}」主题报告`,
        description: `基于 ${synthesisCandidate.bookmarkIds.length} 条收藏生成综合报告`,
        affectedCount: synthesisCandidate.bookmarkIds.length,
        executeParams: {
          skillId: "thematic_synthesis",
          bookmarkIds: synthesisCandidate.bookmarkIds,
          topic: synthesisCandidate.topic,
        },
      });
    }

    // 整理建议
    if (result.uncategorized.length > 0) {
      actions.push({
        id: `action_organize_${Date.now()}`,
        type: "tag_untagged",
        label: "整理未分类收藏",
        description: `快速为 ${result.uncategorized.length} 条内容添加标签`,
        affectedCount: result.uncategorized.length,
        executeParams: {
          skillId: "smart_tagging",
          bookmarkIds: result.uncategorized.slice(0, 20),
        },
      });
    }

    return actions;
  }
}

/**
 * 聚类用书签数据
 */
interface BookmarkForClustering {
  id: number;
  title: string;
  tags: string[];
  createdAt: string;
  embedding?: number[];
}
