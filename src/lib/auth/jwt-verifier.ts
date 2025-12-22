/**
 * JWT 本地验证模块
 * @description 在边缘节点本地验证 JWT，避免每次请求都访问 Supabase Auth 服务器
 * @version V4.2.25
 *
 * 性能优化效果：
 * - 原方案：supabase.auth.getUser() ~1000-2000ms（网络请求）
 * - 新方案：本地 JWT 验证 ~1-5ms
 *
 * 使用前提：
 * - 需要配置 SUPABASE_JWT_SECRET 环境变量
 * - 从 Supabase Dashboard -> Settings -> API -> JWT Secret 获取
 */

import * as jose from "jose";

/**
 * JWT Payload 类型（Supabase 格式）
 */
export interface SupabaseJwtPayload {
  /** 用户 ID */
  sub: string;
  /** 邮箱 */
  email?: string;
  /** 手机号 */
  phone?: string;
  /** 角色 */
  role?: string;
  /** 应用元数据 */
  app_metadata?: Record<string, unknown>;
  /** 用户元数据 */
  user_metadata?: Record<string, unknown>;
  /** 签发者 */
  iss: string;
  /** 签发时间（Unix 时间戳） */
  iat: number;
  /** 过期时间（Unix 时间戳） */
  exp: number;
  /** Session ID */
  session_id?: string;
}

/**
 * JWT 验证结果
 */
export interface JwtVerifyResult {
  /** 是否验证成功 */
  valid: boolean;
  /** 解析的 Payload */
  payload: SupabaseJwtPayload | null;
  /** 用户 ID */
  userId: string | null;
  /** 错误信息 */
  error: string | null;
  /** 验证耗时（毫秒） */
  duration: number;
  /** Token 是否即将过期（5分钟内） */
  nearExpiry: boolean;
}

// JWT 密钥缓存
let cachedSecret: Uint8Array | null = null;

/**
 * 获取 JWT 密钥
 * Supabase JWT Secret 应该直接作为字符串使用（UTF-8 编码），不需要 Base64 解码
 */
function getJwtSecret(): Uint8Array | null {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // 配置缺失时静默返回 null，让调用方回退到网络验证
    return null;
  }

  // Supabase 使用 JWT Secret 作为原始字符串进行 HMAC-SHA256 签名
  // 不要 Base64 解码，直接将字符串转换为 UTF-8 字节
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

/**
 * 本地验证 Supabase JWT Token
 *
 * @param token - JWT Token（不含 Bearer 前缀）
 * @returns 验证结果
 *
 * @example
 * const result = await verifyJwtLocally(token);
 * if (result.valid && !result.nearExpiry) {
 *   // 使用快速路径，跳过 Supabase 网络请求
 *   return result.userId;
 * }
 */
export async function verifyJwtLocally(
  token: string,
): Promise<JwtVerifyResult> {
  const startTime = performance.now();

  // 检查密钥是否配置
  const secret = getJwtSecret();
  if (!secret) {
    return {
      valid: false,
      payload: null,
      userId: null,
      error: "JWT secret not configured",
      duration: performance.now() - startTime,
      nearExpiry: false,
    };
  }

  try {
    // 验证 JWT 签名和有效期
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const typedPayload = payload as unknown as SupabaseJwtPayload;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = typedPayload.exp - now;

    // 检查是否即将过期（5分钟内需要刷新）
    // V4.2.30: 将阈值从 1 分钟恢复到 5 分钟，确保 Token 有足够时间刷新
    // 避免长时间操作时会话意外过期
    const nearExpiry = expiresIn < 300;

    const duration = performance.now() - startTime;

    return {
      valid: true,
      payload: typedPayload,
      userId: typedPayload.sub,
      error: null,
      duration,
      nearExpiry,
    };
  } catch (err) {
    const duration = performance.now() - startTime;

    // 区分不同的错误类型
    let errorMessage = "Unknown error";
    if (err instanceof jose.errors.JWTExpired) {
      errorMessage = "Token expired";
    } else if (err instanceof jose.errors.JWTInvalid) {
      errorMessage = "Invalid token";
    } else if (err instanceof jose.errors.JWSSignatureVerificationFailed) {
      errorMessage = "Signature verification failed";
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    return {
      valid: false,
      payload: null,
      userId: null,
      error: errorMessage,
      duration,
      nearExpiry: false,
    };
  }
}

/**
 * 仅解析 JWT（不验证签名）
 * 用于快速提取用户信息，不需要密钥
 *
 * @param token - JWT Token
 * @returns 解析结果
 */
export function decodeJwtUnsafe(token: string): {
  payload: SupabaseJwtPayload | null;
  expired: boolean;
} {
  try {
    const payload = jose.decodeJwt(token) as unknown as SupabaseJwtPayload;
    const now = Math.floor(Date.now() / 1000);
    const expired = payload.exp < now;

    return { payload, expired };
  } catch {
    return { payload: null, expired: true };
  }
}

/**
 * 从 Cookie 中提取 Access Token
 *
 * @param cookies - Cookie 对象
 * @returns Access Token 或 null
 */
export function extractAccessToken(cookies: {
  get: (name: string) => { value: string } | undefined;
}): string | null {
  // Supabase 存储格式：sb-{ref}-auth-token 或分片存储
  const allCookies = cookies as unknown as {
    getAll?: () => Array<{ name: string; value: string }>;
  };

  if (allCookies.getAll) {
    const cookieList = allCookies.getAll();

    // 方式 1: 查找完整的 auth-token cookie
    const authTokenCookie = cookieList.find((c) =>
      c.name.includes("auth-token"),
    );

    if (authTokenCookie) {
      const rawValue = authTokenCookie.value;

      // Supabase SSR 使用 "base64-" 前缀标识 base64url 编码的 cookie
      const BASE64_PREFIX = "base64-";
      if (rawValue.startsWith(BASE64_PREFIX)) {
        try {
          // 移除前缀并解码 base64url
          const base64Part = rawValue.substring(BASE64_PREFIX.length);
          // base64url 使用 - 和 _ 代替 + 和 /
          const base64Standard = base64Part
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const decoded = Buffer.from(base64Standard, "base64").toString(
            "utf-8",
          );
          const parsed = JSON.parse(decoded);
          if (parsed.access_token) {
            return parsed.access_token;
          }
        } catch {
          // base64url 解码失败，继续尝试其他方式
        }
      }

      // 方式 1: 直接尝试 JSON 解析（可能已经是 JSON 字符串）
      try {
        const parsed = JSON.parse(rawValue);
        if (parsed.access_token) {
          return parsed.access_token;
        }
      } catch {
        // 不是直接的 JSON
      }

      // 方式 2: URL 解码后 JSON 解析
      try {
        const decoded = decodeURIComponent(rawValue);
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) {
          return parsed.access_token;
        }
      } catch {
        // URL 解码失败
      }

      // 方式 3: Base64 标准解码后 JSON 解析
      try {
        const decoded = Buffer.from(rawValue, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) {
          return parsed.access_token;
        }
      } catch {
        // Base64 解码失败
      }

      // 方式 4: 检查是否是直接的 JWT token
      if (rawValue.includes(".") && rawValue.split(".").length === 3) {
        return rawValue;
      }
    }

    // 方式 2: Supabase 可能使用分片存储（sb-xxx-auth-token.0, .1, .2 等）
    const tokenChunks = cookieList
      .filter((c) => c.name.match(/sb-.*-auth-token\.\d+/))
      .sort((a, b) => {
        const numA = parseInt(a.name.split(".").pop() || "0");
        const numB = parseInt(b.name.split(".").pop() || "0");
        return numA - numB;
      });

    if (tokenChunks.length > 0) {
      try {
        const fullValue = tokenChunks.map((c) => c.value).join("");
        const decoded = decodeURIComponent(fullValue);
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) {
          return parsed.access_token;
        }
      } catch {
        // 分片 cookie 解析失败
      }
    }
  }

  return null;
}
