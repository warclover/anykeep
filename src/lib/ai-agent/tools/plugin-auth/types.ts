/**
 * Plugin Authorization Tools - 共享类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ============================================
// 基础类型
// ============================================

/** 浏览器类型 */
export type BrowserType = "chrome" | "edge" | "firefox" | "other";

/** 浏览器显示名称映射 */
export const BROWSER_DISPLAY_NAMES: Record<BrowserType, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  other: "其他浏览器",
};

/** 授权状态 */
export type AuthorizationStatus = "active" | "expired" | "revoked";

/** 授权状态显示名称 */
export const STATUS_DISPLAY_NAMES: Record<AuthorizationStatus, string> = {
  active: "有效",
  expired: "已过期",
  revoked: "已撤销",
};

// ============================================
// 数据库记录类型
// ============================================

/** 数据库查询返回的授权记录 */
export interface PluginAuthorizationRow {
  id: string;
  user_id: string;
  browser: string;
  extension_version: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
}

// ============================================
// Tool 结果类型
// ============================================

/** 授权记录（用户友好格式） */
export interface PluginAuthorization {
  id: string;
  browser: BrowserType;
  browserLabel: string;
  extensionVersion: string | null;
  status: AuthorizationStatus;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  /** 友好的最后使用时间描述 */
  lastUsedDescription: string;
}

/** list_plugin_authorizations 结果 */
export interface ListAuthorizationsResult {
  authorizations: PluginAuthorization[];
  total: number;
  activeCount: number;
  message: string;
}

/** revoke_plugin_authorization 结果 */
export interface RevokeAuthorizationResult {
  revokedId: string;
  browser: string;
  browserLabel: string;
  message: string;
}

/** revoke_all_plugin_authorizations 结果 */
export interface RevokeAllResult {
  revokedCount: number;
  browser: BrowserType | null;
  message: string;
}

/** get_plugin_auth_stats 结果 */
export interface PluginAuthStatsResult {
  totalAuthorizations: number;
  activeCount: number;
  expiredCount: number;
  revokedCount: number;
  byBrowser: Array<{
    browser: BrowserType;
    label: string;
    count: number;
    activeCount: number;
    lastUsed: string | null;
    lastUsedDescription: string | null;
  }>;
  oldestActiveDate: string | null;
  newestActiveDate: string | null;
  message: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 计算授权状态
 */
export function calculateAuthStatus(
  expiresAt: string,
  revokedAt: string | null,
): AuthorizationStatus {
  if (revokedAt) return "revoked";
  if (new Date(expiresAt) <= new Date()) return "expired";
  return "active";
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

/**
 * 转换数据库记录为用户友好格式
 */
export function transformAuthorization(
  row: PluginAuthorizationRow,
): PluginAuthorization {
  const browser = row.browser as BrowserType;
  const status = calculateAuthStatus(row.expires_at, row.revoked_at);

  return {
    id: row.id,
    browser,
    browserLabel: BROWSER_DISPLAY_NAMES[browser] || row.browser,
    extensionVersion: row.extension_version,
    status,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedDescription: formatRelativeTime(row.last_used_at),
  };
}
