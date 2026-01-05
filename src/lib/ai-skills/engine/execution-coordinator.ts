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
   * 统一执行入口
   *
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @param options - 执行选项
   */
  async *execute(
    input: string,
    context: EngineContext,
    options: ExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const { mode, skillId, reason, enableFallback = true } = options;

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
          yield chunk;
        }
      } else {
        // 标准原子模式
        for await (const chunk of this.atomicExecutor(input, agentContext)) {
          yield this.outputAdapter.adaptAtomicChunk(chunk);
        }
      }
    } catch (error) {
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
