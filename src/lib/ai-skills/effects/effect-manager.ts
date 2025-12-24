/**
 * EffectManager - 统一副作用管理器
 *
 * 核心职责：
 * - 统一管理确认、通知、审计等副作用
 * - 提供事件驱动的 Effect 处理
 * - 支持 Effect 生命周期管理
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type {
  Effect,
  EffectType,
  ConfirmationEffect,
  NotificationEffect,
  AuditEffect,
  UnifiedEffect,
} from "./types";

// ============================================
// 类型定义
// ============================================

/**
 * Effect 处理器类型
 */
export type EffectHandler<T extends Effect = Effect> = (
  effect: T,
) => Promise<void>;

/**
 * Effect 监听器
 */
export interface EffectListener {
  /** 监听器 ID */
  id: string;
  /** 监听的 Effect 类型 */
  type: EffectType | "*";
  /** 处理函数 */
  handler: EffectHandler;
}

/**
 * EffectManager 配置
 */
export interface EffectManagerConfig {
  /** 是否启用调试日志 */
  debug?: boolean;
  /** Effect 最大队列长度 */
  maxQueueSize?: number;
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs?: number;
}

/**
 * Effect 统计信息
 */
export interface EffectStats {
  /** 总处理数 */
  total: number;
  /** 确认数 */
  confirmations: number;
  /** 通知数 */
  notifications: number;
  /** 审计数 */
  audits: number;
  /** 失败数 */
  failed: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: Required<EffectManagerConfig> = {
  debug: false,
  maxQueueSize: 1000,
  defaultTimeoutMs: 5 * 60 * 1000, // 5 分钟
};

// ============================================
// EffectManager 实现
// ============================================

/**
 * 统一副作用管理器
 *
 * 管理所有类型的 Effect，提供统一的处理和监听机制
 *
 * @example
 * ```typescript
 * const manager = new EffectManager();
 *
 * // 添加确认效果监听
 * manager.on('confirmation', async (effect) => {
 *   console.log('收到确认请求:', effect.payload.title);
 * });
 *
 * // 发出效果
 * await manager.emit({
 *   type: 'confirmation',
 *   payload: { id: '1', title: '删除', message: '确定删除？', ... },
 *   context: { ... },
 * });
 * ```
 */
export class EffectManager {
  private config: Required<EffectManagerConfig>;
  private listeners: Map<string, EffectListener>;
  private stats: EffectStats;
  private effectQueue: UnifiedEffect[];

  constructor(config: EffectManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.listeners = new Map();
    this.stats = {
      total: 0,
      confirmations: 0,
      notifications: 0,
      audits: 0,
      failed: 0,
    };
    this.effectQueue = [];
  }

  /**
   * 注册 Effect 监听器
   *
   * @param type - Effect 类型，"*" 表示监听所有类型
   * @param handler - 处理函数
   * @returns 监听器 ID，用于取消监听
   */
  on<T extends Effect = Effect>(
    type: EffectType | "*",
    handler: EffectHandler<T>,
  ): string {
    const id = this.generateId();
    this.listeners.set(id, {
      id,
      type,
      handler: handler as EffectHandler,
    });

    if (this.config.debug) {
      logger.debug({ listenerId: id, type }, "EffectManager: 注册监听器");
    }

    return id;
  }

  /**
   * 取消监听
   *
   * @param listenerId - 监听器 ID
   */
  off(listenerId: string): boolean {
    const result = this.listeners.delete(listenerId);

    if (this.config.debug && result) {
      logger.debug({ listenerId }, "EffectManager: 取消监听器");
    }

    return result;
  }

  /**
   * 发出 Effect
   *
   * @param effect - 要发出的 Effect
   */
  async emit(effect: UnifiedEffect): Promise<void> {
    this.stats.total++;
    this.updateTypeStats(effect.type);

    // 添加到队列（用于历史追踪）
    this.addToQueue(effect);

    if (this.config.debug) {
      logger.debug(
        { effectType: effect.type, effectId: this.getEffectId(effect) },
        "EffectManager: 发出 Effect",
      );
    }

    // 收集匹配的监听器
    const matchingListeners = Array.from(this.listeners.values()).filter(
      (listener) => listener.type === "*" || listener.type === effect.type,
    );

    // 并行执行所有监听器
    const results = await Promise.allSettled(
      matchingListeners.map((listener) => listener.handler(effect)),
    );

    // 统计失败
    const failedCount = results.filter((r) => r.status === "rejected").length;
    if (failedCount > 0) {
      this.stats.failed += failedCount;
      logger.warn(
        { effectType: effect.type, failedCount },
        "EffectManager: 部分监听器执行失败",
      );
    }
  }

  /**
   * 发出确认 Effect
   */
  async emitConfirmation(effect: ConfirmationEffect): Promise<void> {
    await this.emit(effect);
  }

  /**
   * 发出通知 Effect
   */
  async emitNotification(effect: NotificationEffect): Promise<void> {
    await this.emit(effect);
  }

  /**
   * 发出审计 Effect
   */
  async emitAudit(effect: AuditEffect): Promise<void> {
    await this.emit(effect);
  }

  /**
   * 获取统计信息
   */
  getStats(): EffectStats {
    return { ...this.stats };
  }

  /**
   * 获取最近的 Effects
   *
   * @param count - 数量
   * @param type - 可选的类型过滤
   */
  getRecentEffects(count: number, type?: EffectType): UnifiedEffect[] {
    let effects = this.effectQueue;

    if (type) {
      effects = effects.filter((e) => e.type === type);
    }

    return effects.slice(-count);
  }

  /**
   * 清理队列
   */
  clearQueue(): void {
    this.effectQueue = [];
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      total: 0,
      confirmations: 0,
      notifications: 0,
      audits: 0,
      failed: 0,
    };
  }

  /**
   * 获取监听器数量
   */
  getListenerCount(type?: EffectType | "*"): number {
    if (!type) {
      return this.listeners.size;
    }

    return Array.from(this.listeners.values()).filter(
      (l) => l.type === type || l.type === "*",
    ).length;
  }

  /**
   * 清理所有监听器
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * 更新配置
   *
   * @param config - 部分配置
   */
  updateConfig(config: Partial<EffectManagerConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.debug !== undefined) {
      logger.debug({ debug: config.debug }, "EffectManager: 配置已更新");
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `listener_${timestamp}_${random}`;
  }

  private updateTypeStats(type: EffectType): void {
    switch (type) {
      case "confirmation":
        this.stats.confirmations++;
        break;
      case "notification":
        this.stats.notifications++;
        break;
      case "audit":
        this.stats.audits++;
        break;
    }
  }

  private addToQueue(effect: UnifiedEffect): void {
    this.effectQueue.push(effect);

    // 限制队列长度
    if (this.effectQueue.length > this.config.maxQueueSize) {
      this.effectQueue = this.effectQueue.slice(-this.config.maxQueueSize);
    }
  }

  private getEffectId(effect: UnifiedEffect): string {
    if ("payload" in effect && effect.payload && "id" in effect.payload) {
      return effect.payload.id as string;
    }
    return "unknown";
  }
}

// ============================================
// 工厂函数和单例
// ============================================

/**
 * 创建 EffectManager
 */
export function createEffectManager(
  config?: EffectManagerConfig,
): EffectManager {
  return new EffectManager(config);
}

/**
 * 默认 EffectManager 实例
 */
export const effectManager = new EffectManager();
