/**
 * Learning Event Handler
 * V4.2 学习触发事件监听器
 *
 * @description 监听用户行为事件并触发负样本学习
 * - 监听书签移动事件
 * - 监听分类确认/拒绝事件
 * - 监听批量操作事件
 * - 协调 NegativeSampleService 和 PreferenceLearner
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { eventBus, ClassificationEvents, OrganizationEvents } from "@/lib/shared/event-bus";
import type {
  BookmarkClassifiedEvent,
  ClassificationFeedbackEvent,
  FolderProfileUpdatedEvent,
} from "@/lib/shared/event-bus";
import { negativeSampleService } from "./negative-sample.service";
import { preferenceLearner } from "./preference-learner";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 学习事件处理器配置
 */
export interface LearningEventHandlerConfig {
  /** 是否启用负样本学习 */
  enableNegativeSampling: boolean;
  /** 是否启用偏好学习 */
  enablePreferenceLearning: boolean;
  /** 是否在手动模式下学习 */
  learnInManualMode: boolean;
  /** 批量操作最小数量阈值（达到此数量才触发学习） */
  bulkOperationThreshold: number;
}

/**
 * 学习事件统计
 */
export interface LearningEventStats {
  totalEventsProcessed: number;
  negativeSamplesCreated: number;
  preferencesLearned: number;
  errors: number;
  lastEventTime: Date | null;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: LearningEventHandlerConfig = {
  enableNegativeSampling: true,
  enablePreferenceLearning: true,
  learnInManualMode: false,
  bulkOperationThreshold: 3,
};

// ============================================================================
// 事件处理器实现
// ============================================================================

/**
 * 学习事件处理器
 */
class LearningEventHandler {
  private config: LearningEventHandlerConfig;
  private stats: LearningEventStats;
  private isInitialized: boolean = false;
  private unsubscribeFunctions: (() => void)[] = [];

  constructor(config: Partial<LearningEventHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalEventsProcessed: 0,
      negativeSamplesCreated: 0,
      preferencesLearned: 0,
      errors: 0,
      lastEventTime: null,
    };
  }

  /**
   * 初始化事件监听
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn("LearningEventHandler already initialized");
      return;
    }

    // 订阅分类反馈事件
    this.unsubscribeFunctions.push(
      eventBus.on(
        ClassificationEvents.FEEDBACK_RECEIVED as "classification:feedback_received",
        (event) => this.handleClassificationFeedback(event),
      ),
    );

    // 订阅分类完成事件
    this.unsubscribeFunctions.push(
      eventBus.on(
        ClassificationEvents.BOOKMARK_CLASSIFIED as "classification:bookmark_classified",
        (event) => this.handleBookmarkClassified(event),
      ),
    );

    // 订阅文件夹画像更新事件（可能包含移动信息）
    this.unsubscribeFunctions.push(
      eventBus.on(
        OrganizationEvents.PROFILE_UPDATED as "organization:profile_updated",
        (event) => this.handleProfileUpdated(event),
      ),
    );

    this.isInitialized = true;
    logger.info("LearningEventHandler initialized with event subscriptions");
  }

  /**
   * 停止事件监听
   */
  shutdown(): void {
    for (const unsubscribe of this.unsubscribeFunctions) {
      unsubscribe();
    }
    this.unsubscribeFunctions = [];
    this.isInitialized = false;
    logger.info("LearningEventHandler shut down");
  }

  // ============================================================================
  // 事件处理方法
  // ============================================================================

  /**
   * 处理分类反馈事件
   */
  private async handleClassificationFeedback(event: ClassificationFeedbackEvent): Promise<void> {
    this.stats.totalEventsProcessed++;
    this.stats.lastEventTime = new Date();

    try {
      const { userId, bookmarkId, feedbackType, originalFolderId, newFolderId, confidence } = event;

      // 检查是否需要学习
      if (!this.shouldLearn(event)) {
        return;
      }

      // 负样本学习：用户拒绝或修改建议
      if (this.config.enableNegativeSampling && originalFolderId) {
        if (feedbackType === "rejected" || feedbackType === "corrected") {
          // 从拒绝中学习
          const result = await negativeSampleService.learnFromRejection({
            userId,
            bookmarkId,
            rejectedFolderId: originalFolderId,
            // TODO: 获取书签的标签和来源
            bookmarkTags: event.bookmarkTags,
            bookmarkSourceId: event.sourceId,
          });

          this.stats.negativeSamplesCreated += result.exclusionsCreated;
          logger.debug(
            {
              userId,
              bookmarkId,
              rejectedFolderId: originalFolderId,
              exclusionsCreated: result.exclusionsCreated,
            },
            "Learned from classification rejection",
          );
        }
      }

      // 偏好学习：记录用户的正面选择
      if (this.config.enablePreferenceLearning && newFolderId) {
        const eventType =
          feedbackType === "confirmed"
            ? "classification_confirmed"
            : feedbackType === "corrected"
              ? "classification_modified"
              : "classification_rejected";

        await preferenceLearner.recordEvent({
          userId,
          eventType,
          bookmarkId,
          originalFolderId: originalFolderId || undefined,
          newFolderId,
          confidence,
          timestamp: new Date(),
        });

        this.stats.preferencesLearned++;
      }
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, event }, "Failed to handle classification feedback");
    }
  }

  /**
   * 处理书签分类完成事件
   */
  private async handleBookmarkClassified(event: BookmarkClassifiedEvent): Promise<void> {
    this.stats.totalEventsProcessed++;
    this.stats.lastEventTime = new Date();

    try {
      // 对于自动分类，只在特定条件下学习
      // 例如：高置信度分类作为正样本加强
      if (event.confidence >= 0.9 && this.config.enablePreferenceLearning) {
        // 高置信度分类可以加强偏好
        // 但我们不主动学习，等待用户反馈
      }
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, event }, "Failed to handle bookmark classified event");
    }
  }

  /**
   * 处理文件夹画像更新事件
   */
  private async handleProfileUpdated(event: FolderProfileUpdatedEvent): Promise<void> {
    this.stats.totalEventsProcessed++;
    this.stats.lastEventTime = new Date();

    try {
      // 文件夹画像更新可能包含书签移动信息
      // 这里可以做一些统计或触发额外的学习
      const { userId, folderId, updateReason, stats } = event;

      if (updateReason === "bookmark_moved" && stats?.bookmarksAdded) {
        // 书签移入事件，可以学习正样本
        logger.debug(
          {
            userId,
            folderId,
            bookmarksAdded: stats.bookmarksAdded,
          },
          "Profile updated due to bookmark move",
        );
      }
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, event }, "Failed to handle profile updated event");
    }
  }

  // ============================================================================
  // 手动触发学习
  // ============================================================================

  /**
   * 手动触发从移动操作中学习
   */
  async learnFromBookmarkMove(input: {
    userId: string;
    bookmarkId: number;
    sourceFolderId: number;
    targetFolderId: number;
    bookmarkTags?: string[];
    bookmarkSourceId?: string;
    bookmarkEmbedding?: number[];
  }): Promise<{ success: boolean; exclusionsCreated: number }> {
    this.stats.totalEventsProcessed++;
    this.stats.lastEventTime = new Date();

    try {
      if (!this.config.enableNegativeSampling) {
        return { success: true, exclusionsCreated: 0 };
      }

      const result = await negativeSampleService.learnFromMove({
        userId: input.userId,
        bookmarkId: input.bookmarkId,
        sourceFolderId: input.sourceFolderId,
        targetFolderId: input.targetFolderId,
        bookmarkTags: input.bookmarkTags,
        bookmarkSourceId: input.bookmarkSourceId,
        bookmarkEmbedding: input.bookmarkEmbedding,
      });

      this.stats.negativeSamplesCreated += result.exclusionsCreated;

      return { success: true, exclusionsCreated: result.exclusionsCreated };
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, input }, "Failed to learn from bookmark move");
      return { success: false, exclusionsCreated: 0 };
    }
  }

  /**
   * 手动触发从批量移动中学习
   */
  async learnFromBulkMove(input: {
    userId: string;
    bookmarkIds: number[];
    sourceFolderId: number;
    targetFolderId: number;
    commonTags?: string[];
    commonSourceId?: string;
  }): Promise<{ success: boolean; exclusionsCreated: number }> {
    this.stats.totalEventsProcessed++;
    this.stats.lastEventTime = new Date();

    try {
      if (!this.config.enableNegativeSampling) {
        return { success: true, exclusionsCreated: 0 };
      }

      // 批量操作只有达到阈值才学习
      if (input.bookmarkIds.length < this.config.bulkOperationThreshold) {
        return { success: true, exclusionsCreated: 0 };
      }

      let exclusionsCreated = 0;

      // 学习共同特征作为负样本
      if (input.commonTags && input.commonTags.length > 0) {
        const result = await negativeSampleService.createBatchExclusions({
          userId: input.userId,
          folderId: input.sourceFolderId,
          exclusions: input.commonTags.map((tag) => ({
            type: "tag" as const,
            value: tag,
            weight: 0.5, // 批量操作给中等权重
          })),
          createdFrom: "bulk_move",
          originalBookmarkId: input.bookmarkIds[0],
        });
        exclusionsCreated += result.created;
      }

      if (input.commonSourceId) {
        const result = await negativeSampleService.createExclusion({
          userId: input.userId,
          folderId: input.sourceFolderId,
          exclusionType: "source",
          excludedValue: input.commonSourceId,
          weight: 0.6,
          createdFrom: "bulk_move",
          originalBookmarkId: input.bookmarkIds[0],
          expiresInDays: 90,
        });
        if (result) {
          exclusionsCreated++;
        }
      }

      this.stats.negativeSamplesCreated += exclusionsCreated;

      logger.info(
        {
          userId: input.userId,
          bookmarkCount: input.bookmarkIds.length,
          sourceFolderId: input.sourceFolderId,
          exclusionsCreated,
        },
        "Learned from bulk move",
      );

      return { success: true, exclusionsCreated };
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, input }, "Failed to learn from bulk move");
      return { success: false, exclusionsCreated: 0 };
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 检查是否应该学习
   */
  private shouldLearn(event: ClassificationFeedbackEvent): boolean {
    // 手动模式检查
    if (!this.config.learnInManualMode && event.trustMode === "manual") {
      return false;
    }

    return true;
  }

  // ============================================================================
  // 状态和配置管理
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): LearningEventStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalEventsProcessed: 0,
      negativeSamplesCreated: 0,
      preferencesLearned: 0,
      errors: 0,
      lastEventTime: null,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): LearningEventHandlerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LearningEventHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查是否已初始化
   */
  isActive(): boolean {
    return this.isInitialized;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const learningEventHandler = new LearningEventHandler();

// 自动初始化（可以在应用启动时调用）
export function initializeLearningEventHandler(
  config?: Partial<LearningEventHandlerConfig>,
): void {
  if (config) {
    learningEventHandler.updateConfig(config);
  }
  learningEventHandler.initialize();
}

// 关闭（在应用关闭时调用）
export function shutdownLearningEventHandler(): void {
  learningEventHandler.shutdown();
}
