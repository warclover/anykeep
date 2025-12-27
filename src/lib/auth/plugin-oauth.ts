/**
 * 插件 OAuth 认证工具函数
 *
 * @version 1.0.0
 * @description OAuth 2.0 + PKCE 认证相关工具
 */

import { createHash, randomBytes, randomUUID } from "crypto";

// ============================================
// 常量配置
// ============================================

/** 授权码有效期（5分钟） */
export const AUTH_CODE_EXPIRES_IN = 5 * 60 * 1000;

/** Access Token 有效期（1小时） */
export const ACCESS_TOKEN_EXPIRES_IN = 60 * 60;

/** Refresh Token 有效期（30天） */
export const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60;

/** 支持的浏览器类型 */
export const SUPPORTED_BROWSERS = [
  "chrome",
  "edge",
  "firefox",
  "other",
] as const;
export type BrowserType = (typeof SUPPORTED_BROWSERS)[number];

/** 支持的 scope */
export const SUPPORTED_SCOPES = ["bookmarks:read", "bookmarks:write"] as const;

// ============================================
// PKCE 验证
// ============================================

/**
 * 验证 PKCE code_challenge
 * @param codeVerifier 客户端提供的 code_verifier
 * @param codeChallenge 存储的 code_challenge
 * @param method 挑战方法 (S256 或 plain)
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: "S256" | "plain" = "S256",
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }

  // S256: BASE64URL(SHA256(code_verifier)) == code_challenge
  const hash = createHash("sha256").update(codeVerifier).digest("base64url");
  return hash === codeChallenge;
}

// ============================================
// Token 生成
// ============================================

/**
 * 生成随机授权码
 */
export function generateAuthorizationCode(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * 生成 Refresh Token
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

/**
 * 生成 JWT ID (jti)
 */
export function generateJti(): string {
  return randomUUID();
}

/**
 * 计算 Token 哈希（用于安全存储）
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ============================================
// 浏览器检测
// ============================================

/**
 * 从 User-Agent 检测浏览器类型
 */
export function detectBrowser(userAgent: string): BrowserType {
  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/") || ua.includes("edge/")) {
    return "edge";
  }
  if (ua.includes("firefox/")) {
    return "firefox";
  }
  if (ua.includes("chrome/") || ua.includes("chromium/")) {
    return "chrome";
  }

  return "other";
}

// ============================================
// Scope 验证
// ============================================

/**
 * 解析并验证 scope
 */
export function parseAndValidateScope(scopeStr: string): string[] {
  const scopes = scopeStr.split(/\s+/).filter(Boolean);
  const validScopes = scopes.filter((s) =>
    SUPPORTED_SCOPES.includes(s as (typeof SUPPORTED_SCOPES)[number]),
  );

  // 如果没有有效 scope，返回默认 scope
  if (validScopes.length === 0) {
    return ["bookmarks:read", "bookmarks:write"];
  }

  return validScopes;
}

// ============================================
// 验证函数
// ============================================

/**
 * 验证 redirect_uri 是否为有效的扩展 URL
 */
export function isValidExtensionRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);

    // Chrome 扩展
    if (url.protocol === "chrome-extension:") {
      return true;
    }

    // Firefox 扩展
    if (url.protocol === "moz-extension:") {
      return true;
    }

    // Edge 扩展（使用 chrome-extension 协议）
    if (url.protocol === "extension:") {
      return true;
    }

    // 开发环境：允许 localhost
    if (
      process.env.NODE_ENV === "development" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 验证 client_id
 */
export function isValidClientId(clientId: string): boolean {
  // 当前只支持一个固定的 client_id
  return clientId === "anykeep-extension";
}

// ============================================
// JWT 工具
// ============================================

/**
 * 创建简单的 JWT payload
 * 兼容 jose 库的 JWTPayload 类型（需要索引签名）
 */
export interface JwtPayload {
  sub: string; // user_id
  jti: string; // JWT ID
  iat: number; // issued at
  exp: number; // expiration
  scope: string[]; // 权限范围
  browser?: string; // 浏览器类型
  [key: string]: unknown; // 索引签名，兼容 jose JWTPayload
}

/**
 * 创建 Access Token payload
 */
export function createAccessTokenPayload(
  userId: string,
  jti: string,
  scope: string[],
  browser?: BrowserType,
): JwtPayload {
  const now = Math.floor(Date.now() / 1000);

  return {
    sub: userId,
    jti,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRES_IN,
    scope,
    browser,
  };
}
