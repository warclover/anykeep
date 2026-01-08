/**
 * 事件触发管理器
 *
 * 监听和处理工作流事件触发
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "../orchestrator";
import { getSafeExpressionEvaluator } from "../integration/safe-expression-evaluator";
import { logger } from "@/lib/logger";
import type { EventTriggerConfig, WorkflowEvent } from "./types";
import type { WorkflowDefinition } from "../types";

/**
 * 事件触发管理器
 *
 * 监听和处理工作流事件触发
 */
export class EventTriggerManager {
  private orchestrator = getWorkflowOrchestrator();
  private expressionEvaluator = getSafeExpressionEvaluator();
  private eventWorkflowCache: Map<string, WorkflowDefinition[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // 去重：记录最近处理的事件
  private recentEvents: Map<string, number> = new Map();
  private readonly DEFAULT_DEBOUNCE_MS = 5000;

  /**
   * 处理事件
   */
  async handleEvent(event: WorkflowEvent): Promise<void> {
    const startTime = performance.now();

    try {
      // 1. 检查去重
      const eventKey = this.generateEventKey(event);
      if (this.isDuplicate(eventKey)) {
        logger.debug(
          { eventType: event.type, userId: event.userId },
          "EventTriggerManager: Duplicate event ignored",
        );
        return;
      }

      // 2. 获取匹配的工作流
      const matchingWorkflows = await this.findMatchingWorkflows(event);

      if (matchingWorkflows.length === 0) {
        return;
      }

      logger.info(
        {
          eventType: event.type,
          userId: event.userId,
          matchingCount: matchingWorkflows.length,
        },
        "EventTriggerManager: Event matched workflows",
      );

      // 3. 触发工作流
      for (const workflow of matchingWorkflows) {
        await this.triggerWorkflow(workflow, event);
      }

      // 4. 记录事件
      this.recordEvent(eventKey);

      logger.info(
        {
          eventType: event.type,
          userId: event.userId,
          triggeredCount: matchingWorkflows.length,
          durationMs: Math.round(performance.now() - startTime),
        },
        "EventTriggerManager: Event processed",
      );
    } catch (error) {
      logger.error(
        { error, eventType: event.type, userId: event.userId },
        "EventTriggerManager: Event handling failed",
      );
    }
  }

  /**
   * 查找匹配的工作流
   *
   * 使用 SafeExpressionEvaluator 进行安全条件评估
   */
  private async findMatchingWorkflows(
    event: WorkflowEvent,
  ): Promise<WorkflowDefinition[]> {
    const workflows = await this.loadEventTriggeredWorkflows(event.userId);

    return workflows.filter((workflow) => {
      const eventTrigger = workflow.triggers?.find((t) => t.type === "event");
      if (!eventTrigger) return false;

      const config = eventTrigger as unknown as {
        eventType?: string;
        condition?: string;
        enabled?: boolean;
      };
      if (config.enabled === false) return false;
      if (config.eventType !== event.type) return false;

      // 使用安全表达式评估器
      if (config.condition) {
        try {
          // 验证表达式安全性
          const validation = this.expressionEvaluator.validate(
            config.condition,
          );
          if (!validation.valid) {
            logger.warn(
              { condition: config.condition, error: validation.error },
              "EventTriggerManager: Invalid condition expression",
            );
            return false;
          }

          // 安全评估条件
          return this.expressionEvaluator.evaluate(config.condition, {
            event: event.payload,
          });
        } catch (error) {
          logger.warn(
            { condition: config.condition, error },
            "EventTriggerManager: Condition evaluation failed",
          );
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 触发工作流
   */
  private async triggerWorkflow(
    workflow: WorkflowDefinition,
    event: WorkflowEvent,
  ): Promise<void> {
    const eventTrigger = workflow.triggers?.find((t) => t.type === "event");
    const config = eventTrigger as unknown as EventTriggerConfig | undefined;

    // 构建触发上下文
    const triggerContext: Record<string, unknown> = {
      eventType: event.type,
      eventTimestamp: event.timestamp.toISOString(),
      ...event.payload,
    };

    // 应用参数映射
    if (config?.paramMapping) {
      for (const [targetKey, sourceExpr] of Object.entries(
        config.paramMapping,
      )) {
        triggerContext[targetKey] = this.resolveExpression(
          sourceExpr,
          event.payload,
        );
      }
    }

    await this.orchestrator.startWorkflow(workflow.id, event.userId, {
      triggerType: "event",
      triggerContext,
    });
  }

  /**
   * 加载事件触发的工作流
   */
  private async loadEventTriggeredWorkflows(
    userId: string,
  ): Promise<WorkflowDefinition[]> {
    const cacheKey = `event:${userId}`;
    const now = Date.now();

    if (this.eventWorkflowCache.has(cacheKey) && this.cacheExpiry > now) {
      return this.eventWorkflowCache.get(cacheKey) ?? [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflows")
      .select("id, definition")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true);

    if (error) {
      logger.error({ error }, "EventTriggerManager: Failed to load workflows");
      return [];
    }

    const workflows = (data || [])
      .map((row) => ({
        id: row.id,
        ...(row.definition as unknown as Omit<WorkflowDefinition, "id">),
      }))
      .filter((w) => w.triggers?.some((t) => t.type === "event"));

    this.eventWorkflowCache.set(cacheKey, workflows);
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return workflows;
  }

  /**
   * 生成事件唯一键
   */
  private generateEventKey(event: WorkflowEvent): string {
    const payloadHash = JSON.stringify(event.payload);
    return `${event.type}:${event.userId}:${payloadHash}`;
  }

  /**
   * 检查是否重复事件
   */
  private isDuplicate(eventKey: string): boolean {
    const lastTime = this.recentEvents.get(eventKey);
    if (!lastTime) return false;

    return Date.now() - lastTime < this.DEFAULT_DEBOUNCE_MS;
  }

  /**
   * 记录事件
   */
  private recordEvent(eventKey: string): void {
    this.recentEvents.set(eventKey, Date.now());

    // 清理过期记录
    if (this.recentEvents.size > 1000) {
      const expiredThreshold = Date.now() - this.DEFAULT_DEBOUNCE_MS * 2;
      for (const [key, time] of this.recentEvents) {
        if (time < expiredThreshold) {
          this.recentEvents.delete(key);
        }
      }
    }
  }

  /**
   * 解析表达式
   */
  private resolveExpression(
    expr: string,
    payload: Record<string, unknown>,
  ): unknown {
    if (expr.startsWith("$.")) {
      const path = expr.slice(2);
      return path.split(".").reduce((acc, key) => {
        if (acc && typeof acc === "object" && key in acc) {
          return (acc as Record<string, unknown>)[key];
        }
        return undefined;
      }, payload as unknown);
    }
    return expr;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.eventWorkflowCache.clear();
    this.cacheExpiry = 0;
  }
}

// 单例导出
let managerInstance: EventTriggerManager | null = null;

export function getEventTriggerManager(): EventTriggerManager {
  if (!managerInstance) {
    managerInstance = new EventTriggerManager();
  }
  return managerInstance;
}
