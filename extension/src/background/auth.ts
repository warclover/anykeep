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

// Token 存储 Keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "anykeep_access_token",
  REFRESH_TOKEN: "anykeep_refresh_token",
  TOKEN_EXPIRES_AT: "anykeep_token_expires_at",
  USER_INFO: "anykeep_user_info",
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

// PKCE 工具函数
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// 存储 PKCE verifier（临时，用于 OAuth 回调）
let pendingCodeVerifier: string | null = null;

/**
 * 启动 OAuth 授权流程
 */
export async function startOAuthFlow(): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  // 保存 verifier 用于后续交换
  pendingCodeVerifier = codeVerifier;
  await chrome.storage.local.set({ pending_oauth_state: state });

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
    pendingCodeVerifier = null;
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
    throw new Error(`OAuth error: ${error}`);
  }

  if (!code || !pendingCodeVerifier) {
    throw new Error("Missing authorization code or verifier");
  }

  // 验证 state
  const { pending_oauth_state: savedState } = await chrome.storage.local.get(
    "pending_oauth_state",
  );
  if (state !== savedState) {
    throw new Error("State mismatch");
  }

  // 交换 code 获取 tokens
  await exchangeCodeForTokens(code, pendingCodeVerifier);

  // 清理
  pendingCodeVerifier = null;
  await chrome.storage.local.remove("pending_oauth_state");
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
 * 清除认证状态（登出）
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
