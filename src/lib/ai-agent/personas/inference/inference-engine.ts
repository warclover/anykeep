/**
 * 画像推断引擎
 *
 * 基于用户行为数据推断最匹配的用户画像
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  IInferenceEngine,
  InferenceEngineConfig,
  InferenceResult,
  InferenceRule,
  RuleMatchResult,
  UserBehaviorData,
} from "./types";
import type { PersonaType, PersonaGroup } from "../types";
import { ConditionMatcher } from "./condition-matcher";
import { ALL_INFERENCE_RULES } from "./rules";
import { PERSONA_GROUP_WEIGHTS } from "./weight-matrix";

// =============================================================================
// 推断引擎实现
// =============================================================================

/**
 * 画像推断引擎
 */
export class PersonaInferenceEngine implements IInferenceEngine {
  private rules: InferenceRule[] = [];
  private config: InferenceEngineConfig;
  private conditionMatcher: ConditionMatcher;
  private cache: Map<string, { result: InferenceResult; timestamp: number }> =
    new Map();

  constructor(config?: Partial<InferenceEngineConfig>) {
    this.config = {
      minConfidenceThreshold: 0.3,
      maxResults: 5,
      debug: false,
      enableCache: true,
      cacheTtlMs: 5 * 60 * 1000,
      ...config,
    };
    this.conditionMatcher = new ConditionMatcher();

    // 注册默认规则
    this.registerDefaultRules();
  }

  /**
   * 注册默认推断规则
   */
  private registerDefaultRules(): void {
    for (const rule of ALL_INFERENCE_RULES) {
      this.registerRule(rule);
    }
  }

  /**
   * 执行画像推断
   */
  async infer(behaviorData: UserBehaviorData): Promise<InferenceResult> {
    const startTime = Date.now();

    // 检查缓存
    if (this.config.enableCache) {
      const cached = this.getFromCache(behaviorData);
      if (cached) {
        return cached;
      }
    }

    // 评估所有规则
    const ruleResults = this.evaluateRules(behaviorData);

    // 聚合结果
    const aggregatedResults = this.aggregateResults(ruleResults);

    // 排序并选择最佳
    const sortedResults = aggregatedResults.sort(
      (a, b) => b.confidence - a.confidence,
    );

    // 过滤低置信度结果
    const filteredResults = sortedResults.filter(
      (r) => r.confidence >= this.config.minConfidenceThreshold,
    );

    // 构建结果
    const result = this.buildResult(
      filteredResults,
      ruleResults,
      behaviorData,
      startTime,
    );

    // 缓存结果
    if (this.config.enableCache) {
      this.saveToCache(behaviorData, result);
    }

    return result;
  }

  /**
   * 评估所有规则
   */
  private evaluateRules(behaviorData: UserBehaviorData): RuleMatchResult[] {
    const results: RuleMatchResult[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const matchResult = this.evaluateRule(rule, behaviorData);
      results.push(matchResult);
    }

    return results;
  }

  /**
   * 评估单个规则
   */
  private evaluateRule(
    rule: InferenceRule,
    behaviorData: UserBehaviorData,
  ): RuleMatchResult {
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const condition of rule.conditions) {
      const result = this.conditionMatcher.match(condition, behaviorData);
      const weight = condition.weight ?? 1;
      totalWeight += weight;

      if (result.matched) {
        matchedWeight += weight * result.confidence;
        matchedConditions.push(result.description);
      } else {
        failedConditions.push(result.description);

        // 如果是必需条件且未匹配，整个规则失败
        if (condition.required) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            matched: false,
            confidence: 0,
            matchedConditions,
            failedConditions,
            targetPersona: rule.targetPersona,
            targetGroup: rule.targetGroup,
          };
        }
      }
    }

    // 根据条件逻辑计算是否匹配
    let matched = false;
    let confidence = 0;

    switch (rule.conditionLogic) {
      case "and":
        matched = failedConditions.length === 0;
        confidence =
          matched && totalWeight > 0 ? matchedWeight / totalWeight : 0;
        break;
      case "or":
        matched = matchedConditions.length > 0;
        confidence =
          matched && totalWeight > 0 ? matchedWeight / totalWeight : 0;
        break;
      case "not":
        matched = matchedConditions.length === 0;
        confidence = matched ? 1 : 0;
        break;
    }

    // 应用最小置信度阈值
    if (confidence < rule.minConfidence) {
      matched = false;
      confidence = 0;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched,
      confidence,
      matchedConditions,
      failedConditions,
      targetPersona: rule.targetPersona,
      targetGroup: rule.targetGroup,
    };
  }

  /**
   * 聚合规则结果（按画像）
   */
  private aggregateResults(ruleResults: RuleMatchResult[]): Array<{
    persona: PersonaType;
    group: PersonaGroup;
    confidence: number;
    matchedRules: RuleMatchResult[];
  }> {
    const personaMap = new Map<
      PersonaType,
      {
        group: PersonaGroup;
        confidences: number[];
        matchedRules: RuleMatchResult[];
      }
    >();

    for (const result of ruleResults) {
      if (!result.matched) continue;

      const existing = personaMap.get(result.targetPersona);
      if (existing) {
        existing.confidences.push(result.confidence);
        existing.matchedRules.push(result);
      } else {
        personaMap.set(result.targetPersona, {
          group: result.targetGroup,
          confidences: [result.confidence],
          matchedRules: [result],
        });
      }
    }

    return Array.from(personaMap.entries()).map(([persona, data]) => {
      // 计算加权平均置信度
      const avgConfidence =
        data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;

      // 应用画像组权重
      const groupWeight = PERSONA_GROUP_WEIGHTS[data.group] ?? 1;

      // 考虑规则覆盖度加成
      const coverageBonus = Math.min(0.1, data.matchedRules.length * 0.02);

      const finalConfidence = Math.min(
        1,
        avgConfidence * groupWeight + coverageBonus,
      );

      return {
        persona,
        group: data.group,
        confidence: finalConfidence,
        matchedRules: data.matchedRules,
      };
    });
  }

  /**
   * 构建最终结果
   */
  private buildResult(
    sortedResults: Array<{
      persona: PersonaType;
      group: PersonaGroup;
      confidence: number;
      matchedRules: RuleMatchResult[];
    }>,
    allRuleResults: RuleMatchResult[],
    behaviorData: UserBehaviorData,
    startTime: number,
  ): InferenceResult {
    const inferenceTimeMs = Date.now() - startTime;

    // 如果没有匹配结果，返回 general
    if (sortedResults.length === 0) {
      return {
        recommendedPersona: "general",
        recommendedGroup: "tech", // general 默认归类
        confidence: 0,
        matchedRules: [],
        alternatives: [],
        inferenceTimeMs,
        debugInfo: this.config.debug
          ? {
              totalRulesEvaluated: this.rules.filter((r) => r.enabled).length,
              behaviorDataSummary: this.summarizeBehaviorData(behaviorData),
            }
          : undefined,
      };
    }

    const best = sortedResults[0];
    const alternatives = sortedResults
      .slice(1, this.config.maxResults)
      .map((r) => ({
        persona: r.persona,
        group: r.group,
        confidence: r.confidence,
      }));

    return {
      recommendedPersona: best.persona,
      recommendedGroup: best.group,
      confidence: best.confidence,
      matchedRules: best.matchedRules,
      alternatives,
      inferenceTimeMs,
      debugInfo: this.config.debug
        ? {
            totalRulesEvaluated: this.rules.filter((r) => r.enabled).length,
            behaviorDataSummary: this.summarizeBehaviorData(behaviorData),
          }
        : undefined,
    };
  }

  /**
   * 总结行为数据
   */
  private summarizeBehaviorData(
    behaviorData: UserBehaviorData,
  ): Record<string, unknown> {
    return {
      totalTags: behaviorData.tags.length,
      topPlatforms: Object.entries(behaviorData.platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([p]) => p),
      totalBookmarks: behaviorData.activityMetrics.totalBookmarks,
      recentActivity: behaviorData.activityMetrics.recentWeekCount,
    };
  }

  // =============================================================================
  // 缓存管理
  // =============================================================================

  /**
   * 生成缓存键
   */
  private generateCacheKey(behaviorData: UserBehaviorData): string {
    // 使用行为数据的关键特征生成简化的缓存键
    const keyParts = [
      behaviorData.tags.slice(0, 10).sort().join(","),
      Object.keys(behaviorData.platformCounts).sort().join(","),
      behaviorData.activityMetrics.totalBookmarks.toString(),
    ];
    return keyParts.join("|");
  }

  /**
   * 从缓存获取
   */
  private getFromCache(behaviorData: UserBehaviorData): InferenceResult | null {
    const key = this.generateCacheKey(behaviorData);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.config.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * 保存到缓存
   */
  private saveToCache(
    behaviorData: UserBehaviorData,
    result: InferenceResult,
  ): void {
    const key = this.generateCacheKey(behaviorData);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  // =============================================================================
  // 公共方法
  // =============================================================================

  /**
   * 注册推断规则
   */
  registerRule(rule: InferenceRule): void {
    // 检查是否已存在
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * 获取所有已注册规则
   */
  getRules(): InferenceRule[] {
    return [...this.rules];
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 创建推断引擎实例
 */
export function createInferenceEngine(
  config?: Partial<InferenceEngineConfig>,
): PersonaInferenceEngine {
  return new PersonaInferenceEngine(config);
}

/**
 * 默认推断引擎实例
 */
export const defaultInferenceEngine = new PersonaInferenceEngine();
