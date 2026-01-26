/**
 * Feedback Loop Service
 * V4.2 学习反馈循环服务
 *
 * @description 管理分类系统的持续学习和自我优化
 * - 收集用户反馈信号
 * - 更新置信度模型
 * - 调整分类参数
 * - 生成优化建议
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { preferenceLearner, type LearningStats } from "./preference-learner";
import { profileUpdater } from "./profile-updater";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 反馈信号类型
 */
export type FeedbackSignal =
  | "confirm"
  | "reject"
  | "modify"
  | "delete"
  | "move"
  | "archive";

/**
 * 反馈数据
 */
export interface FeedbackData {
  userId: string;
  bookmarkId: number;
  signal: FeedbackSignal;
  sourceId?: string;
  originalFolderId?: number;
  newFolderId?: number;
  confidence?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 学习调整建议
 */
export interface LearningAdjustment {
  type: "confidence" | "threshold" | "exclusion" | "source_trust";
  target: string;
  currentValue: number;
  suggestedValue: number;
  reason: string;
  impact: "high" | "medium" | "low";
}

/**
 * 系统健康报告
 */
export interface SystemHealthReport {
  userId: string;
  overallScore: number;
  metrics: {
    classificationAccuracy: number;
    confirmationRate: number;
    fastPathHitRate: number;
    userSatisfaction: number;
  };
  trends: {
    accuracyTrend: "improving" | "stable" | "declining";
    activityTrend: "increasing" | "stable" | "decreasing";
  };
  adjustments: LearningAdjustment[];
  recommendations: string[];
  generatedAt: Date;
}

/**
 * 反馈处理结果
 */
export interface FeedbackResult {
  success: boolean;
  learningApplied: boolean;
  adjustmentsMade: string[];
  message: string;
}

// ============================================================================
// 反馈循环服务
// ============================================================================

/**
 * 学习反馈循环服务
 */
export class FeedbackLoopService {
  // 反馈窗口（用于计算短期趋势）
  private feedbackWindow: Map<string, FeedbackData[]> = new Map();
  private windowSize = 100; // 保留最近 100 条反馈

  /**
   * 处理反馈信号
   */
  async processFeedback(feedback: FeedbackData): Promise<FeedbackResult> {
    const adjustmentsMade: string[] = [];

    try {
      // 1. 记录反馈到窗口
      this.addToWindow(feedback);

      // 2. 转换为学习事件
      const eventType = this.mapSignalToEventType(feedback.signal);
      if (eventType) {
        await preferenceLearner.recordEvent({
          userId: feedback.userId,
          eventType,
          bookmarkId: feedback.bookmarkId,
          sourceId: feedback.sourceId,
          originalFolderId: feedback.originalFolderId,
          newFolderId: feedback.newFolderId,
          confidence: feedback.confidence,
          timestamp: new Date(),
          metadata: feedback.metadata,
        });
        adjustmentsMade.push("学习事件已记录");
      }

      // 3. 更新来源画像
      if (feedback.sourceId) {
        await this.updateSourceFromFeedback(feedback);
        adjustmentsMade.push("来源画像已更新");
      }

      // 4. 检查是否需要动态调整
      const adjustments = await this.checkForAdjustments(feedback.userId);
      if (adjustments.length > 0) {
        for (const adj of adjustments) {
          await this.applyAdjustment(feedback.userId, adj);
          adjustmentsMade.push(`已应用调整: ${adj.type}`);
        }
      }

      // 5. 失效相关缓存
      fastPathCacheManager.invalidateUser(feedback.userId);

      return {
        success: true,
        learningApplied: true,
        adjustmentsMade,
        message: "反馈处理成功",
      };
    } catch (error) {
      logger.error({ error }, "Feedback processing error");
      return {
        success: false,
        learningApplied: false,
        adjustmentsMade,
        message: error instanceof Error ? error.message : "反馈处理失败",
      };
    }
  }

  /**
   * 生成系统健康报告
   */
  async generateHealthReport(userId: string): Promise<SystemHealthReport> {
    // 获取学习统计
    const learningStats = await preferenceLearner.getLearningStats(userId);

    // 获取画像健康状态
    const profileHealth = await profileUpdater.getHealthStatus(userId);

    // 获取缓存统计
    const cacheStats = fastPathCacheManager.getStats();

    // 计算各项指标
    const classificationAccuracy = this.calculateAccuracy(learningStats);
    const confirmationRate = this.calculateConfirmationRate(learningStats);
    const fastPathHitRate = cacheStats.hitRate;
    const userSatisfaction = this.calculateSatisfaction(learningStats);

    // 计算总体分数
    const overallScore = Math.round(
      classificationAccuracy * 0.4 +
        confirmationRate * 0.3 +
        fastPathHitRate * 0.2 +
        userSatisfaction * 0.1,
    );

    // 分析趋势
    const trends = this.analyzeTrends(userId);

    // 生成调整建议
    const adjustments = await this.checkForAdjustments(userId);

    // 生成建议
    const recommendations = this.generateRecommendations(
      learningStats,
      profileHealth,
      adjustments,
    );

    return {
      userId,
      overallScore,
      metrics: {
        classificationAccuracy,
        confirmationRate,
        fastPathHitRate,
        userSatisfaction,
      },
      trends,
      adjustments,
      recommendations,
      generatedAt: new Date(),
    };
  }

  /**
   * 触发周期性学习优化
   */
  async runPeriodicOptimization(userId: string): Promise<void> {
    // 1. 运行画像更新
    await profileUpdater.runFullUpdate(userId);

    // 2. 检查并应用调整
    const adjustments = await this.checkForAdjustments(userId);
    for (const adj of adjustments) {
      if (adj.impact === "high" || adj.impact === "medium") {
        await this.applyAdjustment(userId, adj);
      }
    }

    // 3. 清理过期数据
    await this.cleanupExpiredData(userId);

    // 4. 重建缓存
    await fastPathCacheManager.warmupUserCache(userId);
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 添加反馈到窗口
   */
  private addToWindow(feedback: FeedbackData): void {
    const window = this.feedbackWindow.get(feedback.userId) || [];
    window.push(feedback);
    if (window.length > this.windowSize) {
      window.shift();
    }
    this.feedbackWindow.set(feedback.userId, window);
  }

  /**
   * 映射信号到事件类型
   */
  private mapSignalToEventType(
    signal: FeedbackSignal,
  ):
    | "classification_confirmed"
    | "classification_rejected"
    | "classification_modified"
    | "folder_moved"
    | "bookmark_deleted"
    | null {
    switch (signal) {
      case "confirm":
        return "classification_confirmed";
      case "reject":
        return "classification_rejected";
      case "modify":
        return "classification_modified";
      case "move":
        return "folder_moved";
      case "delete":
        return "bookmark_deleted";
      default:
        return null;
    }
  }

  /**
   * 从反馈更新来源画像
   */
  private async updateSourceFromFeedback(
    feedback: FeedbackData,
  ): Promise<void> {
    if (!feedback.sourceId) return;

    const { userId, sourceId, signal, newFolderId, confidence } = feedback;

    switch (signal) {
      case "confirm":
        // 正反馈：增加可信度
        await sourceProfileService.updateTrustScore(userId, sourceId, 5);
        if (newFolderId) {
          await sourceProfileService.updateOnClassification({
            userId,
            sourceId,
            newFolderId,
            confidence,
          });
        }
        break;

      case "reject":
        // 负反馈：降低可信度
        await sourceProfileService.updateTrustScore(userId, sourceId, -10);
        break;

      case "modify":
        // 修正：适度降低可信度，更新文件夹关联
        await sourceProfileService.updateTrustScore(userId, sourceId, -3);
        if (newFolderId) {
          await sourceProfileService.updateOnClassification({
            userId,
            sourceId,
            newFolderId,
            confidence,
          });
        }
        break;
    }
  }

  /**
   * 检查是否需要调整
   */
  private async checkForAdjustments(
    userId: string,
  ): Promise<LearningAdjustment[]> {
    const adjustments: LearningAdjustment[] = [];
    const window = this.feedbackWindow.get(userId) || [];

    if (window.length < 10) {
      return adjustments; // 数据不足
    }

    // 计算拒绝率
    const rejectCount = window.filter((f) => f.signal === "reject").length;
    const rejectRate = rejectCount / window.length;

    // 如果拒绝率过高，建议提高置信度阈值
    if (rejectRate > 0.3) {
      adjustments.push({
        type: "threshold",
        target: "auto_confirm_threshold",
        currentValue: 80,
        suggestedValue: Math.min(95, 80 + Math.round(rejectRate * 20)),
        reason: `拒绝率 ${Math.round(rejectRate * 100)}% 过高`,
        impact: "high",
      });
    }

    // 如果修改率过高，建议更新来源可信度
    const modifyCount = window.filter((f) => f.signal === "modify").length;
    const modifyRate = modifyCount / window.length;

    if (modifyRate > 0.2) {
      // 找出频繁被修改的来源
      const sourceModifies = new Map<string, number>();
      for (const f of window.filter(
        (f) => f.signal === "modify" && f.sourceId,
      )) {
        const sourceId = f.sourceId;
        if (sourceId) {
          const count = sourceModifies.get(sourceId) || 0;
          sourceModifies.set(sourceId, count + 1);
        }
      }

      for (const [sourceId, count] of sourceModifies.entries()) {
        if (count >= 3) {
          adjustments.push({
            type: "source_trust",
            target: sourceId,
            currentValue: 50,
            suggestedValue: Math.max(30, 50 - count * 5),
            reason: `来源 ${sourceId} 被修改 ${count} 次`,
            impact: "medium",
          });
        }
      }
    }

    return adjustments;
  }

  /**
   * 应用调整
   */
  private async applyAdjustment(
    userId: string,
    adjustment: LearningAdjustment,
  ): Promise<void> {
    switch (adjustment.type) {
      case "source_trust":
        await sourceProfileService.updateTrustScore(
          userId,
          adjustment.target,
          adjustment.suggestedValue - adjustment.currentValue,
        );
        break;

      // 其他调整类型可以通过更新用户设置来实现
      case "threshold":
      case "confidence":
        // 这些调整可以记录到用户偏好中，但不直接修改系统配置
        // 可以作为建议展示给用户
        break;
    }
  }

  /**
   * 计算准确率
   */
  private calculateAccuracy(stats: LearningStats): number {
    const total = stats.confirmations + stats.rejections + stats.modifications;
    if (total === 0) return 70; // 默认值
    return Math.round((stats.confirmations / total) * 100);
  }

  /**
   * 计算确认率
   */
  private calculateConfirmationRate(stats: LearningStats): number {
    if (stats.totalEvents === 0) return 0;
    return Math.round((stats.confirmations / stats.totalEvents) * 100);
  }

  /**
   * 计算用户满意度
   */
  private calculateSatisfaction(stats: LearningStats): number {
    // 基于确认率和修改率计算
    const accuracy = this.calculateAccuracy(stats);
    const modificationPenalty =
      stats.modifications > 0 ? Math.min(20, stats.modifications * 2) : 0;
    return Math.max(0, accuracy - modificationPenalty);
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(userId: string): {
    accuracyTrend: "improving" | "stable" | "declining";
    activityTrend: "increasing" | "stable" | "decreasing";
  } {
    const window = this.feedbackWindow.get(userId) || [];

    if (window.length < 20) {
      return { accuracyTrend: "stable", activityTrend: "stable" };
    }

    // 分析最近 vs 之前的确认率
    const half = Math.floor(window.length / 2);
    const recent = window.slice(-half);
    const previous = window.slice(0, half);

    const recentConfirmRate =
      recent.filter((f) => f.signal === "confirm").length / recent.length;
    const previousConfirmRate =
      previous.filter((f) => f.signal === "confirm").length / previous.length;

    let accuracyTrend: "improving" | "stable" | "declining" = "stable";
    if (recentConfirmRate - previousConfirmRate > 0.1) {
      accuracyTrend = "improving";
    } else if (previousConfirmRate - recentConfirmRate > 0.1) {
      accuracyTrend = "declining";
    }

    // 活跃度趋势（简单使用窗口大小）
    const activityTrend: "increasing" | "stable" | "decreasing" =
      window.length >= this.windowSize * 0.8 ? "increasing" : "stable";

    return { accuracyTrend, activityTrend };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    learningStats: LearningStats,
    profileHealth: { recommendations: string[] },
    adjustments: LearningAdjustment[],
  ): string[] {
    const recommendations: string[] = [];

    // 来自画像健康检查的建议
    recommendations.push(...profileHealth.recommendations);

    // 基于学习统计的建议
    if (learningStats.accuracy < 70) {
      recommendations.push("分类准确率较低，建议检查来源画像配置");
    }

    if (learningStats.rejections > learningStats.confirmations) {
      recommendations.push("拒绝次数较多，建议调整自动确认阈值");
    }

    // 基于调整建议
    for (const adj of adjustments) {
      if (adj.impact === "high") {
        recommendations.push(`建议调整 ${adj.target}: ${adj.reason}`);
      }
    }

    return recommendations.slice(0, 5); // 最多返回 5 条建议
  }

  /**
   * 清理过期数据
   */
  private async cleanupExpiredData(userId: string): Promise<void> {
    const supabase = await createClient();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 30); // 30 天前

    // 清理已处理的确认消息
    await supabase
      .from("pending_confirmations")
      .delete()
      .eq("user_id", userId)
      .neq("status", "pending")
      .lt("updated_at", expiryDate.toISOString());
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const feedbackLoopService = new FeedbackLoopService();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 快捷方法：处理用户反馈
 */
export async function handleUserFeedback(
  feedback: FeedbackData,
): Promise<FeedbackResult> {
  return feedbackLoopService.processFeedback(feedback);
}

/**
 * 快捷方法：获取健康报告
 */
export async function getSystemHealthReport(
  userId: string,
): Promise<SystemHealthReport> {
  return feedbackLoopService.generateHealthReport(userId);
}
