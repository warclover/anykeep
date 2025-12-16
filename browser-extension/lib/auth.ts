/**
 * AnyKeep 浏览器扩展 - 认证管理
 * 处理用户认证状态、Token 管理等
 */

import type { AuthInfo, AuthStatus } from "@/types";
import { storage } from "./storage";

/** Token 过期提前量（5分钟，单位：毫秒） */
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

/** 默认 Token 有效期（7天，单位：毫秒） */
const DEFAULT_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;

/**
 * 检查是否已登录
 */
async function isLoggedIn(): Promise<boolean> {
  const { authToken, userId } = await storage.getMultiple([
    "authToken",
    "userId",
  ]);
  return !!(authToken && userId);
}

/**
 * 检查 Token 是否过期或即将过期
 */
async function isTokenExpired(): Promise<boolean> {
  const { authToken, tokenExpiresAt } = await storage.getMultiple([
    "authToken",
    "tokenExpiresAt",
  ]);

  // 没有 token，视为过期
  if (!authToken) {
    return true;
  }

  // 没有过期时间，假设未过期
  if (!tokenExpiresAt) {
    return false;
  }

  // 检查是否即将过期（提前 5 分钟）
  return Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_BUFFER;
}

/**
 * 获取当前认证状态
 */
async function getStatus(): Promise<AuthStatus> {
  const loggedIn = await isLoggedIn();

  if (!loggedIn) {
    return "loggedOut";
  }

  const expired = await isTokenExpired();
  return expired ? "expired" : "loggedIn";
}

/**
 * 获取认证信息
 */
async function getAuth(): Promise<AuthInfo | null> {
  const { authToken, userId, tokenExpiresAt } = await storage.getMultiple([
    "authToken",
    "userId",
    "tokenExpiresAt",
  ]);

  if (!authToken || !userId) {
    return null;
  }

  return {
    token: authToken,
    userId,
    expiresAt: tokenExpiresAt,
  };
}

/**
 * 存储认证信息
 * @param token - 访问令牌
 * @param userId - 用户 ID
 * @param expiresIn - 过期时间（秒），默认 7 天
 */
async function setAuth(
  token: string,
  userId: string,
  expiresIn?: number,
): Promise<void> {
  const expiresAt = expiresIn
    ? Date.now() + expiresIn * 1000
    : Date.now() + DEFAULT_TOKEN_EXPIRY;

  await storage.setMultiple({
    authToken: token,
    userId,
    tokenExpiresAt: expiresAt,
  });
}

/**
 * 清除认证信息（登出）
 */
async function logout(): Promise<void> {
  await storage.remove(["authToken", "userId", "tokenExpiresAt"]);
}

/**
 * 获取 API URL
 */
async function getApiUrl(): Promise<string> {
  return storage.get("apiUrl");
}

/**
 * 设置 API URL
 */
async function setApiUrl(url: string): Promise<void> {
  await storage.set("apiUrl", url);
}

/**
 * 获取完整的认证头
 */
async function getAuthHeader(): Promise<{ Authorization: string } | null> {
  const authInfo = await getAuth();

  if (!authInfo) {
    return null;
  }

  return {
    Authorization: `Bearer ${authInfo.token}`,
  };
}

/**
 * 认证管理对象
 */
export const auth = {
  isLoggedIn,
  isTokenExpired,
  getStatus,
  getAuth,
  setAuth,
  logout,
  getApiUrl,
  setApiUrl,
  getAuthHeader,
};

export default auth;
