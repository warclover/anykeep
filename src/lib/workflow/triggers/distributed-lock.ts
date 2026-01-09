/**
 * 分布式锁管理器
 *
 * 使用 PostgreSQL 实现分布式锁，防止多实例环境下定时任务重复执行
 *
 * @version 1.0.1
 * @since 2026-01-08
 * @updated 2026-01-09 - 安全修复：释放锁时验证 instance_id
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
 * 锁句柄，用于安全释放锁
 */
export interface LockHandle {
  lockKey: string;
  lockId: number;
  instanceId: string;
}

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
   * @returns 锁句柄（包含 instanceId），获取失败返回 null
   */
  async tryAcquire(
    lockKey: string,
    config: Partial<DistributedLockConfig> = {},
  ): Promise<LockHandle | null> {
    const { ttlMs, maxRetries, retryIntervalMs } = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    const supabase = await createClient();
    const lockId = this.hashKey(lockKey);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
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

        // 安全修复：函数现在返回 instance_id 而非布尔值
        if (data) {
          const instanceId = data as string;
          logger.debug(
            { lockKey, lockId, instanceId },
            "DistributedLock: Lock acquired",
          );
          return { lockKey, lockId, instanceId };
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

    return null;
  }

  /**
   * 释放锁
   *
   * 安全修复：必须提供获取锁时返回的句柄，验证 instance_id
   *
   * @param handle 锁句柄
   * @returns 是否成功释放
   */
  async release(handle: LockHandle): Promise<boolean> {
    const supabase = await createClient();

    try {
      // 安全修复：传递 instance_id 验证锁持有者身份
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "release_workflow_lock",
        {
          p_lock_id: handle.lockId,
          p_lock_key: handle.lockKey,
          p_instance_id: handle.instanceId,
        },
      );

      if (error) {
        logger.error(
          { error, handle },
          "DistributedLock: Failed to release lock",
        );
        return false;
      }

      const released = data === true;
      if (released) {
        logger.debug(
          { lockKey: handle.lockKey, lockId: handle.lockId },
          "DistributedLock: Lock released",
        );
      } else {
        logger.warn(
          { handle },
          "DistributedLock: Lock not found or owned by another instance",
        );
      }

      return released;
    } catch (error) {
      logger.error(
        { error, handle },
        "DistributedLock: Failed to release lock",
      );
      return false;
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
    const handle = await this.tryAcquire(lockKey, config);

    if (!handle) {
      logger.warn(
        { lockKey },
        "DistributedLock: Could not acquire lock, skipping operation",
      );
      return null;
    }

    try {
      return await operation();
    } finally {
      await this.release(handle);
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
