/**
 * SWR 风格的数据缓存层
 * stale-while-revalidate 策略实现
 */

import { DATA_CACHE_CONFIG } from "./cache-config";

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isValidating: boolean;
  error?: Error;
}

/**
 * 获取数据的选项
 */
export interface FetchOptions<T> {
  cacheKey: string;
  fetcher: () => Promise<T>;
  staleTime?: number;
  cacheTime?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * 获取数据的结果
 */
export interface FetchResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isValidating: boolean;
  isStale: boolean;
  error?: Error;
  mutate: (data?: T | ((prev: T | undefined) => T)) => Promise<void>;
}

/**
 * 数据缓存管理器
 * 实现 stale-while-revalidate 策略
 */
class DataCacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private subscribers = new Map<
    string,
    Set<(entry: CacheEntry<unknown> | undefined) => void>
  >();
  private pendingRequests = new Map<string, Promise<unknown>>();

  /**
   * 同步获取缓存数据（不触发请求）
   */
  getSync<T>(cacheKey: string): {
    data: T | undefined;
    isStale: boolean;
    timestamp: number | undefined;
  } {
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (!cached) {
      return { data: undefined, isStale: true, timestamp: undefined };
    }

    const isStale = now - cached.timestamp > DATA_CACHE_CONFIG.staleTime;

    return {
      data: cached.data,
      isStale,
      timestamp: cached.timestamp,
    };
  }

  /**
   * 获取数据（SWR 模式）
   * 优先返回缓存，后台刷新
   */
  async get<T>(options: FetchOptions<T>): Promise<FetchResult<T>> {
    const {
      cacheKey,
      fetcher,
      staleTime = DATA_CACHE_CONFIG.staleTime,
      cacheTime = DATA_CACHE_CONFIG.cacheTime,
      onSuccess,
      onError,
    } = options;

    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    const now = Date.now();

    // 检查缓存状态
    const isStale = !cached || now - cached.timestamp > staleTime;
    const isExpired = !cached || now - cached.timestamp > cacheTime;

    // 创建 mutate 函数
    const mutate = this.createMutator<T>(cacheKey, fetcher);

    // 情况 1：有新鲜缓存，直接返回
    if (cached && !isStale) {
      return {
        data: cached.data,
        isLoading: false,
        isValidating: false,
        isStale: false,
        mutate,
      };
    }

    // 情况 2：有过期但未失效的缓存，先返回缓存，后台刷新
    if (cached && !isExpired) {
      // 后台重新验证（不阻塞返回）
      this.revalidateInBackground(cacheKey, fetcher, onSuccess, onError);

      return {
        data: cached.data,
        isLoading: false,
        isValidating: true,
        isStale: true,
        mutate,
      };
    }

    // 情况 3：没有缓存或已完全过期，需要等待请求
    try {
      const data = await this.fetchWithDedup(cacheKey, fetcher);
      onSuccess?.(data);

      return {
        data,
        isLoading: false,
        isValidating: false,
        isStale: false,
        mutate,
      };
    } catch (error) {
      onError?.(error as Error);

      return {
        data: cached?.data, // 返回旧缓存（如果有）
        isLoading: false,
        isValidating: false,
        isStale: true,
        error: error as Error,
        mutate,
      };
    }
  }

  /**
   * 预取数据（用于预热缓存）
   */
  async prefetch<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
  ): Promise<void> {
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // 如果缓存还新鲜，不需要预取
    if (cached && now - cached.timestamp < DATA_CACHE_CONFIG.staleTime) {
      return;
    }

    try {
      await this.fetchWithDedup(cacheKey, fetcher);
    } catch {
      // 预取失败静默处理
    }
  }

  /**
   * 请求去重
   * 同一 cacheKey 的并发请求只发一次
   */
  private async fetchWithDedup<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    // 如果已有进行中的请求，复用它
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending as Promise<T>;
    }

    // 标记为验证中
    this.updateValidatingState(cacheKey, true);

    // 发起新请求
    const promise = fetcher()
      .then((data) => {
        this.setCache(cacheKey, data);
        return data;
      })
      .catch((error) => {
        // 更新错误状态
        const cached = this.cache.get(cacheKey);
        if (cached) {
          cached.error = error;
          cached.isValidating = false;
          this.notifySubscribers(cacheKey);
        }
        throw error;
      })
      .finally(() => {
        this.pendingRequests.delete(cacheKey);
        this.updateValidatingState(cacheKey, false);
      });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * 后台重新验证
   */
  private async revalidateInBackground<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    onSuccess?: (data: T) => void,
    onError?: (error: Error) => void,
  ): Promise<void> {
    try {
      const data = await this.fetchWithDedup(cacheKey, fetcher);
      onSuccess?.(data);
    } catch (error) {
      onError?.(error as Error);
    }
  }

  /**
   * 设置缓存
   */
  private setCache<T>(cacheKey: string, data: T): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      isValidating: false,
      error: undefined,
    });
    this.notifySubscribers(cacheKey);
  }

  /**
   * 更新验证状态
   */
  private updateValidatingState(cacheKey: string, isValidating: boolean): void {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      cached.isValidating = isValidating;
      this.notifySubscribers(cacheKey);
    }
  }

  /**
   * 创建 mutate 函数
   */
  private createMutator<T>(cacheKey: string, fetcher: () => Promise<T>) {
    return async (data?: T | ((prev: T | undefined) => T)): Promise<void> => {
      if (data !== undefined) {
        // 乐观更新
        const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
        const newData =
          typeof data === "function"
            ? (data as (prev: T | undefined) => T)(cached?.data)
            : data;

        this.setCache(cacheKey, newData);
      }

      // 重新获取最新数据
      try {
        await this.fetchWithDedup(cacheKey, fetcher);
      } catch {
        // mutate 失败时保持乐观更新的数据
      }
    };
  }

  /**
   * 订阅缓存变化
   */
  subscribe(
    cacheKey: string,
    callback: (entry: CacheEntry<unknown> | undefined) => void,
  ): () => void {
    const subs = this.subscribers.get(cacheKey) || new Set();
    subs.add(callback);
    this.subscribers.set(cacheKey, subs);

    // 立即通知当前状态
    const cached = this.cache.get(cacheKey);
    callback(cached);

    // 返回取消订阅函数
    return () => {
      subs.delete(callback);
      if (subs.size === 0) {
        this.subscribers.delete(cacheKey);
      }
    };
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(cacheKey: string): void {
    const cached = this.cache.get(cacheKey);
    const subs = this.subscribers.get(cacheKey);
    subs?.forEach((callback) => callback(cached));
  }

  /**
   * 使特定缓存失效
   */
  invalidate(pattern: string | RegExp): void {
    if (typeof pattern === "string") {
      this.cache.delete(pattern);
      this.notifySubscribers(pattern);
    } else {
      // 正则匹配批量失效
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
          this.notifySubscribers(key);
        }
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    const keys = Array.from(this.cache.keys());
    this.cache.clear();
    keys.forEach((key) => this.notifySubscribers(key));
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    keys: string[];
    memoryEstimate: string;
  } {
    const keys = Array.from(this.cache.keys());
    const jsonSize = JSON.stringify(Array.from(this.cache.values())).length;
    const memoryEstimate =
      jsonSize > 1024 * 1024
        ? `${(jsonSize / (1024 * 1024)).toFixed(2)} MB`
        : `${(jsonSize / 1024).toFixed(2)} KB`;

    return {
      size: this.cache.size,
      keys,
      memoryEstimate,
    };
  }
}

// 单例导出
export const dataCache = new DataCacheManager();

/**
 * 缓存失效规则
 * 在数据变更时调用对应方法
 */
export const cacheInvalidation = {
  // 书签创建后
  onBookmarkCreate: (userId: string) => {
    dataCache.invalidate(new RegExp(`^bookmarks:${userId}`));
  },

  // 书签更新后
  onBookmarkUpdate: (userId: string, bookmarkId: string) => {
    dataCache.invalidate(new RegExp(`^bookmarks:${userId}`));
    dataCache.invalidate(`bookmark:${bookmarkId}`);
  },

  // 书签删除后
  onBookmarkDelete: (userId: string) => {
    dataCache.invalidate(new RegExp(`^bookmarks:${userId}`));
  },

  // 文件夹变更后
  onFolderChange: (userId: string) => {
    dataCache.invalidate(`folders:${userId}`);
  },

  // 用户登出时
  onLogout: () => {
    dataCache.clear();
  },
};
