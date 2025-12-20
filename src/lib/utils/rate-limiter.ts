/**
 * V4.2.15: 内存级速率限制器
 *
 * 特性：
 * - 滑动窗口算法
 * - 按用户 ID 或 IP 限制
 * - 自动清理过期记录
 * - 支持不同端点配置不同限制
 */

interface RateLimitEntry {
  /** 请求时间戳数组 */
  timestamps: number[];
  /** 最后访问时间 */
  lastAccess: number;
}

interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
}

/**
 * 默认速率限制配置
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // API 默认限制：每分钟 200 次（提高以适应正常使用）
  default: { windowMs: 60_000, maxRequests: 200 },
  // 认证相关：每分钟 10 次（防暴力破解）
  auth: { windowMs: 60_000, maxRequests: 10 },
  // 搜索 API：每分钟 60 次
  search: { windowMs: 60_000, maxRequests: 60 },
  // AI 相关 API：每分钟 30 次（成本考虑）
  ai: { windowMs: 60_000, maxRequests: 30 },
  // 批量操作：每分钟 10 次
  batch: { windowMs: 60_000, maxRequests: 10 },
  // 书签操作：每分钟 300 次（核心用户操作，需要宽松限制）
  bookmarks: { windowMs: 60_000, maxRequests: 300 },
  // 快照操作：每分钟 60 次
  snapshots: { windowMs: 60_000, maxRequests: 60 },
};

/**
 * 内存速率限制存储
 * 生产环境建议替换为 Redis
 */
class RateLimiterStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每 5 分钟清理一次过期记录
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 检查并记录请求
   * @returns true 如果允许请求，false 如果被限制
   */
  check(
    key: string,
    config: RateLimitConfig,
  ): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // 获取或创建记录
    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [], lastAccess: now };
      this.store.set(key, entry);
    }

    // 清理窗口外的旧时间戳
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
    entry.lastAccess = now;

    // 检查是否超限
    if (entry.timestamps.length >= config.maxRequests) {
      const oldestTimestamp = entry.timestamps[0];
      const resetMs = oldestTimestamp + config.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    // 记录本次请求
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.timestamps.length,
      resetMs: config.windowMs,
    };
  }

  /**
   * 清理过期记录（超过 10 分钟未访问）
   */
  private cleanup(): void {
    const expireTime = Date.now() - 10 * 60 * 1000;
    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccess < expireTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 获取存储大小（用于监控）
   */
  getSize(): number {
    return this.store.size;
  }

  /**
   * 停止清理定时器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 单例实例
const rateLimiterStore = new RateLimiterStore();

/**
 * 根据路径获取速率限制配置
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  // 认证相关（最严格）
  if (pathname.includes("/auth") || pathname.includes("/login")) {
    return RATE_LIMIT_CONFIGS.auth;
  }

  // 书签操作（核心用户功能，宽松限制）
  // 注意：必须在 /batch 检查之前，避免 /bookmarks/batch-status 被错误匹配
  if (pathname.includes("/bookmarks") || pathname.includes("/bookmark")) {
    return RATE_LIMIT_CONFIGS.bookmarks;
  }

  // 批量操作（严格）
  if (pathname.includes("/batch")) {
    return RATE_LIMIT_CONFIGS.batch;
  }

  // AI 相关（成本考虑）
  if (
    pathname.includes("/classification") ||
    pathname.includes("/ai") ||
    pathname.includes("/embedding")
  ) {
    return RATE_LIMIT_CONFIGS.ai;
  }

  // 搜索相关
  if (pathname.includes("/search") || pathname.includes("/semantic")) {
    return RATE_LIMIT_CONFIGS.search;
  }

  // 快照操作
  if (pathname.includes("/snapshots")) {
    return RATE_LIMIT_CONFIGS.snapshots;
  }

  // 默认
  return RATE_LIMIT_CONFIGS.default;
}

/**
 * 检查速率限制
 * @param identifier - 用户标识（用户 ID 或 IP）
 * @param pathname - 请求路径
 * @returns 限制检查结果
 */
export function checkRateLimit(
  identifier: string,
  pathname: string,
): { allowed: boolean; remaining: number; resetMs: number; limit: number } {
  const config = getRateLimitConfig(pathname);
  const key = `${identifier}:${getConfigKey(pathname)}`;
  const result = rateLimiterStore.check(key, config);

  return {
    ...result,
    limit: config.maxRequests,
  };
}

/**
 * 获取配置键名
 */
function getConfigKey(pathname: string): string {
  if (pathname.includes("/auth") || pathname.includes("/login")) return "auth";
  // 注意：必须在 /batch 检查之前，避免 /bookmarks/batch-status 被错误匹配
  if (pathname.includes("/bookmarks") || pathname.includes("/bookmark"))
    return "bookmarks";
  if (pathname.includes("/batch")) return "batch";
  if (
    pathname.includes("/classification") ||
    pathname.includes("/ai") ||
    pathname.includes("/embedding")
  )
    return "ai";
  if (pathname.includes("/search") || pathname.includes("/semantic"))
    return "search";
  if (pathname.includes("/snapshots")) return "snapshots";
  return "default";
}

/**
 * 获取速率限制器状态（用于监控）
 */
export function getRateLimiterStats(): { storeSize: number } {
  return {
    storeSize: rateLimiterStore.getSize(),
  };
}
