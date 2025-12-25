/**
 * UnifiedEngine - 统一执行引擎
 *
 * 职责：
 * - 作为 AI 能力的统一入口
 * - 根据意图路由到原子模式或编排模式
 * - 提供统一的流式输出
 * - 处理模式回退
 * - 管理 Effect Layer（确认、通知、审计）
 *
 * @version 2.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { IntentRouter, IntentType } from "../router";
import { createIntentRouter } from "../router";
import type { OrchestrationEngine } from "./orchestration-engine";
import { createOrchestrationEngine } from "./orchestration-engine";
import type { UnifiedOutputAdapter } from "../output/adapter";
import { createUnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk } from "../output/types";
import type { AgentContext, AgentStreamChunk } from "../../ai-agent/core/types";
import type {
  EngineContext,
  EngineExecuteOptions,
  UnifiedEngineConfig,
} from "./types";
import {
  type EffectManager,
  createEffectManager,
  type EffectHandler,
  type UnifiedEffect,
  type EffectType,
  type ConfirmationEffect,
  type NotificationEffect,
  type AuditEffect,
  type ConfirmationServiceResult,
  confirmationService,
  notificationService,
  auditLogService,
} from "../effects";

/**
 * 原子引擎执行函数类型
 *
 * 用于注入 KnowledgeAgent 的执行函数
 */
type AtomicExecutor = (
  input: string,
  context: AgentContext,
) => AsyncGenerator<AgentStreamChunk>;

/**
 * 统一执行引擎
 */
export class UnifiedEngine {
  private router: IntentRouter;
  private orchestrationEngine: OrchestrationEngine;
  private outputAdapter: UnifiedOutputAdapter;
  private effectManager: EffectManager;
  private atomicExecutor: AtomicExecutor | null = null;
  private config: Required<UnifiedEngineConfig>;
  private effectListenerIds: string[] = [];

  constructor(config: UnifiedEngineConfig = {}) {
    this.config = {
      enabled: true,
      debug: false,
      includeRoutingInfo: false,
      defaultOptions: {},
      ...config,
    };

    this.router = createIntentRouter({ debug: config.debug });
    this.orchestrationEngine = createOrchestrationEngine();
    this.outputAdapter = createUnifiedOutputAdapter({
      includeDebugInfo: config.debug,
    });
    this.effectManager = createEffectManager({
      debug: config.debug,
    });

    // 初始化 Effect 处理器
    this.initEffectHandlers();
  }

  /**
   * 初始化 Effect 处理器
   *
   * 将 EffectManager 与 Services 连接起来
   */
  private initEffectHandlers(): void {
    // 监听确认效果并记录日志
    const confirmationListenerId = this.effectManager.on<ConfirmationEffect>(
      "confirmation",
      async (effect) => {
        logger.debug(
          { confirmationId: effect.payload.id },
          "UnifiedEngine: Processing confirmation effect",
        );
        // 确认效果通过通知服务记录，不使用审计日志
        // 因为 AuditAction 不包含 confirmation_requested
      },
    );
    this.effectListenerIds.push(confirmationListenerId);

    // 监听通知效果并转发到 NotificationService
    const notificationListenerId = this.effectManager.on<NotificationEffect>(
      "notification",
      async (effect) => {
        await notificationService.notify({
          level: effect.payload.level,
          title: effect.payload.title,
          message: effect.payload.message,
          autoCloseMs: effect.payload.autoCloseMs,
          userId: effect.context.userId,
        });
      },
    );
    this.effectListenerIds.push(notificationListenerId);

    // 监听审计效果并转发到 AuditLogService
    const auditListenerId = this.effectManager.on<AuditEffect>(
      "audit",
      async (effect) => {
        await auditLogService.log({
          action: effect.payload.action,
          resourceType: effect.payload.resourceType,
          resourceIds: effect.payload.resourceIds,
          changes: effect.payload.changes,
          userId: effect.context.userId,
          source: effect.context.source,
        });
      },
    );
    this.effectListenerIds.push(auditListenerId);
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
   * 注册编排 Skill
   */
  registerOrchestrationSkill(
    skill: Parameters<OrchestrationEngine["register"]>[0],
  ): void {
    this.orchestrationEngine.register(skill);
  }

  /**
   * 执行用户请求
   *
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @param options - 执行选项
   * @yields 统一流式输出块
   */
  async *execute(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions = {},
  ): AsyncGenerator<UnifiedStreamChunk> {
    const mergedOptions = { ...this.config.defaultOptions, ...options };

    // 如果引擎未启用，直接使用原子模式
    if (!this.config.enabled) {
      yield* this.executeAtomic(input, context);
      return;
    }

    // 强制使用指定模式
    if (mergedOptions.forceMode === "atomic") {
      if (mergedOptions.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          "atomic",
          "强制使用原子模式",
          null,
        );
      }
      yield* this.executeAtomic(input, context);
      return;
    }

    if (
      mergedOptions.forceMode === "orchestration" &&
      mergedOptions.forceSkill
    ) {
      if (mergedOptions.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          "orchestration",
          "强制使用编排模式",
          mergedOptions.forceSkill,
        );
      }
      yield* this.executeOrchestration(
        mergedOptions.forceSkill,
        input,
        context,
      );
      return;
    }

    try {
      // 1. 路由决策
      const routeResult = await this.router.route({
        message: input,
        context: {
          userId: context.userId,
          conversationId: context.conversationId,
          bookmarkIds: context.bookmarkIds,
          folderId: context.folderId,
          messageHistory: context.messageHistory,
          totalBookmarks: context.totalBookmarks,
          totalFolders: context.totalFolders,
        },
      });

      // 2. 发送路由信息（如果启用）
      if (mergedOptions.includeRoutingInfo || this.config.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          routeResult.mode,
          routeResult.reason,
          routeResult.suggestedSkill,
          routeResult.intent.type,
          routeResult.complexity.level,
        );
      }

      // 3. 根据模式执行（带跟进建议）
      if (
        routeResult.mode === "orchestration" &&
        routeResult.suggestedSkill &&
        this.orchestrationEngine.hasSkill(routeResult.suggestedSkill)
      ) {
        // 编排模式 - 包装以注入跟进建议
        yield* this.executeWithSuggestions(
          this.executeOrchestrationWithFallback(
            routeResult.suggestedSkill,
            input,
            context,
          ),
          routeResult.intent.type,
          routeResult.intent.subType,
        );
      } else {
        // 原子模式 - 包装以注入跟进建议
        yield* this.executeWithSuggestions(
          this.executeAtomic(input, context),
          routeResult.intent.type,
          routeResult.intent.subType,
        );
      }
    } catch (error) {
      // 改进的错误日志：包含堆栈信息便于调试
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        input: input.substring(0, 100),
        traceId: context.traceId,
        context: {
          userId: context.userId,
          conversationId: context.conversationId,
        },
      };

      logger.error(errorDetails, "UnifiedEngine: Execution failed");

      // 路由或执行失败，回退到原子模式
      yield this.outputAdapter.createFallbackChunk(
        error instanceof Error ? error.message : "Unknown error",
      );

      yield* this.executeAtomic(input, context);
    }
  }

  /**
   * 执行原子模式（使用 KnowledgeAgent）
   */
  private async *executeAtomic(
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

    // 构建 Agent 上下文
    const agentContext: AgentContext = {
      userId: context.userId,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      messageHistory: context.messageHistory,
      traceId: context.traceId,
    };

    try {
      for await (const chunk of this.atomicExecutor(input, agentContext)) {
        yield this.outputAdapter.adaptAtomicChunk(chunk);
      }
    } catch (error) {
      // 改进的错误日志：包含堆栈信息便于调试
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        traceId: context.traceId,
        userId: context.userId,
      };

      logger.error(errorDetails, "UnifiedEngine: Atomic execution failed");

      yield this.outputAdapter.createErrorChunk(
        error instanceof Error ? error.message : "Atomic execution failed",
        "ATOMIC_EXECUTION_ERROR",
        true,
      );
    }
  }

  /**
   * 执行编排模式
   */
  private async *executeOrchestration(
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
   * 执行编排模式（带自动回退）
   */
  private async *executeOrchestrationWithFallback(
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
        // 检查是否有错误块
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
        "UnifiedEngine: Orchestration failed, falling back to atomic mode",
      );

      yield this.outputAdapter.createFallbackChunk(
        `编排执行异常 (${errorMessage})，切换到原子模式`,
      );

      yield* this.executeAtomic(input, context);
    }
  }

  /**
   * 执行流程并在完成前注入跟进建议
   *
   * 在 done chunk 之前发送 suggestions chunk，基于意图类型和子类型
   */
  private async *executeWithSuggestions(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    intentType: IntentType,
    subType?: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let suggestionsEmitted = false;

    for await (const chunk of generator) {
      // 在 done chunk 之前注入 suggestions
      if (chunk.type === "done" && !suggestionsEmitted) {
        // 只有成功完成时才发送建议
        if (chunk.data.success) {
          const suggestionsChunk = this.outputAdapter.createSuggestionsChunk(
            intentType,
            subType,
          );
          // 只有有建议时才发送
          if (
            suggestionsChunk.type === "suggestions" &&
            suggestionsChunk.data.suggestions.length > 0
          ) {
            yield suggestionsChunk;
            suggestionsEmitted = true;
          }
        }
      }

      yield chunk;
    }
  }

  /**
   * 获取路由器
   */
  getRouter(): IntentRouter {
    return this.router;
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
  updateConfig(config: Partial<UnifiedEngineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (config.debug !== undefined) {
      this.router.updateConfig({ debug: config.debug });
      this.outputAdapter.updateConfig({ includeDebugInfo: config.debug });
      this.effectManager.updateConfig({ debug: config.debug });
    }
  }

  /**
   * 检查是否已准备就绪
   */
  isReady(): boolean {
    return this.atomicExecutor !== null;
  }

  /**
   * 获取已注册的编排 Skills
   */
  getRegisteredOrchestrationSkills() {
    return this.orchestrationEngine.getAllSkillMetadata();
  }

  // ============================================================
  // Effect Layer 方法
  // ============================================================

  /**
   * 获取 EffectManager 实例
   */
  getEffectManager(): EffectManager {
    return this.effectManager;
  }

  /**
   * 注册 Effect 监听器
   *
   * @param type - Effect 类型（confirmation/notification/audit/*）
   * @param handler - 处理函数
   * @returns 监听器 ID，用于取消监听
   */
  onEffect<T extends UnifiedEffect = UnifiedEffect>(
    type: EffectType | "*",
    handler: EffectHandler<T>,
  ): string {
    const listenerId = this.effectManager.on(type, handler);
    this.effectListenerIds.push(listenerId);
    return listenerId;
  }

  /**
   * 取消 Effect 监听
   */
  offEffect(listenerId: string): boolean {
    const index = this.effectListenerIds.indexOf(listenerId);
    if (index !== -1) {
      this.effectListenerIds.splice(index, 1);
    }
    return this.effectManager.off(listenerId);
  }

  /**
   * 发送 Effect
   *
   * @param effect - 统一 Effect 对象
   */
  async emitEffect(effect: UnifiedEffect): Promise<void> {
    await this.effectManager.emit(effect);
  }

  /**
   * 请求用户确认
   *
   * 便捷方法，创建确认请求并等待用户响应
   *
   * @param options - 确认选项
   * @returns 确认结果
   */
  async requestConfirmation(options: {
    title: string;
    message: string;
    options: Array<{ id: string; label: string; variant?: string }>;
    userId: string;
    source: "tool" | "skill";
    toolName?: string;
    skillId?: string;
    timeoutMs?: number;
  }): Promise<ConfirmationServiceResult> {
    const pending = confirmationService.createConfirmation({
      title: options.title,
      message: options.message,
      options: options.options,
      userId: options.userId,
      source: options.source,
      toolName: options.toolName,
      skillId: options.skillId,
      timeoutMs: options.timeoutMs,
    });

    return confirmationService.waitForConfirmation(
      pending.id,
      options.timeoutMs,
    );
  }

  /**
   * 响应确认请求
   *
   * @param confirmationId - 确认 ID
   * @param selectedOption - 用户选择的选项 ID
   * @param data - 附加数据
   */
  respondToConfirmation(
    confirmationId: string,
    selectedOption: string,
    data?: unknown,
  ): boolean {
    return confirmationService.respondToConfirmation(
      confirmationId,
      selectedOption,
      data,
    );
  }

  /**
   * 获取 Effect 统计信息
   */
  getEffectStats() {
    return this.effectManager.getStats();
  }

  /**
   * 清理资源
   *
   * 移除所有 Effect 监听器
   */
  dispose(): void {
    // 移除所有注册的监听器
    for (const listenerId of this.effectListenerIds) {
      this.effectManager.off(listenerId);
    }
    this.effectListenerIds = [];

    logger.debug("UnifiedEngine: Disposed, all effect listeners removed");
  }
}

/**
 * 创建统一引擎实例
 */
export function createUnifiedEngine(
  config?: UnifiedEngineConfig,
): UnifiedEngine {
  return new UnifiedEngine(config);
}

/**
 * 默认统一引擎实例
 */
export const unifiedEngine = new UnifiedEngine();
