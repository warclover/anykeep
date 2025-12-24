/**
 * AI Agent Tool Confirmation Handler
 *
 * 管理 AI Agent 工具调用的确认流程
 * - 存储待确认操作
 * - 处理用户确认/取消
 * - 自动清理过期确认
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { PendingConfirmation, ToolContext } from "../tools/types";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 确认状态
 */
export type ConfirmationState =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "expired";

/**
 * 存储的确认记录
 */
export interface StoredConfirmation {
  /** 确认详情 */
  confirmation: PendingConfirmation;
  /** 状态 */
  state: ConfirmationState;
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 确认响应结果
 */
export interface ConfirmationResult {
  /** 是否成功 */
  success: boolean;
  /** 确认记录 */
  confirmation?: StoredConfirmation;
  /** 错误信息 */
  error?: string;
  /** 是否可重试执行 */
  canRetry?: boolean;
}

/**
 * 创建确认的选项
 */
export interface CreateConfirmationOptions {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
}

// ============================================
// 确认处理器类
// ============================================

/**
 * AI Agent 确认处理器
 *
 * 特性：
 * - 内存存储，支持 TTL 自动清理
 * - 线程安全的确认状态管理
 * - 支持批量操作
 */
class ConfirmationHandler {
  /** 确认存储（key: confirmationId） */
  private readonly confirmationStore = new Map<string, StoredConfirmation>();

  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** 清理间隔（毫秒） */
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000; // 1 分钟

  constructor() {
    this.startCleanupTimer();
  }

  // ============================================
  // 公共方法
  // ============================================

  /**
   * 存储待确认操作
   *
   * @param confirmation - 待确认操作详情
   * @param options - 创建选项
   * @returns 存储的确认记录
   */
  store(
    confirmation: PendingConfirmation,
    options: CreateConfirmationOptions,
  ): StoredConfirmation {
    const now = new Date();

    const stored: StoredConfirmation = {
      confirmation,
      state: "pending",
      userId: options.userId,
      conversationId: options.conversationId,
      createdAt: now,
      updatedAt: now,
    };

    this.confirmationStore.set(confirmation.confirmationId, stored);

    logger.debug(
      {
        confirmationId: confirmation.confirmationId,
        toolName: confirmation.toolName,
      },
      "Stored pending confirmation",
    );

    return stored;
  }

  /**
   * 获取待确认操作
   *
   * @param confirmationId - 确认 ID
   * @param userId - 用户 ID（用于权限验证）
   * @returns 确认记录或 null
   */
  get(confirmationId: string, userId: string): StoredConfirmation | null {
    const stored = this.confirmationStore.get(confirmationId);

    if (!stored) {
      return null;
    }

    // 权限验证
    if (stored.userId !== userId) {
      logger.warn(
        { confirmationId, expectedUserId: stored.userId, actualUserId: userId },
        "Confirmation access denied - user mismatch",
      );
      return null;
    }

    // 检查是否过期
    if (this.isExpired(stored)) {
      stored.state = "expired";
      stored.updatedAt = new Date();
      return stored;
    }

    return stored;
  }

  /**
   * 确认操作
   *
   * @param confirmationId - 确认 ID
   * @param userId - 用户 ID
   * @returns 确认结果
   */
  confirm(confirmationId: string, userId: string): ConfirmationResult {
    const stored = this.get(confirmationId, userId);

    if (!stored) {
      return {
        success: false,
        error: "确认操作不存在或无权访问",
      };
    }

    if (stored.state === "expired") {
      return {
        success: false,
        confirmation: stored,
        error: "确认操作已过期",
        canRetry: true,
      };
    }

    if (stored.state !== "pending") {
      return {
        success: false,
        confirmation: stored,
        error: `确认操作已处理（状态: ${stored.state}）`,
      };
    }

    // 更新状态
    stored.state = "confirmed";
    stored.updatedAt = new Date();

    logger.info(
      { confirmationId, toolName: stored.confirmation.toolName },
      "Confirmation confirmed",
    );

    return {
      success: true,
      confirmation: stored,
    };
  }

  /**
   * 取消操作
   *
   * @param confirmationId - 确认 ID
   * @param userId - 用户 ID
   * @returns 确认结果
   */
  cancel(confirmationId: string, userId: string): ConfirmationResult {
    const stored = this.get(confirmationId, userId);

    if (!stored) {
      return {
        success: false,
        error: "确认操作不存在或无权访问",
      };
    }

    if (stored.state !== "pending" && stored.state !== "expired") {
      return {
        success: false,
        confirmation: stored,
        error: `确认操作已处理（状态: ${stored.state}）`,
      };
    }

    // 更新状态
    stored.state = "cancelled";
    stored.updatedAt = new Date();

    logger.info(
      { confirmationId, toolName: stored.confirmation.toolName },
      "Confirmation cancelled",
    );

    return {
      success: true,
      confirmation: stored,
    };
  }

  /**
   * 获取用户所有待确认操作
   *
   * @param userId - 用户 ID
   * @param includeExpired - 是否包含已过期的
   * @returns 确认记录列表
   */
  getUserPendingConfirmations(
    userId: string,
    includeExpired = false,
  ): StoredConfirmation[] {
    const results: StoredConfirmation[] = [];

    for (const stored of this.confirmationStore.values()) {
      if (stored.userId !== userId) continue;

      // 更新过期状态
      if (this.isExpired(stored) && stored.state === "pending") {
        stored.state = "expired";
        stored.updatedAt = new Date();
      }

      if (
        stored.state === "pending" ||
        (includeExpired && stored.state === "expired")
      ) {
        results.push(stored);
      }
    }

    // 按创建时间排序（最新的在前）
    return results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /**
   * 获取用户待确认数量
   *
   * @param userId - 用户 ID
   * @returns 待确认数量
   */
  getUserPendingCount(userId: string): number {
    let count = 0;

    for (const stored of this.confirmationStore.values()) {
      if (stored.userId !== userId) continue;
      if (stored.state !== "pending") continue;
      if (this.isExpired(stored)) continue;
      count++;
    }

    return count;
  }

  /**
   * 构建确认后的 ToolContext
   *
   * @param stored - 已确认的记录
   * @returns ToolContext
   */
  buildConfirmedContext(stored: StoredConfirmation): ToolContext {
    return {
      userId: stored.userId,
      conversationId: stored.conversationId,
      confirmed: true,
      confirmationId: stored.confirmation.confirmationId,
    };
  }

  /**
   * 删除确认记录
   *
   * @param confirmationId - 确认 ID
   */
  delete(confirmationId: string): void {
    this.confirmationStore.delete(confirmationId);
  }

  /**
   * 批量确认
   *
   * @param confirmationIds - 确认 ID 列表
   * @param userId - 用户 ID
   * @returns 成功/失败计数
   */
  batchConfirm(
    confirmationIds: string[],
    userId: string,
  ): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    for (const id of confirmationIds) {
      const result = this.confirm(id, userId);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 批量取消
   *
   * @param confirmationIds - 确认 ID 列表
   * @param userId - 用户 ID
   * @returns 成功/失败计数
   */
  batchCancel(
    confirmationIds: string[],
    userId: string,
  ): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    for (const id of confirmationIds) {
      const result = this.cancel(id, userId);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 检查确认是否已过期
   */
  private isExpired(stored: StoredConfirmation): boolean {
    return new Date() > stored.confirmation.expiresAt;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);

    // 确保进程退出时清理定时器
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => this.stopCleanupTimer());
    }
  }

  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清理过期和已处理的确认记录
   */
  private cleanup(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 分钟后删除已处理记录
    let cleaned = 0;

    for (const [id, stored] of this.confirmationStore.entries()) {
      // 删除已处理且超过 maxAge 的记录
      if (stored.state !== "pending") {
        const age = now.getTime() - stored.updatedAt.getTime();
        if (age > maxAge) {
          this.confirmationStore.delete(id);
          cleaned++;
        }
        continue;
      }

      // 标记过期记录
      if (this.isExpired(stored)) {
        stored.state = "expired";
        stored.updatedAt = now;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, "Cleaned up old confirmation records");
    }
  }

  /**
   * 获取存储统计（用于调试）
   */
  getStats(): {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    expired: number;
  } {
    const stats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0,
    };

    for (const stored of this.confirmationStore.values()) {
      stats.total++;
      stats[stored.state]++;
    }

    return stats;
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * AI Agent 确认处理器单例
 */
export const confirmationHandler = new ConfirmationHandler();

/**
 * 导出类型便于测试
 */
export { ConfirmationHandler };
