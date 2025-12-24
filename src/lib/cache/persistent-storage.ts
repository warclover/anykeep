/**
 * 本地持久化存储管理器
 * V5.0: 为 DataCacheManager 提供 localStorage 持久化能力
 * V5.2: 使用 requestIdleCallback 异步持久化，避免阻塞 UI
 *
 * 特点：
 * - 应用启动时从 localStorage 恢复缓存
 * - 数据变更时自动持久化（防抖 + 异步）
 * - 24小时过期自动清理
 * - 最多缓存10个键（防止膨胀）
 */

import { clientLogger } from "@/lib/client-logger";

/**
 * 缓存条目结构（与 data-cache.ts 保持一致）
 */
interface CacheEntry {
  data: unknown;
  timestamp: number;
  isValidating: boolean;
  error?: Error;
}

/**
 * 持久化存储结构
 */
interface PersistedCache {
  version: 1;
  timestamp: number;
  entries: Record<
    string,
    {
      data: unknown;
      timestamp: number;
    }
  >;
}

/**
 * 本地持久化存储管理器
 */
class PersistentStorage {
  private readonly storageKey = "anykeep:cache:v1";
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24小时过期
  private readonly maxEntries = 10; // 最多缓存10个键
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistDebounceMs = 100; // V5.2: 缩短防抖时间（异步执行不再阻塞）
  private idleCallbackId: number | null = null; // V5.2: requestIdleCallback ID

  /**
   * 从 localStorage 恢复缓存
   * @returns 恢复的缓存 Map，如果没有有效缓存则返回 null
   */
  restore(): Map<string, CacheEntry> | null {
    // SSR 环境检查
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return null;
      }

      const parsed: PersistedCache = JSON.parse(stored);

      // 版本检查
      if (parsed.version !== 1) {
        clientLogger.warn(
          "[PersistentStorage] Version mismatch, clearing cache",
        );
        this.clear();
        return null;
      }

      // 整体过期检查
      if (Date.now() - parsed.timestamp > this.maxAge) {
        clientLogger.warn("[PersistentStorage] Cache expired, clearing");
        this.clear();
        return null;
      }

      // 构建 Map
      const map = new Map<string, CacheEntry>();
      for (const [key, entry] of Object.entries(parsed.entries)) {
        // 单条目过期检查
        if (Date.now() - entry.timestamp > this.maxAge) {
          continue;
        }

        map.set(key, {
          data: entry.data,
          timestamp: entry.timestamp,
          isValidating: false,
        });
      }

      if (map.size > 0) {
        clientLogger.info(
          { entriesCount: map.size },
          "[PersistentStorage] Restored entries from localStorage",
        );
      }

      return map.size > 0 ? map : null;
    } catch (error) {
      clientLogger.warn({ error }, "[PersistentStorage] Restore failed");
      this.clear();
      return null;
    }
  }

  /**
   * 持久化到 localStorage（防抖 + 异步）
   * V5.2: 使用 requestIdleCallback 在空闲时执行，避免阻塞 UI
   * @param entries 要持久化的缓存 Map
   */
  persist(entries: Map<string, CacheEntry>): void {
    // SSR 环境检查
    if (typeof window === "undefined") {
      return;
    }

    // 防抖：取消之前的定时器
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    // V5.2: 取消之前的 idle callback
    if (this.idleCallbackId !== null && "cancelIdleCallback" in window) {
      (window as Window).cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }

    this.persistTimer = setTimeout(() => {
      // V5.2: 使用 requestIdleCallback 异步执行持久化
      if ("requestIdleCallback" in window) {
        this.idleCallbackId = (window as Window).requestIdleCallback(
          () => {
            this.idleCallbackId = null;
            this.doPersist(entries);
          },
          { timeout: 1000 }, // 最多等待 1 秒
        );
      } else {
        // 回退方案：使用 setTimeout(0) 异步执行
        setTimeout(() => this.doPersist(entries), 0);
      }
    }, this.persistDebounceMs);
  }

  /**
   * 立即持久化（用于关键操作）
   * @param entries 要持久化的缓存 Map
   */
  persistImmediately(entries: Map<string, CacheEntry>): void {
    // SSR 环境检查
    if (typeof window === "undefined") {
      return;
    }

    // 取消防抖定时器
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    this.doPersist(entries);
  }

  /**
   * V5.1: 支持持久化的缓存键前缀
   */
  private readonly persistablePrefixes = ["bookmarks:", "folders:"];

  /**
   * 检查键是否应该被持久化
   */
  private shouldPersist(key: string): boolean {
    return this.persistablePrefixes.some((prefix) => key.startsWith(prefix));
  }

  /**
   * 执行持久化
   * V5.1: 支持书签和文件夹数据持久化
   */
  private doPersist(entries: Map<string, CacheEntry>): void {
    try {
      // 只保留需要持久化的缓存，并限制数量
      const filtered: Record<string, { data: unknown; timestamp: number }> = {};
      let count = 0;

      for (const [key, entry] of entries) {
        // V5.1: 持久化书签和文件夹数据
        if (this.shouldPersist(key) && count < this.maxEntries) {
          filtered[key] = {
            data: entry.data,
            timestamp: entry.timestamp,
          };
          count++;
        }
      }

      if (count === 0) {
        // 没有需要持久化的数据，清除存储
        localStorage.removeItem(this.storageKey);
        return;
      }

      const cache: PersistedCache = {
        version: 1,
        timestamp: Date.now(),
        entries: filtered,
      };

      const jsonString = JSON.stringify(cache);
      localStorage.setItem(this.storageKey, jsonString);

      clientLogger.info(
        { entriesCount: count, sizeKB: (jsonString.length / 1024).toFixed(1) },
        "[PersistentStorage] Persisted entries",
      );
    } catch (error) {
      clientLogger.warn({ error }, "[PersistentStorage] Persist failed");

      // localStorage 可能满了，尝试清理
      if (
        error instanceof Error &&
        (error.name === "QuotaExceededError" || error.message.includes("quota"))
      ) {
        this.cleanup();
      }
    }
  }

  /**
   * 清理过期数据和其他 anykeep 缓存
   */
  cleanup(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      // 清理所有 anykeep 相关缓存
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("anykeep:cache:")) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      if (keysToRemove.length > 0) {
        clientLogger.info(
          { keysCount: keysToRemove.length },
          "[PersistentStorage] Cleaned up cache keys",
        );
      }
    } catch {
      // 静默失败
    }
  }

  /**
   * 完全清除当前版本的缓存
   */
  clear(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(this.storageKey);
      clientLogger.info("[PersistentStorage] Cache cleared");
    } catch {
      // 静默失败
    }
  }

  /**
   * 检查是否有持久化的缓存
   */
  has(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return localStorage.getItem(this.storageKey) !== null;
    } catch {
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    hasCache: boolean;
    entryCount: number;
    sizeKB: number;
    age: number | null;
  } {
    if (typeof window === "undefined") {
      return { hasCache: false, entryCount: 0, sizeKB: 0, age: null };
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return { hasCache: false, entryCount: 0, sizeKB: 0, age: null };
      }

      const parsed: PersistedCache = JSON.parse(stored);
      return {
        hasCache: true,
        entryCount: Object.keys(parsed.entries).length,
        sizeKB: Math.round((stored.length / 1024) * 10) / 10,
        age: Date.now() - parsed.timestamp,
      };
    } catch {
      return { hasCache: false, entryCount: 0, sizeKB: 0, age: null };
    }
  }
}

// 单例导出
export const persistentStorage = new PersistentStorage();

// 类型导出（供 data-cache.ts 使用）
export type { CacheEntry };
