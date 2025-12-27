/**
 * UnifiedEngine - 统一执行引擎
 *
 * 职责：
 * - 作为 AI 能力的统一入口
 * - 协调 InputPreprocessor、ExecutionCoordinator、OutputEnhancer
 * - 管理 Effect Layer（确认、通知、审计）
 * - 提供统一的流式输出
 *
 * 重构版本：将执行逻辑委托给专门的模块，遵循 SOLID 原则
 *
 * @version 3.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import type { IntentRouter, IntentType } from "../router";
import { createIntentRouter } from "../router";
import type { OrchestrationEngine } from "./orchestration-engine";
import { createOrchestrationEngine } from "./orchestration-engine";
import type { UnifiedOutputAdapter } from "../output/adapter";
import { createUnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk } from "../output/types";
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
import { type MemoryManager, createMemoryManager } from "../../ai-memory";
import type { InputPreprocessor } from "./input-preprocessor";
import { createInputPreprocessor } from "./input-preprocessor";
import type { ExecutionCoordinator } from "./execution-coordinator";
import {
  createExecutionCoordinator,
  type AtomicExecutor,
} from "./execution-coordinator";
import type { OutputEnhancer } from "./output-enhancer";
import { createOutputEnhancer } from "./output-enhancer";

/**
 * 统一执行引擎
 *
 * 通过组合 InputPreprocessor、ExecutionCoordinator、OutputEnhancer
 * 实现清晰的关注点分离
 */
export class UnifiedEngine {
  private router: IntentRouter;
  private orchestrationEngine: OrchestrationEngine;
  private outputAdapter: UnifiedOutputAdapter;
  private effectManager: EffectManager;
  private memoryManager: MemoryManager;

  // 重构后的模块
  private inputPreprocessor: InputPreprocessor;
  private executionCoordinator: ExecutionCoordinator;
  private outputEnhancer: OutputEnhancer;

  private config: Required<UnifiedEngineConfig>;
  private effectListenerIds: string[] = [];

  constructor(config: UnifiedEngineConfig = {}) {
    this.config = {
      enabled: true,
      debug: false,
      includeRoutingInfo: false,
      enableMemory: true,
      defaultOptions: {},
      ...config,
    };

    // 初始化核心组件
    this.router = createIntentRouter({ debug: config.debug });
    this.orchestrationEngine = createOrchestrationEngine();
    this.outputAdapter = createUnifiedOutputAdapter({
      includeDebugInfo: config.debug,
    });
    this.effectManager = createEffectManager({
      debug: config.debug,
    });
    this.memoryManager = createMemoryManager({
      enableReferenceResolution: this.config.enableMemory,
      enableAutoRecording: this.config.enableMemory,
    });

    // 初始化重构后的模块
    this.inputPreprocessor = createInputPreprocessor(this.memoryManager);
    this.executionCoordinator = createExecutionCoordinator(
      this.orchestrationEngine,
      this.outputAdapter,
      {
        includeRoutingInfo: this.config.includeRoutingInfo,
        debug: this.config.debug,
      },
    );
    this.outputEnhancer = createOutputEnhancer(
      this.memoryManager,
      this.outputAdapter,
      {
        enableMemory: this.config.enableMemory,
        enableSuggestions: true,
        debug: this.config.debug,
      },
    );

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
    this.executionCoordinator.setAtomicExecutor(executor);
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
   * 重构后的主执行方法，职责更加清晰：
   * 1. InputPreprocessor 处理输入预处理
   * 2. 根据选项决定执行模式
   * 3. ExecutionCoordinator 执行具体模式
   * 4. OutputEnhancer 增强输出
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

    // 1. 输入预处理（指代词解析、记录用户消息）
    const preprocessResult = this.inputPreprocessor.preprocess(
      input,
      context,
      this.config.enableMemory,
    );

    // 发送记忆块（如果有变化）
    if (preprocessResult.memoryChunk) {
      yield preprocessResult.memoryChunk;
    }

    const processedInput = preprocessResult.processedInput;

    // 获取最近的搜索结果（用于上下文保持）
    const lastSearchResults =
      this.config.enableMemory && context.conversationId
        ? this.memoryManager.getLastSearchResults(context.conversationId)
        : undefined;

    // 自动注入搜索结果记录回调和最近搜索结果
    const contextWithCallback: EngineContext = {
      ...context,
      onSearchResults:
        context.onSearchResults ??
        (this.config.enableMemory && context.conversationId
          ? (query: string, resultIds: number[]) => {
              this.memoryManager.recordSearchResults(
                context.conversationId!,
                query,
                resultIds,
              );
            }
          : undefined),
      // 注入最近的搜索结果（用于指代词解析）
      // 优先使用内存中的搜索结果，若无则保留传入的上下文
      lastSearchResults: lastSearchResults
        ? {
            query: lastSearchResults.query,
            resultIds: lastSearchResults.resultIds,
            searchedAt: lastSearchResults.searchedAt,
          }
        : context.lastSearchResults,
    };

    // 2. 如果引擎未启用，直接使用原子模式
    if (!this.config.enabled) {
      yield* this.executionCoordinator.executeAtomic(
        processedInput,
        contextWithCallback,
      );
      return;
    }

    // 3. 处理强制模式
    if (mergedOptions.forceMode === "atomic") {
      yield* this.executeWithEnhancements(
        this.executionCoordinator.executeForced(
          processedInput,
          contextWithCallback,
          {
            mode: "atomic",
            reason: "强制使用原子模式",
          },
        ),
        contextWithCallback,
        "query", // 默认意图类型
      );
      return;
    }

    if (
      mergedOptions.forceMode === "orchestration" &&
      mergedOptions.forceSkill
    ) {
      yield* this.executeWithEnhancements(
        this.executionCoordinator.executeForced(
          processedInput,
          contextWithCallback,
          {
            mode: "orchestration",
            skillId: mergedOptions.forceSkill,
            reason: "强制使用编排模式",
          },
        ),
        contextWithCallback,
        "action", // 编排模式默认意图类型
      );
      return;
    }

    // 4. 正常路由执行
    yield* this.executeRouted(
      processedInput,
      contextWithCallback,
      mergedOptions,
    );
  }

  /**
   * 路由执行
   *
   * 通过 IntentRouter 决定执行模式并执行
   */
  private async *executeRouted(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    try {
      // 路由决策
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

      // 发送路由信息（如果启用）
      if (options.includeRoutingInfo || this.config.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          routeResult.mode,
          routeResult.reason,
          routeResult.suggestedSkill,
          routeResult.intent.type,
          routeResult.complexity.level,
        );
      }

      // 处理 refine 意图：注入搜索结果上下文
      let effectiveContext = context;
      if (routeResult.intent.type === "refine" && context.lastSearchResults) {
        effectiveContext = this.injectRefineContext(context);

        if (this.config.debug) {
          logger.debug(
            {
              intentType: routeResult.intent.type,
              subType: routeResult.intent.subType,
              searchQuery: context.lastSearchResults.query,
              resultCount: context.lastSearchResults.resultIds.length,
            },
            "UnifiedEngine: Refine intent detected, injecting search results context",
          );
        }
      }

      // 根据模式执行（带增强）
      if (
        routeResult.mode === "orchestration" &&
        routeResult.suggestedSkill &&
        this.executionCoordinator.hasSkill(routeResult.suggestedSkill)
      ) {
        // 编排模式
        yield* this.executeWithEnhancements(
          this.executionCoordinator.executeOrchestrationWithFallback(
            routeResult.suggestedSkill,
            input,
            effectiveContext,
          ),
          effectiveContext,
          routeResult.intent.type,
          routeResult.intent.subType,
        );
      } else {
        // 原子模式
        yield* this.executeWithEnhancements(
          this.executionCoordinator.executeAtomic(input, effectiveContext),
          effectiveContext,
          routeResult.intent.type,
          routeResult.intent.subType,
        );
      }
    } catch (error) {
      // 错误处理与回退
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        input: input.substring(0, 100),
        traceId: context.traceId,
      };

      logger.error(errorDetails, "UnifiedEngine: Execution failed");

      yield this.outputAdapter.createFallbackChunk(
        error instanceof Error ? error.message : "Unknown error",
      );

      yield* this.executionCoordinator.executeAtomic(input, context);
    }
  }

  /**
   * 为 refine 意图注入搜索结果上下文
   *
   * 当用户请求筛选/过滤之前的搜索结果时，
   * 将搜索结果信息注入到 System Prompt 中，
   * 让 AI 知道用户要筛选的是哪些内容。
   *
   * @param context - 原始上下文
   * @returns 注入搜索结果上下文后的上下文
   */
  private injectRefineContext(context: EngineContext): EngineContext {
    const { lastSearchResults } = context;

    if (!lastSearchResults || lastSearchResults.resultIds.length === 0) {
      return context;
    }

    // 构建搜索结果上下文提示
    const refineContextPrompt = `
【上下文：用户正在筛选之前的搜索结果】

用户之前搜索了："${lastSearchResults.query}"
搜索到 ${lastSearchResults.resultIds.length} 条结果（书签 ID: ${lastSearchResults.resultIds.slice(0, 10).join(", ")}${lastSearchResults.resultIds.length > 10 ? "..." : ""}）

用户现在想要在这些结果中进一步筛选。请：
1. 优先在这 ${lastSearchResults.resultIds.length} 条搜索结果中进行筛选
2. 如果需要搜索，请使用用户的筛选条件结合原搜索词进行搜索
3. 回答时明确指出筛选后还剩多少条符合条件的结果
`;

    // 注入到 attachmentContext
    const newAttachmentContext = context.attachmentContext
      ? `${context.attachmentContext}\n\n${refineContextPrompt}`
      : refineContextPrompt;

    return {
      ...context,
      attachmentContext: newAttachmentContext,
      // 将搜索结果 ID 作为 bookmarkIds 传递，限制搜索范围
      bookmarkIds: context.bookmarkIds?.length
        ? context.bookmarkIds
        : lastSearchResults.resultIds,
    };
  }

  /**
   * 应用输出增强
   *
   * 统一应用建议注入和记忆记录
   */
  private async *executeWithEnhancements(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    context: EngineContext,
    intentType: string,
    subType?: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    yield* this.outputEnhancer.enhance(
      generator,
      context,
      intentType as IntentType,
      subType,
    );
  }

  // ============================================================
  // 公共 API（保持向后兼容）
  // ============================================================

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
      this.executionCoordinator.updateConfig({ debug: config.debug });
      this.outputEnhancer.updateConfig({ debug: config.debug });
    }

    if (config.enableMemory !== undefined) {
      this.outputEnhancer.updateConfig({ enableMemory: config.enableMemory });
    }

    if (config.includeRoutingInfo !== undefined) {
      this.executionCoordinator.updateConfig({
        includeRoutingInfo: config.includeRoutingInfo,
      });
    }
  }

  /**
   * 检查是否已准备就绪
   */
  isReady(): boolean {
    return this.executionCoordinator.hasAtomicExecutor();
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
   */
  async emitEffect(effect: UnifiedEffect): Promise<void> {
    await this.effectManager.emit(effect);
  }

  /**
   * 请求用户确认
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

  // ============================================================
  // Memory Layer 方法
  // ============================================================

  /**
   * 获取 MemoryManager 实例
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  /**
   * 记录搜索结果到会话记忆
   */
  recordSearchResults(
    conversationId: string,
    query: string,
    resultIds: number[],
  ): void {
    if (!this.config.enableMemory) return;
    this.memoryManager.recordSearchResults(conversationId, query, resultIds);
  }

  /**
   * 记录提及的书签到会话记忆
   */
  recordMentionedBookmarks(
    conversationId: string,
    bookmarks: Array<{ id: number; name: string }>,
  ): void {
    if (!this.config.enableMemory) return;
    this.memoryManager.recordMentionedBookmarks(conversationId, bookmarks);
  }

  /**
   * 记录提及的文件夹到会话记忆
   */
  recordMentionedFolders(
    conversationId: string,
    folders: Array<{ id: number; name: string }>,
  ): void {
    if (!this.config.enableMemory) return;
    this.memoryManager.recordMentionedFolders(conversationId, folders);
  }

  /**
   * 获取会话上下文摘要
   */
  getContextSummary(conversationId: string): string | null {
    if (!this.config.enableMemory) return null;
    return this.memoryManager.generateContextSummary(conversationId);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 移除所有注册的监听器
    for (const listenerId of this.effectListenerIds) {
      this.effectManager.off(listenerId);
    }
    this.effectListenerIds = [];

    // 销毁 MemoryManager
    this.memoryManager.destroy();

    logger.debug("UnifiedEngine: Disposed, all resources cleaned up");
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

// 导出模块类型（供外部使用）
export type { AtomicExecutor } from "./execution-coordinator";
