/**
 * SpeculativeExecutor - 推测执行器
 *
 * 职责：
 * - 根据置信度和风险等级决定执行策略
 * - 支持 Speculative Execution + Undo 机制
 * - 管理撤销栈
 *
 * 策略：
 * 1. 高置信度（≥85%）+ 低风险：静默执行
 * 2. 中置信度（60-84%）+ 低/中风险：先执行再提供撤销
 * 3. 低置信度（<60%）：请求澄清
 * 4. 高风险操作：必须确认
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import type {
  ExecutionStrategy,
  RiskLevel,
  ExecutionResult,
  UndoAction,
  UndoResult,
  IntentWithSlots,
  ExecutionContext,
  SpeculativeExecutorConfig,
  ExecutionStrategyConfig,
  ClarificationOption,
} from "./types";
import type { IntentType } from "../router/types";

// ============================================
// 常量配置
// ============================================

/**
 * 默认执行策略配置
 */
const DEFAULT_STRATEGY_CONFIG: ExecutionStrategyConfig = {
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.6,
  undoTimeoutMs: 10000, // 10秒
  clarificationTimeoutMs: 30000, // 30秒
};

/**
 * 意图风险等级映射
 * 格式: "type:subType" -> RiskLevel
 */
const RISK_LEVELS: Record<string, RiskLevel> = {
  // 低风险操作
  "query:search": "low",
  "query:list": "low",
  "query:count": "low",
  "query:get": "low",
  "chitchat:greeting": "low",
  "chitchat:help": "low",
  "chitchat:thanks": "low",

  // 中风险操作
  "action:tag": "medium",
  "action:move": "medium",
  "action:star": "medium",
  "action:mark_read": "medium",
  "action:archive": "medium",
  "organize:classify": "medium",
  "organize:tag": "medium",
  "create:digest": "medium",
  "create:export": "medium",
  "create:tts": "medium",

  // 高风险操作
  "action:delete": "high",
  "action:batch_delete": "high",
  "organize:cleanup": "medium", // cleanup 可能包含删除，但默认中风险
  "organize:dedupe": "medium", // 去重可能删除，中风险
};

/**
 * 意图用户友好标签
 */
const INTENT_LABELS: Record<string, Record<string, string>> = {
  query: {
    search: "搜索",
    list: "列表",
    count: "统计",
    get: "查看详情",
  },
  action: {
    delete: "删除",
    move: "移动",
    tag: "打标签",
    star: "收藏",
    mark_read: "标记已读",
    archive: "归档",
    undo: "撤销",
  },
  organize: {
    cleanup: "整理",
    dedupe: "去重",
    classify: "分类",
    tag: "智能标签",
  },
  create: {
    digest: "生成摘要",
    export: "导出数据",
    tts: "语音朗读",
    md_collection: "保存笔记",
    import: "导入书签",
  },
  analyze: {
    report: "生成报告",
    insight: "数据洞察",
  },
  learn: {
    path: "学习路径",
  },
  chitchat: {
    greeting: "问候",
    help: "帮助",
    thanks: "感谢",
  },
};

/**
 * 生成唯一 ID
 */
function generateUndoId(): string {
  return `undo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// SpeculativeExecutor 类
// ============================================

/**
 * 推测执行器
 *
 * 根据置信度和风险等级决定执行策略，支持撤销机制
 */
export class SpeculativeExecutor {
  private config: Required<SpeculativeExecutorConfig> & {
    strategy: ExecutionStrategyConfig;
  };
  private undoStack: UndoAction[] = [];
  private undoCleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: SpeculativeExecutorConfig = {}) {
    this.config = {
      strategy: {
        ...DEFAULT_STRATEGY_CONFIG,
        ...config.strategy,
      },
      debug: config.debug ?? false,
      maxUndoStackSize: config.maxUndoStackSize ?? 50,
    };
  }

  /**
   * 根据置信度和风险等级决定执行策略
   *
   * @param intent - 意图分类结果
   * @param context - 执行上下文
   * @returns 执行结果
   */
  async execute(
    intent: IntentWithSlots,
    context: ExecutionContext,
    executor: (
      intent: IntentWithSlots,
      context: ExecutionContext,
    ) => Promise<{
      success: boolean;
      message: string;
      data?: unknown;
      affectedCount?: number;
    }>,
  ): Promise<ExecutionResult> {
    const riskLevel = this.getRiskLevel(intent.type, intent.subType);
    const strategy = this.determineStrategy(intent.confidence, riskLevel);

    if (this.config.debug) {
      logger.debug(
        {
          intent: `${intent.type}:${intent.subType}`,
          confidence: intent.confidence,
          riskLevel,
          strategy,
        },
        "SpeculativeExecutor: Determined execution strategy",
      );
    }

    switch (strategy) {
      case "silent_execute":
        return this.executeSilently(intent, context, executor);

      case "speculative_execute":
        return this.executeWithUndo(intent, context, executor);

      case "clarify":
        return this.requestClarification(intent, context);

      case "confirm_required":
        return this.requestConfirmation(intent, context);

      default:
        // 兜底：执行并提供撤销
        return this.executeWithUndo(intent, context, executor);
    }
  }

  /**
   * 获取意图的风险等级
   */
  getRiskLevel(type: IntentType, subType?: string): RiskLevel {
    const key = subType ? `${type}:${subType}` : `${type}:*`;
    const specificLevel = RISK_LEVELS[key];

    if (specificLevel) {
      return specificLevel;
    }

    // 检查通配符
    const wildcardLevel = RISK_LEVELS[`${type}:*`];
    if (wildcardLevel) {
      return wildcardLevel;
    }

    // 默认中风险
    return "medium";
  }

  /**
   * 确定执行策略
   */
  determineStrategy(
    confidence: number,
    riskLevel: RiskLevel,
  ): ExecutionStrategy {
    // 高风险操作必须确认
    if (riskLevel === "high") {
      return "confirm_required";
    }

    // 高置信度：静默执行
    if (confidence >= this.config.strategy.highConfidenceThreshold) {
      return "silent_execute";
    }

    // 中置信度：先执行再提供撤销
    if (confidence >= this.config.strategy.mediumConfidenceThreshold) {
      return "speculative_execute";
    }

    // 低置信度：请求澄清
    return "clarify";
  }

  /**
   * 生成澄清问题（公共方法，供 UnifiedEngine 调用）
   *
   * @param intent - 带槽位的意图
   * @returns 澄清问题和选项
   */
  generateClarificationQuestion(intent: IntentWithSlots): {
    question: string;
    options: ClarificationOption[];
    timeout: number;
  } {
    const options = this.buildClarificationOptions(intent);

    return {
      question: "您想要：",
      options,
      timeout: this.config.strategy.clarificationTimeoutMs,
    };
  }

  /**
   * 静默执行（高置信度）
   * 完成后简短汇报
   */
  private async executeSilently(
    intent: IntentWithSlots,
    context: ExecutionContext,
    executor: (
      intent: IntentWithSlots,
      context: ExecutionContext,
    ) => Promise<{
      success: boolean;
      message: string;
      data?: unknown;
      affectedCount?: number;
    }>,
  ): Promise<ExecutionResult> {
    try {
      const result = await executor(intent, context);

      return {
        success: result.success,
        message: this.generateBriefReport(intent, result),
        showUndo: false,
        data: result.data,
        affectedCount: result.affectedCount,
      };
    } catch (error) {
      logger.error(
        { error, intent },
        "SpeculativeExecutor: Silent execution failed",
      );
      return {
        success: false,
        message: `执行失败：${error instanceof Error ? error.message : "未知错误"}`,
        showUndo: false,
      };
    }
  }

  /**
   * 推测执行 + 撤销选项（中置信度）
   * 先执行，提供 10 秒撤销窗口
   */
  private async executeWithUndo(
    intent: IntentWithSlots,
    context: ExecutionContext,
    executor: (
      intent: IntentWithSlots,
      context: ExecutionContext,
    ) => Promise<{
      success: boolean;
      message: string;
      data?: unknown;
      affectedCount?: number;
      snapshot?: unknown;
      undoExecutor?: () => Promise<void>;
    }>,
  ): Promise<ExecutionResult> {
    try {
      const result = await executor(intent, context);

      if (!result.success) {
        return {
          success: false,
          message: result.message,
          showUndo: false,
        };
      }

      // 创建撤销操作
      const undoAction: UndoAction = {
        id: generateUndoId(),
        userId: context.userId,
        intentType: intent.type,
        intentSubType: intent.subType,
        description: this.getActionLabel(intent),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.strategy.undoTimeoutMs),
        execute:
          result.undoExecutor ||
          (async () => {
            logger.warn({ undoId: undoAction.id }, "No undo executor provided");
          }),
        snapshot: result.snapshot,
      };

      // 添加到撤销栈
      this.pushUndo(undoAction);

      // 设置自动清理定时器
      this.scheduleUndoCleanup(
        undoAction.id,
        this.config.strategy.undoTimeoutMs,
      );

      return {
        success: true,
        message: this.generateReportWithExplanation(intent, result),
        showUndo: true,
        undoId: undoAction.id,
        undoLabel: `撤销${this.getActionLabel(intent)}`,
        undoTimeout: this.config.strategy.undoTimeoutMs,
        data: result.data,
        affectedCount: result.affectedCount,
      };
    } catch (error) {
      logger.error(
        { error, intent },
        "SpeculativeExecutor: Execution with undo failed",
      );
      return {
        success: false,
        message: `执行失败：${error instanceof Error ? error.message : "未知错误"}`,
        showUndo: false,
      };
    }
  }

  /**
   * 请求澄清（低置信度）
   * 提供选项式问题，而非开放问
   */
  private requestClarification(
    intent: IntentWithSlots,
    _context: ExecutionContext,
  ): ExecutionResult {
    const options = this.buildClarificationOptions(intent);

    return {
      success: false,
      message: "",
      requiresClarification: true,
      clarificationQuestion: "您想要：",
      clarificationOptions: options,
      clarificationTimeout: this.config.strategy.clarificationTimeoutMs,
    };
  }

  /**
   * 请求确认（高风险操作）
   */
  private requestConfirmation(
    intent: IntentWithSlots,
    context: ExecutionContext,
  ): ExecutionResult {
    const affectedCount = context.selectedBookmarks?.length || 0;
    const actionLabel = this.getActionLabel(intent);

    return {
      success: false,
      message: "",
      requiresConfirmation: true,
      confirmationMessage: `确定要${actionLabel}吗？`,
      impactDescription:
        affectedCount > 0 ? `将影响 ${affectedCount} 条书签` : "此操作不可撤销",
    };
  }

  /**
   * 执行撤销操作
   */
  async undo(undoId: string): Promise<UndoResult> {
    const undoAction = this.undoStack.find((a) => a.id === undoId);

    if (!undoAction) {
      return {
        success: false,
        message: "撤销操作已过期或不存在",
      };
    }

    // 检查是否过期
    if (new Date() > undoAction.expiresAt) {
      this.removeUndo(undoId);
      return {
        success: false,
        message: "撤销操作已过期",
      };
    }

    try {
      // 执行撤销
      await undoAction.execute();

      // 从栈中移除
      this.removeUndo(undoId);

      if (this.config.debug) {
        logger.debug(
          {
            undoId,
            intent: `${undoAction.intentType}:${undoAction.intentSubType}`,
          },
          "SpeculativeExecutor: Undo executed successfully",
        );
      }

      return {
        success: true,
        message: `已撤销${undoAction.description}`,
      };
    } catch (error) {
      logger.error(
        { error, undoId },
        "SpeculativeExecutor: Undo execution failed",
      );
      return {
        success: false,
        message: `撤销失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  /**
   * 获取活跃的撤销操作列表
   */
  getActiveUndos(userId?: string): UndoAction[] {
    const now = new Date();
    return this.undoStack.filter((action) => {
      const notExpired = action.expiresAt > now;
      const matchesUser = !userId || action.userId === userId;
      return notExpired && matchesUser;
    });
  }

  /**
   * 清除用户的所有撤销操作
   */
  clearUserUndos(userId: string): number {
    const toRemove = this.undoStack.filter((a) => a.userId === userId);
    toRemove.forEach((a) => this.removeUndo(a.id));
    return toRemove.length;
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  /**
   * 添加撤销操作到栈
   */
  private pushUndo(action: UndoAction): void {
    // 限制栈大小
    while (this.undoStack.length >= this.config.maxUndoStackSize) {
      const oldest = this.undoStack.shift();
      if (oldest) {
        this.cancelUndoCleanup(oldest.id);
      }
    }

    this.undoStack.push(action);
  }

  /**
   * 从栈中移除撤销操作
   */
  private removeUndo(undoId: string): void {
    this.undoStack = this.undoStack.filter((a) => a.id !== undoId);
    this.cancelUndoCleanup(undoId);
  }

  /**
   * 安排撤销操作的自动清理
   */
  private scheduleUndoCleanup(undoId: string, delayMs: number): void {
    const timer = setTimeout(() => {
      this.removeUndo(undoId);
      if (this.config.debug) {
        logger.debug(
          { undoId },
          "SpeculativeExecutor: Undo action expired and removed",
        );
      }
    }, delayMs);

    this.undoCleanupTimers.set(undoId, timer);
  }

  /**
   * 取消撤销操作的自动清理
   */
  private cancelUndoCleanup(undoId: string): void {
    const timer = this.undoCleanupTimers.get(undoId);
    if (timer) {
      clearTimeout(timer);
      this.undoCleanupTimers.delete(undoId);
    }
  }

  /**
   * 构建澄清选项
   */
  private buildClarificationOptions(
    intent: IntentWithSlots,
  ): ClarificationOption[] {
    const options: ClarificationOption[] = [
      {
        label: this.getIntentLabel(intent.type, intent.subType),
        value: `${intent.type}:${intent.subType || "*"}`,
        description: this.getIntentDescription(intent.type, intent.subType),
      },
    ];

    // 添加备选意图
    if (intent.alternatives && intent.alternatives.length > 0) {
      const alts = intent.alternatives.slice(0, 2).map((alt) => ({
        label: this.getIntentLabel(alt.type, alt.subType),
        value: `${alt.type}:${alt.subType || "*"}`,
        description: this.getIntentDescription(alt.type, alt.subType),
      }));
      options.push(...alts);
    }

    return options;
  }

  /**
   * 获取意图的用户友好标签
   */
  private getIntentLabel(type: IntentType, subType?: string): string {
    const typeLabels = INTENT_LABELS[type];
    if (typeLabels && subType && typeLabels[subType]) {
      return typeLabels[subType];
    }

    // 默认标签
    const defaultLabels: Record<IntentType, string> = {
      query: "查询",
      action: "操作",
      organize: "整理",
      analyze: "分析",
      learn: "学习",
      create: "创建",
      refine: "筛选",
      chitchat: "对话",
    };

    return defaultLabels[type] || type;
  }

  /**
   * 获取意图的描述
   */
  private getIntentDescription(type: IntentType, subType?: string): string {
    const descriptions: Record<string, string> = {
      "query:search": "搜索您的收藏内容",
      "query:list": "列出收藏列表",
      "query:count": "统计收藏数量",
      "action:delete": "删除选中的书签",
      "action:move": "移动到指定文件夹",
      "action:tag": "添加或修改标签",
      "organize:cleanup": "智能整理收藏",
      "organize:dedupe": "清理重复内容",
      "create:export": "导出收藏数据",
      "create:digest": "生成内容摘要",
    };

    const key = subType ? `${type}:${subType}` : `${type}:*`;
    return descriptions[key] || "";
  }

  /**
   * 获取操作标签
   */
  private getActionLabel(intent: IntentWithSlots): string {
    return this.getIntentLabel(intent.type, intent.subType);
  }

  /**
   * 生成简短汇报
   */
  private generateBriefReport(
    intent: IntentWithSlots,
    result: { message: string; affectedCount?: number },
  ): string {
    const actionLabel = this.getActionLabel(intent);

    if (result.affectedCount !== undefined && result.affectedCount > 0) {
      return `已为您${actionLabel} ${result.affectedCount} 条内容`;
    }

    return result.message || `已完成${actionLabel}`;
  }

  /**
   * 生成带解释的汇报
   */
  private generateReportWithExplanation(
    intent: IntentWithSlots,
    result: { message: string; affectedCount?: number },
  ): string {
    const actionLabel = this.getActionLabel(intent);
    const confidencePercent = Math.round(intent.confidence * 100);

    let report = this.generateBriefReport(intent, result);

    // 添加解释（中置信度时）
    if (intent.confidence < this.config.strategy.highConfidenceThreshold) {
      report += `（按您说的"${actionLabel}"理解，置信度 ${confidencePercent}%）`;
    }

    return report;
  }

  /**
   * 销毁执行器，清理所有定时器
   */
  destroy(): void {
    this.undoCleanupTimers.forEach((timer) => clearTimeout(timer));
    this.undoCleanupTimers.clear();
    this.undoStack = [];
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建推测执行器实例
 */
export function createSpeculativeExecutor(
  config?: SpeculativeExecutorConfig,
): SpeculativeExecutor {
  return new SpeculativeExecutor(config);
}
