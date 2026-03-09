/**
 * AI Skills 事件级联处理器
 *
 * 监听 Skill 事件并触发后续级联动作：
 * - Skill 完成后触发缓存失效
 * - Skill 完成后触发统计更新
 * - Skill 完成后触发通知
 * - Skill 之间的依赖执行
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import { eventBus } from "@/lib/shared/event-bus";
import {
  AISkillsEvents,
  type SkillExecutionCompletedEvent,
  type SkillDeliverableCreatedEvent,
} from "@/lib/shared/event-bus/event-types";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 级联动作类型
 */
export type CascadeActionType =
  | "invalidate_cache"
  | "update_analytics"
  | "send_notification"
  | "trigger_skill"
  | "update_preferences"
  | "custom";

/**
 * 级联规则
 */
export interface CascadeRule {
  /** 规则 ID */
  id: string;
  /** 规则描述 */
  description?: string;
  /** 触发 Skill ID（支持通配符 * 表示所有） */
  triggerSkillId: string | "*";
  /** 是否只在成功时触发 */
  onSuccessOnly?: boolean;
  /** 级联动作类型 */
  actionType: CascadeActionType;
  /** 动作参数 */
  actionParams?: Record<string, unknown>;
  /** 动作处理函数 */
  handler: (event: SkillExecutionCompletedEvent) => void | Promise<void>;
  /** 是否启用 */
  enabled?: boolean;
  /** 优先级（数字越大越先执行） */
  priority?: number;
}

/**
 * 交付物级联规则
 */
export interface DeliverableCascadeRule {
  /** 规则 ID */
  id: string;
  /** 规则描述 */
  description?: string;
  /** 触发 Skill ID（支持通配符） */
  triggerSkillId: string | "*";
  /** 交付物类型筛选 */
  deliverableType?: string;
  /** 动作处理函数 */
  handler: (event: SkillDeliverableCreatedEvent) => void | Promise<void>;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 级联处理器配置
 */
export interface CascadeHandlerConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 是否异步执行（不阻塞主流程） */
  asyncExecution?: boolean;
  /** 错误处理策略 */
  errorStrategy?: "ignore" | "log" | "throw";
  /** 最大并发执行数 */
  maxConcurrency?: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: Required<CascadeHandlerConfig> = {
  enabled: true,
  asyncExecution: true,
  errorStrategy: "log",
  maxConcurrency: 5,
};

// ============================================
// 默认级联规则
// ============================================

/**
 * 创建默认级联规则
 */
function createDefaultRules(): CascadeRule[] {
  return [
    // 批量整理完成后刷新列表缓存
    {
      id: "batch_organize_cache",
      description: "批量整理完成后失效书签列表缓存",
      triggerSkillId: "batch_organize",
      onSuccessOnly: true,
      actionType: "invalidate_cache",
      handler: async (event) => {
        logger.info(
          { skillId: event.skillId, userId: event.userId },
          "CascadeHandler: Invalidating bookmark cache after batch_organize",
        );
        // 实际的缓存失效由 CacheInvalidationService 通过订阅事件处理
      },
      enabled: true,
      priority: 100,
    },

    // 数据导出完成后记录统计
    {
      id: "data_export_analytics",
      description: "数据导出完成后记录导出统计",
      triggerSkillId: "data_export",
      onSuccessOnly: true,
      actionType: "update_analytics",
      handler: async (event) => {
        logger.info(
          {
            skillId: event.skillId,
            userId: event.userId,
            durationMs: event.durationMs,
          },
          "CascadeHandler: Recording export analytics",
        );
      },
      enabled: true,
      priority: 50,
    },

    // 智能标签完成后触发分类建议
    {
      id: "smart_tagging_suggest",
      description: "智能标签完成后可触发分类建议",
      triggerSkillId: "smart_tagging",
      onSuccessOnly: true,
      actionType: "trigger_skill",
      actionParams: { suggestedSkill: "batch_organize" },
      handler: async (event) => {
        logger.debug(
          { skillId: event.skillId, userId: event.userId },
          "CascadeHandler: Smart tagging completed, batch_organize may be suggested",
        );
      },
      enabled: true,
      priority: 30,
    },

    // 所有 Skill 完成后的通用日志
    {
      id: "all_skills_log",
      description: "记录所有 Skill 执行完成",
      triggerSkillId: "*",
      onSuccessOnly: false,
      actionType: "custom",
      handler: async (event) => {
        logger.debug(
          {
            skillId: event.skillId,
            skillName: event.skillName,
            success: event.success,
            durationMs: event.durationMs,
            hasDeliverable: event.hasDeliverable,
          },
          "CascadeHandler: Skill execution recorded",
        );
      },
      enabled: true,
      priority: 10,
    },
  ];
}

// ============================================
// SkillCascadeHandler Class
// ============================================

/**
 * Skill 事件级联处理器
 *
 * @example
 * ```typescript
 * const cascadeHandler = new SkillCascadeHandler();
 *
 * // 添加自定义规则
 * cascadeHandler.addRule({
 *   id: 'custom_rule',
 *   triggerSkillId: 'data_export',
 *   onSuccessOnly: true,
 *   actionType: 'custom',
 *   handler: async (event) => {
 *     // 自定义处理逻辑
 *   },
 * });
 *
 * // 初始化
 * cascadeHandler.initialize();
 * ```
 */
export class SkillCascadeHandler {
  private config: Required<CascadeHandlerConfig>;
  private rules: Map<string, CascadeRule> = new Map();
  private deliverableRules: Map<string, DeliverableCascadeRule> = new Map();
  private unsubscribers: Array<() => void> = [];
  private activeTasks = 0;

  constructor(config: CascadeHandlerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultRules();
  }

  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    const defaultRules = createDefaultRules();
    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * 初始化事件订阅
   */
  initialize(): void {
    if (!this.config.enabled) {
      logger.info({}, "SkillCascadeHandler: Disabled, skipping initialization");
      return;
    }

    // 订阅 Skill 执行完成事件
    const unsubComplete = eventBus.on(
      AISkillsEvents.EXECUTION_COMPLETED,
      this.handleSkillCompleted.bind(this),
    );
    this.unsubscribers.push(unsubComplete);

    // 订阅交付物创建事件
    const unsubDeliverable = eventBus.on(
      AISkillsEvents.DELIVERABLE_CREATED,
      this.handleDeliverableCreated.bind(this),
    );
    this.unsubscribers.push(unsubDeliverable);

    logger.info(
      { rulesCount: this.rules.size },
      "SkillCascadeHandler: Initialized",
    );
  }

  /**
   * 关闭处理器
   */
  shutdown(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    logger.info({}, "SkillCascadeHandler: Shutdown");
  }

  /**
   * 处理 Skill 执行完成事件
   */
  private async handleSkillCompleted(
    event: SkillExecutionCompletedEvent,
  ): Promise<void> {
    const matchingRules = this.getMatchingRules(event);

    if (matchingRules.length === 0) {
      return;
    }

    logger.debug(
      {
        skillId: event.skillId,
        matchingRulesCount: matchingRules.length,
      },
      "SkillCascadeHandler: Processing cascade rules",
    );

    // 按优先级排序
    matchingRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // 执行规则
    for (const rule of matchingRules) {
      await this.executeRule(rule, event);
    }
  }

  /**
   * 处理交付物创建事件
   */
  private async handleDeliverableCreated(
    event: SkillDeliverableCreatedEvent,
  ): Promise<void> {
    const matchingRules = this.getMatchingDeliverableRules(event);

    for (const rule of matchingRules) {
      await this.executeDeliverableRule(rule, event);
    }
  }

  /**
   * 获取匹配的规则
   */
  private getMatchingRules(event: SkillExecutionCompletedEvent): CascadeRule[] {
    const matching: CascadeRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // 检查 Skill ID 匹配
      if (
        rule.triggerSkillId !== "*" &&
        rule.triggerSkillId !== event.skillId
      ) {
        continue;
      }

      // 检查成功条件
      if (rule.onSuccessOnly && !event.success) {
        continue;
      }

      matching.push(rule);
    }

    return matching;
  }

  /**
   * 获取匹配的交付物规则
   */
  private getMatchingDeliverableRules(
    event: SkillDeliverableCreatedEvent,
  ): DeliverableCascadeRule[] {
    const matching: DeliverableCascadeRule[] = [];

    for (const rule of this.deliverableRules.values()) {
      if (!rule.enabled) continue;

      if (
        rule.triggerSkillId !== "*" &&
        rule.triggerSkillId !== event.skillId
      ) {
        continue;
      }

      if (
        rule.deliverableType &&
        rule.deliverableType !== event.deliverableType
      ) {
        continue;
      }

      matching.push(rule);
    }

    return matching;
  }

  /**
   * 执行规则
   */
  private async executeRule(
    rule: CascadeRule,
    event: SkillExecutionCompletedEvent,
  ): Promise<void> {
    const execute = async () => {
      try {
        this.activeTasks++;
        await rule.handler(event);
        logger.debug(
          { ruleId: rule.id, skillId: event.skillId },
          "SkillCascadeHandler: Rule executed successfully",
        );
      } catch (error) {
        this.handleError(rule.id, error);
      } finally {
        this.activeTasks--;
      }
    };

    if (this.config.asyncExecution) {
      // 异步执行，不阻塞
      execute();
    } else {
      await execute();
    }
  }

  /**
   * 执行交付物规则
   */
  private async executeDeliverableRule(
    rule: DeliverableCascadeRule,
    event: SkillDeliverableCreatedEvent,
  ): Promise<void> {
    const execute = async () => {
      try {
        this.activeTasks++;
        await rule.handler(event);
      } catch (error) {
        this.handleError(rule.id, error);
      } finally {
        this.activeTasks--;
      }
    };

    if (this.config.asyncExecution) {
      execute();
    } else {
      await execute();
    }
  }

  /**
   * 处理错误
   */
  private handleError(ruleId: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    switch (this.config.errorStrategy) {
      case "ignore":
        break;
      case "log":
        logger.warn(
          { ruleId, error: errorMessage },
          "SkillCascadeHandler: Rule execution failed",
        );
        break;
      case "throw":
        throw error;
    }
  }

  /**
   * 添加规则
   */
  addRule(rule: CascadeRule): void {
    this.rules.set(rule.id, { enabled: true, ...rule });
    logger.debug({ ruleId: rule.id }, "SkillCascadeHandler: Rule added");
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.debug({ ruleId }, "SkillCascadeHandler: Rule removed");
    }
    return removed;
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 添加交付物规则
   */
  addDeliverableRule(rule: DeliverableCascadeRule): void {
    this.deliverableRules.set(rule.id, { enabled: true, ...rule });
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    rulesCount: number;
    deliverableRulesCount: number;
    enabledRules: number;
    activeTasks: number;
  } {
    return {
      rulesCount: this.rules.size,
      deliverableRulesCount: this.deliverableRules.size,
      enabledRules: Array.from(this.rules.values()).filter((r) => r.enabled)
        .length,
      activeTasks: this.activeTasks,
    };
  }

  /**
   * 获取所有规则
   */
  getRules(): CascadeRule[] {
    return Array.from(this.rules.values());
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * 全局 Skill 级联处理器实例
 */
export const skillCascadeHandler = new SkillCascadeHandler();

/**
 * 创建 Skill 级联处理器的工厂函数
 */
export function createSkillCascadeHandler(
  config?: CascadeHandlerConfig,
): SkillCascadeHandler {
  return new SkillCascadeHandler(config);
}

/**
 * 初始化 Skill 级联处理器
 */
export function initSkillCascadeHandler(
  config?: CascadeHandlerConfig,
): SkillCascadeHandler {
  const handler = config
    ? new SkillCascadeHandler(config)
    : skillCascadeHandler;
  handler.initialize();
  return handler;
}
