/**
 * RequestRegistry - 请求注册表
 *
 * 管理活跃请求的 AbortController，支持请求取消功能
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import { CancellationTokenSource } from "../orchestration/cancellation-token";

/**
 * 请求信息
 */
export interface RequestInfo {
  /** 请求 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** AbortController */
  abortController: AbortController;
  /** CancellationTokenSource (用于编排模式) */
  cancellationTokenSource: CancellationTokenSource;
  /** 创建时间 */
  createdAt: number;
  /** 请求描述 */
  description?: string;
  /** 是否已取消 */
  isCancelled: boolean;
}

/**
 * 请求注册表配置
 */
export interface RequestRegistryConfig {
  /** 最大活跃请求数 */
  maxActiveRequests?: number;
  /** 请求超时时间（毫秒） */
  requestTimeoutMs?: number;
  /** 清理间隔（毫秒） */
  cleanupIntervalMs?: number;
}

/**
 * 请求注册表
 *
 * 单例模式，管理所有活跃请求
 */
export class RequestRegistry {
  private requests = new Map<string, RequestInfo>();
  private config: Required<RequestRegistryConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: RequestRegistryConfig = {}) {
    this.config = {
      maxActiveRequests: 100,
      requestTimeoutMs: 5 * 60 * 1000, // 5 分钟
      cleanupIntervalMs: 60 * 1000, // 1 分钟
      ...config,
    };

    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 注册新请求
   *
   * @param requestId - 请求 ID
   * @param userId - 用户 ID
   * @param description - 请求描述（可选）
   * @returns 请求信息
   */
  register(
    requestId: string,
    userId: string,
    description?: string,
  ): RequestInfo {
    // 检查是否达到最大活跃请求数
    if (this.requests.size >= this.config.maxActiveRequests) {
      // 清理过期请求
      this.cleanupExpiredRequests();

      // 再次检查
      if (this.requests.size >= this.config.maxActiveRequests) {
        logger.warn(
          {
            maxActiveRequests: this.config.maxActiveRequests,
            currentCount: this.requests.size,
          },
          "RequestRegistry: Max active requests reached",
        );
        throw new Error("达到最大并发请求限制");
      }
    }

    const abortController = new AbortController();
    const cancellationTokenSource = new CancellationTokenSource();

    const info: RequestInfo = {
      id: requestId,
      userId,
      abortController,
      cancellationTokenSource,
      createdAt: Date.now(),
      description,
      isCancelled: false,
    };

    this.requests.set(requestId, info);

    logger.debug(
      {
        requestId,
        userId: userId.slice(0, 8) + "...",
        activeRequests: this.requests.size,
      },
      "RequestRegistry: Request registered",
    );

    return info;
  }

  /**
   * 获取请求信息
   *
   * @param requestId - 请求 ID
   * @returns 请求信息，不存在则返回 undefined
   */
  get(requestId: string): RequestInfo | undefined {
    return this.requests.get(requestId);
  }

  /**
   * 取消请求
   *
   * @param requestId - 请求 ID
   * @param reason - 取消原因
   * @returns 是否成功取消
   */
  cancel(requestId: string, reason?: string): boolean {
    const info = this.requests.get(requestId);

    if (!info) {
      logger.debug(
        { requestId },
        "RequestRegistry: Request not found for cancellation",
      );
      return false;
    }

    if (info.isCancelled) {
      logger.debug({ requestId }, "RequestRegistry: Request already cancelled");
      return false;
    }

    // 取消 AbortController
    info.abortController.abort(reason || "用户取消");

    // 取消 CancellationTokenSource
    info.cancellationTokenSource.cancel(reason || "用户取消");

    info.isCancelled = true;

    logger.info(
      {
        requestId,
        userId: info.userId.slice(0, 8) + "...",
        reason,
        elapsedMs: Date.now() - info.createdAt,
      },
      "RequestRegistry: Request cancelled",
    );

    return true;
  }

  /**
   * 取消用户的所有请求
   *
   * @param userId - 用户 ID
   * @param reason - 取消原因
   * @returns 取消的请求数量
   */
  cancelByUser(userId: string, reason?: string): number {
    let count = 0;

    // 使用 Array.from 避免迭代问题
    const entries = Array.from(this.requests.entries());
    for (const [requestId, info] of entries) {
      if (info.userId === userId && !info.isCancelled) {
        this.cancel(requestId, reason);
        count++;
      }
    }

    if (count > 0) {
      logger.info(
        {
          userId: userId.slice(0, 8) + "...",
          count,
          reason,
        },
        "RequestRegistry: User requests cancelled",
      );
    }

    return count;
  }

  /**
   * 注销请求
   *
   * @param requestId - 请求 ID
   * @returns 是否成功注销
   */
  unregister(requestId: string): boolean {
    const deleted = this.requests.delete(requestId);

    if (deleted) {
      logger.debug(
        {
          requestId,
          activeRequests: this.requests.size,
        },
        "RequestRegistry: Request unregistered",
      );
    }

    return deleted;
  }

  /**
   * 获取用户的活跃请求数量
   *
   * @param userId - 用户 ID
   * @returns 活跃请求数量
   */
  getActiveCountByUser(userId: string): number {
    let count = 0;
    // 使用 Array.from 避免迭代问题
    const values = Array.from(this.requests.values());
    for (const info of values) {
      if (info.userId === userId && !info.isCancelled) {
        count++;
      }
    }
    return count;
  }

  /**
   * 获取所有活跃请求数量
   */
  getActiveCount(): number {
    return this.requests.size;
  }

  /**
   * 清理过期请求
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    // 使用 Array.from 避免迭代问题
    const entries = Array.from(this.requests.entries());
    for (const [requestId, info] of entries) {
      if (now - info.createdAt > this.config.requestTimeoutMs) {
        expiredIds.push(requestId);
      }
    }

    for (const requestId of expiredIds) {
      const info = this.requests.get(requestId);
      if (info && !info.isCancelled) {
        // 取消过期请求
        info.abortController.abort("请求超时");
        info.cancellationTokenSource.cancel("请求超时");
      }
      this.requests.delete(requestId);
    }

    if (expiredIds.length > 0) {
      logger.debug(
        {
          cleanedCount: expiredIds.length,
          remainingCount: this.requests.size,
        },
        "RequestRegistry: Expired requests cleaned up",
      );
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredRequests();
    }, this.config.cleanupIntervalMs);

    // 确保不阻止 Node.js 进程退出
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 销毁注册表
   */
  destroy(): void {
    this.stopCleanupTimer();

    // 取消所有请求
    // 使用 Array.from 避免迭代问题
    const values = Array.from(this.requests.values());
    for (const info of values) {
      if (!info.isCancelled) {
        info.abortController.abort("注册表销毁");
        info.cancellationTokenSource.cancel("注册表销毁");
      }
    }

    this.requests.clear();

    logger.debug("RequestRegistry: Destroyed");
  }
}

// 单例实例
let requestRegistryInstance: RequestRegistry | null = null;

/**
 * 获取请求注册表单例
 */
export function getRequestRegistry(): RequestRegistry {
  if (!requestRegistryInstance) {
    requestRegistryInstance = new RequestRegistry();
  }
  return requestRegistryInstance;
}

/**
 * 创建请求注册表（用于测试）
 */
export function createRequestRegistry(
  config?: RequestRegistryConfig,
): RequestRegistry {
  return new RequestRegistry(config);
}
