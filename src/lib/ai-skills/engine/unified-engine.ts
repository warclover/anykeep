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
 * @version 3.1.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import type { IntentRouter, IntentType } from "../router";
import { createIntentRouter } from "../router";
import { type IntentMatch } from "../router/intent-disambiguator";
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
  type EffectHandler,
  type UnifiedEffect,
  type EffectType,
  type ConfirmationServiceResult,
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
  type PredictedIntent,
  type QuickAction,
} from "../router/intent-predictor";
import { type RuleExtractor } from "../../ai-agent/preferences/rule-learning";
// NOTE: Workflow integration removed - migrated to workflow-lite
// import {
//   getWorkflowModeExecutor,
//   type WorkflowExecuteResult,
// } from "@/lib/workflow/integration";
// import { isWorkflowTriggerEnabled } from "../../ai-agent/config/feature-flag-overrides";
import { type ShortcutMatchResult } from "../learning";
import { FeatureFlags } from "../../ai-agent/config/feature-flags";
import {
  calculateEnhancedConfidence,
  type EnhancedConfidenceResult,
  type IntentClassificationLite,
} from "../../ai-agent/context/enhanced-confidence";
import type { DynamicContext } from "../../ai-agent/context/types";
import type { IntentPredictor } from "../router/intent-predictor";

// 引入重构后的组件
import { EngineConfigManager } from "./components/config-manager";
import { EngineEffectHandler } from "./components/effect-handler";
import { EnginePredictor } from "./components/predictor";

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
  private memoryManager: MemoryManager;

  // 核心处理模块
  private inputPreprocessor: InputPreprocessor;
  private executionCoordinator: ExecutionCoordinator;
  private outputEnhancer: OutputEnhancer;
  private slowThinkingService: SlowThinkingService;

  // 重构后的组件
  private configManager: EngineConfigManager;
  private effectHandler: EngineEffectHandler;
  private predictor: EnginePredictor;

  // 兼容性属性（如有必要，或通过getter暴露）
  // private effectListenerIds: string[] = []; // 移入 EffectHandler

  constructor(config: UnifiedEngineConfig = {}) {
    // 1. 初始化配置管理器
    this.configManager = new EngineConfigManager(config);
    const fullConfig = this.configManager.get();

    // 2. 初始化核心组件
    this.router = createIntentRouter({ debug: fullConfig.debug });
    this.orchestrationEngine = createOrchestrationEngine();
    this.outputAdapter = createUnifiedOutputAdapter({
      includeDebugInfo: fullConfig.debug,
    });

    // 3. 初始化副作用处理器
    this.effectHandler = new EngineEffectHandler(this.configManager);
    this.effectHandler.initSystemListeners();

    this.memoryManager = createMemoryManager({
      enableReferenceResolution: this.configManager.enableMemory,
      enableAutoRecording: this.configManager.enableMemory,
    });

    // 4. 初始化核心处理模块
    this.inputPreprocessor = createInputPreprocessor(this.memoryManager);
    this.executionCoordinator = createExecutionCoordinator(
      this.orchestrationEngine,
      this.outputAdapter,
      {
        includeRoutingInfo: fullConfig.includeRoutingInfo,
        debug: fullConfig.debug,
      },
    );
    this.outputEnhancer = createOutputEnhancer(
      this.memoryManager,
      this.outputAdapter,
      {
        enableMemory: this.configManager.enableMemory,
        enableSuggestions: true,
        debug: fullConfig.debug,
      },
    );
    this.slowThinkingService = createSlowThinkingService();

    // 5. 初始化预测器
    this.predictor = new EnginePredictor(this.configManager);
  }

  /**
   * 创建用于增强置信度计算的最小化 DynamicContext
   */
  private createMinimalDynamicContext(context: EngineContext): DynamicContext {
    const now = new Date();
    const hour = now.getHours();
    let period: "morning" | "afternoon" | "evening" | "night";
    if (hour >= 5 && hour < 12) period = "morning";
    else if (hour >= 12 && hour < 18) period = "afternoon";
    else if (hour >= 18 && hour < 22) period = "evening";
    else period = "night";

    return {
      time: {
        current: now.toLocaleString("zh-CN"),
        period,
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
      },
      stats: {
        totalBookmarks: context.totalBookmarks ?? 0,
        recentWeekCount: context.recentWeekCount ?? 0,
        topPlatform: context.topPlatform ?? {
          name: "未知",
          code: "unknown",
          count: 0,
        },
        topFolders: context.topFolders ?? [],
      },
      preferences: {
        responseStyle: "auto",
        frequentTags: context.frequentTags ?? [],
      },
      recentActivity: {},
      session: {
        selectedBookmarkIds: context.bookmarkIds,
        currentFolder: context.folderId
          ? { id: context.folderId, name: "" }
          : undefined,
      },
    };
  }

  private toIntentClassificationLite(routeResult: {
    intent: { type: IntentType; subType?: string; confidence?: number };
  }): IntentClassificationLite {
    return {
      type: routeResult.intent.type as IntentClassificationLite["type"],
      subType: routeResult.intent.subType,
      confidence: routeResult.intent.confidence ?? 0.7,
      entities: [],
    };
  }

  setAtomicExecutor(executor: AtomicExecutor): void {
    this.executionCoordinator.setAtomicExecutor(executor);
  }

  registerOrchestrationSkill(
    skill: Parameters<OrchestrationEngine["register"]>[0],
  ): void {
    this.orchestrationEngine.register(skill);
  }

  async *execute(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions = {},
  ): AsyncGenerator<UnifiedStreamChunk> {
    const mergedOptions = { ...this.configManager.defaultOptions, ...options };

    // 1. 输入预处理
    const preprocessResult = this.inputPreprocessor.preprocess(
      input,
      context,
      this.configManager.enableMemory,
    );

    if (preprocessResult.memoryChunk) {
      yield preprocessResult.memoryChunk;
    }

    const processedInput = preprocessResult.processedInput;

    const lastSearchResults =
      this.configManager.enableMemory && context.conversationId
        ? this.memoryManager.getLastSearchResults(context.conversationId)
        : undefined;

    const contextWithCallback: EngineContext = {
      ...context,
      onSearchResults:
        context.onSearchResults ??
        (this.configManager.enableMemory && context.conversationId
          ? (query: string, resultIds: number[]) => {
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
      lastSearchResults: lastSearchResults
        ? {
            query: lastSearchResults.query,
            resultIds: lastSearchResults.resultIds,
            searchedAt: lastSearchResults.searchedAt,
          }
        : context.lastSearchResults,
    };

    if (!this.configManager.enabled) {
      yield* this.executionCoordinator.execute(
        processedInput,
        contextWithCallback,
        {
          mode: "atomic",
          agentOptions: {
            maxToolRounds: mergedOptions.maxToolRounds,
            temperature: mergedOptions.temperature,
            maxTokens: mergedOptions.maxTokens,
          },
        },
      );
      return;
    }

    // NOTE: Workflow Mode Detection - DISABLED (migrated to workflow-lite)
    // The workflow trigger is now handled by TriggerScheduler for scheduled tasks
    // Conversation-triggered workflows are temporarily disabled pending Lite migration
    // if (isWorkflowTriggerEnabled(context.debugOverrides ?? null)) {
    //   const workflowExecutor = getWorkflowModeExecutor();
    //   const workflowResult = await workflowExecutor.tryExecuteWorkflow(
    //     processedInput,
    //     {
    //       userId: context.userId,
    //       conversationId: context.conversationId,
    //     },
    //   );
    //
    //   if (workflowResult) {
    //     yield* this.streamWorkflowResponseWithEnhancements(
    //       workflowResult,
    //       contextWithCallback,
    //     );
    //     return;
    //   }
    // }

    if (mergedOptions.forceMode === "atomic") {
      yield* this.executeWithEnhancements(
        this.executionCoordinator.execute(processedInput, contextWithCallback, {
          mode: "atomic",
          reason: "强制使用原子模式",
          enableFallback: false,
          agentOptions: {
            maxToolRounds: mergedOptions.maxToolRounds,
            temperature: mergedOptions.temperature,
            maxTokens: mergedOptions.maxTokens,
          },
        }),
        contextWithCallback,
        "query",
      );
      return;
    }

    if (
      mergedOptions.forceMode === "orchestration" &&
      mergedOptions.forceSkill
    ) {
      yield* this.executeWithEnhancements(
        this.executionCoordinator.execute(processedInput, contextWithCallback, {
          mode: "orchestration",
          skillId: mergedOptions.forceSkill,
          reason: "强制使用编排模式",
          enableFallback: false,
          agentOptions: {
            maxToolRounds: mergedOptions.maxToolRounds,
            temperature: mergedOptions.temperature,
            maxTokens: mergedOptions.maxTokens,
          },
        }),
        contextWithCallback,
        "action",
      );
      return;
    }

    yield* this.executeRouted(
      processedInput,
      contextWithCallback,
      mergedOptions,
    );
  }

  private async *executeRouted(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Phase 3: Shortcut Matching
      const shortcutResult = await this.predictor.matchShortcut(
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

        yield* this.executeWithShortcut(input, context, shortcutResult, turnId);
        return;
      }

      // Routing
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

      if (options.includeRoutingInfo || this.configManager.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          routeResult.mode,
          routeResult.reason,
          routeResult.suggestedSkill,
          routeResult.intent.type,
          routeResult.complexity.level,
        );
      }

      // Phase 2: Disambiguation
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

      if (this.predictor.needsDisambiguation(intentMatch)) {
        const disambiguationQuestion =
          this.predictor.generateDisambiguationQuestion(intentMatch);

        logger.info(
          {
            confidence: intentMatch.confidence,
            primaryIntent: `${intentMatch.type}:${intentMatch.subType}`,
            alternativesCount: intentMatch.alternatives?.length ?? 0,
          },
          "UnifiedEngine: Intent disambiguation needed",
        );

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

      // Enhanced Confidence Calculation
      let effectiveConfidence = routeResult.intent.confidence ?? 0.7;
      let enhancedConfidenceResult: EnhancedConfidenceResult | undefined;

      if (FeatureFlags.ENABLE_ENHANCED_CONFIDENCE) {
        const minimalContext = this.createMinimalDynamicContext(context);
        const intentLite = this.toIntentClassificationLite(routeResult);

        enhancedConfidenceResult = calculateEnhancedConfidence(
          intentLite,
          minimalContext,
          input,
        );

        effectiveConfidence = enhancedConfidenceResult.enhancedConfidence;

        if (this.configManager.debug) {
          logger.debug(
            {
              originalConfidence: enhancedConfidenceResult.originalConfidence,
              enhancedConfidence: enhancedConfidenceResult.enhancedConfidence,
            },
            "UnifiedEngine: Enhanced confidence calculated",
          );
        }
      }

      // Phase 2: Speculative Execution Strategy
      const riskLevel = this.predictor.getRiskLevel(
        routeResult.intent.type,
        routeResult.intent.subType,
      );

      const executionStrategy = this.predictor.determineStrategy(
        effectiveConfidence,
        riskLevel,
      );

      logger.debug(
        {
          originalConfidence: routeResult.intent.confidence,
          effectiveConfidence,
          riskLevel,
          strategy: executionStrategy,
          intent: `${routeResult.intent.type}:${routeResult.intent.subType}`,
        },
        "UnifiedEngine: Speculative execution strategy determined",
      );

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

      if (executionStrategy === "clarify" && !options.skipClarification) {
        const clarificationResult =
          this.predictor.generateClarificationQuestion(intentMatch);
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

      // Slow Thinking Integration
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

      const slowThinkingContext: SlowThinkingDynamicContext = {
        stats: {
          totalBookmarks: context.totalBookmarks,
        },
      };

      const monologue = await this.slowThinkingService.generateMonologue(
        input,
        slowThinkingRouteResult,
        slowThinkingContext,
      );

      if (monologue && this.slowThinkingService.shouldShowToUser()) {
        const thinkingContent = monologue.conclusion
          ? `${monologue.thinking}\n\n**结论**: ${monologue.conclusion}`
          : monologue.thinking;

        yield this.outputAdapter.createThinkingChunk(
          "slow_thinking",
          thinkingContent,
          { isFinal: true },
        );
      }

      // Phase 3: Rule Prediction Integration
      let effectiveIntent = routeResult.intent;
      if (this.configManager.enablePrediction) {
        const ruleResult = await this.predictor.applyRules(
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

          effectiveIntent = {
            ...routeResult.intent,
            type: ruleResult.modifiedIntent.type as IntentType,
            subType: ruleResult.modifiedIntent.subType,
          };
        }
      }

      let effectiveContext = context;
      if (effectiveIntent.type === "refine" && context.lastSearchResults) {
        effectiveContext = this.injectRefineContext(context);
      }

      effectiveContext = {
        ...effectiveContext,
        intentType: effectiveIntent.type,
        intentSubType: effectiveIntent.subType,
        intentConfidence: effectiveIntent.confidence ?? 0.7,
        slots: effectiveIntent.slots,
      };

      if (FeatureFlags.ENABLE_CONFIDENCE_TIERING && enhancedConfidenceResult) {
        effectiveContext = {
          ...effectiveContext,
          responseStrategy: enhancedConfidenceResult.suggestedStrategy,
          confidenceLevel: enhancedConfidenceResult.level,
          enhancedConfidence: enhancedConfidenceResult.enhancedConfidence,
        };

        yield {
          type: "confidence_strategy",
          data: {
            strategy: enhancedConfidenceResult.suggestedStrategy,
            level: enhancedConfidenceResult.level,
            confidence: enhancedConfidenceResult.enhancedConfidence,
            originalConfidence: enhancedConfidenceResult.originalConfidence,
          },
        } as UnifiedStreamChunk;
      }

      const executionSuccess = true;

      // Tracking
      this.predictor.startTracking({
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

      const agentOptions = {
        maxToolRounds: options.maxToolRounds,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      };

      if (
        routeResult.mode === "orchestration" &&
        routeResult.suggestedSkill &&
        this.executionCoordinator.hasSkill(routeResult.suggestedSkill)
      ) {
        yield* this.executeWithEnhancements(
          this.executionCoordinator.execute(input, effectiveContext, {
            mode: "orchestration",
            skillId: routeResult.suggestedSkill,
            enableFallback: true,
            agentOptions,
          }),
          effectiveContext,
          effectiveIntent.type,
          effectiveIntent.subType,
        );
      } else {
        yield* this.executeWithEnhancements(
          this.executionCoordinator.execute(input, effectiveContext, {
            mode: "atomic",
            agentOptions,
            useReact: routeResult.useReact,
            reactReason: routeResult.reactReason,
          }),
          effectiveContext,
          effectiveIntent.type,
          effectiveIntent.subType,
        );
      }

      if (this.configManager.enablePrediction) {
        await this.predictor.recordIntent(context.userId, {
          intent: effectiveIntent.type,
          subType: effectiveIntent.subType,
          success: executionSuccess,
        });
      }

      await this.predictor.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        true,
      );
    } catch (error) {
      await this.predictor.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        false,
      );

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

      yield* this.executionCoordinator.execute(input, context, {
        mode: "atomic",
      });
    }
  }

  // Refine Context Injection logic - kept here as it modifies context
  private injectRefineContext(context: EngineContext): EngineContext {
    const { lastSearchResults } = context;

    if (!lastSearchResults || lastSearchResults.resultIds.length === 0) {
      return context;
    }

    const refineContextPrompt = `
【上下文：用户正在筛选之前的搜索结果】

用户之前搜索了："${lastSearchResults.query}"
搜索到 ${lastSearchResults.resultIds.length} 条结果（书签 ID: ${lastSearchResults.resultIds.slice(0, 10).join(", ")}${lastSearchResults.resultIds.length > 10 ? "..." : ""}）

用户现在想要在这些结果中进一步筛选。请：
1. 优先在这 ${lastSearchResults.resultIds.length} 条搜索结果中进行筛选
2. 如果需要搜索，请使用用户的筛选条件结合原搜索词进行搜索
3. 回答时明确指出筛选后还剩多少条符合条件的结果
`;

    const newAttachmentContext = context.attachmentContext
      ? `${context.attachmentContext}\n\n${refineContextPrompt}`
      : refineContextPrompt;

    return {
      ...context,
      attachmentContext: newAttachmentContext,
      bookmarkIds: context.bookmarkIds?.length
        ? context.bookmarkIds
        : lastSearchResults.resultIds,
    };
  }

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

  private async *streamWorkflowResponseWithEnhancements(
    result: WorkflowExecuteResult,
    context: EngineContext,
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

    if (this.configManager.enableMemory && context.conversationId) {
      try {
        this.memoryManager.recordAssistantMessage(
          context.conversationId,
          result.message,
        );
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "UnifiedEngine: Failed to record workflow memory",
        );
      }
    }

    yield {
      type: "done",
      data: {
        success: true,
      },
    };
  }

  private async *executeWithShortcut(
    input: string,
    context: EngineContext,
    shortcutResult: ShortcutMatchResult,
    turnId: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const { shortcut, intentType, intentSubType, defaultSlots } =
      shortcutResult;

    if (!shortcut || !intentType) {
      logger.warn(
        { shortcutResult },
        "UnifiedEngine: Shortcut match incomplete, falling back to normal routing",
      );
      yield* this.executionCoordinator.execute(input, context, {
        mode: "atomic",
      });
      return;
    }

    this.predictor.startTracking({
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

      const contextWithSlots: EngineContext = defaultSlots
        ? {
            ...context,
            attachmentContext: context.attachmentContext
              ? `${context.attachmentContext}\n\n【快捷指令默认参数】\n${JSON.stringify(defaultSlots, null, 2)}`
              : `【快捷指令默认参数】\n${JSON.stringify(defaultSlots, null, 2)}`,
          }
        : context;

      yield* this.executeWithEnhancements(
        this.executionCoordinator.execute(input, contextWithSlots, {
          mode: "atomic",
        }),
        contextWithSlots,
        intentType,
        intentSubType,
      );

      await this.predictor.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        true,
      );
    } catch (error) {
      await this.predictor.recordExecutionComplete(
        context.userId,
        context.conversationId ?? `session-${Date.now()}`,
        turnId,
        false,
      );

      logger.error(
        { error, shortcutPhrase: shortcut.shortcutPhrase },
        "UnifiedEngine: Shortcut execution failed",
      );

      yield this.outputAdapter.createFallbackChunk(
        error instanceof Error ? error.message : "快捷指令执行失败",
      );
      yield* this.executionCoordinator.execute(input, context, {
        mode: "atomic",
      });
    }
  }

  // ============================================================
  // 公共 API
  // ============================================================

  getRouter(): IntentRouter {
    return this.router;
  }

  async initializeHybridIntentClassifier(): Promise<void> {
    const routerWithHybrid = this.router as {
      initializeHybridClassifier?: () => Promise<void>;
    };
    if (routerWithHybrid.initializeHybridClassifier) {
      await routerWithHybrid.initializeHybridClassifier();
    }
  }

  getOrchestrationEngine(): OrchestrationEngine {
    return this.orchestrationEngine;
  }

  getOutputAdapter(): UnifiedOutputAdapter {
    return this.outputAdapter;
  }

  updateConfig(config: Partial<UnifiedEngineConfig>): void {
    this.configManager.update(config);
    this.effectHandler.updateConfig();

    if (config.debug !== undefined) {
      this.router.updateConfig({ debug: config.debug });
      this.outputAdapter.updateConfig({ includeDebugInfo: config.debug });
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

  isReady(): boolean {
    return this.executionCoordinator.hasAtomicExecutor();
  }

  isHybridClassifierReady(): boolean {
    const status = this.router.getClassifier();
    if ("getSemanticMatcherStatus" in status) {
      const semanticStatus = (
        status as { getSemanticMatcherStatus: () => { initialized: boolean } }
      ).getSemanticMatcherStatus();
      return semanticStatus.initialized;
    }
    return false;
  }

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

  async testSemanticMatcher(
    testInput: string,
  ): Promise<{ success: boolean; matchCount?: number; error?: string }> {
    try {
      const classifier = this.router.getClassifier();

      if (!("classify" in classifier)) {
        return {
          success: false,
          error: "Classifier does not support classification",
        };
      }

      const result = await (
        classifier as {
          classify: (input: string) => Promise<{
            type: string;
            confidence: number;
            debugInfo?: { semanticSimilarity?: number };
          }>;
        }
      ).classify(testInput);

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

  getRegisteredOrchestrationSkills() {
    return this.orchestrationEngine.getAllSkillMetadata();
  }

  // ============================================================
  // Effect Layer 委托
  // ============================================================

  getEffectManager(): EffectManager {
    return this.effectHandler.getManager();
  }

  onEffect<T extends UnifiedEffect = UnifiedEffect>(
    type: EffectType | "*",
    handler: EffectHandler<T>,
  ): string {
    return this.effectHandler.on(type, handler);
  }

  offEffect(listenerId: string): boolean {
    return this.effectHandler.off(listenerId);
  }

  async emitEffect(effect: UnifiedEffect): Promise<void> {
    await this.effectHandler.emit(effect);
  }

  async requestConfirmation(
    options: Parameters<EngineEffectHandler["requestConfirmation"]>[0],
  ): Promise<ConfirmationServiceResult> {
    return this.effectHandler.requestConfirmation(options);
  }

  respondToConfirmation(
    confirmationId: string,
    selectedOption: string,
    data?: unknown,
  ): boolean {
    return this.effectHandler.respondToConfirmation(
      confirmationId,
      selectedOption,
      data,
    );
  }

  getEffectStats() {
    return this.effectHandler.getStats();
  }

  // ============================================================
  // Memory Layer
  // ============================================================

  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  recordSearchResults(
    conversationId: string,
    query: string,
    resultIds: number[],
  ): void {
    if (!this.configManager.enableMemory) return;
    this.memoryManager.recordSearchResults(conversationId, query, resultIds);
  }

  recordMentionedBookmarks(
    conversationId: string,
    bookmarks: Array<{ id: number; name: string }>,
  ): void {
    if (!this.configManager.enableMemory) return;
    this.memoryManager.recordMentionedBookmarks(conversationId, bookmarks);
  }

  recordMentionedFolders(
    conversationId: string,
    folders: Array<{ id: number; name: string }>,
  ): void {
    if (!this.configManager.enableMemory) return;
    this.memoryManager.recordMentionedFolders(conversationId, folders);
  }

  getContextSummary(conversationId: string): string | null {
    if (!this.configManager.enableMemory) return null;
    return this.memoryManager.generateContextSummary(conversationId);
  }

  // ============================================================
  // Prediction Layer 委托
  // ============================================================

  getIntentPredictor(): IntentPredictor {
    return this.predictor.getIntentPredictor();
  }

  getRuleExtractor(): RuleExtractor {
    return this.predictor.getRuleExtractor();
  }

  async getPredictions(
    userId: string,
    currentMessage: string,
    currentIntent: { type: IntentType; subType?: string },
  ): Promise<PredictedIntent[]> {
    return this.predictor.getPredictions(userId, currentMessage, currentIntent);
  }

  async getQuickActions(
    userId: string,
    currentIntent?: { type: IntentType; subType?: string },
  ): Promise<QuickAction[]> {
    return this.predictor.getQuickActions(userId, currentIntent);
  }

  async recordCorrection(
    userId: string,
    correction: {
      originalIntent: IntentType;
      correctedIntent: IntentType;
      originalMessage: string;
    },
  ): Promise<void> {
    await this.predictor.recordCorrection(userId, correction);
  }

  async getActiveRules(userId: string) {
    return this.predictor.getActiveRules(userId);
  }

  async activateRule(userId: string, ruleId: string): Promise<void> {
    await this.predictor.activateRule(userId, ruleId);
  }

  async deactivateRule(userId: string, ruleId: string): Promise<void> {
    await this.predictor.deactivateRule(userId, ruleId);
  }

  dispose(): void {
    this.effectHandler.dispose();
    this.memoryManager.destroy();
    logger.debug("UnifiedEngine: Disposed, all resources cleaned up");
  }
}

export function createUnifiedEngine(
  config?: UnifiedEngineConfig,
): UnifiedEngine {
  return new UnifiedEngine(config);
}

export const unifiedEngine = new UnifiedEngine();

export type { AtomicExecutor } from "./execution-coordinator";
export type { PredictedIntent, QuickAction } from "../router/intent-predictor";
