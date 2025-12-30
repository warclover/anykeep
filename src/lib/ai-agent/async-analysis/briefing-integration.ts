/**
 * 异步分析与主动简报集成模块
 *
 * 将 AsyncAnalysisService 的分析结果集成到主动简报中
 *
 * @module ai-agent/async-analysis
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import type { AsyncAnalysisService } from "./async-analysis-service";
import { createAsyncAnalysisService } from "./async-analysis-service";
import type {
  ProactiveInsight,
  SuggestedAction,
} from "../proactive-briefing/types";

/**
 * 集成配置
 */
export interface IntegrationConfig {
  /** 是否启用异步分析集成 */
  enabled: boolean;
  /** 最大合并洞察数 */
  maxMergedInsights: number;
  /** 最大合并操作数 */
  maxMergedActions: number;
}

/**
 * 默认集成配置
 */
const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  enabled: true,
  maxMergedInsights: 5,
  maxMergedActions: 3,
};

/**
 * 异步分析与主动简报集成器
 *
 * 负责：
 * 1. 在用户访问时触发延迟分析
 * 2. 将分析结果合并到主动简报
 * 3. 管理分析结果的生命周期
 */
export class AsyncAnalysisBriefingIntegration {
  private analysisService: AsyncAnalysisService;
  private config: IntegrationConfig;

  constructor(
    analysisService?: AsyncAnalysisService,
    config: Partial<IntegrationConfig> = {},
  ) {
    this.analysisService = analysisService ?? createAsyncAnalysisService();
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
  }

  /**
   * 处理用户访问
   *
   * 在用户访问时调用，触发延迟分析
   */
  async handleUserVisit(userId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.analysisService.recordUserVisit(userId);

      logger.debug(
        { module: "AsyncAnalysis", userId },
        "User visit recorded for async analysis",
      );
    } catch (error) {
      logger.error(
        {
          module: "AsyncAnalysis",
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to handle user visit",
      );
    }
  }

  /**
   * 处理新收藏
   *
   * 在用户收藏内容后调用，添加待处理任务
   */
  handleNewCollection(userId: string, bookmarkId: number): void {
    if (!this.config.enabled) {
      return;
    }

    this.analysisService.addPostCollectionTask(userId, bookmarkId);
  }

  /**
   * 获取分析洞察
   *
   * 获取已完成的分析结果中的洞察
   */
  getAnalysisInsights(userId: string): ProactiveInsight[] {
    if (!this.config.enabled) {
      return [];
    }

    const insights: ProactiveInsight[] = [];

    // 收集各类分析结果中的洞察
    const topicResults = this.analysisService.getUserResults(
      userId,
      "topic_clustering",
    );
    const patternResults = this.analysisService.getUserResults(
      userId,
      "pattern_detection",
    );
    const linkResults = this.analysisService.getUserResults(
      userId,
      "link_health_check",
    );

    for (const result of [...topicResults, ...patternResults, ...linkResults]) {
      insights.push(...result.insights);
    }

    // 按重要性排序并限制数量
    return this.sortAndLimitInsights(insights);
  }

  /**
   * 获取分析建议操作
   *
   * 获取已完成的分析结果中的建议操作
   */
  getAnalysisActions(userId: string): SuggestedAction[] {
    if (!this.config.enabled) {
      return [];
    }

    const actions: SuggestedAction[] = [];

    // 收集各类分析结果中的建议操作
    const results = [
      ...this.analysisService.getUserResults(userId, "topic_clustering"),
      ...this.analysisService.getUserResults(userId, "pattern_detection"),
      ...this.analysisService.getUserResults(userId, "link_health_check"),
    ];

    for (const result of results) {
      actions.push(...result.suggestedActions);
    }

    // 按优先级排序并限制数量
    return this.sortAndLimitActions(actions);
  }

  /**
   * 合并分析结果到简报
   *
   * 将异步分析的结果合并到主动简报中
   */
  mergeIntoBriefing(
    userId: string,
    existingInsights: ProactiveInsight[],
    existingActions: SuggestedAction[],
  ): {
    insights: ProactiveInsight[];
    actions: SuggestedAction[];
  } {
    if (!this.config.enabled) {
      return { insights: existingInsights, actions: existingActions };
    }

    const analysisInsights = this.getAnalysisInsights(userId);
    const analysisActions = this.getAnalysisActions(userId);

    // 合并洞察（去重）
    const mergedInsights = this.mergeInsights(
      existingInsights,
      analysisInsights,
    );

    // 合并操作（去重）
    const mergedActions = this.mergeActions(existingActions, analysisActions);

    return {
      insights: mergedInsights.slice(0, this.config.maxMergedInsights),
      actions: mergedActions.slice(0, this.config.maxMergedActions),
    };
  }

  /**
   * 手动触发分析
   */
  async triggerAnalysis(
    userId: string,
    types?: ("topic_clustering" | "pattern_detection" | "link_health_check")[],
  ): Promise<string[]> {
    return this.analysisService.scheduleAnalysis(userId, {
      trigger: "manual",
      priority: "high",
      types,
    });
  }

  /**
   * 获取分析队列统计
   */
  getQueueStats() {
    return this.analysisService.getQueueStats();
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.analysisService.dispose();
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 排序并限制洞察数量
   */
  private sortAndLimitInsights(
    insights: ProactiveInsight[],
  ): ProactiveInsight[] {
    return insights
      .sort((a, b) => {
        // 按优先级排序（高优先级数值大）
        const priorityDiff = b.priority - a.priority;
        if (priorityDiff !== 0) return priorityDiff;

        // 按生成时间排序（新的优先）
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .slice(0, this.config.maxMergedInsights);
  }

  /**
   * 排序并限制操作数量
   */
  private sortAndLimitActions(actions: SuggestedAction[]): SuggestedAction[] {
    // SuggestedAction 没有 priority 字段，按 affectedCount 降序排列
    return actions
      .sort((a, b) => (b.affectedCount ?? 0) - (a.affectedCount ?? 0))
      .slice(0, this.config.maxMergedActions);
  }

  /**
   * 合并洞察（去重）
   */
  private mergeInsights(
    existing: ProactiveInsight[],
    fromAnalysis: ProactiveInsight[],
  ): ProactiveInsight[] {
    const existingIds = new Set(existing.map((i) => i.id));
    const merged = [...existing];

    for (const insight of fromAnalysis) {
      if (!existingIds.has(insight.id)) {
        merged.push(insight);
        existingIds.add(insight.id);
      }
    }

    return merged;
  }

  /**
   * 合并操作（去重）
   */
  private mergeActions(
    existing: SuggestedAction[],
    fromAnalysis: SuggestedAction[],
  ): SuggestedAction[] {
    const existingIds = new Set(existing.map((a) => a.id));
    const merged = [...existing];

    for (const action of fromAnalysis) {
      if (!existingIds.has(action.id)) {
        merged.push(action);
        existingIds.add(action.id);
      }
    }

    return merged;
  }
}

/**
 * 创建集成器实例
 */
export function createAsyncAnalysisBriefingIntegration(
  analysisService?: AsyncAnalysisService,
  config?: Partial<IntegrationConfig>,
): AsyncAnalysisBriefingIntegration {
  return new AsyncAnalysisBriefingIntegration(analysisService, config);
}
