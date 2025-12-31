/**
 * 规则提取服务
 *
 * 从用户纠正行为中自动学习和提取规则
 *
 * @module ai-agent/preferences/rule-learning
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 3 - 规则自动学习核心服务
 */

import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import type { IntentType } from "@/lib/ai-skills/router/types";
import type { CorrectionRecord } from "@/lib/ai-skills/router/intent-predictor/types";
import type {
  RuleExtractorConfig,
  ExtractedRule,
  RuleCandidate,
  CorrectionPattern,
  RuleApplicationResult,
  IRuleExtractor,
} from "./types";
import { DEFAULT_EXTRACTOR_CONFIG, LOG_MODULE } from "./types";

// =============================================================================
// 服务实现
// =============================================================================

/**
 * 规则提取服务
 *
 * 分析用户纠正行为，自动提取意图覆盖、参数默认值等规则。
 */
export class RuleExtractor implements IRuleExtractor {
  public readonly config: RuleExtractorConfig;

  // 用户规则缓存
  private rulesCache: Map<string, ExtractedRule[]> = new Map();

  // 纠正记录缓存（实际应从 IntentPredictor 或数据库获取）
  private correctionsCache: Map<string, CorrectionRecord[]> = new Map();

  constructor(config: Partial<RuleExtractorConfig> = {}) {
    this.config = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 分析纠正记录，提取规则候选
   */
  async analyzeCorrections(userId: string): Promise<RuleCandidate[]> {
    if (!FeatureFlags.ENABLE_RULE_LEARNING) {
      return [];
    }

    try {
      // 获取纠正记录
      const corrections = await this.getCorrections(userId);

      if (corrections.length < this.config.minObservations) {
        logger.debug(
          {
            module: LOG_MODULE,
            userId,
            correctionCount: corrections.length,
            minRequired: this.config.minObservations,
          },
          "Insufficient corrections for rule extraction",
        );
        return [];
      }

      // 发现纠正模式
      const patterns = this.discoverPatterns(corrections);

      // 生成规则候选
      const candidates = this.generateCandidates(patterns);

      // 过滤低质量候选
      const filtered = candidates.filter(
        (c) => c.confidence >= this.config.minConfidence,
      );

      logger.info(
        {
          module: LOG_MODULE,
          userId,
          patternsFound: patterns.length,
          candidatesGenerated: candidates.length,
          candidatesFiltered: filtered.length,
        },
        "Rule extraction completed",
      );

      // 自动激活高置信度规则
      if (this.config.autoActivateRules) {
        await this.autoActivateHighConfidenceRules(userId, filtered);
      }

      return filtered;
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Rule extraction failed",
      );
      return [];
    }
  }

  /**
   * 获取用户的激活规则
   */
  async getActiveRules(userId: string): Promise<ExtractedRule[]> {
    const rules = this.rulesCache.get(userId) || [];
    return rules.filter((r) => r.isActive);
  }

  /**
   * 应用规则到意图
   */
  async applyRules(
    userId: string,
    intent: { type: IntentType; subType?: string },
    message: string,
  ): Promise<RuleApplicationResult> {
    if (!FeatureFlags.ENABLE_RULE_LEARNING) {
      return { applied: false, appliedRules: [] };
    }

    const activeRules = await this.getActiveRules(userId);
    const appliedRules: ExtractedRule[] = [];
    let modifiedIntent = { ...intent };
    const additionalParams: Record<string, unknown> = {};
    const chainedActions: string[] = [];
    const notifications: string[] = [];
    let shouldSkip = false;

    for (const rule of activeRules) {
      if (this.matchesCondition(rule, intent, message)) {
        appliedRules.push(rule);

        // 应用规则动作
        switch (rule.action.type) {
          case "override_intent":
            if (rule.action.targetIntent) {
              modifiedIntent = {
                type: rule.action.targetIntent,
                subType: rule.action.targetSubType,
              };
            }
            break;

          case "set_param":
            if (rule.action.params) {
              Object.assign(additionalParams, rule.action.params);
            }
            break;

          case "chain_action":
            if (rule.action.chainedAction) {
              chainedActions.push(rule.action.chainedAction);
            }
            break;

          case "skip":
            shouldSkip = true;
            break;

          case "notify":
            if (rule.action.notifyMessage) {
              notifications.push(rule.action.notifyMessage);
            }
            break;
        }

        // 更新规则触发时间
        rule.lastTriggeredAt = Date.now();
        rule.observedCount++;
      }
    }

    if (appliedRules.length > 0) {
      logger.debug(
        {
          module: LOG_MODULE,
          userId,
          originalIntent: intent.type,
          modifiedIntent: modifiedIntent.type,
          appliedRulesCount: appliedRules.length,
        },
        "Rules applied to intent",
      );
    }

    return {
      applied: appliedRules.length > 0,
      appliedRules,
      modifiedIntent:
        modifiedIntent.type !== intent.type ||
        modifiedIntent.subType !== intent.subType
          ? modifiedIntent
          : undefined,
      additionalParams:
        Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
      chainedActions: chainedActions.length > 0 ? chainedActions : undefined,
      shouldSkip,
      notifications: notifications.length > 0 ? notifications : undefined,
    };
  }

  /**
   * 激活规则
   */
  async activateRule(userId: string, ruleId: string): Promise<void> {
    const rules = this.rulesCache.get(userId) || [];
    const rule = rules.find((r) => r.id === ruleId);

    if (rule) {
      rule.isActive = true;
      logger.info({ module: LOG_MODULE, userId, ruleId }, "Rule activated");
    }
  }

  /**
   * 停用规则
   */
  async deactivateRule(userId: string, ruleId: string): Promise<void> {
    const rules = this.rulesCache.get(userId) || [];
    const rule = rules.find((r) => r.id === ruleId);

    if (rule) {
      rule.isActive = false;
      logger.info({ module: LOG_MODULE, userId, ruleId }, "Rule deactivated");
    }
  }

  /**
   * 记录用户纠正行为（用于规则学习）
   * @param userId - 用户 ID
   * @param correction - 纠正记录
   */
  recordCorrection(
    userId: string,
    correction: {
      originalIntent: string;
      correctedIntent: string;
      context?: Record<string, unknown>;
      timestamp?: Date;
      originalMessage?: string;
    },
  ): void {
    if (!FeatureFlags.ENABLE_RULE_LEARNING) {
      return;
    }

    const record: CorrectionRecord = {
      id: `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      originalIntent: correction.originalIntent as IntentType,
      correctedIntent: correction.correctedIntent as IntentType,
      originalMessage: correction.originalMessage || "",
      timestamp: correction.timestamp?.getTime() || Date.now(),
    };

    // 添加到缓存
    const existing = this.correctionsCache.get(userId) || [];
    existing.push(record);

    // 限制缓存大小
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }

    this.correctionsCache.set(userId, existing);

    logger.debug(
      {
        module: LOG_MODULE,
        userId,
        originalIntent: record.originalIntent,
        correctedIntent: record.correctedIntent,
      },
      "Correction recorded",
    );
  }

  /**
   * 从纠正记录中提取规则（别名 analyzeCorrections）
   * @param userId - 用户 ID
   * @returns 提取的规则候选列表
   */
  async extractRules(userId: string): Promise<RuleCandidate[]> {
    return this.analyzeCorrections(userId);
  }

  /**
   * 添加纠正记录（由 IntentPredictor 调用）
   */
  addCorrection(userId: string, correction: CorrectionRecord): void {
    const corrections = this.correctionsCache.get(userId) || [];
    corrections.push(correction);
    this.correctionsCache.set(userId, corrections);
  }

  // ===========================================================================
  // 私有方法 - 模式发现
  // ===========================================================================

  /**
   * 发现纠正模式
   */
  private discoverPatterns(
    corrections: CorrectionRecord[],
  ): CorrectionPattern[] {
    const patternMap = new Map<string, CorrectionPattern>();

    for (const correction of corrections) {
      const key = `${correction.originalIntent}:${correction.originalSubType ?? ""}->${correction.correctedIntent}:${correction.correctedSubType ?? ""}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          originalIntent: correction.originalIntent,
          originalSubType: correction.originalSubType,
          correctedIntent: correction.correctedIntent,
          correctedSubType: correction.correctedSubType,
          count: 0,
          lastSeen: 0,
          messageSamples: [],
        });
      }

      const pattern = patternMap.get(key) as CorrectionPattern;
      pattern.count++;
      pattern.lastSeen = Math.max(pattern.lastSeen, correction.timestamp);

      // 保留最多 5 个消息样本
      if (pattern.messageSamples.length < 5) {
        pattern.messageSamples.push(correction.originalMessage);
      }
    }

    return Array.from(patternMap.values());
  }

  /**
   * 生成规则候选
   */
  private generateCandidates(patterns: CorrectionPattern[]): RuleCandidate[] {
    const candidates: RuleCandidate[] = [];
    const totalCorrections = patterns.reduce((sum, p) => sum + p.count, 0);

    for (const pattern of patterns) {
      // 支持度：该模式占所有纠正的比例
      const support = pattern.count / totalCorrections;

      // 置信度：基于观测次数和一致性
      const confidence = this.calculateConfidence(pattern);

      // 提升度：相对于随机的提升
      const lift = this.calculateLift(pattern, patterns);

      if (pattern.count >= this.config.minObservations) {
        candidates.push({
          rule: {
            type: "intent_override",
            condition: {
              intentType: pattern.originalIntent,
              subType: pattern.originalSubType,
              // 从消息样本中提取共同关键词
              keywords: this.extractCommonKeywords(pattern.messageSamples),
            },
            action: {
              type: "override_intent",
              targetIntent: pattern.correctedIntent,
              targetSubType: pattern.correctedSubType,
            },
            confidence,
            observedCount: pattern.count,
            isActive: false,
            source: "correction",
          },
          support,
          confidence,
          lift,
        });
      }
    }

    // 按置信度排序
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  // ===========================================================================
  // 私有方法 - 置信度计算
  // ===========================================================================

  /**
   * 计算置信度
   */
  private calculateConfidence(pattern: CorrectionPattern): number {
    // 基础置信度：基于观测次数
    const baseConfidence = Math.min(pattern.count / 10, 1);

    // 时间衰减：最近的纠正权重更高
    const daysSinceLastSeen =
      (Date.now() - pattern.lastSeen) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysSinceLastSeen / 30); // 30 天半衰期

    // 一致性加成：如果所有纠正都指向同一目标
    const consistencyBonus = 0.1;

    return Math.min(baseConfidence * timeDecay + consistencyBonus, 1);
  }

  /**
   * 计算提升度
   */
  private calculateLift(
    pattern: CorrectionPattern,
    allPatterns: CorrectionPattern[],
  ): number {
    const totalCount = allPatterns.reduce((sum, p) => sum + p.count, 0);
    const patternSupport = pattern.count / totalCount;

    // 目标意图的基准概率
    const targetPatterns = allPatterns.filter(
      (p) => p.correctedIntent === pattern.correctedIntent,
    );
    const targetSupport =
      targetPatterns.reduce((sum, p) => sum + p.count, 0) / totalCount;

    // 提升度 = 实际概率 / 基准概率
    return targetSupport > 0 ? patternSupport / targetSupport : 1;
  }

  // ===========================================================================
  // 私有方法 - 辅助
  // ===========================================================================

  /**
   * 获取纠正记录
   */
  private async getCorrections(userId: string): Promise<CorrectionRecord[]> {
    // TODO: 从数据库加载
    return this.correctionsCache.get(userId) || [];
  }

  /**
   * 检查规则是否匹配条件
   */
  private matchesCondition(
    rule: ExtractedRule,
    intent: { type: IntentType; subType?: string },
    message: string,
  ): boolean {
    const { condition } = rule;

    // 检查意图类型
    if (condition.intentType && condition.intentType !== intent.type) {
      return false;
    }

    // 检查子类型
    if (condition.subType && condition.subType !== intent.subType) {
      return false;
    }

    // 检查关键词
    if (condition.keywords && condition.keywords.length > 0) {
      const hasKeyword = condition.keywords.some((kw) =>
        message.toLowerCase().includes(kw.toLowerCase()),
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // 检查正则
    if (condition.pattern) {
      try {
        const regex = new RegExp(condition.pattern, "i");
        if (!regex.test(message)) {
          return false;
        }
      } catch {
        // 无效正则，跳过
      }
    }

    return true;
  }

  /**
   * 从消息样本中提取共同关键词
   */
  private extractCommonKeywords(messages: string[]): string[] {
    if (messages.length === 0) return [];

    // 简单实现：提取所有消息中出现的中文词
    const wordCounts = new Map<string, number>();
    const chineseWordRegex = /[\u4e00-\u9fa5]+/g;

    for (const message of messages) {
      const words = message.match(chineseWordRegex) || [];
      const uniqueWords = new Set(words);

      for (const word of uniqueWords) {
        if (word.length >= 2) {
          // 只考虑 2 字以上的词
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }

    // 返回在大多数消息中出现的词
    const threshold = messages.length * 0.5;
    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([word]) => word)
      .slice(0, 3); // 最多 3 个关键词
  }

  /**
   * 自动激活高置信度规则
   */
  private async autoActivateHighConfidenceRules(
    userId: string,
    candidates: RuleCandidate[],
  ): Promise<void> {
    const existingRules = this.rulesCache.get(userId) || [];

    for (const candidate of candidates) {
      if (candidate.confidence >= this.config.autoActivateThreshold) {
        // 检查是否已存在类似规则
        const exists = existingRules.some(
          (r) =>
            r.condition.intentType === candidate.rule.condition.intentType &&
            r.action.targetIntent === candidate.rule.action.targetIntent,
        );

        if (!exists) {
          const newRule: ExtractedRule = {
            ...candidate.rule,
            id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
            lastTriggeredAt: Date.now(),
            isActive: true,
          };

          existingRules.push(newRule);

          logger.info(
            {
              module: LOG_MODULE,
              userId,
              ruleId: newRule.id,
              confidence: candidate.confidence,
            },
            "High-confidence rule auto-activated",
          );
        }
      }
    }

    // 限制最大规则数量
    if (existingRules.length > this.config.maxRules) {
      // 按置信度排序，保留最好的
      existingRules.sort((a, b) => b.confidence - a.confidence);
      existingRules.length = this.config.maxRules;
    }

    this.rulesCache.set(userId, existingRules);
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建规则提取器实例
 */
export function createRuleExtractor(
  config?: Partial<RuleExtractorConfig>,
): RuleExtractor {
  return new RuleExtractor(config);
}
