/**
 * 工作流推荐器
 *
 * 基于用户数据状态推荐合适的工作流
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { logger } from "@/lib/logger";
import type { DynamicContext } from "@/lib/ai-agent/context/types";
import type { WorkflowRecommendation, RecommendationPriority } from "./types";

/**
 * 推荐规则
 */
interface RecommendationRule {
  id: string;
  workflowId: string;
  workflowName: string;
  condition: (context: DynamicContext) => boolean;
  reason: (context: DynamicContext) => string;
  priority: RecommendationPriority;
  score: number;
}

/**
 * 扩展的动态上下文（包含额外字段）
 */
interface ExtendedDynamicContext extends DynamicContext {
  /** 最近一次健康检查时间 */
  lastHealthCheckAt?: Date;
  /** 复习积压数量 */
  reviewBacklog?: number;
  /** 未分类书签数量 */
  untaggedCount?: number;
}

/**
 * 工作流推荐规则
 */
const RECOMMENDATION_RULES: RecommendationRule[] = [
  // 规则 1：大量未分类书签
  {
    id: "untagged-many",
    workflowId: "smart_intake",
    workflowName: "智能收录",
    condition: (ctx) => {
      const extended = ctx as ExtendedDynamicContext;
      const untaggedCount = extended.untaggedCount ?? 0;
      return untaggedCount > 50;
    },
    reason: (ctx) => {
      const extended = ctx as ExtendedDynamicContext;
      const count = extended.untaggedCount ?? 0;
      return `您有 ${count} 条书签尚未分类，建议运行智能收录`;
    },
    priority: "high",
    score: 90,
  },

  // 规则 2：一周无活动 + 书签较多
  {
    id: "weekly-inactive",
    workflowId: "weekly_organize",
    workflowName: "周度整理",
    condition: (ctx) =>
      ctx.stats.recentWeekCount === 0 && ctx.stats.totalBookmarks > 100,
    reason: () => "本周尚未进行整理，建议运行周度整理工作流",
    priority: "medium",
    score: 75,
  },

  // 规则 3：某主题积累较多
  {
    id: "topic-accumulated",
    workflowId: "topic_deep_dive",
    workflowName: "主题深挖",
    condition: (ctx) => {
      const topFolders = ctx.stats.topFolders || [];
      return topFolders.length > 0 && topFolders[0].count >= 20;
    },
    reason: (ctx) => {
      const topFolder = ctx.stats.topFolders?.[0];
      if (!topFolder) return "您积累了较多收藏，可以开始系统学习";
      return `您在「${topFolder.name}」文件夹下积累了 ${topFolder.count} 条收藏，可以开始系统学习`;
    },
    priority: "low",
    score: 60,
  },

  // 规则 4：超过 30 天未检查链接健康
  {
    id: "link-check-overdue",
    workflowId: "bookmark_health",
    workflowName: "书签健康巡检",
    condition: (ctx) => {
      const extended = ctx as ExtendedDynamicContext;
      const lastCheck = extended.lastHealthCheckAt;
      if (!lastCheck) return ctx.stats.totalBookmarks > 100;
      const daysSinceCheck =
        (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCheck > 30;
    },
    reason: () => "超过 30 天未检查书签健康状况，建议运行巡检",
    priority: "medium",
    score: 70,
  },

  // 规则 5：复习队列积压
  {
    id: "review-backlog",
    workflowId: "spaced_review",
    workflowName: "间隔复习",
    condition: (ctx) => {
      const extended = ctx as ExtendedDynamicContext;
      const reviewBacklog = extended.reviewBacklog ?? 0;
      return reviewBacklog > 10;
    },
    reason: (ctx) => {
      const extended = ctx as ExtendedDynamicContext;
      const backlog = extended.reviewBacklog ?? 0;
      return `您有 ${backlog} 条待复习内容，建议开始复习`;
    },
    priority: "high",
    score: 85,
  },

  // 规则 6：新用户导入后整理
  {
    id: "new-user-onboarding",
    workflowId: "new_user_onboarding",
    workflowName: "新用户整理",
    condition: (ctx) => {
      // 总量较大但最近活动少，可能是刚导入
      return ctx.stats.totalBookmarks > 100 && ctx.stats.recentWeekCount < 5;
    },
    reason: () => "检测到您可能刚导入了大量书签，建议运行整理工作流",
    priority: "medium",
    score: 72,
  },
];

/**
 * 工作流推荐器
 *
 * 基于用户数据状态推荐合适的工作流
 */
export class WorkflowRecommender {
  /**
   * 获取工作流推荐
   *
   * @param context - 动态上下文
   * @param maxRecommendations - 最大推荐数量
   * @returns 推荐列表
   */
  recommend(
    context: DynamicContext,
    maxRecommendations: number = 3,
  ): WorkflowRecommendation[] {
    const recommendations: WorkflowRecommendation[] = [];

    for (const rule of RECOMMENDATION_RULES) {
      try {
        if (rule.condition(context)) {
          recommendations.push({
            workflowId: rule.workflowId,
            workflowName: rule.workflowName,
            reason: rule.reason(context),
            priority: rule.priority,
            score: rule.score,
          });
        }
      } catch (error) {
        logger.warn(
          { ruleId: rule.id, error },
          "WorkflowRecommender: Rule evaluation failed",
        );
      }
    }

    // 按分数降序排列
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, maxRecommendations);
  }

  /**
   * 获取单个最佳推荐
   */
  recommendTop(context: DynamicContext): WorkflowRecommendation | null {
    const recommendations = this.recommend(context, 1);
    return recommendations[0] || null;
  }

  /**
   * 检查是否有高优先级推荐
   */
  hasHighPriorityRecommendation(context: DynamicContext): boolean {
    const recommendations = this.recommend(context, 5);
    return recommendations.some((r) => r.priority === "high");
  }
}

// 单例导出
let recommenderInstance: WorkflowRecommender | null = null;

export function getWorkflowRecommender(): WorkflowRecommender {
  if (!recommenderInstance) {
    recommenderInstance = new WorkflowRecommender();
  }
  return recommenderInstance;
}

/**
 * 便捷函数：获取工作流推荐
 */
export function recommendWorkflows(
  context: DynamicContext,
  maxRecommendations?: number,
): WorkflowRecommendation[] {
  return getWorkflowRecommender().recommend(context, maxRecommendations);
}
