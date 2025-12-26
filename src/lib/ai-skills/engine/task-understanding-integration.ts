/**
 * 任务理解层集成
 *
 * 将任务理解层与 UnifiedEngine 集成，提供零接管模式支持
 *
 * 集成方式：
 * - 作为执行流程的前置处理器
 * - 通过 Feature Flag 控制启用
 * - 与现有架构完全兼容
 * - 使用 ZeroTakeoverAdapter 输出统一流格式
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-26 - 集成 ZeroTakeoverAdapter
 */

import { createLogger } from "@/lib/logger";
import { FeatureFlags } from "../../ai-agent/config/feature-flags";
import type { UnifiedStreamChunk } from "../output/types";
import type { ZeroTakeoverAdapter } from "../output/zero-takeover-adapter";
import { createZeroTakeoverAdapter } from "../output/zero-takeover-adapter";
import type { EngineContext } from "./types";
import type {
  TaskUnderstanding,
  TaskContext,
  TaskExecutionResult,
  OperationSnapshot,
} from "../../ai-agent/task-understanding/types";
import type { TaskAnalyzer } from "../../ai-agent/task-understanding/analyzer/task-analyzer";
import type { SmartDefaultsService } from "../../ai-agent/task-understanding/defaults/smart-defaults-service";
import type { PreferenceLearningServiceV2 } from "../../ai-agent/task-understanding/defaults/preference-learning-service-v2";
import type { UndoService } from "../../ai-agent/task-understanding/undo/undo-service";
import type { UnifiedEngine } from "./unified-engine";

const logger = createLogger("TaskUnderstandingIntegration");

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 集成配置
 */
export interface TaskUnderstandingIntegrationConfig {
  /** 任务分析器 */
  taskAnalyzer?: TaskAnalyzer;

  /** 智能默认值服务 */
  smartDefaultsService?: SmartDefaultsService;

  /** 偏好学习服务 */
  preferenceLearningService?: PreferenceLearningServiceV2;

  /** 撤销服务 */
  undoService?: UndoService;

  /** 零接管适配器 */
  zeroTakeoverAdapter?: ZeroTakeoverAdapter;

  /** 是否启用调试 */
  debug?: boolean;
}

/**
 * 增强执行选项
 */
export interface EnhancedExecuteOptions {
  /** 是否启用任务理解 */
  enableTaskUnderstanding?: boolean;

  /** 是否启用思考过程输出 */
  enableThinkingOutput?: boolean;

  /** 是否启用智能默认值输出 */
  enableSmartDefaultsOutput?: boolean;
}

// =============================================================================
// 集成类
// =============================================================================

/**
 * 任务理解层集成
 *
 * 为 UnifiedEngine 添加任务理解能力
 */
export class TaskUnderstandingIntegration {
  private taskAnalyzer?: TaskAnalyzer;
  private smartDefaultsService?: SmartDefaultsService;
  private preferenceLearningService?: PreferenceLearningServiceV2;
  private undoService?: UndoService;
  private zeroTakeoverAdapter: ZeroTakeoverAdapter;
  private debug: boolean;

  constructor(config: TaskUnderstandingIntegrationConfig = {}) {
    this.taskAnalyzer = config.taskAnalyzer;
    this.smartDefaultsService = config.smartDefaultsService;
    this.preferenceLearningService = config.preferenceLearningService;
    this.undoService = config.undoService;
    this.zeroTakeoverAdapter =
      config.zeroTakeoverAdapter ||
      createZeroTakeoverAdapter({
        enableThinkingOutput: true,
        enableSmartDefaultsOutput: true,
        debug: config.debug ?? false,
      });
    this.debug = config.debug ?? false;
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 检查任务理解是否启用
   */
  isEnabled(): boolean {
    return (
      FeatureFlags.ENABLE_TASK_UNDERSTANDING &&
      FeatureFlags.ENABLE_ZERO_TAKEOVER &&
      !!this.taskAnalyzer
    );
  }

  /**
   * 执行带任务理解的请求
   *
   * @param input 用户输入
   * @param context 引擎上下文
   * @param engine 统一引擎实例
   * @param options 执行选项
   */
  async *executeWithUnderstanding(
    input: string,
    context: EngineContext,
    engine: UnifiedEngine,
    options: EnhancedExecuteOptions = {},
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 如果未启用任务理解，直接使用原引擎
    if (!this.isEnabled() || !options.enableTaskUnderstanding) {
      yield* engine.execute(input, context);
      return;
    }

    const startTime = Date.now();

    try {
      // 1. 构建任务上下文
      const taskContext = this.buildTaskContext(input, context);

      // 2. 输出初始思考状态
      yield this.zeroTakeoverAdapter.createThinkingChunk(
        "understanding",
        "正在理解你的需求...",
      );

      // 3. 分析任务
      const understanding = await this.taskAnalyzer!.analyze(
        input,
        taskContext,
      );

      if (this.debug) {
        logger.debug(
          {
            input: input.substring(0, 50),
            goal: understanding.goal,
            confidence: understanding.confidence,
            riskLevel: understanding.riskLevel,
          },
          "任务理解完成",
        );
      }

      // 4. 输出思考过程（使用适配器）
      for (const thinkingChunk of this.zeroTakeoverAdapter.generateThinkingChunks(
        understanding,
      )) {
        yield thinkingChunk;
      }

      // 5. 输出智能默认值
      if (
        understanding.appliedDefaults &&
        understanding.appliedDefaults.length > 0
      ) {
        yield this.zeroTakeoverAdapter.createSmartDefaultsChunk(
          understanding.appliedDefaults,
          understanding.confidence,
        );
      }

      // 6. 检查是否需要确认（仅删除操作）
      if (understanding.requiresConfirmation) {
        const confirmId = `confirm_${Date.now()}`;
        yield this.zeroTakeoverAdapter.createZeroTakeoverConfirmChunk(
          confirmId,
          "delete",
          "确认删除",
          understanding.confirmationReason || "此操作不可撤销，确定要继续吗？",
          taskContext.targetBookmarks?.map((b) => Number(b.id)) || [],
          30000,
        );
        return;
      }

      // 7. 执行任务（通过原引擎）
      let executionSuccess = true;
      let executionSummary = understanding.goal;

      // 使用适配器包装执行流
      const executionStream = engine.execute(input, context);

      // 传递执行流，收集结果
      for await (const chunk of executionStream) {
        if (chunk.type === "done") {
          executionSuccess = chunk.data.success;
          executionSummary = chunk.data.summary || executionSummary;
        }
        yield chunk;
      }

      // 8. 记录撤销信息（异步）
      let undoInfo: { undoId: string; expiresAt: Date } | undefined;
      if (
        FeatureFlags.ENABLE_UNDO_SERVICE &&
        this.undoService &&
        understanding.riskLevel !== "low" &&
        executionSuccess
      ) {
        const operationType = this.mapToOperationType(
          understanding.matchedTemplate,
        );
        if (operationType) {
          const snapshot: OperationSnapshot = {
            bookmarkIds: taskContext.targetBookmarks?.map((b) => b.id) || [],
            data: { understanding },
            snapshotAt: new Date(),
          };

          undoInfo = await this.undoService.recordOperation(
            context.userId,
            understanding.id,
            operationType,
            snapshot,
          );

          // 输出撤销可用通知
          yield this.zeroTakeoverAdapter.createUndoAvailableChunk(
            undoInfo.undoId,
            operationType,
            executionSummary,
            undoInfo.expiresAt,
            snapshot.bookmarkIds.length,
          );
        }
      }

      // 9. 异步学习偏好（不阻塞返回）
      if (
        FeatureFlags.ENABLE_PREFERENCE_LEARNING_V2 &&
        this.preferenceLearningService
      ) {
        const result: TaskExecutionResult = {
          success: executionSuccess,
          summary: executionSummary,
          understanding,
          canUndo: !!undoInfo,
          undoInfo,
          executionTimeMs: Date.now() - startTime,
        };

        this.preferenceLearningService
          .learnFromExecution(context.userId, understanding, result, "accepted")
          .catch((error) => {
            logger.error({ error }, "偏好学习失败");
          });
      }
    } catch (error) {
      logger.error({ input, error }, "任务理解执行失败");

      // 发送错误块
      yield {
        type: "error",
        data: {
          message: error instanceof Error ? error.message : "任务执行失败",
          retryable: true,
        },
      } as UnifiedStreamChunk;

      // 回退到原引擎
      yield* engine.execute(input, context);
    }
  }

  /**
   * 执行撤销操作
   */
  async executeUndo(
    undoId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.undoService) {
      return { success: false, message: "撤销服务未启用" };
    }

    const result = await this.undoService.executeUndo(undoId, userId);

    // 学习撤销行为
    if (result.success && this.preferenceLearningService) {
      // TODO: 获取原始的 understanding 和 result 来学习
      // 这里需要从撤销记录中获取
    }

    return result;
  }

  /**
   * 记录用户调整
   */
  async recordAdjustment(
    userId: string,
    understandingId: string,
    adjustmentContent: string,
  ): Promise<void> {
    // TODO: 实现调整记录和学习
    logger.info({ userId, understandingId, adjustmentContent }, "记录用户调整");
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 构建任务上下文
   */
  private buildTaskContext(input: string, context: EngineContext): TaskContext {
    return {
      userId: context.userId,
      input,
      stats: {
        total: context.totalBookmarks || 0,
        inbox: 0, // TODO: 从上下文获取
        platformDistribution: {},
        weeklyAdded: 0,
      },
      folders:
        context.folders?.map((f) => ({
          id: String(f.id),
          name: f.name,
        })) || [],
      targetBookmarks: context.bookmarkIds?.map((id) => ({
        id: String(id),
        title: "",
        platform: "",
      })),
      recentPlatforms: [],
      frequentTags: context.tags?.slice(0, 10) || [],
      lastTopic: undefined,
    };
  }

  /**
   * 映射到操作类型
   */
  private mapToOperationType(
    taskType?: string,
  ):
    | "move_bookmarks"
    | "batch_tags_add"
    | "batch_tags_remove"
    | "batch_organize"
    | "classify"
    | null {
    if (!taskType) return null;

    const mapping: Record<
      string,
      | "move_bookmarks"
      | "batch_tags_add"
      | "batch_tags_remove"
      | "batch_organize"
      | "classify"
    > = {
      move: "move_bookmarks",
      batch_tags: "batch_tags_add",
      organize: "batch_organize",
      batch_organize: "batch_organize",
      classify: "classify",
    };

    return mapping[taskType] || null;
  }

  /**
   * 异步记录撤销操作（不阻塞主流程）
   */
  private async recordUndoOperation(
    userId: string,
    understanding: TaskUnderstanding,
    taskContext: TaskContext,
  ): Promise<void> {
    if (!this.undoService) return;

    const operationType = this.mapToOperationType(
      understanding.matchedTemplate,
    );
    if (!operationType) return;

    try {
      const snapshot: OperationSnapshot = {
        bookmarkIds: taskContext.targetBookmarks?.map((b) => b.id) || [],
        data: { understanding },
        snapshotAt: new Date(),
      };

      await this.undoService.recordOperation(
        userId,
        understanding.id,
        operationType,
        snapshot,
      );
    } catch (error) {
      logger.error(
        { error, userId, understandingId: understanding.id },
        "记录撤销操作失败",
      );
    }
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建任务理解层集成
 */
export function createTaskUnderstandingIntegration(
  config: TaskUnderstandingIntegrationConfig = {},
): TaskUnderstandingIntegration {
  return new TaskUnderstandingIntegration(config);
}
