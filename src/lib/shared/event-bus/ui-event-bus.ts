/**
 * UI Event Bus - UI Layer Event Communication
 * V4.2 UI 层事件总线
 *
 * 用于替代 Window CustomEvent 的类型安全 UI 事件通信
 * 提供与 Context 的双向集成能力
 *
 * @example
 * ```typescript
 * import { uiEventBus } from '@/lib/shared/event-bus/ui-event-bus';
 *
 * // 订阅事件
 * const unsubscribe = uiEventBus.on('ui:view:mode:change', (payload) => {
 *   console.log('View mode changed:', payload.mode);
 * });
 *
 * // 发布事件
 * uiEventBus.emit('ui:view:mode:change', { mode: 'list' });
 *
 * // 取消订阅
 * unsubscribe();
 * ```
 */

"use client";

import { logger } from "@/lib/logger";
import type {
  UIEventName,
  UIEventPayload,
  UIEventTypes,
} from "./ui-event-types";

/** 事件处理函数类型 */
type EventHandler<T> = (payload: T) => void | Promise<void>;

/** 事件处理函数包装器 */
interface HandlerWrapper<T> {
  handler: EventHandler<T>;
  once: boolean;
  id: string;
}

/**
 * UI 事件总线选项
 */
export interface UIEventBusOptions {
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 最大监听器数量 */
  maxListeners?: number;
  /**
   * 是否启用 Window Event 桥接
   * 开启后会同时触发对应的 Window CustomEvent（用于渐进迁移）
   * @default true
   */
  enableLegacyBridge?: boolean;
}

const DEFAULT_OPTIONS: Required<UIEventBusOptions> = {
  debug: process.env.NODE_ENV === "development",
  maxListeners: 50,
  enableLegacyBridge: true,
};

/**
 * UI 事件总线类
 * 专门用于 UI 层的事件通信，替代 Window CustomEvent
 */
export class UIEventBus {
  private handlers = new Map<string, Set<HandlerWrapper<unknown>>>();
  private options: Required<UIEventBusOptions>;
  private handlerIdCounter = 0;
  private static instance: UIEventBus | null = null;

  constructor(options: UIEventBusOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 获取单例实例
   */
  static getInstance(options?: UIEventBusOptions): UIEventBus {
    if (!UIEventBus.instance) {
      UIEventBus.instance = new UIEventBus(options);
    }
    return UIEventBus.instance;
  }

  /**
   * 重置单例（仅用于测试）
   */
  static resetInstance(): void {
    if (UIEventBus.instance) {
      UIEventBus.instance.removeAllListeners();
      UIEventBus.instance = null;
    }
  }

  /**
   * 订阅事件
   */
  on<K extends UIEventName>(
    event: K,
    handler: EventHandler<UIEventPayload<K>>,
  ): () => void {
    return this.addHandler(event, handler, false);
  }

  /**
   * 订阅事件（只触发一次）
   */
  once<K extends UIEventName>(
    event: K,
    handler: EventHandler<UIEventPayload<K>>,
  ): () => void {
    return this.addHandler(event, handler, true);
  }

  /**
   * 取消订阅事件
   */
  off<K extends UIEventName>(
    event: K,
    handler: EventHandler<UIEventPayload<K>>,
  ): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    for (const wrapper of eventHandlers) {
      if (wrapper.handler === handler) {
        eventHandlers.delete(wrapper);
        break;
      }
    }

    if (eventHandlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * 发布事件
   */
  emit<K extends UIEventName>(event: K, payload: UIEventPayload<K>): void {
    const eventHandlers = this.handlers.get(event);

    if (this.options.debug) {
      logger.debug(
        {
          event,
          handlerCount: eventHandlers?.size ?? 0,
          payload,
        },
        "UIEventBus: Event emitted",
      );
    }

    // 触发 UI 事件处理函数
    if (eventHandlers && eventHandlers.size > 0) {
      const toRemove: HandlerWrapper<unknown>[] = [];

      for (const wrapper of eventHandlers) {
        if (wrapper.once) {
          toRemove.push(wrapper);
        }
        this.executeHandler(event, wrapper.handler, payload);
      }

      for (const wrapper of toRemove) {
        eventHandlers.delete(wrapper);
      }
    }

    // Legacy Bridge: 同时触发 Window CustomEvent（渐进迁移期间）
    if (this.options.enableLegacyBridge && typeof window !== "undefined") {
      this.emitLegacyEvent(event, payload);
    }
  }

  /**
   * 获取事件的监听器数量
   */
  listenerCount(event: UIEventName): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * 获取所有事件名称
   */
  eventNames(): UIEventName[] {
    return Array.from(this.handlers.keys()) as UIEventName[];
  }

  /**
   * 移除指定事件的所有监听器
   */
  removeAllListeners(event?: UIEventName): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * 设置是否启用 Legacy Bridge
   */
  setLegacyBridge(enabled: boolean): void {
    this.options.enableLegacyBridge = enabled;
  }

  /**
   * 添加处理函数
   */
  private addHandler<K extends UIEventName>(
    event: K,
    handler: EventHandler<UIEventPayload<K>>,
    once: boolean,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const eventHandlers = this.handlers.get(event)!;

    if (eventHandlers.size >= this.options.maxListeners) {
      logger.warn(
        {
          event,
          maxListeners: this.options.maxListeners,
          currentCount: eventHandlers.size,
        },
        "UIEventBus: Max listeners exceeded, possible memory leak",
      );
    }

    const wrapper: HandlerWrapper<unknown> = {
      handler: handler as EventHandler<unknown>,
      once,
      id: `ui_handler_${++this.handlerIdCounter}`,
    };

    eventHandlers.add(wrapper);

    return () => {
      eventHandlers.delete(wrapper);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * 执行处理函数（同步，UI 事件需要即时响应）
   */
  private executeHandler<T>(
    event: string,
    handler: EventHandler<T>,
    payload: T,
  ): void {
    try {
      const result = handler(payload);
      if (result instanceof Promise) {
        result.catch((error) => this.handleError(event, error));
      }
    } catch (error) {
      this.handleError(event, error);
    }
  }

  /**
   * 触发旧版 Window CustomEvent（Legacy Bridge）
   */
  private emitLegacyEvent<K extends UIEventName>(
    event: K,
    payload: UIEventPayload<K>,
  ): void {
    // 新事件名到旧事件名的反向映射
    const legacyEventMap: Record<UIEventName, string | null> = {
      "ui:view:mode:change": "viewModeChange",
      "ui:view:layout:change": "layoutModeChange",
      "ui:view:flipCard:change": "flipCardChange",
      "ui:filter:platform:change": "platformChange",
      "ui:filter:usageTags:change": "usageTagFilterChange",
      "ui:dialog:open": "openDialog",
      "ui:dialog:close": null, // 无对应旧事件
      "ui:selection:toggle": "toggleSelectionMode",
      "ui:bookmark:created": "bookmarkCreated",
      "ui:bookmark:updated": null, // 无对应旧事件
      "ui:bookmark:deleted": null, // 无对应旧事件
    };

    const legacyEventName = legacyEventMap[event];
    if (!legacyEventName) return;

    // 转换 payload 格式以匹配旧事件格式
    let legacyDetail: unknown;
    switch (event) {
      case "ui:view:mode:change":
        legacyDetail = (payload as UIEventTypes["ui:view:mode:change"]).mode;
        break;
      case "ui:view:layout:change":
        legacyDetail = (payload as UIEventTypes["ui:view:layout:change"]).mode;
        break;
      case "ui:view:flipCard:change":
        legacyDetail = (payload as UIEventTypes["ui:view:flipCard:change"])
          .enabled;
        break;
      case "ui:filter:platform:change":
        legacyDetail = payload; // { platform, folder } 格式相同
        break;
      case "ui:filter:usageTags:change":
        legacyDetail = payload; // { usageTags } 格式相同
        break;
      case "ui:dialog:open":
        legacyDetail = (payload as UIEventTypes["ui:dialog:open"]).type;
        break;
      case "ui:selection:toggle":
        legacyDetail = (payload as UIEventTypes["ui:selection:toggle"]).enabled;
        break;
      case "ui:bookmark:created":
        legacyDetail = (payload as UIEventTypes["ui:bookmark:created"])
          .bookmark;
        break;
      default:
        legacyDetail = payload;
    }

    window.dispatchEvent(
      new CustomEvent(legacyEventName, { detail: legacyDetail }),
    );

    if (this.options.debug) {
      logger.debug(
        { legacyEvent: legacyEventName, detail: legacyDetail },
        "UIEventBus: Legacy event bridged",
      );
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
      "UIEventBus: Handler error",
    );
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/** UI 事件总线单例实例 */
export const uiEventBus = UIEventBus.getInstance();

/**
 * 创建新的 UI 事件总线实例（用于测试或隔离场景）
 */
export function createUIEventBus(options?: UIEventBusOptions): UIEventBus {
  return new UIEventBus(options);
}
