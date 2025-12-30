/**
 * Event Bus - Core Implementation
 * V4.2 事件总线核心实现
 *
 * 提供类型安全的发布/订阅机制，用于模块间解耦通信
 *
 * @example
 * ```typescript
 * import { eventBus } from '@/lib/shared/event-bus';
 *
 * // 订阅事件
 * const unsubscribe = eventBus.on('classification:bookmark_classified', (payload) => {
 *   clientLogger.info({ bookmarkId: payload.bookmarkId }, 'Bookmark classified');
 * });
 *
 * // 发布事件
 * eventBus.emit('classification:bookmark_classified', {
 *   userId: 'user-123',
 *   bookmarkId: 456,
 *   folderId: 789,
 *   confidence: 0.85,
 *   action: 'classify',
 *   timestamp: new Date().toISOString(),
 * });
 *
 * // 取消订阅
 * unsubscribe();
 * ```
 */

import { logger } from "@/lib/logger";
import type { EventName, EventPayload } from "./event-types";

/** 事件处理函数类型 */
type EventHandler<T> = (payload: T) => void | Promise<void>;

/** 事件处理函数包装器（用于追踪） */
interface HandlerWrapper<T> {
  handler: EventHandler<T>;
  once: boolean;
  id: string;
}

/**
 * 事件总线选项
 */
export interface EventBusOptions {
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 最大监听器数量（防止内存泄漏） */
  maxListeners?: number;
  /** 是否异步执行处理函数 */
  async?: boolean;
}

const DEFAULT_OPTIONS: Required<EventBusOptions> = {
  debug: process.env.NODE_ENV === "development",
  maxListeners: 100,
  async: true,
};

/**
 * 类型安全的事件总线
 */
export class EventBus {
  private handlers = new Map<string, Set<HandlerWrapper<unknown>>>();
  private options: Required<EventBusOptions>;
  private handlerIdCounter = 0;

  constructor(options: EventBusOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 订阅事件
   *
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  on<K extends EventName>(
    event: K,
    handler: EventHandler<EventPayload<K>>,
  ): () => void {
    return this.addHandler(event, handler, false);
  }

  /**
   * 订阅事件（只触发一次）
   *
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  once<K extends EventName>(
    event: K,
    handler: EventHandler<EventPayload<K>>,
  ): () => void {
    return this.addHandler(event, handler, true);
  }

  /**
   * 取消订阅事件
   *
   * @param event - 事件名称
   * @param handler - 事件处理函数
   */
  off<K extends EventName>(
    event: K,
    handler: EventHandler<EventPayload<K>>,
  ): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    for (const wrapper of eventHandlers) {
      if (wrapper.handler === handler) {
        eventHandlers.delete(wrapper);
        break;
      }
    }

    // 清理空的事件集合
    if (eventHandlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * 发布事件
   *
   * @param event - 事件名称
   * @param payload - 事件负载
   */
  emit<K extends EventName>(event: K, payload: EventPayload<K>): void {
    const eventHandlers = this.handlers.get(event);

    if (this.options.debug) {
      logger.debug(
        {
          event,
          handlerCount: eventHandlers?.size ?? 0,
          payload:
            typeof payload === "object"
              ? { ...payload, timestamp: undefined }
              : payload,
        },
        "EventBus: Event emitted",
      );
    }

    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    // 收集需要移除的 once 处理函数
    const toRemove: HandlerWrapper<unknown>[] = [];

    for (const wrapper of eventHandlers) {
      if (wrapper.once) {
        toRemove.push(wrapper);
      }

      this.executeHandler(event, wrapper.handler, payload);
    }

    // 移除 once 处理函数
    for (const wrapper of toRemove) {
      eventHandlers.delete(wrapper);
    }
  }

  /**
   * 异步发布事件并等待所有处理函数完成
   *
   * @param event - 事件名称
   * @param payload - 事件负载
   */
  async emitAsync<K extends EventName>(
    event: K,
    payload: EventPayload<K>,
  ): Promise<void> {
    const eventHandlers = this.handlers.get(event);

    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    const toRemove: HandlerWrapper<unknown>[] = [];

    for (const wrapper of eventHandlers) {
      if (wrapper.once) {
        toRemove.push(wrapper);
      }

      promises.push(this.executeHandlerAsync(event, wrapper.handler, payload));
    }

    // 移除 once 处理函数
    for (const wrapper of toRemove) {
      eventHandlers.delete(wrapper);
    }

    await Promise.all(promises);
  }

  /**
   * 获取事件的监听器数量
   */
  listenerCount(event: EventName): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * 获取所有事件名称
   */
  eventNames(): EventName[] {
    return Array.from(this.handlers.keys()) as EventName[];
  }

  /**
   * 移除指定事件的所有监听器
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * 添加处理函数
   */
  private addHandler<K extends EventName>(
    event: K,
    handler: EventHandler<EventPayload<K>>,
    once: boolean,
  ): () => void {
    let eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      eventHandlers = new Set();
      this.handlers.set(event, eventHandlers);
    }

    // 检查监听器数量限制
    if (eventHandlers.size >= this.options.maxListeners) {
      logger.warn(
        {
          event,
          maxListeners: this.options.maxListeners,
          currentCount: eventHandlers.size,
        },
        "EventBus: Max listeners exceeded, possible memory leak",
      );
    }

    const wrapper: HandlerWrapper<unknown> = {
      handler: handler as EventHandler<unknown>,
      once,
      id: `handler_${++this.handlerIdCounter}`,
    };

    eventHandlers.add(wrapper);

    // 返回取消订阅函数
    return () => {
      eventHandlers.delete(wrapper);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * 执行处理函数
   */
  private executeHandler<T>(
    event: string,
    handler: EventHandler<T>,
    payload: T,
  ): void {
    if (this.options.async) {
      // 异步执行，不阻塞发布者
      queueMicrotask(() => {
        try {
          const result = handler(payload);
          // 如果处理函数返回 Promise，捕获错误
          if (result instanceof Promise) {
            result.catch((error) => this.handleError(event, error));
          }
        } catch (error) {
          this.handleError(event, error);
        }
      });
    } else {
      // 同步执行
      try {
        handler(payload);
      } catch (error) {
        this.handleError(event, error);
      }
    }
  }

  /**
   * 异步执行处理函数
   */
  private async executeHandlerAsync<T>(
    event: string,
    handler: EventHandler<T>,
    payload: T,
  ): Promise<void> {
    try {
      await handler(payload);
    } catch (error) {
      this.handleError(event, error);
    }
  }

  /**
   * 处理执行错误
   */
  private handleError(event: string, error: unknown): void {
    logger.error(
      {
        event,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "EventBus: Handler error",
    );
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/** 全局事件总线实例 */
export const eventBus = new EventBus();

/**
 * 创建新的事件总线实例（用于测试或隔离场景）
 */
export function createEventBus(options?: EventBusOptions): EventBus {
  return new EventBus(options);
}
