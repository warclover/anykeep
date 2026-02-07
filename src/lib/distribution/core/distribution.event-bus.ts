/**
 * 分发事件总线
 *
 * @module distribution/core
 * @description 内存版事件总线，用于解耦事件发布和订阅
 */

import type { DistributionEvent, EventHandler } from "../types";
import type { IDistributionEventBus, Unsubscribe } from "../interfaces";
import { logger } from "@/lib/logger";

/**
 * 事件总线配置
 */
export interface EventBusConfig {
  /** 是否记录事件日志 */
  enableLogging?: boolean;
  /** 处理器超时时间（毫秒） */
  handlerTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<EventBusConfig> = {
  enableLogging: true,
  handlerTimeoutMs: 30000,
};

/**
 * 分发事件总线
 *
 * 内存版事件总线实现，支持事件发布、订阅和错误隔离
 *
 * @example
 * ```typescript
 * const eventBus = new DistributionEventBus();
 *
 * // 订阅事件
 * const unsubscribe = eventBus.subscribe('bookmark_created', async (event) => {
 *   console.log('新书签创建:', event.bookmarkId);
 * });
 *
 * // 发布事件
 * await eventBus.publish({
 *   type: 'bookmark_created',
 *   bookmarkId: '123',
 *   userId: 'user-1',
 * });
 *
 * // 取消订阅
 * unsubscribe();
 * ```
 */
export class DistributionEventBus implements IDistributionEventBus {
  private readonly config: Required<EventBusConfig>;
  private readonly handlers: Map<DistributionEvent["type"], Set<EventHandler>> =
    new Map();
  private readonly allHandlers: Set<EventHandler> = new Set();

  constructor(config: EventBusConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 发布事件
   *
   * 异步通知所有订阅该事件类型的处理器
   * 单个处理器失败不会影响其他处理器
   *
   * @param event - 要发布的事件
   */
  async publish(event: DistributionEvent): Promise<void> {
    const startTime = Date.now();

    if (this.config.enableLogging) {
      logger.debug({ eventType: event.type }, "EventBus: Publishing event");
    }

    // 收集所有需要通知的处理器
    const handlers: EventHandler[] = [];

    // 特定事件类型的订阅者
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      handlers.push(...typeHandlers);
    }

    // 全局订阅者
    handlers.push(...this.allHandlers);

    if (handlers.length === 0) {
      if (this.config.enableLogging) {
        logger.debug(
          { eventType: event.type },
          "EventBus: No handlers for event",
        );
      }
      return;
    }

    // 并行执行所有处理器，带超时和错误隔离
    const results = await Promise.allSettled(
      handlers.map((handler) => this.executeHandler(handler, event)),
    );

    // 统计执行结果
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (this.config.enableLogging) {
      const duration = Date.now() - startTime;
      logger.debug(
        {
          eventType: event.type,
          totalHandlers: handlers.length,
          succeeded,
          failed,
          durationMs: duration,
        },
        "EventBus: Event published",
      );
    }

    // 记录失败的处理器
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error(
          {
            eventType: event.type,
            handlerIndex: index,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          },
          "EventBus: Handler failed",
        );
      }
    });
  }

  /**
   * 订阅事件
   *
   * @param eventType - 要订阅的事件类型
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  subscribe(
    eventType: DistributionEvent["type"],
    handler: EventHandler,
  ): Unsubscribe {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.add(handler);
    }

    if (this.config.enableLogging) {
      logger.debug(
        {
          eventType,
          totalHandlers: this.handlers.get(eventType)?.size ?? 0,
        },
        "EventBus: Handler subscribed",
      );
    }

    // 返回取消订阅函数
    return () => {
      const removed = this.handlers.get(eventType)?.delete(handler) ?? false;

      if (this.config.enableLogging && removed) {
        logger.debug(
          {
            eventType,
            remainingHandlers: this.handlers.get(eventType)?.size ?? 0,
          },
          "EventBus: Handler unsubscribed",
        );
      }
    };
  }

  /**
   * 订阅所有事件
   *
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  subscribeAll(handler: EventHandler): Unsubscribe {
    this.allHandlers.add(handler);

    if (this.config.enableLogging) {
      logger.debug(
        {
          totalGlobalHandlers: this.allHandlers.size,
        },
        "EventBus: Global handler subscribed",
      );
    }

    return () => {
      const removed = this.allHandlers.delete(handler);

      if (this.config.enableLogging && removed) {
        logger.debug(
          {
            remainingGlobalHandlers: this.allHandlers.size,
          },
          "EventBus: Global handler unsubscribed",
        );
      }
    };
  }

  /**
   * 获取指定事件类型的订阅者数量
   *
   * @param eventType - 事件类型
   * @returns 订阅者数量
   */
  getSubscriberCount(eventType: DistributionEvent["type"]): number {
    return (this.handlers.get(eventType)?.size ?? 0) + this.allHandlers.size;
  }

  /**
   * 获取所有事件类型的订阅者数量
   *
   * @returns 事件类型到订阅者数量的映射
   */
  getAllSubscriberCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const [eventType, handlers] of this.handlers) {
      counts[eventType] = handlers.size + this.allHandlers.size;
    }

    // 包含全局处理器数量
    counts["_global"] = this.allHandlers.size;

    return counts;
  }

  /**
   * 清除所有订阅
   */
  clear(): void {
    const totalCleared =
      Array.from(this.handlers.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ) + this.allHandlers.size;

    this.handlers.clear();
    this.allHandlers.clear();

    if (this.config.enableLogging) {
      logger.debug({ totalCleared }, "EventBus: All handlers cleared");
    }
  }

  /**
   * 清除指定事件类型的所有订阅
   *
   * @param eventType - 事件类型
   */
  clearEventType(eventType: DistributionEvent["type"]): void {
    const handlers = this.handlers.get(eventType);
    const count = handlers?.size ?? 0;

    handlers?.clear();

    if (this.config.enableLogging && count > 0) {
      logger.debug(
        {
          eventType,
          clearedCount: count,
        },
        "EventBus: Event type handlers cleared",
      );
    }
  }

  /**
   * 执行单个处理器（带超时）
   */
  private async executeHandler(
    handler: EventHandler,
    event: DistributionEvent,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Handler timeout after ${this.config.handlerTimeoutMs}ms`),
        );
      }, this.config.handlerTimeoutMs);

      handler(event)
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
