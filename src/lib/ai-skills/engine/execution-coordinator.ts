/**
 * ExecutionCoordinator - 执行协调模块（精简版）
 *
 * 职责：
 * - 协调原子模式和编排模式的执行
 * - 管理执行模式切换与自动回退
 *
 * @version 2.1.0
 * @since 2025-12-26
 * @updated 2026-01-11 - 迁移核心类型到 shared/types
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
import type { OrchestrationStreamChunk } from "../orchestration/types";
import type { AtomicFallbackHandler } from "./atomic-fallback";
import {
  createAtomicFallbackHandler,
  classifyError,
  type AtomicFallbackConfig,
} from "./atomic-fallback";
import { aiMetrics } from "@/lib/ai-agent/metrics";

// 从共享类型导入
import type { ExecutionMode } from "@/lib/shared/types";

// 重新导出以保持向后兼容
export type { ExecutionMode };

// ============================================
// 类型定义
// ============================================

/** Agent 执行选项（透传到原子执行器） */
export interface AgentExecutionOptions {
  /** 最大工具调用轮数 */
  maxToolRounds?: number;
  /** 温度参数 */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
}

/** 原子引擎执行函数类型 */
export type AtomicExecutor = (
  input: string,
  context: AgentContext,
  options?: AgentExecutionOptions,
) => AsyncGenerator<AgentStreamChunk>;

// 注意: ExecutionMode 已从 @/lib/shared/types 导入

/** 执行选项 */
export interface ExecuteOptions {
  mode: ExecutionMode;
  skillId?: string;
  reason?: string;
  enableFallback?: boolean;
  /** 原子执行器选项（maxToolRounds, temperature 等） */
  agentOptions?: AgentExecutionOptions;
  /** 是否使用 ReAct 循环（由 ModeSelector 决定）[P2-9 新增] */
  useReact?: boolean;
  /** ReAct 决策理由 [P2-9 新增] */
  reactReason?: string;
  /** 是否为回退执行（P0-4 新增：防止重复执行） */
  isFallback?: boolean;
}

/** ExecutionCoordinator 配置 */
export interface ExecutionCoordinatorConfig {
  includeRoutingInfo?: boolean;
  debug?: boolean;
  reactConfig?: ReactLoopConfig;
  /** 原子执行器降级配置 */
  atomicFallbackConfig?: Partial<AtomicFallbackConfig>;
}

/** @deprecated 使用 ExecuteOptions 替代 */
export type ForceExecutionOptions = ExecuteOptions;

// ============================================
// ExecutionCoordinator 类
// ============================================

export class ExecutionCoordinator {
  private atomicExecutor: AtomicExecutor | null = null;
  private reactExecutor: ReactLoopExecutor | null = null;
  private atomicFallbackHandler: AtomicFallbackHandler;
  private includeRoutingInfo: boolean;

  constructor(
    private orchestrationEngine: OrchestrationEngine,
    private outputAdapter: UnifiedOutputAdapter,
    config: ExecutionCoordinatorConfig = {},
  ) {
    this.includeRoutingInfo = config.includeRoutingInfo ?? false;
    this.atomicFallbackHandler = createAtomicFallbackHandler(
      config.atomicFallbackConfig,
    );

    if (FeatureFlags.ENABLE_REACT_LOOP) {
      this.reactExecutor = new ReactLoopExecutor(config.reactConfig);
      logger.info("ExecutionCoordinator: ReAct loop executor initialized");
    }

    logger.debug(
      { fallbackConfig: this.atomicFallbackHandler.getConfig() },
      "ExecutionCoordinator: Atomic fallback handler initialized",
    );
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
    const {
      mode,
      skillId,
      reason,
      enableFallback = true,
      agentOptions,
      useReact,
      reactReason,
      isFallback = false,
    } = options;

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

    // 分发到对应模式并记录指标
    if (mode === "atomic") {
      aiMetrics.recordAtomicMode();
      // P2-9: 传递 ReAct 决策到原子模式执行器
      // P0-4: 传递 isFallback 标志以防止重复执行
      yield* this.executeAtomicMode(
        input,
        context,
        agentOptions,
        useReact,
        reactReason,
        isFallback,
      );
    } else if (skillId) {
      aiMetrics.recordOrchestrationMode();
      yield* this.executeOrchestrationMode(
        input,
        context,
        skillId,
        enableFallback,
      );
    } else {
      // 编排模式缺少 skillId，回退到原子模式
      aiMetrics.recordAtomicMode();
      aiMetrics.recordFallback();
      logger.warn(
        { mode, skillId },
        "ExecutionCoordinator: Missing skillId, falling back to atomic",
      );
      yield* this.executeAtomicMode(
        input,
        context,
        agentOptions,
        useReact,
        reactReason,
        true, // 明确标记为回退
      );
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

  /**
   * 执行原子模式（带降级）
   *
   * [P2-9 更新]: 使用路由决策的 useReact 标志，而非直接检查 Feature Flag
   * [P0-4 更新]: 添加 isFallback 参数防止重复执行
   *
   * @param input - 用户输入
   * @param context - 执行上下文
   * @param agentOptions - Agent 执行选项
   * @param useReact - 是否使用 ReAct 循环（由 ModeSelector 决定）
   * @param reactReason - ReAct 决策理由
   * @param isFallback - 是否为回退执行（防止重复工具调用）
   */
  private async *executeAtomicMode(
    input: string,
    context: EngineContext,
    agentOptions?: AgentExecutionOptions,
    useReact?: boolean,
    reactReason?: string,
    isFallback = false,
  ): AsyncGenerator<UnifiedStreamChunk> {
    if (!this.atomicExecutor) {
      yield this.outputAdapter.createErrorChunk(
        "Atomic executor not configured",
        "EXECUTOR_NOT_CONFIGURED",
        false,
      );
      return;
    }

    // P0-4: 回退模式下记录日志，避免重复执行
    if (isFallback) {
      logger.info(
        { executedToolIds: Array.from(context.executedToolIds ?? []) },
        "ExecutionCoordinator: Running in fallback mode, skip executed tools",
      );
    }

    const agentContext = this.buildAgentContext(context, isFallback);

    // P2-9: 判断是否使用 ReAct 循环
    // 优先使用路由决策的 useReact，若未提供则回退到 Feature Flag 检查
    const shouldUseReact =
      useReact !== undefined
        ? useReact &&
          FeatureFlags.ENABLE_REACT_LOOP &&
          this.reactExecutor !== null
        : FeatureFlags.ENABLE_REACT_LOOP && this.reactExecutor !== null;

    if (shouldUseReact) {
      logger.debug(
        {
          useReact,
          reactReason,
          traceId: context.traceId,
        },
        "ExecutionCoordinator: Using ReAct loop for atomic execution",
      );
    }

    // 创建带取消检查的执行器包装
    const wrappedExecutor = async (
      execInput: string,
      execContext: AgentContext,
    ): Promise<UnifiedStreamChunk[]> => {
      const chunks: UnifiedStreamChunk[] = [];

      // 验证 atomicExecutor 已初始化
      if (!this.atomicExecutor) {
        throw new Error(
          "AtomicExecutor not initialized. Call registerAtomicExecutor first.",
        );
      }

      try {
        // P2-9: 根据路由决策使用 ReAct 循环模式
        if (shouldUseReact && this.reactExecutor) {
          for await (const chunk of this.reactExecutor.executeWithReact(
            execInput,
            execContext,
            this.atomicExecutor,
          )) {
            // 检查取消
            if (this.isCancelled(context)) {
              throw new CancellationError(this.getCancelReason(context));
            }
            chunks.push(chunk);
          }
        } else {
          // 标准原子模式
          for await (const chunk of this.atomicExecutor(
            execInput,
            execContext,
            agentOptions,
          )) {
            // 检查取消
            if (this.isCancelled(context)) {
              throw new CancellationError(this.getCancelReason(context));
            }
            chunks.push(this.outputAdapter.adaptAtomicChunk(chunk));
          }
        }
      } catch (error) {
        // 处理取消错误
        if (error instanceof CancellationError) {
          chunks.push(
            this.outputAdapter.createErrorChunk(
              error.message,
              "REQUEST_CANCELLED",
              false,
            ),
          );
          return chunks;
        }

        // 分类错误并决定是否重试
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const classification = classifyError(errorMessage);

        logger.warn(
          {
            error: errorMessage,
            category: classification.category,
            isRetryable: classification.isRetryable,
            traceId: context.traceId,
          },
          "ExecutionCoordinator: Atomic execution error",
        );

        // 返回错误块（让 fallback handler 决定是否重试）
        chunks.push(
          this.outputAdapter.createErrorChunk(
            errorMessage,
            "ATOMIC_EXECUTION_ERROR",
            classification.isRetryable,
          ),
        );
      }

      return chunks;
    };

    // 使用 fallback handler 执行（带重试和降级）
    yield* this.atomicFallbackHandler.executeWithRetry(
      async function* (
        execInput: string,
        execContext: AgentContext,
      ): AsyncGenerator<UnifiedStreamChunk> {
        const chunks = await wrappedExecutor(execInput, execContext);
        for (const chunk of chunks) {
          yield chunk;
        }
      },
      input,
      agentContext,
    );
  }

  /**
   * 执行编排模式（带可选回退）
   *
   * [P2-10 更新]: 添加生成器资源清理，防止资源泄漏
   */
  private async *executeOrchestrationMode(
    input: string,
    context: EngineContext,
    skillId: string,
    enableFallback: boolean,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let hasError = false;
    let errorMessage = "";
    // P2-10: 存储生成器引用以便正确清理
    let generator: AsyncGenerator<OrchestrationStreamChunk> | null = null;

    try {
      generator = this.orchestrationEngine.execute(skillId, input, context);

      for await (const chunk of generator) {
        // 检查取消
        if (this.isCancelled(context)) {
          // P2-10: 在返回前清理生成器
          await this.cleanupGenerator(generator);
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
          // P2-10: 在 break 前清理生成器
          await this.cleanupGenerator(generator);
          break;
        }

        yield adaptedChunk;

        if (adaptedChunk.type === "done") {
          return;
        }
      }
    } catch (error) {
      // P2-10: 错误情况下也要清理生成器
      await this.cleanupGenerator(generator);

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
      // 记录回退指标
      aiMetrics.recordFallback();

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
  private buildAgentContext(
    context: EngineContext,
    isFallback = false,
  ): AgentContext {
    // 构建 System Prompt（包含附件上下文和情景记忆）
    let systemPrompt = context.attachmentContext || "";

    // P0-4: 回退模式下添加指令，避免重复执行已执行的工具
    if (
      isFallback &&
      context.executedToolIds &&
      context.executedToolIds.size > 0
    ) {
      const skipToolsPrompt = `
【重要：回退执行模式】
之前的编排执行失败，现在切换到原子模式继续完成用户请求。
已执行的工具（请勿重复调用）：${Array.from(context.executedToolIds).join(", ")}
请专注于完成用户的核心请求，避免重复调用上述工具。
`;
      systemPrompt = systemPrompt
        ? `${skipToolsPrompt}\n\n${systemPrompt}`
        : skipToolsPrompt;

      logger.debug(
        {
          executedToolIds: Array.from(context.executedToolIds),
        },
        "ExecutionCoordinator: Added skip tools instruction for fallback mode",
      );
    }

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

    // 🆕 注入置信度分层信息到 SystemPrompt
    if (context.confidenceLevel && context.responseStrategy) {
      const confidencePrompt = this.buildConfidencePrompt(context);
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${confidencePrompt}`
        : confidencePrompt;
    }

    // 🆕 注入数据上下文到 SystemPrompt
    const dataContextPrompt = this.buildDataContextPrompt(context);
    if (dataContextPrompt) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${dataContextPrompt}`
        : dataContextPrompt;
    }

    return {
      // === 现有映射（保持不变） ===
      userId: context.userId,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      messageHistory: context.messageHistory,
      traceId: context.traceId,
      systemPrompt: systemPrompt || undefined,
      onSearchResults: context.onSearchResults,
      // 意图驱动工具加载（性能优化）
      intentType: context.intentType,
      intentSubType: context.intentSubType,
      intentConfidence: context.intentConfidence,
      // 意图槽位（包含 timeRange 等预提取参数）
      slots: context.slots,

      // === 🆕 新增映射：上下文参数 ===
      folderId: context.folderId,
      totalBookmarks: context.totalBookmarks,
      totalFolders: context.totalFolders,
      folders: context.folders,
      tags: context.tags,

      // === 🆕 新增映射：置信度分层 ===
      responseStrategy: context.responseStrategy,
      confidenceLevel: context.confidenceLevel,
      enhancedConfidence: context.enhancedConfidence,
    };
  }

  /**
   * 🆕 构建置信度 Prompt
   * @param context - 引擎上下文
   * @returns 置信度提示语
   */
  private buildConfidencePrompt(context: EngineContext): string {
    const levelDesc: Record<string, string> = {
      high: "高（≥80%）- 用户意图明确，可直接执行",
      medium: "中（60-79%）- 意图基本明确，执行后简要解释",
      low: "低（<60%）- 意图不明确，需要澄清",
    };

    const strategyDesc: Record<string, string> = {
      silent: "静默执行，完成后简短汇报结果",
      explain: "执行 + 简要解释为什么这样做",
      clarify: "轻量级澄清（选项式，非开放问）",
    };

    const level = context.confidenceLevel || "medium";
    const strategy = context.responseStrategy || "explain";

    return `【AI 执行策略】
- 意图置信度: ${levelDesc[level] || level}
- 建议响应方式: ${strategyDesc[strategy] || strategy}
- 置信度分数: ${(context.enhancedConfidence ?? 0.7).toFixed(2)}`;
  }

  /**
   * 🆕 构建数据上下文 Prompt
   * @param context - 引擎上下文
   * @returns 数据上下文提示语，无内容时返回 null
   */
  private buildDataContextPrompt(context: EngineContext): string | null {
    const parts: string[] = [];

    if (context.folderId !== undefined) {
      const folderName = context.folders?.find(
        (f) => f.id === context.folderId,
      )?.name;
      parts.push(`当前文件夹: ${folderName || `ID:${context.folderId}`}`);
    }

    if (context.totalBookmarks !== undefined) {
      parts.push(`书签总数: ${context.totalBookmarks}`);
    }

    if (context.totalFolders !== undefined) {
      parts.push(`文件夹数: ${context.totalFolders}`);
    }

    if (parts.length === 0) return null;

    return `【用户数据上下文】\n${parts.join(" | ")}`;
  }

  /**
   * 安全清理异步生成器 [P2-10 新增]
   *
   * 确保生成器资源被正确释放，防止资源泄漏
   *
   * @param generator - 需要清理的异步生成器
   */
  private async cleanupGenerator<T>(
    generator: AsyncGenerator<T> | null,
  ): Promise<void> {
    if (generator && typeof generator.return === "function") {
      try {
        await generator.return(undefined as T);
      } catch (err) {
        logger.warn(
          { error: err },
          "ExecutionCoordinator: Generator cleanup failed",
        );
      }
    }
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
