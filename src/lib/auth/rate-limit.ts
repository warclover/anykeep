/**
 * 登录速率限制工具
 * 防止暴力破解攻击
 */

// 速率限制配置
const RATE_LIMIT_CONFIG = {
  // 时间窗口（毫秒）- 15 分钟
  windowMs: 15 * 60 * 1000,
  // 最大尝试次数
  maxAttempts: 5,
  // 锁定时间（毫秒）- 15 分钟
  lockoutMs: 15 * 60 * 1000,
};

// 内存存储（生产环境建议使用 Redis）
interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// 清理过期记录（每 5 分钟执行一次）
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [key, record] of rateLimitStore.entries()) {
        // 如果时间窗口已过且未锁定，删除记录
        if (
          now - record.firstAttemptAt > RATE_LIMIT_CONFIG.windowMs &&
          (!record.lockedUntil || now > record.lockedUntil)
        ) {
          rateLimitStore.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  ); // 5 分钟清理一次
}

// 启动清理任务
startCleanup();

/**
 * 生成速率限制键
 * 基于 IP 地址和可选的标识符（如邮箱）
 */
export function getRateLimitKey(ip: string, identifier?: string): string {
  if (identifier) {
    return `${ip}:${identifier.toLowerCase()}`;
  }
  return ip;
}

/**
 * 检查速率限制状态
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number | null; // 秒
  message: string;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // 没有记录，允许访问
  if (!record) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxAttempts,
      retryAfter: null,
      message: "允许访问",
    };
  }

  // 检查是否处于锁定状态
  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      message: `登录尝试次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后重试`,
    };
  }

  // 锁定已过期，重置记录
  if (record.lockedUntil && now >= record.lockedUntil) {
    rateLimitStore.delete(key);
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxAttempts,
      retryAfter: null,
      message: "允许访问",
    };
  }

  // 检查时间窗口是否已过
  if (now - record.firstAttemptAt > RATE_LIMIT_CONFIG.windowMs) {
    // 时间窗口已过，重置记录
    rateLimitStore.delete(key);
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxAttempts,
      retryAfter: null,
      message: "允许访问",
    };
  }

  // 检查尝试次数
  const remaining = RATE_LIMIT_CONFIG.maxAttempts - record.attempts;
  if (remaining <= 0) {
    // 达到限制，锁定账户
    record.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs;
    const retryAfter = Math.ceil(RATE_LIMIT_CONFIG.lockoutMs / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      message: `登录尝试次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后重试`,
    };
  }

  return {
    allowed: true,
    remaining,
    retryAfter: null,
    message: `还可尝试 ${remaining} 次`,
  };
}

/**
 * 记录失败的登录尝试
 */
export function recordFailedAttempt(key: string): RateLimitResult {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record || now - record.firstAttemptAt > RATE_LIMIT_CONFIG.windowMs) {
    // 创建新记录或重置过期记录
    record = {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    };
    rateLimitStore.set(key, record);
  } else {
    // 增加尝试次数
    record.attempts++;
  }

  // 检查是否需要锁定
  if (record.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
    record.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs;
    const retryAfter = Math.ceil(RATE_LIMIT_CONFIG.lockoutMs / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      message: `登录尝试次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后重试`,
    };
  }

  const remaining = RATE_LIMIT_CONFIG.maxAttempts - record.attempts;
  return {
    allowed: true,
    remaining,
    retryAfter: null,
    message: `登录失败，还可尝试 ${remaining} 次`,
  };
}

/**
 * 成功登录后清除记录
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * 获取客户端 IP 地址
 */
export function getClientIP(request: Request): string {
  // 尝试从各种 header 获取真实 IP
  const headers = new Headers(request.headers);

  // Cloudflare
  const cfConnectingIP = headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;

  // X-Forwarded-For (可能包含多个 IP，取第一个)
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }

  // X-Real-IP
  const xRealIP = headers.get("x-real-ip");
  if (xRealIP) return xRealIP;

  // 默认返回未知
  return "unknown";
}
