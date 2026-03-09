/**
 * Knowledge Studio - 常量配置
 * @module knowledge-studio
 * @description 模块级常量、限制值、默认配置
 */

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Pro 功能标识
 */
export const PRO_FEATURES = {
  BLUEPRINT_BLOGGER: "blueprint_blogger",
  BLUEPRINT_THREAD: "blueprint_thread",
  BLUEPRINT_TUTORIAL: "blueprint_tutorial",
  BLUEPRINT_FEYNMAN: "blueprint_feynman",
  CHAT_TO_EDIT: "chat_to_edit",
  CITATION_HOVER_LINK: "citation_hover_link",
  OBSIDIAN_EXPORT: "obsidian_export",
  UNLIMITED_SYNTHESIS: "unlimited_synthesis",
} as const;

/**
 * 免费用户可用蓝图
 */
export const FREE_BLUEPRINTS = ["debater"] as const;

/**
 * Pro 用户可用蓝图
 */
export const PRO_BLUEPRINTS = [
  "blogger",
  "thread",
  "tutorial",
  "feynman",
] as const;

// ============================================================================
// Limits & Quotas
// ============================================================================

/**
 * 素材数量限制
 */
export const MATERIAL_LIMITS = {
  /** 免费用户最大书签数 */
  FREE_MAX_BOOKMARKS: 5,
  /** Pro 用户最大书签数 */
  PRO_MAX_BOOKMARKS: 200,
  /** 最小书签数 */
  MIN_BOOKMARKS: 1,
} as const;

/**
 * 生成次数限制
 */
export const GENERATION_LIMITS = {
  /** 免费用户每月生成次数 */
  FREE_MONTHLY_GENERATIONS: 3,
  /** Pro 用户每月 Chat-to-Edit 配额 */
  PRO_MONTHLY_CHAT_EDITS: 50,
  /** 超额计费单价（元） */
  OVERAGE_PRICE_PER_EDIT: 0.5,
} as const;

/**
 * Token 限制
 */
export const TOKEN_LIMITS = {
  /** 单次生成最大上下文 Token */
  MAX_CONTEXT_TOKENS: 8000,
  /** 单次编辑最大 Token */
  MAX_EDIT_TOKENS: 2000,
  /** 对话摘要最大 Token */
  MAX_SUMMARY_TOKENS: 500,
  /** 总上下文预算 */
  TOTAL_CONTEXT_BUDGET: 4000,
} as const;

// ============================================================================
// Performance Targets (PRD NFR)
// ============================================================================

/**
 * 性能目标
 */
export const PERFORMANCE_TARGETS = {
  /** 首次 Token 响应（毫秒） */
  FIRST_TOKEN_MS: 3000,
  /** 5 书签完整生成（毫秒） */
  GENERATION_5_BOOKMARKS_MS: 10000,
  /** 20 书签完整生成（毫秒） */
  GENERATION_20_BOOKMARKS_MS: 30000,
  /** 200 书签完整生成（毫秒） */
  GENERATION_200_BOOKMARKS_MS: 90000,
  /** Chat-to-Edit 响应（毫秒） */
  CHAT_EDIT_RESPONSE_MS: 10000,
  /** 引用 Tooltip 显示（毫秒） */
  CITATION_TOOLTIP_MS: 100,
  /** 导出下载（毫秒） */
  EXPORT_DOWNLOAD_MS: 5000,
} as const;

// ============================================================================
// SSE Streaming
// ============================================================================

/**
 * 阶段权重（百分比）
 */
export const STAGE_WEIGHTS = {
  parsing: 10,
  outline: 15,
  content: 50,
  citations: 20,
  finalizing: 5,
} as const;

/**
 * SSE 重连配置
 */
export const SSE_RECONNECT_CONFIG = {
  /** 最大重试次数 */
  MAX_RETRIES: 3,
  /** 初始延迟（毫秒） */
  INITIAL_DELAY_MS: 1000,
  /** 最大延迟（毫秒） */
  MAX_DELAY_MS: 4000,
  /** 退避因子 */
  BACKOFF_FACTOR: 2,
} as const;

// ============================================================================
// Chat-to-Edit (Decision 4.3)
// ============================================================================

/**
 * 滑动窗口配置
 */
export const SLIDING_WINDOW_CONFIG = {
  /** 完整保留最近 N 轮 */
  FULL_CONTEXT_TURNS: 3,
  /** 上下文段落数（前后各 N 段） */
  CONTEXT_PARAGRAPHS: 1,
  /** 摘要最大 Token */
  SUMMARY_MAX_TOKENS: 500,
  /** 单次编辑最大 Token */
  EDIT_MAX_TOKENS: 2000,
} as const;

// ============================================================================
// Material Scorer
// ============================================================================

/**
 * 素材评分维度权重
 */
export const DIMENSION_WEIGHTS = {
  freshness: 0.2,
  relevance: 0.35,
  depth: 0.3,
  credibility: 0.15,
} as const;

/**
 * 素材质量阈值
 */
export const QUALITY_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0,
} as const;

/**
 * 新鲜度评分规则（天数 → 分数）
 */
export const FRESHNESS_RULES = {
  /** 7 天内 */
  WITHIN_7_DAYS: 100,
  /** 30 天内 */
  WITHIN_30_DAYS: 80,
  /** 90 天内 */
  WITHIN_90_DAYS: 60,
  /** 180 天内 */
  WITHIN_180_DAYS: 40,
  /** 超过 180 天 */
  BEYOND_180_DAYS: 20,
} as const;

/**
 * 平台可信度评分
 */
export const PLATFORM_CREDIBILITY_SCORES: Record<string, number> = {
  "github.com": 90,
  "stackoverflow.com": 85,
  "zhihu.com": 75,
  "medium.com": 70,
  "juejin.cn": 70,
  "weixin.qq.com": 65,
  "bilibili.com": 60,
  "xiaohongshu.com": 50,
};

// ============================================================================
// Database Tables
// ============================================================================

/**
 * 表名常量
 */
export const TABLE_NAMES = {
  SYNTHESIS_REPORTS: "synthesis_reports",
  QUOTA_OPERATIONS: "quota_operations",
  PROFILES: "profiles",
  BOOKMARKS: "bookmarks",
} as const;

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * API 端点路径
 */
export const API_ENDPOINTS = {
  GENERATE: "/api/knowledge-studio/generate",
  REPORTS: "/api/knowledge-studio/reports",
  EDIT: "/api/knowledge-studio/reports/:id/edit",
  QUOTA: "/api/knowledge-studio/quota",
  MATERIALS: "/api/knowledge-studio/materials",
  ANALYTICS: "/api/knowledge-studio/analytics",
} as const;

// ============================================================================
// UI Text (国际化预留)
// ============================================================================

/**
 * UI 文本常量
 */
export const UI_TEXT = {
  // 蓝图名称
  BLUEPRINT_DEBATER: "观点对撞机",
  BLUEPRINT_BLOGGER: "博客大纲",
  BLUEPRINT_THREAD: "社交串烧",
  BLUEPRINT_TUTORIAL: "终极教程",
  BLUEPRINT_FEYNMAN: "费曼学习法",

  // 按钮
  BUTTON_GENERATE: "开始生成",
  BUTTON_CANCEL: "取消",
  BUTTON_EXPORT: "导出",
  BUTTON_EDIT: "编辑",

  // 状态
  STATUS_GENERATING: "正在生成...",
  STATUS_PARSING: "解析素材中...",
  STATUS_OUTLINE: "生成大纲中...",
  STATUS_CONTENT: "生成内容中...",
  STATUS_CITATIONS: "添加引用中...",
  STATUS_FINALIZING: "最终处理中...",

  // 错误
  ERROR_QUOTA_EXCEEDED: "配额已用完",
  ERROR_GENERATION_FAILED: "生成失败",
  ERROR_NETWORK: "网络错误，请重试",

  // 配额
  QUOTA_REMAINING: "剩余配额",
  QUOTA_OVERAGE_HINT: "超出配额将按 ¥0.5/次 计费",
} as const;

// ============================================================================
// Export Formats
// ============================================================================

/**
 * 支持的导出格式
 */
export const EXPORT_FORMATS = {
  MARKDOWN: "markdown",
  OBSIDIAN: "obsidian",
  HTML: "html",
  JSON: "json",
} as const;

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * AI 模型配置
 */
export const MODEL_CONFIG = {
  /** 主力模型 */
  PRIMARY_MODEL: "deepseek-chat",
  /** 备用模型 - 阿里云百炼 */
  FALLBACK_MODEL: "qwen-turbo",
  /** API 超时（毫秒）- 长内容生成需要更多时间 */
  API_TIMEOUT_MS: 300000,
  /** 故障转移触发：连续超时次数 */
  FAILOVER_TIMEOUT_COUNT: 2,
  /** 故障转移触发：超时阈值（毫秒） */
  FAILOVER_TIMEOUT_THRESHOLD_MS: 60000,
} as const;
