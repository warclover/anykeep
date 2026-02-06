/**
 * V4.2.16: 混合速率限制器
 *
 * 特性：
 * - 滑动窗口算法
 * - 按用户 ID 或 IP 限制
 * - 自动清理过期记录
 * - 支持不同端点配置不同限制
 *
 * Code Review P0-2: 混合存储模式
 * - 内存存储：用于非关键端点（快速但不跨实例共享）
 * - 数据库存储：用于高风险端点（auth/dangerous）确保分布式一致性
 *
 * ⚠️ 分布式部署注意事项：
 * 当前内存存储在多实例部署时无法共享状态。
 * 高风险端点（auth、dangerous）使用数据库存储确保一致性。
 * 如需所有端点都支持分布式，请配置 REDIS_URL 环境变量。
 */

import { logger } from "@/lib/logger";

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
  /** 是否使用分布式存储（用于高风险操作） */
  useDistributed?: boolean;
}

/**
 * 默认速率限制配置
 *
 * Code Review P0-2: 高风险端点标记为分布式存储
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // API 默认限制：每分钟 200 次（提高以适应正常使用）
  default: { windowMs: 60_000, maxRequests: 200 },
  // 认证相关：每分钟 10 次（防暴力破解）- 使用分布式存储
  auth: { windowMs: 60_000, maxRequests: 10, useDistributed: true },
  // 搜索 API：每分钟 60 次
  search: { windowMs: 60_000, maxRequests: 60 },
  // AI 相关 API：每分钟 30 次（成本考虑）- 使用分布式存储防止滥用
  ai: { windowMs: 60_000, maxRequests: 30, useDistributed: true },
  // 批量操作：每分钟 10 次 - 使用分布式存储
  batch: { windowMs: 60_000, maxRequests: 10, useDistributed: true },
  // 书签操作：每分钟 300 次（核心用户操作，需要宽松限制）
  bookmarks: { windowMs: 60_000, maxRequests: 300 },
  // 附件内容抓取：每分钟 10 次（防滥用，最多 3 个附件）
  attachment_fetch: { windowMs: 60_000, maxRequests: 10 },
  // 快照操作：每分钟 60 次
  snapshots: { windowMs: 60_000, maxRequests: 60 },
  // 内容监控：每分钟 20 次
  monitors: { windowMs: 60_000, maxRequests: 20 },
  // Knowledge Studio 读取操作：每分钟 60 次（列表、详情、简报表单等）
  knowledge_studio_read: { windowMs: 60_000, maxRequests: 60 },
  // Knowledge Studio 生成操作：每分钟 10 次（大纲、内容生成，成本较高）
  knowledge_studio_generate: { windowMs: 60_000, maxRequests: 10 },
  // 高风险操作：每小时 2 次（账户删除、数据导出等不可逆操作）- 使用分布式存储
  dangerous: { windowMs: 3600_000, maxRequests: 2, useDistributed: true },
};

/**
 * 内存速率限制存储
 *
 * ⚠️ 注意：仅适用于单实例部署或非关键端点
 * 多实例部署时请使用分布式存储
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

/**
 * 分布式速率限制存储（使用 Supabase）
 *
 * Code Review P0-2: 添加分布式存储支持
 * 用于高风险端点确保跨实例一致性
 */
class DistributedRateLimiterStore {
  private memoryFallback = new Map<string, RateLimitEntry>();
  private static warnedAboutFallback = false;

  /**
   * 检查并记录请求（使用数据库或内存回退）
   *
   * @security 安全修复 v1.1.0:
   * - 数据库不可用时使用更严格的内存限制（原限制的 50%）
   * - 高风险端点（auth/dangerous）在数据库不可用时直接拒绝
   */
  async check(
    key: string,
    config: RateLimitConfig,
    identifier: string,
    configKey: string,
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    // 尝试使用数据库
    try {
      return await this.checkWithDatabase(key, config, identifier, configKey);
    } catch (error) {
      // 数据库不可用时的处理
      if (!DistributedRateLimiterStore.warnedAboutFallback) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            configKey,
          },
          "Rate limiter: Database unavailable, applying fallback strategy.",
        );
        DistributedRateLimiterStore.warnedAboutFallback = true;
      }

      // 🔒 安全修复：高风险���点在数据库不可用时直接拒绝
      if (configKey === "auth" || configKey === "dangerous") {
        logger.error(
          { configKey, identifier },
          "Rate limiter: High-risk endpoint blocked due to database unavailability",
        );
        return {
          allowed: false,
          remaining: 0,
          resetMs: 60000, // 1 分钟后重试
        };
      }

      // 🔒 安全修复：其他端点使用更严格的限制（50%）
      const strictConfig: RateLimitConfig = {
        ...config,
        maxRequests: Math.max(1, Math.floor(config.maxRequests * 0.5)),
      };

      return this.checkWithMemory(key, strictConfig);
    }
  }

  /**
   * 使用数据库检查速率限制
   */
  private async checkWithDatabase(
    _key: string,
    config: RateLimitConfig,
    identifier: string,
    configKey: string,
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    // 动态导入避免循环依赖
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const now = Date.now();
    const windowStart = new Date(now - config.windowMs).toISOString();

    // 调用数据库函数进行原子检查和记录
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_identifier: identifier,
      p_config_key: configKey,
      p_window_start: windowStart,
      p_max_requests: config.maxRequests,
      p_window_ms: config.windowMs,
    });

    if (error) {
      throw error;
    }

    // 解析数据库返回结果（PostgreSQL 表函数返回数组）
    const results = data as Array<{
      allowed: boolean;
      remaining: number;
      reset_ms: number;
    }>;

    if (!results || results.length === 0) {
      throw new Error("check_rate_limit returned no results");
    }

    const result = results[0];

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetMs: result.reset_ms,
    };
  }

  /**
   * 使用内存回退检查速率限制
   */
  private checkWithMemory(
    key: string,
    config: RateLimitConfig,
  ): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let entry = this.memoryFallback.get(key);
    if (!entry) {
      entry = { timestamps: [], lastAccess: now };
      this.memoryFallback.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
    entry.lastAccess = now;

    if (entry.timestamps.length >= config.maxRequests) {
      const oldestTimestamp = entry.timestamps[0];
      const resetMs = oldestTimestamp + config.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.timestamps.length,
      resetMs: config.windowMs,
    };
  }
}

// 单例实例
const rateLimiterStore = new RateLimiterStore();
const distributedRateLimiterStore = new DistributedRateLimiterStore();

/**
 * 根据路径获取速率限制配置
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  // 高风险操作（最严格：每小时 2 次）
  if (
    pathname.includes("/user/delete") ||
    pathname.includes("/user/export") ||
    pathname.includes("/batch-delete") ||
    pathname.includes("/trash/empty") ||
    pathname.includes("/permanent")
  ) {
    return RATE_LIMIT_CONFIGS.dangerous;
  }

  // 认证相关（最严格）
  if (pathname.includes("/auth") || pathname.includes("/login")) {
    return RATE_LIMIT_CONFIGS.auth;
  }

  // 附件内容抓取（严格限制：每分钟 10 次）
  if (pathname.includes("/fetch-content")) {
    return RATE_LIMIT_CONFIGS.attachment_fetch;
  }

  // 书签/MD收藏操作（核心用户功能，宽松限制）
  // 注意：必须在 /batch 检查之前，避免 batch-status 端点被错误匹配到严格的 batch 限制
  if (
    pathname.includes("/bookmarks") ||
    pathname.includes("/bookmark") ||
    pathname.includes("/md-collections")
  ) {
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
    pathname.includes("/embedding") ||
    pathname.includes("/synthesis") ||
    pathname.includes("/agent")
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

  // 内容监控
  if (pathname.includes("/monitors")) {
    return RATE_LIMIT_CONFIGS.monitors;
  }

  // Knowledge Studio（区分读取和生成操作）
  if (pathname.includes("/knowledge-studio")) {
    // 生成操作（成本高，限制严格）
    if (
      pathname.includes("/outline") ||
      pathname.includes("/generate") ||
      pathname.includes("/v2/outline") ||
      pathname.includes("/v2/generate")
    ) {
      return RATE_LIMIT_CONFIGS.knowledge_studio_generate;
    }
    // 读取操作（列表、详情、简报表单等）
    return RATE_LIMIT_CONFIGS.knowledge_studio_read;
  }

  // 默认
  return RATE_LIMIT_CONFIGS.default;
}

/**
 * 检查速率限制（同步版本）
 *
 * ⚠️ 注意：此函数仅使用内存存储，不支持分布式。
 * 对于高风险端点，请使用 checkRateLimitAsync。
 *
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
 * 检查速率限制（异步版本，支持分布式存储）
 *
 * Code Review P0-2: 添加异步版本支持分布式存储
 *
 * @param identifier - 用户标识（用户 ID 或 IP）
 * @param pathname - 请求路径
 * @returns 限制检查结果
 */
export async function checkRateLimitAsync(
  identifier: string,
  pathname: string,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}> {
  const config = getRateLimitConfig(pathname);
  const configKey = getConfigKey(pathname);
  const key = `${identifier}:${configKey}`;

  // 高风险端点使用分布式存储
  if (config.useDistributed) {
    const result = await distributedRateLimiterStore.check(
      key,
      config,
      identifier,
      configKey,
    );
    return {
      ...result,
      limit: config.maxRequests,
    };
  }

  // 非高风险端点使用内存存储
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
  // 高风险操作优先检查
  if (
    pathname.includes("/user/delete") ||
    pathname.includes("/user/export") ||
    pathname.includes("/batch-delete") ||
    pathname.includes("/trash/empty") ||
    pathname.includes("/permanent")
  )
    return "dangerous";
  if (pathname.includes("/auth") || pathname.includes("/login")) return "auth";
  // 附件内容抓取（严格限制）
  if (pathname.includes("/fetch-content")) return "attachment_fetch";
  // 注意：必须在 /batch 检查之前，避免 batch-status 端点被错误匹配
  if (
    pathname.includes("/bookmarks") ||
    pathname.includes("/bookmark") ||
    pathname.includes("/md-collections")
  )
    return "bookmarks";
  if (pathname.includes("/batch")) return "batch";
  if (
    pathname.includes("/classification") ||
    pathname.includes("/ai") ||
    pathname.includes("/embedding") ||
    pathname.includes("/synthesis") ||
    pathname.includes("/agent")
  )
    return "ai";
  if (pathname.includes("/search") || pathname.includes("/semantic"))
    return "search";
  if (pathname.includes("/snapshots")) return "snapshots";
  if (pathname.includes("/monitors")) return "monitors";
  if (pathname.includes("/knowledge-studio")) {
    if (
      pathname.includes("/outline") ||
      pathname.includes("/generate") ||
      pathname.includes("/v2/outline") ||
      pathname.includes("/v2/generate")
    ) {
      return "knowledge_studio_generate";
    }
    return "knowledge_studio_read";
  }
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
