/**
 * ExecutionCoordinator - 执行协调模块（精简版）
 *
 * 职责：
 * - 协调原子模式和编排模式的执行
 * - 管理执行模式切换与自动回退
 *
 * @version 2.0.0
 * @since 2025-12-26
 * @updated 2026-01-05 - 精简重构，合并执行入口
 */

import { logger } from "@/lib/logger";
import type { AgentContext, AgentStreamChunk } from "../../ai-agent/core/types";
import type { OrchestrationEngine } from "./orchestration-engine";
import type { UnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk } from "../output/types";
import type { EngineContext } from "./types";
import { buildMemoryPrompt, isEmptyMemoryContext } from "../../ai-agent/memory";
import { FeatureFlags } from "../../ai-agent/config/feature-flags";
import { ReactLoopExecutor, type ReactLoopConfig } from "../../ai-agent/react";
import { CancellationError } from "../orchestration/types";

// ============================================
// 类型定义
// ============================================

/** 原子引擎执行函数类型 */
export type AtomicExecutor = (
  input: string,
  context: AgentContext,
) => AsyncGenerator<AgentStreamChunk>;

/** 执行模式 */
export type ExecutionMode = "atomic" | "orchestration";

/** 执行选项 */
export interface ExecuteOptions {
  mode: ExecutionMode;
  skillId?: string;
  reason?: string;
  enableFallback?: boolean;
}

/** ExecutionCoordinator 配置 */
export interface ExecutionCoordinatorConfig {
  includeRoutingInfo?: boolean;
  debug?: boolean;
  reactConfig?: ReactLoopConfig;
}

/** @deprecated 使用 ExecuteOptions 替代 */
export type ForceExecutionOptions = ExecuteOptions;

// ============================================
// ExecutionCoordinator 类
// ============================================

export class ExecutionCoordinator {
  private atomicExecutor: AtomicExecutor | null = null;
  private reactExecutor: ReactLoopExecutor | null = null;
  private includeRoutingInfo: boolean;

  constructor(
    private orchestrationEngine: OrchestrationEngine,
    private outputAdapter: UnifiedOutputAdapter,
    config: ExecutionCoordinatorConfig = {},
  ) {
    this.includeRoutingInfo = config.includeRoutingInfo ?? false;

    if (FeatureFlags.ENABLE_REACT_LOOP) {
      this.reactExecutor = new ReactLoopExecutor(config.reactConfig);
      logger.info("ExecutionCoordinator: ReAct loop executor initialized");
    }
  }

  /** 设置原子模式执行器 */
  setAtomicExecutor(executor: AtomicExecutor): void {
    this.atomicExecutor = executor;
  }

  /** 检查原子执行器是否已配置 */
  hasAtomicExecutor(): boolean {
    return this.atomicExecutor !== null;
  }

  /**
   * 检查请求是否已取消
   *
   * 支持两种取消方式：
   * - AbortSignal (Web 标准): context.signal?.aborted
   * - CancellationToken (自定义): context.cancellationToken?.isCancelled
   *
   * @param context - 引擎上下文
   * @returns 是否已取消
   */
  private isCancelled(context: EngineContext): boolean {
    return (
      context.signal?.aborted === true ||
      context.cancellationToken?.isCancelled === true
    );
  }

  /**
   * 获取取消原因
   *
   * @param context - 引擎上下文
   * @returns 取消原因（如果有）
   */
  private getCancelReason(context: EngineContext): string {
    if (context.signal?.aborted) {
      // AbortSignal.reason 可能是 DOMException 或字符串
      const reason = context.signal.reason;
      if (reason instanceof Error) {
        return reason.message;
      }
      return reason ? String(reason) : "Request aborted";
    }
    if (context.cancellationToken?.isCancelled) {
      return context.cancellationToken.reason || "Operation cancelled";
    }
    return "Unknown cancellation";
  }

  /**
   * 检查并抛出取消错误
   *
   * @param context - 引擎上下文
   * @throws CancellationError 如果已取消
   */
  private throwIfCancelled(context: EngineContext): void {
    if (this.isCancelled(context)) {
      throw new CancellationError(this.getCancelReason(context));
    }
  }

  /**
   * 统一执行入口
   *
   * @param input - 用户输入 (不允许空字符串)
   * @param context - 引擎上下文 (必需字段: userId, conversationId)
   * @param options - 执行选项
   * @param options.mode - 执行模式: "atomic" | "orchestration"
   * @param options.skillId - 编排模式 Skill ID (mode="orchestration" 时必需)
   * @param options.reason - 模式选择原因 (可选,用于日志和 UI 展示)
   * @param options.enableFallback - 编排失败时是否回退到原子模式 (默认 true)
   *
   * @yields UnifiedStreamChunk - 流式输出块
   *
   * @example
   * ```typescript
   * // 原子模式
   * for await (const chunk of coordinator.execute(input, context, { mode: "atomic" })) {
   *   console.log(chunk);
   * }
   *
   * // 编排模式 (带回退)
   * for await (const chunk of coordinator.execute(input, context, {
   *   mode: "orchestration",
   *   skillId: "knowledge_review",
   *   enableFallback: true
   * })) {
   *   console.log(chunk);
   * }
   *
   * // 支持取消
   * const controller = new AbortController();
   * const context = { userId, signal: controller.signal };
   * setTimeout(() => controller.abort(), 5000); // 5秒后取消
   * for await (const chunk of coordinator.execute(input, context, { mode: "atomic" })) {
   *   console.log(chunk);
   * }
   * ```
   *
   * @note 当 mode="orchestration" 但 skillId 为空时，自动回退到原子模式
   * @note 支持 AbortSignal 和 CancellationToken 两种取消方式
   *
   * @migration
   * 旧方法迁移:
   * - executeForced() → execute({ mode, skillId, enableFallback: false })
   * - executeAtomic() → execute({ mode: "atomic" })
   * - executeOrchestrationWithFallback() → execute({ mode: "orchestration", skillId, enableFallback: true })
   */
  async *execute(
    input: string,
    context: EngineContext,
    options: ExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const { mode, skillId, reason, enableFallback = true } = options;

    // 检查是否已取消
    if (this.isCancelled(context)) {
      yield this.outputAdapter.createErrorChunk(
        this.getCancelReason(context),
        "REQUEST_CANCELLED",
        false,
      );
      return;
    }

    // 发送路由信息
    if (this.includeRoutingInfo) {
      yield this.outputAdapter.createRoutingChunk(
        mode,
        reason || `使用${mode === "atomic" ? "原子" : "编排"}模式`,
        skillId || null,
      );
    }

    // 分发到对应模式
    if (mode === "atomic") {
      yield* this.executeAtomicMode(input, context);
    } else if (skillId) {
      yield* this.executeOrchestrationMode(
        input,
        context,
        skillId,
        enableFallback,
      );
    } else {
      // 编排模式缺少 skillId，回退到原子模式
      logger.warn(
        { mode, skillId },
        "ExecutionCoordinator: Missing skillId, falling back to atomic",
      );
      yield* this.executeAtomicMode(input, context);
    }
  }

  /** 检查是否有指定的 Skill */
  hasSkill(skillId: string): boolean {
    return this.orchestrationEngine.hasSkill(skillId);
  }

  /** 获取编排引擎 */
  getOrchestrationEngine(): OrchestrationEngine {
    return this.orchestrationEngine;
  }

  /** 获取输出适配器 */
  getOutputAdapter(): UnifiedOutputAdapter {
    return this.outputAdapter;
  }

  /** 更新配置 */
  updateConfig(config: Partial<ExecutionCoordinatorConfig>): void {
    if (config.includeRoutingInfo !== undefined) {
      this.includeRoutingInfo = config.includeRoutingInfo;
    }
  }

  // ============================================
  // 兼容层方法 (委托到 execute)
  // ============================================

  /** @deprecated 使用 execute() 替代 */
  async *executeForced(
    input: string,
    context: EngineContext,
    options: { mode: ExecutionMode; skillId?: string; reason?: string },
  ): AsyncGenerator<UnifiedStreamChunk> {
    yield* this.execute(input, context, { ...options, enableFallback: false });
  }

  /** @deprecated 使用 execute({ mode: "atomic" }) 替代 */
  async *executeAtomic(
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    yield* this.executeAtomicMode(input, context);
  }

  /** @deprecated 使用 execute({ mode: "orchestration", enableFallback: true }) 替代 */
  async *executeOrchestrationWithFallback(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    yield* this.execute(input, context, {
      mode: "orchestration",
      skillId,
      enableFallback: true,
    });
  }

  // ============================================
  // 私有方法
  // ============================================

  /** 执行原子模式 */
  private async *executeAtomicMode(
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    if (!this.atomicExecutor) {
      yield this.outputAdapter.createErrorChunk(
        "Atomic executor not configured",
        "EXECUTOR_NOT_CONFIGURED",
        false,
      );
      return;
    }

    const agentContext = this.buildAgentContext(context);

    try {
      // ReAct 循环模式
      if (FeatureFlags.ENABLE_REACT_LOOP && this.reactExecutor) {
        for await (const chunk of this.reactExecutor.executeWithReact(
          input,
          agentContext,
          this.atomicExecutor,
        )) {
          // 检查取消
          if (this.isCancelled(context)) {
            yield this.outputAdapter.createErrorChunk(
              this.getCancelReason(context),
              "REQUEST_CANCELLED",
              false,
            );
            return;
          }
          yield chunk;
        }
      } else {
        // 标准原子模式
        for await (const chunk of this.atomicExecutor(input, agentContext)) {
          // 检查取消
          if (this.isCancelled(context)) {
            yield this.outputAdapter.createErrorChunk(
              this.getCancelReason(context),
              "REQUEST_CANCELLED",
              false,
            );
            return;
          }
          yield this.outputAdapter.adaptAtomicChunk(chunk);
        }
      }
    } catch (error) {
      // 处理取消错误
      if (error instanceof CancellationError) {
        yield this.outputAdapter.createErrorChunk(
          error.message,
          "REQUEST_CANCELLED",
          false,
        );
        return;
      }

      logger.error(
        {
          message: error instanceof Error ? error.message : String(error),
          traceId: context.traceId,
        },
        "ExecutionCoordinator: Atomic execution failed",
      );

      yield this.outputAdapter.createErrorChunk(
        error instanceof Error ? error.message : "Atomic execution failed",
        "ATOMIC_EXECUTION_ERROR",
        true,
      );
    }
  }

  /** 执行编排模式（带可选回退） */
  private async *executeOrchestrationMode(
    input: string,
    context: EngineContext,
    skillId: string,
    enableFallback: boolean,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let hasError = false;
    let errorMessage = "";

    try {
      for await (const chunk of this.orchestrationEngine.execute(
        skillId,
        input,
        context,
      )) {
        // 检查取消
        if (this.isCancelled(context)) {
          yield this.outputAdapter.createErrorChunk(
            this.getCancelReason(context),
            "REQUEST_CANCELLED",
            false,
          );
          return;
        }

        const adaptedChunk = this.outputAdapter.adaptOrchestrationChunk(chunk);

        // 检查可重试错误
        if (adaptedChunk.type === "error" && adaptedChunk.data.retryable) {
          hasError = true;
          errorMessage = adaptedChunk.data.message;
          break;
        }

        yield adaptedChunk;

        if (adaptedChunk.type === "done") {
          return;
        }
      }
    } catch (error) {
      // 处理取消错误
      if (error instanceof CancellationError) {
        yield this.outputAdapter.createErrorChunk(
          error.message,
          "REQUEST_CANCELLED",
          false,
        );
        return;
      }

      hasError = true;
      errorMessage = error instanceof Error ? error.message : "Unknown error";
    }

    // 回退到原子模式
    if (hasError && enableFallback) {
      logger.warn(
        { skillId, error: errorMessage, traceId: context.traceId },
        "ExecutionCoordinator: Orchestration failed, falling back to atomic",
      );

      yield this.outputAdapter.createFallbackChunk(
        `编排执行异常 (${errorMessage})，切换到原子模式`,
      );

      yield* this.executeAtomicMode(input, context);
    }
  }

  /** 构建 Agent 上下文 */
  private buildAgentContext(context: EngineContext): AgentContext {
    // 构建 System Prompt（包含附件上下文和情景记忆）
    let systemPrompt = context.attachmentContext || "";

    // 注入情景记忆
    if (
      FeatureFlags.ENABLE_EPISODIC_MEMORY &&
      FeatureFlags.ENABLE_MEMORY_PROMPT &&
      context.episodicMemory &&
      !isEmptyMemoryContext(context.episodicMemory)
    ) {
      const memoryPrompt = buildMemoryPrompt(context.episodicMemory);
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${memoryPrompt}`
        : memoryPrompt;

      logger.debug(
        {
          userId: context.userId.slice(0, 8),
          memoryPromptLength: memoryPrompt.length,
        },
        "ExecutionCoordinator: Injected episodic memory",
      );
    }

    return {
      userId: context.userId,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      messageHistory: context.messageHistory,
      traceId: context.traceId,
      systemPrompt: systemPrompt || undefined,
      onSearchResults: context.onSearchResults,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

export function createExecutionCoordinator(
  orchestrationEngine: OrchestrationEngine,
  outputAdapter: UnifiedOutputAdapter,
  config?: ExecutionCoordinatorConfig,
): ExecutionCoordinator {
  return new ExecutionCoordinator(orchestrationEngine, outputAdapter, config);
}
