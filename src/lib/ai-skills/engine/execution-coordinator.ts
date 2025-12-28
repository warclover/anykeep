/**
 * ExecutionCoordinator - 执行协调模块
 *
 * 职责：
 * - 协调原子模式和编排模式的执行
 * - 处理强制模式执行
 * - 管理编排模式的自动回退
 * - 集成 ReAct 循环执行器（可选）
 *
 * 从 UnifiedEngine 中拆分，遵循单一职责原则
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-28 - 集成 ReAct 循环执行器
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

/**
 * 原子引擎执行函数类型
 *
 * 用于注入 KnowledgeAgent 的执行函数
 */
export type AtomicExecutor = (
  input: string,
  context: AgentContext,
) => AsyncGenerator<AgentStreamChunk>;

/**
 * ExecutionCoordinator 配置
 */
export interface ExecutionCoordinatorConfig {
  /** 是否在路由信息中包含调试信息 */
  includeRoutingInfo?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** ReAct 循环配置 */
  reactConfig?: ReactLoopConfig;
}

/**
 * 执行模式
 */
export type ExecutionMode = "atomic" | "orchestration";

/**
 * 强制执行选项
 */
export interface ForceExecutionOptions {
  mode: ExecutionMode;
  skillId?: string;
  reason?: string;
}

// ============================================
// ExecutionCoordinator 类
// ============================================

/**
 * 执行协调器
 *
 * 负责协调不同执行模式之间的切换和回退
 */
export class ExecutionCoordinator {
  private atomicExecutor: AtomicExecutor | null = null;
  private reactExecutor: ReactLoopExecutor | null = null;
  private config: Required<Omit<ExecutionCoordinatorConfig, "reactConfig">> & {
    reactConfig?: ReactLoopConfig;
  };

  constructor(
    private orchestrationEngine: OrchestrationEngine,
    private outputAdapter: UnifiedOutputAdapter,
    config: ExecutionCoordinatorConfig = {},
  ) {
    this.config = {
      includeRoutingInfo: false,
      debug: false,
      ...config,
    };

    // 初始化 ReAct 执行器（如果启用）
    if (FeatureFlags.ENABLE_REACT_LOOP) {
      this.reactExecutor = new ReactLoopExecutor(config.reactConfig);
      logger.info("ExecutionCoordinator: ReAct loop executor initialized");
    }
  }

  /**
   * 设置原子模式执行器
   *
   * 用于注入 KnowledgeAgent.executeStream
   */
  setAtomicExecutor(executor: AtomicExecutor): void {
    this.atomicExecutor = executor;
  }

  /**
   * 检查原子执行器是否已配置
   */
  hasAtomicExecutor(): boolean {
    return this.atomicExecutor !== null;
  }

  /**
   * 强制执行指定模式
   *
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @param options - 强制执行选项
   * @yields 统一流式输出块
   */
  async *executeForced(
    input: string,
    context: EngineContext,
    options: ForceExecutionOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const { mode, skillId, reason } = options;

    // 发送路由信息（如果启用）
    if (this.config.includeRoutingInfo) {
      yield this.outputAdapter.createRoutingChunk(
        mode,
        reason || `强制使用${mode === "atomic" ? "原子" : "编排"}模式`,
        skillId || null,
      );
    }

    if (mode === "atomic") {
      yield* this.executeAtomic(input, context);
    } else if (mode === "orchestration" && skillId) {
      yield* this.executeOrchestration(skillId, input, context);
    } else {
      // 编排模式但没有指定 skillId，回退到原子模式
      logger.warn(
        { mode, skillId },
        "ExecutionCoordinator: Orchestration mode requires skillId, falling back to atomic",
      );
      yield* this.executeAtomic(input, context);
    }
  }

  /**
   * 执行原子模式（使用 KnowledgeAgent）
   *
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @yields 统一流式输出块
   */
  async *executeAtomic(
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

    // 构建 System Prompt（包含附件上下文和情景记忆）
    let systemPrompt = context.attachmentContext || "";

    // 注入情景记忆（如果启用且有内容）
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
          userId: context.userId.slice(0, 8) + "...",
          memoryPromptLength: memoryPrompt.length,
        },
        "ExecutionCoordinator: Injected episodic memory into system prompt",
      );
    }

    // 构建 Agent 上下文
    const agentContext: AgentContext = {
      userId: context.userId,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      messageHistory: context.messageHistory,
      traceId: context.traceId,
      // 将合并后的上下文注入到 systemPrompt
      systemPrompt: systemPrompt || undefined,
      // 传递搜索结果记录回调（用于上下文保持）
      onSearchResults: context.onSearchResults,
    };

    try {
      // 如果启用 ReAct 循环，使用 ReactLoopExecutor
      if (FeatureFlags.ENABLE_REACT_LOOP && this.reactExecutor) {
        logger.debug(
          {
            userId: context.userId?.slice(0, 8),
            traceId: context.traceId,
          },
          "ExecutionCoordinator: Using ReAct loop executor",
        );

        for await (const chunk of this.reactExecutor.executeWithReact(
          input,
          agentContext,
          this.atomicExecutor,
        )) {
          yield chunk;
        }
      } else {
        // 标准原子模式执行
        for await (const chunk of this.atomicExecutor(input, agentContext)) {
          yield this.outputAdapter.adaptAtomicChunk(chunk);
        }
      }
    } catch (error) {
      // 改进的错误日志：包含堆栈信息便于调试
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        traceId: context.traceId,
        userId: context.userId,
      };

      logger.error(
        errorDetails,
        "ExecutionCoordinator: Atomic execution failed",
      );

      yield this.outputAdapter.createErrorChunk(
        error instanceof Error ? error.message : "Atomic execution failed",
        "ATOMIC_EXECUTION_ERROR",
        true,
      );
    }
  }

  /**
   * 执行编排模式
   *
   * @param skillId - Skill ID
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @yields 统一流式输出块
   */
  async *executeOrchestration(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    for await (const chunk of this.orchestrationEngine.execute(
      skillId,
      input,
      context,
    )) {
      yield this.outputAdapter.adaptOrchestrationChunk(chunk);
    }
  }

  /**
   * 执行编排模式（带自动回退到原子模式）
   *
   * 当编排执行失败时，自动切换到原子模式继续处理
   *
   * @param skillId - Skill ID
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @yields 统一流式输出块
   */
  async *executeOrchestrationWithFallback(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let hasError = false;
    let errorMessage = "";

    try {
      for await (const chunk of this.executeOrchestration(
        skillId,
        input,
        context,
      )) {
        // 检查是否有可重试的错误块
        if (chunk.type === "error" && chunk.data.retryable) {
          hasError = true;
          errorMessage = chunk.data.message;
          break;
        }

        yield chunk;

        // 如果已经完成，不需要回退
        if (chunk.type === "done") {
          return;
        }
      }
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : "Unknown error";
    }

    // 如果编排失败，回退到原子模式
    if (hasError) {
      logger.warn(
        {
          skillId,
          error: errorMessage,
          traceId: context.traceId,
        },
        "ExecutionCoordinator: Orchestration failed, falling back to atomic mode",
      );

      yield this.outputAdapter.createFallbackChunk(
        `编排执行异常 (${errorMessage})，切换到原子模式`,
      );

      yield* this.executeAtomic(input, context);
    }
  }

  /**
   * 检查编排引擎是否有指定的 Skill
   */
  hasSkill(skillId: string): boolean {
    return this.orchestrationEngine.hasSkill(skillId);
  }

  /**
   * 获取编排引擎
   */
  getOrchestrationEngine(): OrchestrationEngine {
    return this.orchestrationEngine;
  }

  /**
   * 获取输出适配器
   */
  getOutputAdapter(): UnifiedOutputAdapter {
    return this.outputAdapter;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExecutionCoordinatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 ExecutionCoordinator 实例
 */
export function createExecutionCoordinator(
  orchestrationEngine: OrchestrationEngine,
  outputAdapter: UnifiedOutputAdapter,
  config?: ExecutionCoordinatorConfig,
): ExecutionCoordinator {
  return new ExecutionCoordinator(orchestrationEngine, outputAdapter, config);
}
