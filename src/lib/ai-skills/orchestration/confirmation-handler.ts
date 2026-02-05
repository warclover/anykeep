/**
 * ConfirmationHandler - 确认请求处理器
 *
 * 职责：
 * - 存储和管理待确认操作
 * - 生成确认 ID
 * - 处理确认响应
 * - 管理确认超时和过期
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { ConfirmOption, ConfirmationResponse } from "../output/types";

// ============================================
// 类型定义
// ============================================

/**
 * 确认状态
 */
export type ConfirmationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "cancelled";

/**
 * 待确认操作
 */
export interface PendingConfirmation {
  /** 确认 ID */
  id: string;
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项 */
  options: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 当前状态 */
  status: ConfirmationStatus;
  /** 用户响应（确认后填充） */
  response?: ConfirmationResponse;
  /** 上下文数据（用于确认后执行） */
  contextData?: Record<string, unknown>;
  /** 关联的 Skill ID */
  skillId?: string;
  /** 关联的用户 ID */
  userId?: string;
}

/**
 * 确认请求选项
 */
export interface ConfirmationRequestOptions {
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项 */
  options?: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 超时时间（毫秒），默认 5 分钟 */
  timeoutMs?: number;
  /** 上下文数据（用于确认后执行） */
  contextData?: Record<string, unknown>;
  /** 关联的 Skill ID */
  skillId?: string;
  /** 关联的用户 ID */
  userId?: string;
}

/**
 * 确认结果
 */
export interface ConfirmationResult {
  /** 是否已确认 */
  confirmed: boolean;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 确认状态 */
  status: ConfirmationStatus;
  /** 额外数据 */
  data?: unknown;
  /** 上下文数据（从请求传递） */
  contextData?: Record<string, unknown>;
}

/**
 * 确认处理器配置
 */
export interface ConfirmationHandlerConfig {
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs: number;
  /** 最大待确认数量 */
  maxPendingConfirmations: number;
  /** 清理间隔（毫秒） */
  cleanupIntervalMs: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: ConfirmationHandlerConfig = {
  defaultTimeoutMs: 5 * 60 * 1000, // 5 分钟
  maxPendingConfirmations: 100,
  cleanupIntervalMs: 60 * 1000, // 1 分钟
};

/**
 * 默认确认选项
 */
const DEFAULT_OPTIONS: ConfirmOption[] = [
  {
    id: "confirm",
    label: "确认",
    primary: true,
  },
  {
    id: "cancel",
    label: "取消",
  },
];

// ============================================
// 确认处理器实现
// ============================================

/**
 * 确认请求处理器
 *
 * 管理 AI Skills 执行过程中需要用户确认的操作
 *
 * @example
 * ```typescript
 * const handler = new ConfirmationHandler();
 *
 * // 创建确认请求
 * const confirmation = handler.createConfirmation({
 *   title: '批量删除',
 *   message: '确定要删除选中的 5 条书签吗？',
 *   preview: ['书签1', '书签2', '书签3', '书签4', '书签5'],
 * });
 *
 * // 等待用户响应
 * const result = await handler.waitForConfirmation(confirmation.id);
 *
 * if (result.confirmed) {
 *   // 执行删除操作
 * }
 * ```
 */
export class ConfirmationHandler {
  private config: ConfirmationHandlerConfig;
  private pendingConfirmations: Map<string, PendingConfirmation>;
  private confirmationPromises: Map<
    string,
    {
      resolve: (result: ConfirmationResult) => void;
      reject: (error: Error) => void;
      timeoutId?: NodeJS.Timeout;
    }
  >;
  private cleanupTimer?: NodeJS.Timeout;
  /**
   * 创建确认的互斥锁，防止并发创建时的竞态条件
   * 使用 Promise 队列确保 createConfirmation 操作的原子性
   */
  private createLock: Promise<unknown> = Promise.resolve();

  constructor(config: Partial<ConfirmationHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pendingConfirmations = new Map();
    this.confirmationPromises = new Map();

    // 启动定期清理
    this.startCleanupTimer();
  }

  /**
   * 生成确认 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `confirm_${timestamp}_${random}`;
  }

  /**
   * 创建确认请求
   *
   * @param options - 确认请求选项
   * @returns 待确认操作对象
   */
  async createConfirmation(
    options: ConfirmationRequestOptions,
  ): Promise<PendingConfirmation> {
    // 使用锁机制确保并发安全
    this.createLock = this.createLock.then(async () => {
      // 检查数量限制
      if (
        this.pendingConfirmations.size >= this.config.maxPendingConfirmations
      ) {
        // 清理过期的确认
        this.cleanupExpired();

        // 如果仍然超过限制，删除最旧的
        if (
          this.pendingConfirmations.size >= this.config.maxPendingConfirmations
        ) {
          const oldestId = this.findOldestPending();
          if (oldestId) {
            this.cancelConfirmation(oldestId, "达到最大待确认数量限制");
          }
        }
      }

      const id = this.generateId();
      const now = new Date();
      const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

      const confirmation: PendingConfirmation = {
        id,
        title: options.title,
        message: options.message,
        options: options.options ?? DEFAULT_OPTIONS,
        preview: options.preview,
        createdAt: now,
        expiresAt: new Date(now.getTime() + timeoutMs),
        status: "pending",
        contextData: options.contextData,
        skillId: options.skillId,
        userId: options.userId,
      };

      this.pendingConfirmations.set(id, confirmation);

      logger.debug(
        {
          confirmationId: id,
          title: options.title,
          expiresAt: confirmation.expiresAt,
        },
        "ConfirmationHandler: 创建确认请求",
      );

      return confirmation;
    });

    return this.createLock as Promise<PendingConfirmation>;
  }

  /**
   * 等待用户确认
   *
   * @param confirmationId - 确认 ID
   * @param timeoutMs - 超时时间（毫秒），可选，使用创建时的超时设置
   * @returns 确认结果
   */
  waitForConfirmation(
    confirmationId: string,
    timeoutMs?: number,
  ): Promise<ConfirmationResult> {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      return Promise.reject(new Error(`确认请求不存在: ${confirmationId}`));
    }

    if (confirmation.status !== "pending") {
      // 已经有结果，直接返回
      return Promise.resolve(this.getResultFromConfirmation(confirmation));
    }

    // 检查是否已过期
    if (new Date() > confirmation.expiresAt) {
      confirmation.status = "expired";
      return Promise.resolve({
        confirmed: false,
        selectedOption: "",
        status: "expired",
      });
    }

    return new Promise((resolve, reject) => {
      const effectiveTimeout =
        timeoutMs ?? confirmation.expiresAt.getTime() - Date.now();

      // 设置超时
      const timeoutId = setTimeout(
        () => {
          this.handleTimeout(confirmationId);
        },
        Math.max(effectiveTimeout, 0),
      );

      this.confirmationPromises.set(confirmationId, {
        resolve,
        reject,
        timeoutId,
      });
    });
  }

  /**
   * 响应确认请求
   *
   * @param confirmationId - 确认 ID
   * @param selectedOption - 选择的选项 ID
   * @param data - 额外数据
   * @returns 是否成功处理
   */
  respondToConfirmation(
    confirmationId: string,
    selectedOption: string,
    data?: unknown,
  ): boolean {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      logger.warn({ confirmationId }, "ConfirmationHandler: 确认请求不存在");
      return false;
    }

    if (confirmation.status !== "pending") {
      logger.warn(
        { confirmationId, status: confirmation.status },
        "ConfirmationHandler: 确认请求已处理",
      );
      return false;
    }

    // 检查是否已过期
    if (new Date() > confirmation.expiresAt) {
      confirmation.status = "expired";
      this.resolvePromise(confirmationId, {
        confirmed: false,
        selectedOption: "",
        status: "expired",
      });
      return false;
    }

    // 更新确认状态
    const isConfirmed = selectedOption !== "cancel";
    confirmation.status = isConfirmed ? "confirmed" : "cancelled";
    confirmation.response = {
      id: confirmationId,
      selectedOption,
      data,
    };

    logger.debug(
      {
        confirmationId,
        selectedOption,
        isConfirmed,
      },
      "ConfirmationHandler: 处理确认响应",
    );

    // 解析等待的 Promise
    this.resolvePromise(confirmationId, {
      confirmed: isConfirmed,
      selectedOption,
      status: confirmation.status,
      data,
      contextData: confirmation.contextData,
    });

    return true;
  }

  /**
   * 取消确认请求
   *
   * @param confirmationId - 确认 ID
   * @param reason - 取消原因
   */
  cancelConfirmation(confirmationId: string, reason?: string): void {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation || confirmation.status !== "pending") {
      return;
    }

    confirmation.status = "cancelled";

    logger.debug(
      { confirmationId, reason },
      "ConfirmationHandler: 取消确认请求",
    );

    this.resolvePromise(confirmationId, {
      confirmed: false,
      selectedOption: "cancel",
      status: "cancelled",
    });
  }

  /**
   * 获取待确认操作
   *
   * @param confirmationId - 确认 ID
   * @returns 待确认操作对象
   */
  getConfirmation(confirmationId: string): PendingConfirmation | undefined {
    return this.pendingConfirmations.get(confirmationId);
  }

  /**
   * 获取用户的所有待确认操作
   *
   * @param userId - 用户 ID
   * @returns 待确认操作列表
   */
  getPendingByUser(userId: string): PendingConfirmation[] {
    const results: PendingConfirmation[] = [];

    for (const confirmation of this.pendingConfirmations.values()) {
      if (confirmation.userId === userId && confirmation.status === "pending") {
        results.push(confirmation);
      }
    }

    return results.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /**
   * 获取 Skill 的所有待确认操作
   *
   * @param skillId - Skill ID
   * @returns 待确认操作列表
   */
  getPendingBySkill(skillId: string): PendingConfirmation[] {
    const results: PendingConfirmation[] = [];

    for (const confirmation of this.pendingConfirmations.values()) {
      if (
        confirmation.skillId === skillId &&
        confirmation.status === "pending"
      ) {
        results.push(confirmation);
      }
    }

    return results;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    expired: number;
  } {
    const stats = {
      total: this.pendingConfirmations.size,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0,
    };

    for (const confirmation of this.pendingConfirmations.values()) {
      switch (confirmation.status) {
        case "pending":
          stats.pending++;
          break;
        case "confirmed":
          stats.confirmed++;
          break;
        case "cancelled":
        case "rejected":
          stats.cancelled++;
          break;
        case "expired":
          stats.expired++;
          break;
      }
    }

    return stats;
  }

  /**
   * 清理过期的确认请求
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, confirmation] of this.pendingConfirmations.entries()) {
      if (confirmation.status === "pending" && now > confirmation.expiresAt) {
        confirmation.status = "expired";
        this.resolvePromise(id, {
          confirmed: false,
          selectedOption: "",
          status: "expired",
        });
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, "ConfirmationHandler: 清理过期确认请求");
    }

    return cleanedCount;
  }

  /**
   * 清理已完成的确认请求（保留指定时间）
   *
   * @param maxAgeMs - 最大保留时间（毫秒），默认 1 小时
   */
  cleanupCompleted(maxAgeMs = 60 * 60 * 1000): number {
    const now = new Date();
    const threshold = new Date(now.getTime() - maxAgeMs);
    let cleanedCount = 0;

    for (const [id, confirmation] of this.pendingConfirmations.entries()) {
      if (
        confirmation.status !== "pending" &&
        confirmation.createdAt < threshold
      ) {
        this.pendingConfirmations.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, "ConfirmationHandler: 清理已完成确认请求");
    }

    return cleanedCount;
  }

  /**
   * 停止处理器（清理定时器）
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 取消所有待处理的确认
    for (const [id, promiseData] of this.confirmationPromises.entries()) {
      if (promiseData.timeoutId) {
        clearTimeout(promiseData.timeoutId);
      }
      promiseData.reject(new Error("ConfirmationHandler 已关闭"));
      this.confirmationPromises.delete(id);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
      this.cleanupCompleted();
    }, this.config.cleanupIntervalMs);

    // 确保定时器不阻止进程退出
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private handleTimeout(confirmationId: string): void {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (confirmation && confirmation.status === "pending") {
      confirmation.status = "expired";

      // 解析 Promise 并清理相关资源
      this.resolvePromise(confirmationId, {
        confirmed: false,
        selectedOption: "",
        status: "expired",
      });

      // 确保 pendingConfirmations 中的过期确认在适当时候被清理
      // 注意：不立即删除 pendingConfirmations 中的条目，以便用户仍可查询
      // cleanupCompleted() 会定期清理已过期的条目
      logger.debug({ confirmationId }, "ConfirmationHandler: 确认请求超时");
    }
  }

  private resolvePromise(
    confirmationId: string,
    result: ConfirmationResult,
  ): void {
    const promiseData = this.confirmationPromises.get(confirmationId);

    if (promiseData) {
      // 清理超时定时器
      if (promiseData.timeoutId) {
        clearTimeout(promiseData.timeoutId);
      }
      // 解析 Promise
      promiseData.resolve(result);
      // 从 Map 中删除，释放内存
      this.confirmationPromises.delete(confirmationId);
    } else {
      // 如果没有对应的 Promise，说明已经超时或被清理
      logger.debug(
        { confirmationId },
        "ConfirmationHandler: resolvePromise 没有找到对应的 Promise",
      );
    }
  }

  private getResultFromConfirmation(
    confirmation: PendingConfirmation,
  ): ConfirmationResult {
    return {
      confirmed: confirmation.status === "confirmed",
      selectedOption: confirmation.response?.selectedOption ?? "",
      status: confirmation.status,
      data: confirmation.response?.data,
      contextData: confirmation.contextData,
    };
  }

  private findOldestPending(): string | undefined {
    let oldestId: string | undefined;
    let oldestTime = Infinity;

    for (const [id, confirmation] of this.pendingConfirmations.entries()) {
      if (
        confirmation.status === "pending" &&
        confirmation.createdAt.getTime() < oldestTime
      ) {
        oldestId = id;
        oldestTime = confirmation.createdAt.getTime();
      }
    }

    return oldestId;
  }
}

// ============================================
// 工厂函数和单例
// ============================================

/**
 * 创建确认处理器
 */
export function createConfirmationHandler(
  config?: Partial<ConfirmationHandlerConfig>,
): ConfirmationHandler {
  return new ConfirmationHandler(config);
}

/**
 * 默认确认处理器实例
 */
export const confirmationHandler = new ConfirmationHandler();
