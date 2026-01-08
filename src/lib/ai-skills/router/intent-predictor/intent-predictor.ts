/**
 * 意图预测服务
 *
 * 基于马尔可夫链和上下文调整的意图预测
 *
 * @module ai-skills/router/intent-predictor
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 3 - 智能预测核心服务
 */

import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import type { IntentType } from "../types";
import type {
  IntentPredictorConfig,
  PredictedIntent,
  QuickAction,
  IntentHistoryEntry,
  CorrectionRecord,
  TransitionMatrixRow,
  TransitionProbability,
  IIntentPredictor,
} from "./types";
import {
  DEFAULT_PREDICTOR_CONFIG,
  DEFAULT_PREDICTIONS,
  QUICK_ACTION_ICONS,
  LOG_MODULE,
} from "./types";

// =============================================================================
// 服务实现
// =============================================================================

/**
 * 意图预测服务
 *
 * 使用马尔可夫链模型预测用户下一步意图，
 * 结合上下文因素动态调整预测结果。
 */
export class IntentPredictor implements IIntentPredictor {
  public readonly config: IntentPredictorConfig;

  // 内存中的转移矩阵（按用户缓存）
  private transitionMatrixCache: Map<string, TransitionMatrixRow[]> = new Map();

  // 历史记录缓存（实际应从数据库加载）
  private historyCache: Map<string, IntentHistoryEntry[]> = new Map();

  // 纠正记录缓存
  private correctionCache: Map<string, CorrectionRecord[]> = new Map();

  constructor(config: Partial<IntentPredictorConfig> = {}) {
    this.config = { ...DEFAULT_PREDICTOR_CONFIG, ...config };
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 预测下一步意图
   */
  async predict(
    userId: string,
    currentMessage: string,
    currentIntent: { type: IntentType; subType?: string },
  ): Promise<PredictedIntent[]> {
    // 检查功能开关
    if (!FeatureFlags.ENABLE_INTENT_PREDICTION) {
      return [];
    }

    try {
      // 1. 获取用户历史意图
      const history = await this.getIntentHistory(userId);

      if (history.length < this.config.minHistorySamples) {
        // 历史数据不足，使用默认预测
        logger.debug(
          {
            module: LOG_MODULE,
            userId,
            historyLength: history.length,
            minRequired: this.config.minHistorySamples,
          },
          "Insufficient history, using default predictions",
        );
        return this.getDefaultPredictions(currentIntent);
      }

      // 2. 更新转移矩阵
      const matrix = this.buildTransitionMatrix(history);
      this.transitionMatrixCache.set(userId, matrix);

      // 3. 基于当前意图预测下一步
      const predictions = this.predictFromMatrix(matrix, currentIntent);

      // 4. 结合上下文调整预测
      const adjustedPredictions = this.config.enableContextAdjustment
        ? await this.adjustByContext(userId, predictions, currentMessage)
        : predictions;

      logger.info(
        {
          module: LOG_MODULE,
          userId,
          currentIntent: currentIntent.type,
          predictionsCount: adjustedPredictions.length,
          topPrediction: adjustedPredictions[0]?.intent,
        },
        "Intent prediction completed",
      );

      return adjustedPredictions;
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Intent prediction failed",
      );
      return [];
    }
  }

  /**
   * 获取快捷操作按钮
   */
  async getQuickActions(
    userId: string,
    currentIntent?: { type: IntentType; subType?: string },
  ): Promise<QuickAction[]> {
    if (!FeatureFlags.ENABLE_INTENT_PREDICTION) {
      return [];
    }

    // 获取预测
    const predictions = currentIntent
      ? await this.predict(userId, "", currentIntent)
      : this.getGlobalQuickActions();

    // 转换为快捷操作
    return predictions.map((pred, index) => ({
      id: `quick-${pred.intent}-${pred.subType ?? "default"}-${index}`,
      label: pred.suggestedAction,
      icon: QUICK_ACTION_ICONS[pred.intent],
      intent: pred.intent,
      subType: pred.subType,
      priority: Math.round(pred.probability * 100),
      confidence: pred.probability,
    }));
  }

  /**
   * 记录意图执行
   */
  async recordIntent(
    userId: string,
    entry: Omit<IntentHistoryEntry, "timestamp">,
  ): Promise<void> {
    const historyEntry: IntentHistoryEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    // 更新缓存
    const history = this.historyCache.get(userId) || [];
    history.push(historyEntry);

    // 清理过期记录
    const cutoff =
      Date.now() - this.config.historyRetentionDays * 24 * 60 * 60 * 1000;
    const filtered = history.filter((e) => e.timestamp > cutoff);
    this.historyCache.set(userId, filtered);

    // P2: 意图历史持久化 (配合 ENABLE_INTENT_PREDICTION Feature Flag)
    logger.debug(
      {
        module: LOG_MODULE,
        userId,
        intent: entry.intent,
        success: entry.success,
      },
      "Intent recorded",
    );
  }

  /**
   * 记录用户纠正
   */
  async recordCorrection(
    userId: string,
    correction: Omit<CorrectionRecord, "id" | "userId" | "timestamp">,
  ): Promise<void> {
    const record: CorrectionRecord = {
      id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      timestamp: Date.now(),
      ...correction,
    };

    // 更新缓存
    const corrections = this.correctionCache.get(userId) || [];
    corrections.push(record);
    this.correctionCache.set(userId, corrections);

    // 同时更新历史记录，标记被纠正
    const history = this.historyCache.get(userId) || [];
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.intent === correction.originalIntent) {
      lastEntry.wasCorrected = true;
      lastEntry.correctedTo = {
        intent: correction.correctedIntent,
        subType: correction.correctedSubType,
      };
    }

    // 使转移矩阵缓存失效
    this.transitionMatrixCache.delete(userId);

    // P2: 纠正记录持久化 (配合 ENABLE_RULE_LEARNING Feature Flag)
    logger.info(
      {
        module: LOG_MODULE,
        userId,
        original: correction.originalIntent,
        corrected: correction.correctedIntent,
      },
      "Correction recorded",
    );
  }

  // ===========================================================================
  // 私有方法 - 转移矩阵
  // ===========================================================================

  /**
   * 构建转移矩阵
   */
  private buildTransitionMatrix(
    history: IntentHistoryEntry[],
  ): TransitionMatrixRow[] {
    // 统计转移频率
    const transitionCounts: Map<string, Map<string, number>> = new Map();
    const fromCounts: Map<string, number> = new Map();

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];

      const fromKey = this.getIntentKey(current.intent, current.subType);
      const toKey = this.getIntentKey(next.intent, next.subType);

      // 更新转移计数
      if (!transitionCounts.has(fromKey)) {
        transitionCounts.set(fromKey, new Map());
      }
      const transitions =
        transitionCounts.get(fromKey) ?? new Map<string, number>();
      transitions.set(toKey, (transitions.get(toKey) || 0) + 1);

      // 更新源计数
      fromCounts.set(fromKey, (fromCounts.get(fromKey) || 0) + 1);

      // 如果被纠正，增加纠正后意图的权重
      if (current.wasCorrected && current.correctedTo) {
        const correctedKey = this.getIntentKey(
          current.correctedTo.intent,
          current.correctedTo.subType,
        );
        // 纠正的权重是普通转移的 2 倍
        transitions.set(correctedKey, (transitions.get(correctedKey) || 0) + 2);
        fromCounts.set(fromKey, (fromCounts.get(fromKey) || 0) + 2);
      }
    }

    // 构建矩阵行
    const matrix: TransitionMatrixRow[] = [];

    for (const [fromKey, transitions] of transitionCounts) {
      const [fromIntent, fromSubType] = this.parseIntentKey(fromKey);
      const totalObservations = fromCounts.get(fromKey) || 1;

      const transitionProbs: TransitionProbability[] = [];
      for (const [toKey, count] of transitions) {
        const [toIntent, toSubType] = this.parseIntentKey(toKey);
        transitionProbs.push({
          toIntent,
          toSubType,
          probability: count / totalObservations,
          observedCount: count,
        });
      }

      // 按概率排序
      transitionProbs.sort((a, b) => b.probability - a.probability);

      matrix.push({
        fromIntent,
        fromSubType,
        transitions: transitionProbs,
        totalObservations,
      });
    }

    return matrix;
  }

  /**
   * 基于转移矩阵预测
   */
  private predictFromMatrix(
    matrix: TransitionMatrixRow[],
    currentIntent: { type: IntentType; subType?: string },
  ): PredictedIntent[] {
    const key = this.getIntentKey(currentIntent.type, currentIntent.subType);

    // 查找匹配的矩阵行
    const row = matrix.find(
      (r) => this.getIntentKey(r.fromIntent, r.fromSubType) === key,
    );

    if (!row) {
      // 尝试只匹配意图类型
      const typeOnlyRow = matrix.find(
        (r) => r.fromIntent === currentIntent.type,
      );
      if (!typeOnlyRow) {
        return this.getDefaultPredictions(currentIntent);
      }
      return this.transitionsToPredictor(
        typeOnlyRow.transitions,
        currentIntent,
      );
    }

    return this.transitionsToPredictor(row.transitions, currentIntent);
  }

  /**
   * 转换转移概率为预测结果
   */
  private transitionsToPredictor(
    transitions: TransitionProbability[],
    currentIntent: { type: IntentType; subType?: string },
  ): PredictedIntent[] {
    return transitions
      .filter((t) => t.probability >= this.config.predictionThreshold)
      .slice(0, this.config.maxPredictions)
      .map((t) => ({
        intent: t.toIntent,
        subType: t.toSubType,
        probability: t.probability,
        triggerCondition: this.describeTriggerCondition(
          currentIntent,
          t.toIntent,
        ),
        suggestedAction: this.describeSuggestedAction(t.toIntent, t.toSubType),
        shouldPush: t.probability >= this.config.pushThreshold,
      }));
  }

  // ===========================================================================
  // 私有方法 - 上下文调整
  // ===========================================================================

  /**
   * 基于上下文调整预测
   */
  private async adjustByContext(
    userId: string,
    predictions: PredictedIntent[],
    currentMessage: string,
  ): Promise<PredictedIntent[]> {
    // 获取纠正历史
    const corrections = this.correctionCache.get(userId) || [];

    // 基于纠正历史调整
    const adjusted = predictions.map((pred) => {
      // 检查这个预测是否经常被纠正
      const correctionRate = this.getCorrectionRate(corrections, pred.intent);

      // 如果纠正率高，降低概率
      if (correctionRate > 0.3) {
        return {
          ...pred,
          probability: pred.probability * (1 - correctionRate * 0.5),
        };
      }

      return pred;
    });

    // 基于消息关键词调整（简单实现）
    const keywordAdjusted = this.adjustByKeywords(adjusted, currentMessage);

    // 重新排序并过滤
    return keywordAdjusted
      .filter((p) => p.probability >= this.config.predictionThreshold)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, this.config.maxPredictions);
  }

  /**
   * 获取意图的纠正率
   */
  private getCorrectionRate(
    corrections: CorrectionRecord[],
    intent: IntentType,
  ): number {
    const relevantCorrections = corrections.filter(
      (c) => c.originalIntent === intent,
    );
    if (relevantCorrections.length < 3) {
      return 0; // 样本太少，不调整
    }

    // 简单计算：纠正次数 / 总预测次数（估算）
    // 实际应该跟踪预测次数
    return Math.min(relevantCorrections.length / 10, 1);
  }

  /**
   * 基于关键词调整预测
   */
  private adjustByKeywords(
    predictions: PredictedIntent[],
    message: string,
  ): PredictedIntent[] {
    const keywords: Record<IntentType, string[]> = {
      query: ["查找", "搜索", "哪些", "多少", "统计"],
      action: ["添加", "删除", "修改", "移动", "标签", "导出", "下载", "备份"],
      organize: ["整理", "分类", "归档", "清理"],
      analyze: ["分析", "洞察", "趋势", "报告"],
      learn: ["学习", "复习", "记忆", "理解"],
      create: ["创建", "新建", "保存", "收藏", "分享"],
      refine: ["细化", "筛选", "过滤", "精确"],
      chitchat: ["你好", "帮助", "谢谢"],
    };

    return predictions.map((pred) => {
      const intentKeywords = keywords[pred.intent] || [];
      const hasKeyword = intentKeywords.some((kw) => message.includes(kw));

      if (hasKeyword) {
        return {
          ...pred,
          probability: Math.min(pred.probability * 1.3, 1),
        };
      }

      return pred;
    });
  }

  // ===========================================================================
  // 私有方法 - 辅助
  // ===========================================================================

  /**
   * 获取意图历史
   */
  private async getIntentHistory(
    userId: string,
  ): Promise<IntentHistoryEntry[]> {
    // P2: 从数据库加载历史 (配合 ENABLE_INTENT_PREDICTION Feature Flag)
    return this.historyCache.get(userId) || [];
  }

  /**
   * 获取默认预测
   */
  private getDefaultPredictions(currentIntent: {
    type: IntentType;
    subType?: string;
  }): PredictedIntent[] {
    return DEFAULT_PREDICTIONS[currentIntent.type] || [];
  }

  /**
   * 获取全局快捷操作
   */
  private getGlobalQuickActions(): PredictedIntent[] {
    // 没有当前意图时，返回通用操作
    return [
      {
        intent: "query",
        subType: "search",
        probability: 0.5,
        triggerCondition: "通用搜索",
        suggestedAction: "搜索收藏",
        shouldPush: false,
      },
      {
        intent: "organize",
        probability: 0.4,
        triggerCondition: "整理收藏",
        suggestedAction: "整理收藏夹",
        shouldPush: false,
      },
      {
        intent: "query",
        subType: "stats",
        probability: 0.35,
        triggerCondition: "查看统计",
        suggestedAction: "查看统计数据",
        shouldPush: false,
      },
    ];
  }

  /**
   * 生成意图键
   */
  private getIntentKey(intent: IntentType, subType?: string): string {
    return subType ? `${intent}:${subType}` : intent;
  }

  /**
   * 解析意图键
   */
  private parseIntentKey(key: string): [IntentType, string | undefined] {
    const [intent, subType] = key.split(":") as [IntentType, string?];
    return [intent, subType];
  }

  /**
   * 描述触发条件
   */
  private describeTriggerCondition(
    current: { type: IntentType; subType?: string },
    next: IntentType,
  ): string {
    const descriptions: Record<string, Record<IntentType, string>> = {
      query: {
        query: "继续搜索",
        action: "查询后操作",
        organize: "查询后整理",
        analyze: "查询后分析",
        learn: "查询后学习",
        create: "查询后创建",
        refine: "查询后细化",
        chitchat: "查询后帮助",
      },
      action: {
        query: "操作后验证",
        action: "连续操作",
        organize: "操作后整理",
        analyze: "操作后分析",
        learn: "操作后学习",
        create: "操作后创建",
        refine: "操作后细化",
        chitchat: "操作后帮助",
      },
    };

    return descriptions[current.type]?.[next] || `${current.type}后${next}`;
  }

  /**
   * 描述建议操作
   */
  private describeSuggestedAction(
    intent: IntentType,
    subType?: string,
  ): string {
    const actions: Record<string, string> = {
      "query:search": "搜索收藏",
      "query:stats": "查看统计",
      "query:count": "统计数量",
      "action:tag": "添加标签",
      "action:move": "移动到文件夹",
      "action:delete": "删除收藏",
      organize: "智能整理",
      analyze: "生成分析报告",
      export: "导出数据",
      learn: "开始学习",
      create: "创建新收藏",
      refine: "细化搜索",
    };

    const key = subType ? `${intent}:${subType}` : intent;
    return actions[key] || `执行${intent}`;
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建意图预测器实例
 */
export function createIntentPredictor(
  config?: Partial<IntentPredictorConfig>,
): IntentPredictor {
  return new IntentPredictor(config);
}
