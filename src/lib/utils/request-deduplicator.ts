/**
 * 请求去重器
 * @description 防止并发重复请求，相同 key 的请求只发送一次
 * @version 1.0.0
 * @since 2026-02-01
 *
 * 使用场景：
 * - React StrictMode 导致的双重请求
 * - 多组件同时挂载触发的重复请求
 * - 快速连续点击导致的重复提交
 */

type PendingRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
};

class RequestDeduplicator {
  private pending = new Map<string, PendingRequest<unknown>>();

  // 默认超时时间（防止内存泄漏）
  private readonly DEFAULT_TIMEOUT = 30000; // 30s

  /**
   * 执行去重请求
   * 如果存在相同 key 的进行中请求，直接返回该请求的 Promise
   *
   * @param key - 请求唯一标识（如 API 路径 + 参数 hash）
   * @param fetcher - 实际请求函数
   * @param timeout - 超时时间（毫秒）
   * @returns Promise<T>
   *
   * @example
   * const data = await requestDeduplicator.dedupe(
   *   '/api/folders',
   *   () => fetch('/api/folders').then(r => r.json())
   * );
   */
  async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>,
    timeout: number = this.DEFAULT_TIMEOUT,
  ): Promise<T> {
    // 检查是否有进行中的请求
    const existing = this.pending.get(key) as PendingRequest<T> | undefined;

    if (existing) {
      // 检查是否超时（防止僵尸请求）
      if (Date.now() - existing.timestamp < timeout) {
        return existing.promise;
      }
      // 超时则清理并重新发起
      this.pending.delete(key);
    }

    // 创建新请求
    const promise = fetcher().finally(() => {
      // 请求完成后从缓存移除
      this.pending.delete(key);
    });

    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * 清除指定 key 的缓存
   * 用于强制刷新场景
   */
  invalidate(key: string): void {
    this.pending.delete(key);
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.pending.clear();
  }

  /**
   * 获取当前进行中的请求数量
   */
  get size(): number {
    return this.pending.size;
  }

  /**
   * 检查是否有进行中的请求
   */
  has(key: string): boolean {
    return this.pending.has(key);
  }
}

// 导出单例实例
export const requestDeduplicator = new RequestDeduplicator();

// 导出类型供测试使用
export { RequestDeduplicator };
