import { logger } from "@/lib/logger";
import {
  type IntentPredictor,
  createIntentPredictor,
  type PredictedIntent,
  type QuickAction,
} from "../../router/intent-predictor";
import {
  type RuleExtractor,
  createRuleExtractor,
} from "../../../ai-agent/preferences/rule-learning";
import {
  type SpeculativeExecutor,
  createSpeculativeExecutor,
  type RiskLevel,
} from "../../execution";
import {
  type IntentDisambiguator,
  createIntentDisambiguator,
  type IntentMatch,
} from "../../router/intent-disambiguator";
import {
  type PersonalizedLearningIntegration,
  createPersonalizedLearningIntegration,
  type ShortcutMatchResult,
} from "../../learning";
import type { IntentType } from "../../router";
import type { EngineConfigManager } from "./config-manager";

/**
 * 引擎预测器
 *
 * 职责：
 * - 聚合所有"智能"预测和推测能力
 * - 管理 IntentPredictor, RuleExtractor, SpeculativeExecutor 等组件
 * - 提供高级方法进行快捷匹配、规则应用和风险评估
 */
export class EnginePredictor {
  private intentPredictor: IntentPredictor;
  private ruleExtractor: RuleExtractor;
  private speculativeExecutor: SpeculativeExecutor;
  private intentDisambiguator: IntentDisambiguator;
  private personalizedLearning: PersonalizedLearningIntegration;
  private configManager: EngineConfigManager;

  constructor(configManager: EngineConfigManager) {
    this.configManager = configManager;
    const debug = configManager.debug;

    // Phase 3: 初始化智能预测模块
    this.intentPredictor = createIntentPredictor();
    this.ruleExtractor = createRuleExtractor();

    // Phase 2: 初始化推测执行与消歧模块
    this.speculativeExecutor = createSpeculativeExecutor({ debug });
    this.intentDisambiguator = createIntentDisambiguator();

    // Phase 3: 初始化个性化学习模块
    this.personalizedLearning = createPersonalizedLearningIntegration({
      debug,
      enableShortcutMatching: true,
      enableFeedbackCollection: true,
      enablePatternDiscovery: true,
    });
  }

  // 组件访问器（供内部或高级用途）
  getIntentPredictor() {
    return this.intentPredictor;
  }
  getRuleExtractor() {
    return this.ruleExtractor;
  }
  getSpeculativeExecutor() {
    return this.speculativeExecutor;
  }
  getIntentDisambiguator() {
    return this.intentDisambiguator;
  }
  getPersonalizedLearning() {
    return this.personalizedLearning;
  }

  // Phase 3: 快捷指令匹配
  async matchShortcut(
    userId: string,
    input: string,
  ): Promise<ShortcutMatchResult> {
    return this.personalizedLearning.matchShortcut(userId, input);
  }

  // Phase 2: 意图消歧
  needsDisambiguation(intentMatch: IntentMatch): boolean {
    return this.intentDisambiguator.needsDisambiguation(intentMatch);
  }

  generateDisambiguationQuestion(intentMatch: IntentMatch) {
    return this.intentDisambiguator.generateDisambiguationQuestion(intentMatch);
  }

  // Phase 2: 推测执行策略
  getRiskLevel(type: string, subType?: string) {
    return this.speculativeExecutor.getRiskLevel(type as IntentType, subType);
  }

  determineStrategy(confidence: number, riskLevel: RiskLevel) {
    return this.speculativeExecutor.determineStrategy(confidence, riskLevel);
  }

  generateClarificationQuestion(intentMatch: IntentMatch) {
    return this.speculativeExecutor.generateClarificationQuestion(intentMatch);
  }

  // Phase 3: 规则应用
  async applyRules(
    userId: string,
    intent: { type: IntentType; subType?: string },
    input: string,
  ) {
    if (!this.configManager.enablePrediction) {
      return { applied: false, modifiedIntent: null, appliedRules: [] };
    }
    return this.ruleExtractor.applyRules(userId, intent, input);
  }

  // 跟踪与记录
  startTracking(
    data: Parameters<PersonalizedLearningIntegration["startTracking"]>[0],
  ) {
    this.personalizedLearning.startTracking(data);
  }

  async recordExecutionComplete(
    userId: string,
    sessionId: string,
    turnId: string,
    success: boolean,
  ) {
    await this.personalizedLearning.recordExecutionComplete(
      userId,
      sessionId,
      turnId,
      success,
    );
  }

  async recordIntent(
    userId: string,
    data: { intent: IntentType; subType?: string; success: boolean },
  ) {
    if (this.configManager.enablePrediction) {
      await this.intentPredictor.recordIntent(userId, data);
    }
  }

  // 预测 API
  async getPredictions(
    userId: string,
    currentMessage: string,
    currentIntent: { type: IntentType; subType?: string },
  ): Promise<PredictedIntent[]> {
    if (!this.configManager.enablePrediction) return [];
    return this.intentPredictor.predict(userId, currentMessage, currentIntent);
  }

  async getQuickActions(
    userId: string,
    currentIntent?: { type: IntentType; subType?: string },
  ): Promise<QuickAction[]> {
    if (!this.configManager.enablePrediction) return [];
    return this.intentPredictor.getQuickActions(userId, currentIntent);
  }

  // 纠正与规则管理
  async recordCorrection(
    userId: string,
    correction: {
      originalIntent: IntentType;
      correctedIntent: IntentType;
      originalMessage: string;
    },
  ): Promise<void> {
    if (!this.configManager.enablePrediction) return;

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

    // 异步触发规则分析
    this.ruleExtractor.analyzeCorrections(userId).catch((error) => {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "EnginePredictor: Failed to analyze corrections",
      );
    });

    logger.debug(
      {
        userId,
        originalIntent: correction.originalIntent,
        correctedIntent: correction.correctedIntent,
      },
      "EnginePredictor: Correction recorded",
    );
  }

  async getActiveRules(userId: string) {
    if (!this.configManager.enablePrediction) return [];
    return this.ruleExtractor.getActiveRules(userId);
  }

  async activateRule(userId: string, ruleId: string): Promise<void> {
    if (!this.configManager.enablePrediction) return;
    await this.ruleExtractor.activateRule(userId, ruleId);
  }

  async deactivateRule(userId: string, ruleId: string): Promise<void> {
    if (!this.configManager.enablePrediction) return;
    await this.ruleExtractor.deactivateRule(userId, ruleId);
  }
}
