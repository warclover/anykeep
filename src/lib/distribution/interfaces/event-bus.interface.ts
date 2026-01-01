/**
 * 分发事件总线接口
 *
 * @module distribution/interfaces
 * @description 定义事件总线接口，用于解耦事件发布和订阅
 */

import type { DistributionEvent, EventHandler } from "../types";

/**
 * 取消订阅函数类型
 */
export type Unsubscribe = () => void;

/**
 * 事件总线接口
 *
 * 用于解耦分发触发源和处理逻辑
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
export interface IDistributionEventBus {
  /**
   * 发布事件
   *
   * 异步通知所有订阅该事件类型的处理器
   * 单个处理器失败不会影响其他处理器
   *
   * @param event - 要发布的事件
   */
  publish(event: DistributionEvent): Promise<void>;

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
  ): Unsubscribe;

  /**
   * 订阅所有事件
   *
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  subscribeAll?(handler: EventHandler): Unsubscribe;

  /**
   * 获取指定事件类型的订阅者数量
   *
   * @param eventType - 事件类型
   * @returns 订阅者数量
   */
  getSubscriberCount?(eventType: DistributionEvent["type"]): number;

  /**
   * 清除所有订阅
   */
  clear?(): void;
}

/**
 * 事件发布选项
 */
export interface PublishOptions {
  /** 是否等待所有处理器完成 */
  waitForHandlers?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 事件订阅选项
 */
export interface SubscribeOptions {
  /** 优先级（数值越小优先级越高） */
  priority?: number;
  /** 是否只触发一次 */
  once?: boolean;
}
