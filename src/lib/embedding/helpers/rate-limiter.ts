/**
 * 简单的速率限制器
 *
 * V4.2.6: 防止 API 速率限制触发
 *
 * @module embedding/helpers/rate-limiter
 * @version 1.0.0
 * @since 2026-01-20
 */

/**
 * 基于滑动窗口的速率限制器
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  /**
   * @param maxRequests 时间窗口内允许的最大请求数
   * @param windowMs 时间窗口大小（毫秒），默认 60000 (1 分钟)
   */
  constructor(maxRequests: number, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * 等待直到可以发送请求
   * 如果超过速率限制，会阻塞直到有空闲槽位
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // 清理过期的请求记录
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    // 如果未达到限制，立即返回
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return;
    }

    // 计算需要等待的时间
    const oldestRequest = this.requests[0];
    const waitTime = this.windowMs - (now - oldestRequest) + 10; // 额外加 10ms 确保安全

    // 等待
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // 递归调用（此时应该有空闲槽位了）
    return this.acquire();
  }

  /**
   * 重置限制器状态
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * 获取当前窗口内的请求数
   */
  getCurrentCount(): number {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return this.requests.length;
  }
}
