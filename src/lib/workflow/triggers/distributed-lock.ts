/**
 * 分布式锁管理器
 *
 * 使用 PostgreSQL 实现分布式锁，防止多实例环境下定时任务重复执行
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * 分布式锁配置
 */
export interface DistributedLockConfig {
  /** 锁过期时间（毫秒） */
  ttlMs: number;
  /** 重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  retryIntervalMs: number;
}

const DEFAULT_CONFIG: DistributedLockConfig = {
  ttlMs: 60000, // 1 分钟
  maxRetries: 3,
  retryIntervalMs: 100,
};

/**
 * 分布式锁管理器
 *
 * 使用 PostgreSQL advisory lock 或表锁实现分布式锁，
 * 防止多实例环境下定时任务重复执行
 */
export class DistributedLockManager {
  /**
   * 尝试获取锁
   *
   * @param lockKey 锁标识
   * @param config 锁配置
   * @returns 是否获取成功
   */
  async tryAcquire(
    lockKey: string,
    config: Partial<DistributedLockConfig> = {},
  ): Promise<boolean> {
    const { ttlMs, maxRetries, retryIntervalMs } = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    const supabase = await createClient();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 使用 PostgreSQL 表锁实现
        const lockId = this.hashKey(lockKey);

        // 使用类型断言绕过 Supabase 类型检查（RPC 函数在迁移后才存在）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc(
          "try_acquire_workflow_lock",
          {
            p_lock_id: lockId,
            p_lock_key: lockKey,
            p_ttl_ms: ttlMs,
          },
        );

        if (error) {
          logger.warn(
            { error, lockKey, attempt },
            "DistributedLock: Failed to acquire lock",
          );
          await this.sleep(retryIntervalMs);
          continue;
        }

        if (data) {
          logger.debug({ lockKey, lockId }, "DistributedLock: Lock acquired");
          return true;
        }

        // 锁已被其他实例持有
        logger.debug(
          { lockKey, attempt },
          "DistributedLock: Lock held by another instance",
        );
        await this.sleep(retryIntervalMs);
      } catch (error) {
        logger.error(
          { error, lockKey, attempt },
          "DistributedLock: Unexpected error",
        );
        await this.sleep(retryIntervalMs);
      }
    }

    return false;
  }

  /**
   * 释放锁
   */
  async release(lockKey: string): Promise<void> {
    const supabase = await createClient();
    const lockId = this.hashKey(lockKey);

    try {
      // 使用类型断言绕过 Supabase 类型检查（RPC 函数在迁移后才存在）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("release_workflow_lock", {
        p_lock_id: lockId,
        p_lock_key: lockKey,
      });

      logger.debug({ lockKey, lockId }, "DistributedLock: Lock released");
    } catch (error) {
      logger.error(
        { error, lockKey },
        "DistributedLock: Failed to release lock",
      );
    }
  }

  /**
   * 执行带锁的操作
   */
  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    config?: Partial<DistributedLockConfig>,
  ): Promise<T | null> {
    const acquired = await this.tryAcquire(lockKey, config);

    if (!acquired) {
      logger.warn(
        { lockKey },
        "DistributedLock: Could not acquire lock, skipping operation",
      );
      return null;
    }

    try {
      return await operation();
    } finally {
      await this.release(lockKey);
    }
  }

  /**
   * 生成锁键的哈希值
   */
  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 单例导出
let lockManagerInstance: DistributedLockManager | null = null;

export function getDistributedLockManager(): DistributedLockManager {
  if (!lockManagerInstance) {
    lockManagerInstance = new DistributedLockManager();
  }
  return lockManagerInstance;
}
