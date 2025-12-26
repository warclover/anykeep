/**
 * 零接管模式流适配器
 *
 * 将任务理解层的输出转换为统一的流式输出块
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import type {
  UnifiedStreamChunk,
  ThinkingChunk,
  UndoAvailableChunk,
  ZeroTakeoverConfirmChunk,
  SmartDefaultsAppliedChunk,
  DoneChunk,
} from "./types";
import type {
  TaskUnderstanding,
  SmartDefault,
  TaskExecutionResult,
} from "@/lib/ai-agent/task-understanding/types";

// ============================================
// 适配器配置
// ============================================

export interface ZeroTakeoverAdapterConfig {
  /** 是否启用思考过程输出 */
  enableThinkingOutput: boolean;
  /** 是否启用智能默认值输出 */
  enableSmartDefaultsOutput: boolean;
  /** 调试模式 */
  debug: boolean;
}

const DEFAULT_CONFIG: ZeroTakeoverAdapterConfig = {
  enableThinkingOutput: true,
  enableSmartDefaultsOutput: true,
  debug: false,
};

// ============================================
// 适配器类
// ============================================

/**
 * 零接管模式流适配器
 *
 * 提供将任务理解层输出转换为流式块的方法
 */
export class ZeroTakeoverAdapter {
  private config: ZeroTakeoverAdapterConfig;

  constructor(config: Partial<ZeroTakeoverAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // 块创建方法
  // ============================================

  /**
   * 创建思考过程块
   */
  createThinkingChunk(
    phase: ThinkingChunk["data"]["phase"],
    content: string,
  ): ThinkingChunk {
    return {
      type: "thinking",
      data: {
        phase,
        content,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * 从任务理解创建思考过程块序列
   */
  *generateThinkingChunks(
    understanding: TaskUnderstanding,
  ): Generator<ThinkingChunk> {
    if (!this.config.enableThinkingOutput) return;

    // 阶段 1：理解用户意图
    yield this.createThinkingChunk(
      "understanding",
      `理解你的需求：${understanding.goal}`,
    );

    // 阶段 2：制定计划
    if (understanding.executionPlan.length > 0) {
      const planSteps = understanding.executionPlan
        .map((step, i) => `${i + 1}. ${step.action}`)
        .join("\n");
      yield this.createThinkingChunk(
        "planning",
        `制定执行计划：\n${planSteps}`,
      );
    }

    // 阶段 3：决策
    if (
      understanding.appliedDefaults &&
      understanding.appliedDefaults.length > 0
    ) {
      const decisions = understanding.appliedDefaults
        .map((d) => `- ${d.field}: ${d.value}`)
        .join("\n");
      yield this.createThinkingChunk(
        "deciding",
        `自动决定以下参数：\n${decisions}`,
      );
    }

    // 阶段 4：执行
    yield this.createThinkingChunk(
      "executing",
      `开始执行，置信度 ${Math.round(understanding.confidence * 100)}%`,
    );
  }

  /**
   * 创建智能默认值应用块
   */
  createSmartDefaultsChunk(
    defaults: SmartDefault[],
    overallConfidence: number,
  ): SmartDefaultsAppliedChunk {
    return {
      type: "smart_defaults_applied",
      data: {
        defaults: defaults.map((d) => ({
          field: d.field,
          value: d.value,
          source: d.source,
          confidence: d.confidence,
          reason: d.reason,
        })),
        overallConfidence,
      },
    };
  }

  /**
   * 创建撤销可用通知块
   */
  createUndoAvailableChunk(
    undoId: string,
    operationType: string,
    summary: string,
    expiresAt: Date,
    affectedCount: number,
  ): UndoAvailableChunk {
    return {
      type: "undo_available",
      data: {
        undoId,
        operationType,
        summary,
        expiresAt: expiresAt.toISOString(),
        affectedCount,
      },
    };
  }

  /**
   * 创建零接管确认请求块
   *
   * 仅用于删除等高风险操作
   */
  createZeroTakeoverConfirmChunk(
    id: string,
    operationType: ZeroTakeoverConfirmChunk["data"]["operationType"],
    title: string,
    message: string,
    affectedBookmarkIds: number[],
    timeout?: number,
  ): ZeroTakeoverConfirmChunk {
    return {
      type: "zero_takeover_confirm",
      data: {
        id,
        operationType,
        title,
        message,
        affectedBookmarkIds,
        timeout,
        defaultAction: "cancel", // 默认取消，避免误删
      },
    };
  }

  /**
   * 创建增强的完成块（包含零接管信息）
   */
  createEnhancedDoneChunk(
    result: TaskExecutionResult,
    understanding?: TaskUnderstanding,
  ): DoneChunk {
    const doneChunk: DoneChunk = {
      type: "done",
      data: {
        success: result.success,
        summary: result.summary,
        durationMs: result.executionTimeMs,
      },
    };

    // 添加撤销信息
    if (result.undoInfo) {
      doneChunk.data.undoInfo = {
        undoId: result.undoInfo.undoId,
        expiresAt: result.undoInfo.expiresAt.toISOString(),
        canUndo: result.canUndo,
      };
    }

    // 添加任务理解信息
    if (understanding || result.understanding) {
      const u = understanding || result.understanding!;
      doneChunk.data.understanding = {
        goal: u.goal,
        reasoning: u.reasoning,
        confidence: u.confidence,
        appliedDefaults: u.appliedDefaults?.map((d) => ({
          field: d.field,
          value: d.value,
          source: d.source,
          reason: d.reason,
        })),
      };
    }

    return doneChunk;
  }

  // ============================================
  // 流转换方法
  // ============================================

  /**
   * 包装执行流，添加零接管模式输出
   *
   * @param understanding - 任务理解结果
   * @param executionStream - 原始执行流
   * @param undoInfo - 撤销信息（执行完成后传入）
   */
  async *wrapExecutionStream(
    understanding: TaskUnderstanding,
    executionStream: AsyncGenerator<UnifiedStreamChunk>,
    onExecutionComplete?: (
      result: TaskExecutionResult,
    ) => { undoId: string; expiresAt: Date; affectedCount: number } | null,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 输出思考过程
    for (const thinkingChunk of this.generateThinkingChunks(understanding)) {
      yield thinkingChunk;
    }

    // 2. 输出智能默认值（如果有）
    if (
      this.config.enableSmartDefaultsOutput &&
      understanding.appliedDefaults &&
      understanding.appliedDefaults.length > 0
    ) {
      yield this.createSmartDefaultsChunk(
        understanding.appliedDefaults,
        understanding.confidence,
      );
    }

    // 3. 检查是否需要确认（仅删除操作）
    if (understanding.requiresConfirmation) {
      const confirmId = `confirm_${Date.now()}`;
      yield this.createZeroTakeoverConfirmChunk(
        confirmId,
        "delete",
        "确认删除",
        understanding.confirmationReason || "此操作不可撤销，确定要继续吗？",
        [], // 从执行计划中提取 bookmark IDs
        30000, // 30 秒超时
      );
      // 等待确认的逻辑应该在调用方处理
      return;
    }

    // 4. 传递执行流
    let lastDoneChunk: DoneChunk | null = null;

    for await (const chunk of executionStream) {
      // 拦截 done 块，稍后增强
      if (chunk.type === "done") {
        lastDoneChunk = chunk as DoneChunk;
        continue;
      }
      yield chunk;
    }

    // 5. 如果有 done 块，增强它
    if (lastDoneChunk) {
      // 构造 TaskExecutionResult
      const result: TaskExecutionResult = {
        success: lastDoneChunk.data.success,
        summary: lastDoneChunk.data.summary || "操作完成",
        canUndo: false,
        executionTimeMs: lastDoneChunk.data.durationMs || 0,
        understanding: understanding,
      };

      // 调用回调获取撤销信息
      if (onExecutionComplete) {
        const undoInfo = onExecutionComplete(result);
        if (undoInfo) {
          result.canUndo = true;
          result.undoInfo = {
            undoId: undoInfo.undoId,
            expiresAt: undoInfo.expiresAt,
          };

          // 输出撤销可用通知
          yield this.createUndoAvailableChunk(
            undoInfo.undoId,
            "operation", // 通用操作类型
            result.summary,
            undoInfo.expiresAt,
            undoInfo.affectedCount,
          );
        }
      }

      // 输出增强的 done 块
      yield this.createEnhancedDoneChunk(result, understanding);
    }
  }

  // ============================================
  // 配置方法
  // ============================================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ZeroTakeoverAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建零接管适配器实例
 */
export function createZeroTakeoverAdapter(
  config?: Partial<ZeroTakeoverAdapterConfig>,
): ZeroTakeoverAdapter {
  return new ZeroTakeoverAdapter(config);
}

// 默认实例
export const zeroTakeoverAdapter = new ZeroTakeoverAdapter();
