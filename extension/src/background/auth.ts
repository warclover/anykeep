/**
 * OAuth 2.0 + PKCE 认证模块
 *
 * 功能：
 * 1. 生成 PKCE code_verifier 和 code_challenge
 * 2. 启动 OAuth 授权流程
 * 3. 交换 authorization code 获取 tokens
 * 4. Token 刷新和管理
 * 5. Token 安全存储
 */

import { getApiBaseUrl } from "./api";

// Token 存储 Keys（持久化存储）
const STORAGE_KEYS = {
  ACCESS_TOKEN: "anykeep_access_token",
  REFRESH_TOKEN: "anykeep_refresh_token",
  TOKEN_EXPIRES_AT: "anykeep_token_expires_at",
  USER_INFO: "anykeep_user_info",
} as const;

// OAuth 临时状态 Keys（会话存储，Service Worker 重启后保留）
const SESSION_KEYS = {
  CODE_VERIFIER: "anykeep_code_verifier",
  OAUTH_STATE: "anykeep_oauth_state",
} as const;

// Token 类型
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface UserInfo {
  id: string;
  email: string;
  nickname?: string;
}

// ============================================
// PKCE 工具函数
// ============================================

/**
 * 生成随机字符串
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * 生成 PKCE code_challenge
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ============================================
// OAuth 流程
// ============================================

/**
 * 启动 OAuth 授权流程
 */
export async function startOAuthFlow(): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  // 使用 session storage 存储临时状态（Service Worker 重启后保留）
  await chrome.storage.session.set({
    [SESSION_KEYS.CODE_VERIFIER]: codeVerifier,
    [SESSION_KEYS.OAUTH_STATE]: state,
  });

  const baseUrl = getApiBaseUrl();
  const authUrl = new URL(`${baseUrl}/api/auth/plugin/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", "anykeep-extension");
  authUrl.searchParams.set("redirect_uri", chrome.identity.getRedirectURL());
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "bookmarks:read bookmarks:write");

  // 使用 chrome.identity.launchWebAuthFlow
  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    if (redirectUrl) {
      await handleOAuthCallback(redirectUrl);
    }
  } catch (error) {
    console.error("[Auth] OAuth flow error:", error);
    // 清理临时状态
    await clearOAuthSession();
    throw error;
  }
}

/**
 * 处理 OAuth 回调
 */
async function handleOAuthCallback(redirectUrl: string): Promise<void> {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    await clearOAuthSession();
    throw new Error(`OAuth error: ${error}`);
  }

  // 获取保存的临时状态
  const sessionData = await chrome.storage.session.get([
    SESSION_KEYS.CODE_VERIFIER,
    SESSION_KEYS.OAUTH_STATE,
  ]);

  const savedVerifier = sessionData[SESSION_KEYS.CODE_VERIFIER];
  const savedState = sessionData[SESSION_KEYS.OAUTH_STATE];

  if (!code || !savedVerifier) {
    await clearOAuthSession();
    throw new Error("Missing authorization code or verifier");
  }

  // 验证 state
  if (state !== savedState) {
    await clearOAuthSession();
    throw new Error("State mismatch");
  }

  // 交换 code 获取 tokens
  await exchangeCodeForTokens(code, savedVerifier);

  // 清理临时状态
  await clearOAuthSession();
}

/**
 * 清理 OAuth 会话状态
 */
async function clearOAuthSession(): Promise<void> {
  await chrome.storage.session.remove([
    SESSION_KEYS.CODE_VERIFIER,
    SESSION_KEYS.OAUTH_STATE,
  ]);
}

/**
 * 交换 authorization code 获取 tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/plugin/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: chrome.identity.getRedirectURL(),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Token exchange failed");
  }

  const data = await response.json();
  await saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  if (data.user) {
    await saveUserInfo(data.user);
  }
}

// ============================================
// Token 管理
// ============================================

/**
 * 刷新 Access Token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/plugin/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    // Refresh token 失效，清除认证状态
    await clearAuth();
    return null;
  }

  const data = await response.json();
  await saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

/**
 * 获取有效的 Access Token（自动刷新）
 */
export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.TOKEN_EXPIRES_AT,
  ]);

  const accessToken = result[STORAGE_KEYS.ACCESS_TOKEN];
  const expiresAt = result[STORAGE_KEYS.TOKEN_EXPIRES_AT];

  if (!accessToken) {
    return null;
  }

  // 检查是否即将过期（5分钟内）
  if (expiresAt && Date.now() > expiresAt - 5 * 60 * 1000) {
    return refreshAccessToken();
  }

  return accessToken;
}

/**
 * 获取 Refresh Token
 */
async function getRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.REFRESH_TOKEN);
  return result[STORAGE_KEYS.REFRESH_TOKEN] || null;
}

/**
 * 保存 Tokens
 */
async function saveTokens(tokens: TokenPair): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.ACCESS_TOKEN]: tokens.accessToken,
    [STORAGE_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
    [STORAGE_KEYS.TOKEN_EXPIRES_AT]: tokens.expiresAt,
  });
}

// ============================================
// 用户信息
// ============================================

/**
 * 保存用户信息
 */
async function saveUserInfo(user: UserInfo): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.USER_INFO]: user,
  });
}

/**
 * 获取用户信息
 */
export async function getUserInfo(): Promise<UserInfo | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_INFO);
  return result[STORAGE_KEYS.USER_INFO] || null;
}

// ============================================
// 认证状态
// ============================================

/**
 * 检查认证状态
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

/**
 * 获取认证状态（包含用户信息）
 */
export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  user: UserInfo | null;
}> {
  const token = await getAccessToken();
  const user = token ? await getUserInfo() : null;
  return {
    authenticated: !!token,
    user,
  };
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  // 调用服务端撤销 Token
  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/auth/plugin/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error("[Auth] Failed to revoke token:", error);
    }
  }

  // 清除本地存储
  await clearAuth();
}

/**
 * 清除认证状态
 */
export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.TOKEN_EXPIRES_AT,
    STORAGE_KEYS.USER_INFO,
  ]);
}

/**
 * 初始化认证模块
 */
export async function initializeAuth(): Promise<void> {
  // 检查现有认证状态
  await isAuthenticated();
}
