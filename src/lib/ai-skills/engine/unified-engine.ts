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
import {
  type IntentDisambiguator,
  createIntentDisambiguator,
  type IntentMatch,
} from "../router/intent-disambiguator";
import {
  type SpeculativeExecutor,
  createSpeculativeExecutor,
} from "../execution";
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
import {
  createSlowThinkingService,
  type SlowThinkingService,
  type SlowThinkingRouteResult,
  type SlowThinkingDynamicContext,
} from "../../ai-agent/slow-thinking";
import {
  type IntentPredictor,
  createIntentPredictor,
  type PredictedIntent,
  type QuickAction,
} from "../router/intent-predictor";
import {
  type RuleExtractor,
  createRuleExtractor,
} from "../../ai-agent/preferences/rule-learning";
import {
  getWorkflowModeExecutor,
  type WorkflowExecuteResult,
} from "@/lib/workflow/integration";
import { isWorkflowTriggerEnabled } from "../../ai-agent/config/feature-flag-overrides";
import {
  type PersonalizedLearningIntegration,
  createPersonalizedLearningIntegration,
  type ShortcutMatchResult,
} from "../learning";

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
  private slowThinkingService: SlowThinkingService;

  // Phase 3: 智能预测模块
  private intentPredictor: IntentPredictor;
  private ruleExtractor: RuleExtractor;

  // Phase 2: 推测执行与消歧模块
  private speculativeExecutor: SpeculativeExecutor;
  private intentDisambiguator: IntentDisambiguator;

  // Phase 3: 个性化学习模块
  private personalizedLearning: PersonalizedLearningIntegration;

  private config: Required<UnifiedEngineConfig>;
  private effectListenerIds: string[] = [];

  constructor(config: UnifiedEngineConfig = {}) {
    this.config = {
      enabled: true,
      debug: false,
      includeRoutingInfo: false,
      enableMemory: true,
      enablePrediction: true,
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
    this.slowThinkingService = createSlowThinkingService();

    // 初始化智能预测模块（Phase 3）
    this.intentPredictor = createIntentPredictor();
    this.ruleExtractor = createRuleExtractor();

    // 初始化推测执行与消歧模块（Phase 2）
    this.speculativeExecutor = createSpeculativeExecutor({
      debug: config.debug,
    });
    this.intentDisambiguator = createIntentDisambiguator();

    // 初始化个性化学习模块（Phase 3）
    this.personalizedLearning = createPersonalizedLearningIntegration({
      debug: config.debug,
      enableShortcutMatching: true,
      enableFeedbackCollection: true,
      enablePatternDiscovery: true,
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
              // conversationId 已在条件中检查，此处安全使用
              const convId = context.conversationId;
              if (convId) {
                this.memoryManager.recordSearchResults(
                  convId,
                  query,
                  resultIds,
                );
              }
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

    // 2.5 工作流模式检测（Feature Flag 控制，支持调试覆盖）
    if (isWorkflowTriggerEnabled(context.debugOverrides ?? null)) {
      const workflowExecutor = getWorkflowModeExecutor();
      const workflowResult = await workflowExecutor.tryExecuteWorkflow(
        processedInput,
        {
          userId: context.userId,
          conversationId: context.conversationId,
        },
      );

      if (workflowResult) {
        // 路由到工作流模式，返回工作流启动信息
        yield* this.streamWorkflowResponse(workflowResult);
        return;
      }
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
    // 生成轮次 ID（用于反馈跟踪）
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // ========== Phase 3: 快捷指令匹配 ==========
      // 在路由前检查用户是否有匹配的快捷指令
      const shortcutResult = await this.personalizedLearning.matchShortcut(
        context.userId,
        input,
      );

      if (shortcutResult.matched && shortcutResult.shortcut) {
        logger.info(
          {
            userId: context.userId,
            input: input.substring(0, 50),
            matchedPhrase: shortcutResult.shortcut.shortcutPhrase,
            similarity: shortcutResult.similarity,
            intentType: shortcutResult.intentType,
          },
          "UnifiedEngine: Shortcut matched, using shortcut intent",
        );

        // 使用快捷指令的意图直接执行（跳过路由）
        yield* this.executeWithShortcut(input, context, shortcutResult, turnId);
        return;
      }
      // ========== 快捷指令匹配结束 ==========

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

      // ========== Phase 2: 意图消歧检测 ==========
      // 构建意图匹配对象，用于消歧判断
      const intentMatch: IntentMatch = {
        type: routeResult.intent.type,
        subType: routeResult.intent.subType,
        confidence: routeResult.intent.confidence ?? 0.7,
        alternatives: routeResult.intent.alternatives?.map((alt) => ({
          type: alt.type,
          subType: alt.subType,
          confidence: alt.confidence,
        })),
      };

      // 检查是否需要消歧
      if (this.intentDisambiguator.needsDisambiguation(intentMatch)) {
        const disambiguationQuestion =
          this.intentDisambiguator.generateDisambiguationQuestion(intentMatch);

        logger.info(
          {
            confidence: intentMatch.confidence,
            primaryIntent: `${intentMatch.type}:${intentMatch.subType}`,
            alternativesCount: intentMatch.alternatives?.length ?? 0,
          },
          "UnifiedEngine: Intent disambiguation needed",
        );

        // 发送消歧问题给用户
        yield {
          type: "disambiguation",
          data: {
            id: `disambiguation-${Date.now()}`,
            question: disambiguationQuestion.question,
            options: disambiguationQuestion.options,
            allowCustomInput: disambiguationQuestion.allowCustomInput,
            timeout: disambiguationQuestion.timeout,
            originalConfidence: intentMatch.confidence,
          },
        } as UnifiedStreamChunk;

        // 消歧时暂停执行，等待用户选择
        // 用户的选择将通过新的请求传入，携带 disambiguationChoice 参数
        if (options.waitForDisambiguation !== false) {
          yield {
            type: "done",
            data: {
              success: false,
              needsDisambiguation: true,
              disambiguationId: `disambiguation-${Date.now()}`,
            },
          } as UnifiedStreamChunk;
          return;
        }
      }
      // ========== 意图消歧检测结束 ==========

      // ========== Phase 2: 推测执行策略判断 ==========
      // 获取意图风险等级
      const riskLevel = this.speculativeExecutor.getRiskLevel(
        routeResult.intent.type,
        routeResult.intent.subType,
      );

      // 确定执行策略
      const executionStrategy = this.speculativeExecutor.determineStrategy(
        routeResult.intent.confidence ?? 0.7,
        riskLevel,
      );

      logger.debug(
        {
          confidence: routeResult.intent.confidence,
          riskLevel,
          strategy: executionStrategy,
          intent: `${routeResult.intent.type}:${routeResult.intent.subType}`,
        },
        "UnifiedEngine: Speculative execution strategy determined",
      );

      // 如果策略是需要确认的高风险操作
      if (
        executionStrategy === "confirm_required" &&
        !options.skipConfirmation
      ) {
        const affectedCount = context.bookmarkIds?.length ?? 0;
        const confirmationId = `confirm-${Date.now()}`;

        yield {
          type: "risk_confirmation",
          data: {
            id: confirmationId,
            operationType: routeResult.intent.type,
            operationSubType: routeResult.intent.subType,
            riskLevel,
            impactDescription: `此操作将影响 ${affectedCount} 个书签`,
            affectedCount,
            question: `确定要执行此${riskLevel === "high" ? "高风险" : ""}操作吗？`,
            timeout: 30000,
          },
        } as UnifiedStreamChunk;

        yield {
          type: "done",
          data: {
            success: false,
            needsConfirmation: true,
            confirmationId,
          },
        } as UnifiedStreamChunk;
        return;
      }

      // 如果策略是需要澄清的低置信度
      if (executionStrategy === "clarify" && !options.skipClarification) {
        const clarificationResult =
          this.speculativeExecutor.generateClarificationQuestion(intentMatch);
        const clarificationId = `clarify-${Date.now()}`;

        yield {
          type: "clarification",
          data: {
            id: clarificationId,
            question: clarificationResult.question,
            options: clarificationResult.options.map((opt) => ({
              label: opt.label,
              value: opt.value,
              description: opt.description,
            })),
            timeout: clarificationResult.timeout,
            confidence: routeResult.intent.confidence ?? 0,
          },
        } as UnifiedStreamChunk;

        yield {
          type: "done",
          data: {
            success: false,
            needsClarification: true,
            clarificationId,
          },
        } as UnifiedStreamChunk;
        return;
      }
      // ========== 推测执行策略判断结束 ==========

      // ========== 慢思考层集成 ==========
      // 转换路由结果为慢思考接口格式
      const slowThinkingRouteResult: SlowThinkingRouteResult = {
        intent: {
          type: routeResult.intent.type,
          subType: routeResult.intent.subType,
        },
        complexity: {
          level: routeResult.complexity.level as
            | "simple"
            | "medium"
            | "complex",
          score: routeResult.complexity.score,
        },
        mode: routeResult.mode,
      };

      // 构建动态上下文（从 EngineContext 提取）
      const slowThinkingContext: SlowThinkingDynamicContext = {
        stats: {
          totalBookmarks: context.totalBookmarks,
        },
        // 注意：完整的动态上下文需要从 DynamicContextBuilder 获取
        // 这里只提供 EngineContext 中可用的数据
      };

      // 调用慢思考服务
      const monologue = await this.slowThinkingService.generateMonologue(
        input,
        slowThinkingRouteResult,
        slowThinkingContext,
      );

      // 如果有慢思考结果且应该展示给用户
      if (monologue && this.slowThinkingService.shouldShowToUser()) {
        // 构建思考内容展示
        const thinkingContent = monologue.conclusion
          ? `${monologue.thinking}\n\n**结论**: ${monologue.conclusion}`
          : monologue.thinking;

        yield this.outputAdapter.createThinkingChunk(
          "slow_thinking",
          thinkingContent,
          { isFinal: true },
        );

        logger.debug(
          {
            userMessage: input.slice(0, 50),
            inferredIntent: monologue.inferredIntent,
            suggestRouteChange: monologue.suggestRouteChange,
            confidence: monologue.confidence,
            durationMs: monologue.thinkingDurationMs,
          },
          "UnifiedEngine: Slow thinking completed",
        );
      }

      // P2: 慢思考路由调整 - 根据 monologue.suggestedStrategy 动态修改执行策略
      // 当前仅记录日志，配合 ENABLE_SLOW_THINKING Feature Flag
      if (monologue?.suggestRouteChange) {
        logger.info(
          {
            originalMode: routeResult.mode,
            suggestedStrategy: monologue.suggestedStrategy.type,
            confidence: monologue.confidence,
          },
          "UnifiedEngine: Slow thinking suggests route change (not implemented yet)",
        );
      }
      // ========== 慢思考层集成结束 ==========

      // ========== 智能预测模块集成（Phase 3）==========
      // 应用用户学习到的规则调整意图
      let effectiveIntent = routeResult.intent;
      if (this.config.enablePrediction) {
        const ruleResult = await this.ruleExtractor.applyRules(
          context.userId,
          {
            type: routeResult.intent.type,
            subType: routeResult.intent.subType,
          },
          input,
        );

        if (ruleResult.applied && ruleResult.modifiedIntent) {
          logger.info(
            {
              originalIntent: routeResult.intent.type,
              modifiedIntent: ruleResult.modifiedIntent.type,
              appliedRules: ruleResult.appliedRules.length,
            },
            "UnifiedEngine: Rule applied, intent modified",
          );

          // 更新有效意图
          effectiveIntent = {
            ...routeResult.intent,
            type: ruleResult.modifiedIntent.type as IntentType,
            subType: ruleResult.modifiedIntent.subType,
          };
        }
      }
      // ========== 智能预测模块集成结束 ==========

      // 处理 refine 意图：注入搜索结果上下文
      let effectiveContext = context;
      if (effectiveIntent.type === "refine" && context.lastSearchResults) {
        effectiveContext = this.injectRefineContext(context);

        if (this.config.debug) {
          logger.debug(
            {
              intentType: effectiveIntent.type,
              subType: effectiveIntent.subType,
              searchQuery: context.lastSearchResults.query,
              resultCount: context.lastSearchResults.resultIds.length,
            },
            "UnifiedEngine: Refine intent detected, injecting search results context",
          );
        }
      }

      // ========== 意图驱动工具加载（性能优化）==========
      // 将意图信息注入上下文，供 KnowledgeAgentStreamExecutor 使用
      effectiveContext = {
        ...effectiveContext,
        intentType: effectiveIntent.type,
        intentSubType: effectiveIntent.subType,
        intentConfidence: effectiveIntent.confidence ?? 0.7,
        slots: effectiveIntent.slots,
      };

      if (this.config.debug) {
        logger.debug(
          {
            intentType: effectiveIntent.type,
            intentSubType: effectiveIntent.subType,
            intentConfidence: effectiveIntent.confidence,
            slots: effectiveIntent.slots,
          },
          "UnifiedEngine: Intent injected for tool loading optimization",
        );
      }
      // ========== 意图驱动工具加载结束 ==========

      // 执行成功标志（用于意图记录）
      const executionSuccess = true;

      // ========== Phase 3: 开始反馈跟踪 ==========
      this.personalizedLearning.startTracking({
        userId: context.userId,
        sessionId: context.conversationId ?? `session-${Date.now()}`,
        turnId,
        originalInput: input,
        predictedIntent: {
          type: effectiveIntent.type,
          subType: effectiveIntent.subType,
          confidence: effectiveIntent.confidence ?? 0.7,
        },
        executionStartTime: Date.now(),
      });
      // ========== 反馈跟踪开始结束 ==========

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
          effectiveIntent.type,
          effectiveIntent.subType,
        );
      } else {
        // 原子模式
        yield* this.executeWithEnhancements(
          this.executionCoordinator.executeAtomic(input, effectiveContext),
          effectiveContext,
          effectiveIntent.type,
          effectiveIntent.subType,
        );
      }

      // ========== 记录意图历史（Phase 3）==========
      if (this.config.enablePrediction) {
        await this.intentPredictor.recordIntent(context.userId, {
          intent: effectiveIntent.type,
          subType: effectiveIntent.subType,
          success: executionSuccess,
        });
      }
      // ========== 意图历史记录结束 ==========

      // ========== Phase 3: 记录执行成功反馈 ==========
      await this.personalizedLearning.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        true, // 执行成功
      );
      // ========== 执行成功反馈记录结束 ==========
    } catch (error) {
      // ========== Phase 3: 记录执行失败反馈 ==========
      await this.personalizedLearning.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        false, // 执行失败
      );
      // ========== 执行失败反馈记录结束 ==========

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

  /**
   * 流式返回工作流响应
   *
   * @param result - 工作流执行结果
   * @yields 统一流式输出块
   */
  private async *streamWorkflowResponse(
    result: WorkflowExecuteResult,
  ): AsyncGenerator<UnifiedStreamChunk> {
    yield {
      type: "routing",
      data: {
        mode: "workflow",
        reason: "用户意图匹配工作流触发条件",
        skill: null,
        workflowId: result.workflowId,
        workflowName: result.workflowName,
      },
    };

    yield {
      type: "text",
      data: { text: result.message },
    };

    if (result.status === "started") {
      yield {
        type: "workflow_started",
        data: {
          executionId: result.executionId,
          workflowId: result.workflowId,
          workflowName: result.workflowName,
        },
      };
    }

    yield { type: "done", data: { success: true } };
  }

  /**
   * 使用快捷指令执行
   *
   * 当用户输入匹配已保存的快捷指令时，直接使用快捷指令的意图执行
   *
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @param shortcutResult - 快捷指令匹配结果
   * @param turnId - 轮次 ID（用于反馈跟踪）
   */
  private async *executeWithShortcut(
    input: string,
    context: EngineContext,
    shortcutResult: ShortcutMatchResult,
    turnId: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const { shortcut, intentType, intentSubType, defaultSlots } =
      shortcutResult;

    if (!shortcut || !intentType) {
      // 快捷指令匹配数据不完整，回退到正常路由执行
      logger.warn(
        { shortcutResult },
        "UnifiedEngine: Shortcut match incomplete, falling back to normal routing",
      );
      // 修复：回退到原子模式执行，而不是直接 return 导致空响应
      yield* this.executionCoordinator.executeAtomic(input, context);
      return;
    }

    // 开始反馈跟踪
    this.personalizedLearning.startTracking({
      userId: context.userId,
      sessionId: context.conversationId ?? `session-${Date.now()}`,
      turnId,
      originalInput: input,
      predictedIntent: {
        type: intentType,
        subType: intentSubType,
        confidence: shortcutResult.similarity,
      },
      executionStartTime: Date.now(),
    });

    try {
      // 发送路由信息（标记为快捷指令）
      yield {
        type: "routing",
        data: {
          mode: "atomic",
          reason: `使用快捷指令: "${shortcut.shortcutPhrase}"`,
          skill: null,
          isShortcut: true,
          shortcutPhrase: shortcut.shortcutPhrase,
          similarity: shortcutResult.similarity,
        },
      } as UnifiedStreamChunk;

      // 使用快捷指令的意图执行原子模式
      // 如果有默认槽位，注入到上下文中
      const contextWithSlots: EngineContext = defaultSlots
        ? {
            ...context,
            attachmentContext: context.attachmentContext
              ? `${context.attachmentContext}\n\n【快捷指令默认参数】\n${JSON.stringify(defaultSlots, null, 2)}`
              : `【快捷指令默认参数】\n${JSON.stringify(defaultSlots, null, 2)}`,
          }
        : context;

      // 执行（带增强）
      yield* this.executeWithEnhancements(
        this.executionCoordinator.executeAtomic(input, contextWithSlots),
        contextWithSlots,
        intentType,
        intentSubType,
      );

      // 记录执行成功
      await this.personalizedLearning.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        true,
      );
    } catch (error) {
      // 记录执行失败
      await this.personalizedLearning.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        false,
      );

      logger.error(
        { error, shortcutPhrase: shortcut.shortcutPhrase },
        "UnifiedEngine: Shortcut execution failed",
      );

      // 回退到原子模式
      yield this.outputAdapter.createFallbackChunk(
        error instanceof Error ? error.message : "快捷指令执行失败",
      );
      yield* this.executionCoordinator.executeAtomic(input, context);
    }
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
   * 初始化混合意图分类器（如果启用）
   * 应在应用启动时调用一次
   */
  async initializeHybridIntentClassifier(): Promise<void> {
    const routerWithHybrid = this.router as {
      initializeHybridClassifier?: () => Promise<void>;
    };
    if (routerWithHybrid.initializeHybridClassifier) {
      await routerWithHybrid.initializeHybridClassifier();
    }
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
   * 检查混合意图分类器是否已就绪
   *
   * Code Review P0-1: 添加混合分类器就绪状态检查
   */
  isHybridClassifierReady(): boolean {
    const status = this.router.getClassifier();
    // 检查是否是混合分类器并且语义匹配器已初始化
    if ("getSemanticMatcherStatus" in status) {
      const semanticStatus = (
        status as { getSemanticMatcherStatus: () => { initialized: boolean } }
      ).getSemanticMatcherStatus();
      return semanticStatus.initialized;
    }
    return false;
  }

  /**
   * 获取语义匹配器状态
   *
   * Code Review P1-2: 添加语义匹配器健康检查支持
   */
  getSemanticMatcherStatus(): { initialized: boolean; intentCount: number } {
    const classifier = this.router.getClassifier();
    if ("getSemanticMatcherStatus" in classifier) {
      return (
        classifier as {
          getSemanticMatcherStatus: () => {
            initialized: boolean;
            intentCount: number;
          };
        }
      ).getSemanticMatcherStatus();
    }
    return { initialized: false, intentCount: 0 };
  }

  /**
   * 测试语义匹配器功能
   *
   * Code Review P1-2: 添加语义匹配器健康检查
   *
   * @param testInput - 测试输入
   * @returns 测试结果
   */
  async testSemanticMatcher(
    testInput: string,
  ): Promise<{ success: boolean; matchCount?: number; error?: string }> {
    try {
      const classifier = this.router.getClassifier();

      // 检查是否是混合分类器
      if (!("classify" in classifier)) {
        return {
          success: false,
          error: "Classifier does not support classification",
        };
      }

      // 执行测试分类
      const result = await (
        classifier as {
          classify: (input: string) => Promise<{
            type: string;
            confidence: number;
            debugInfo?: { semanticSimilarity?: number };
          }>;
        }
      ).classify(testInput);

      // 检查是否获得了语义匹配结果
      const hasSemanticMatch =
        result.debugInfo?.semanticSimilarity !== undefined;

      return {
        success: true,
        matchCount: hasSemanticMatch ? 1 : 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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

  // ============================================================
  // Prediction Layer 方法（Phase 3）
  // ============================================================

  /**
   * 获取 IntentPredictor 实例
   */
  getIntentPredictor(): IntentPredictor {
    return this.intentPredictor;
  }

  /**
   * 获取 RuleExtractor 实例
   */
  getRuleExtractor(): RuleExtractor {
    return this.ruleExtractor;
  }

  /**
   * 获取预测的下一步意图
   *
   * 基于用户历史行为，预测用户可能的下一步操作
   *
   * @param userId - 用户 ID
   * @param currentMessage - 当前消息
   * @param currentIntent - 当前意图
   * @returns 预测的意图列表
   */
  async getPredictions(
    userId: string,
    currentMessage: string,
    currentIntent: { type: IntentType; subType?: string },
  ): Promise<PredictedIntent[]> {
    if (!this.config.enablePrediction) return [];
    return this.intentPredictor.predict(userId, currentMessage, currentIntent);
  }

  /**
   * 获取快捷操作按钮
   *
   * 返回基于预测的快捷操作列表，供前端渲染
   *
   * @param userId - 用户 ID
   * @param currentIntent - 当前意图（可选）
   * @returns 快捷操作列表
   */
  async getQuickActions(
    userId: string,
    currentIntent?: { type: IntentType; subType?: string },
  ): Promise<QuickAction[]> {
    if (!this.config.enablePrediction) return [];
    return this.intentPredictor.getQuickActions(userId, currentIntent);
  }

  /**
   * 记录用户纠正
   *
   * 当用户纠正 AI 的意图判断时调用，用于规则学习
   *
   * @param userId - 用户 ID
   * @param correction - 纠正信息
   */
  async recordCorrection(
    userId: string,
    correction: {
      originalIntent: IntentType;
      correctedIntent: IntentType;
      originalMessage: string;
    },
  ): Promise<void> {
    if (!this.config.enablePrediction) return;

    // 记录到 IntentPredictor
    await this.intentPredictor.recordCorrection(userId, correction);

    // 记录到 RuleExtractor 用于规则学习
    this.ruleExtractor.addCorrection(userId, {
      id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      originalIntent: correction.originalIntent,
      correctedIntent: correction.correctedIntent,
      originalMessage: correction.originalMessage,
      timestamp: Date.now(),
    });

    // 异步触发规则分析（不阻塞）
    this.ruleExtractor.analyzeCorrections(userId).catch((error) => {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "UnifiedEngine: Failed to analyze corrections",
      );
    });

    logger.debug(
      {
        userId,
        originalIntent: correction.originalIntent,
        correctedIntent: correction.correctedIntent,
      },
      "UnifiedEngine: Correction recorded",
    );
  }

  /**
   * 获取用户的活跃规则
   *
   * 返回从用户行为学习到的已激活规则
   *
   * @param userId - 用户 ID
   * @returns 活跃规则列表
   */
  async getActiveRules(userId: string) {
    if (!this.config.enablePrediction) return [];
    return this.ruleExtractor.getActiveRules(userId);
  }

  /**
   * 激活规则
   *
   * @param userId - 用户 ID
   * @param ruleId - 规则 ID
   */
  async activateRule(userId: string, ruleId: string): Promise<void> {
    if (!this.config.enablePrediction) return;
    await this.ruleExtractor.activateRule(userId, ruleId);
  }

  /**
   * 停用规则
   *
   * @param userId - 用户 ID
   * @param ruleId - 规则 ID
   */
  async deactivateRule(userId: string, ruleId: string): Promise<void> {
    if (!this.config.enablePrediction) return;
    await this.ruleExtractor.deactivateRule(userId, ruleId);
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
export type { PredictedIntent, QuickAction } from "../router/intent-predictor";
