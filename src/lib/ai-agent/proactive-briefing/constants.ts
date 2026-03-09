/**
 * 主动简报模块常量配置
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import type { ProactiveBriefingConfig } from "./types";

// =============================================================================
// 默认配置
// =============================================================================

/**
 * 主动简报默认配置
 */
export const PROACTIVE_BRIEFING_DEFAULTS: ProactiveBriefingConfig = {
  /** 最小离线时长：4 小时 */
  minOfflineDuration: 4 * 60 * 60 * 1000,
  /** 最大洞察数量 */
  maxInsights: 5,
  /** 最大建议操作数量 */
  maxSuggestions: 3,
  /** 启用 LLM 生成摘要 */
  enableLLMSummary: true,
  /** 摘要最大长度 */
  summaryMaxLength: 200,
};

// =============================================================================
// 时间常量
// =============================================================================

/**
 * 时间相关常量
 */
export const TIME_CONSTANTS = {
  /** 1 小时（毫秒） */
  ONE_HOUR_MS: 60 * 60 * 1000,
  /** 1 天（毫秒） */
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  /** 洞察过期天数 */
  INSIGHT_EXPIRY_DAYS: 7,
  /** 简报缓存时间（毫秒） */
  BRIEFING_CACHE_TTL_MS: 5 * 60 * 1000, // 5 分钟
} as const;

// =============================================================================
// 洞察类型配置
// =============================================================================

/**
 * 洞察类型元数据
 */
export const INSIGHT_TYPE_CONFIG = {
  topic_emergence: {
    label: "新主题发现",
    icon: "Sparkles",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    priority: 8,
  },
  pattern_detected: {
    label: "模式检测",
    icon: "TrendingUp",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    priority: 7,
  },
  recommendation: {
    label: "推荐内容",
    icon: "Lightbulb",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    priority: 6,
  },
  knowledge_gap: {
    label: "知识盲区",
    icon: "AlertCircle",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    priority: 5,
  },
  content_update: {
    label: "内容更新",
    icon: "RefreshCw",
    color: "text-green-600",
    bgColor: "bg-green-50",
    priority: 4,
  },
  link_health: {
    label: "链接健康",
    icon: "Link",
    color: "text-red-600",
    bgColor: "bg-red-50",
    priority: 3,
  },
} as const;

// =============================================================================
// 操作类型配置
// =============================================================================

/**
 * 操作类型元数据
 */
export const ACTION_TYPE_CONFIG = {
  organize_topic: {
    label: "整理主题",
    icon: "FolderTree",
    skillId: "batch_organize",
  },
  cleanup_duplicates: {
    label: "清理重复",
    icon: "Trash2",
    skillId: "duplicate_cleanup",
  },
  tag_untagged: {
    label: "智能标签",
    icon: "Tag",
    skillId: "smart_tagging",
  },
  archive_old: {
    label: "归档旧内容",
    icon: "Archive",
    skillId: "batch_organize",
  },
  start_learning: {
    label: "开始学习",
    icon: "GraduationCap",
    skillId: "learning_path",
  },
} as const;

// =============================================================================
// 阈值常量
// =============================================================================

/**
 * 触发阈值配置
 */
export const THRESHOLDS = {
  /** 未标签数量阈值（超过此值建议标签） */
  UNTAGGED_SUGGESTION_THRESHOLD: 10,
  /** 新增书签阈值（超过此值生成主题洞察） */
  NEW_BOOKMARKS_INSIGHT_THRESHOLD: 3,
  /** 主题涌现最小书签数 */
  TOPIC_EMERGENCE_MIN_COUNT: 3,
} as const;

// =============================================================================
// 日志标签
// =============================================================================

/**
 * 日志模块标签
 */
export const LOG_MODULE = "proactive-briefing";

// =============================================================================
// 错误消息
// =============================================================================

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  GENERATION_FAILED: "Failed to generate proactive briefing",
  INSIGHT_NOT_FOUND: "Insight not found",
  INVALID_USER_ID: "Invalid user ID",
  DB_QUERY_FAILED: "Database query failed",
} as const;
