/**
 * Fluid Agent 配置常量
 * 集中管理所有魔法数字，便于维护和调整
 */

// 配额相关
export const QUOTA_CONFIG = {
  FREE_DAILY_LIMIT: 5,
  PRO_UNLIMITED: -1,
} as const;

// 遥测相关
export const TELEMETRY_CONFIG = {
  FLUSH_INTERVAL: 5000, // 5秒批量刷新
  BATCH_SIZE: 50,
  RETENTION_DAYS: 30,
} as const;

// 操作执行器相关
export const OPERATION_CONFIG = {
  CLEANUP_DELAY: 60000, // 1分钟后清理
  THINKING_MIN: 300,
  THINKING_MAX: 500,
  NOTIFY_THROTTLE: 100, // 通知节流间隔
  ACTION_DELAY: 100, // 单个操作延迟
} as const;

// 高亮效果相关
export const HIGHLIGHT_CONFIG = {
  DURATION: 1500, // 高亮持续时间
} as const;

// 命令匹配相关
export const COMMAND_MATCH_CONFIG = {
  MIN_MATCH_SCORE: 0.5,
  EXACT_MATCH_SCORE: 1.0,
  PREFIX_MATCH_SCORE: 0.8,
  CONTAINS_MATCH_SCORE: 0.6,
  FUZZY_MATCH_SCORE: 0.5,
  MAX_EDIT_DISTANCE: 1,
} as const;

// 标签消毒：允许的字符
export const SANITIZE_CONFIG = {
  // 移除可能导致 XSS 的字符
  UNSAFE_CHARS_REGEX: /[<>"'&]/g,
  MAX_LABEL_LENGTH: 50,
} as const;

/**
 * 消毒标签文本，防止 XSS
 */
export function sanitizeLabel(label: string): string {
  if (!label) return "";

  return label
    .replace(SANITIZE_CONFIG.UNSAFE_CHARS_REGEX, "")
    .slice(0, SANITIZE_CONFIG.MAX_LABEL_LENGTH);
}
