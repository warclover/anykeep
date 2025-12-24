/**
 * AI Skills 统一配置
 *
 * 集中管理所有 Skill 相关的配置常量，避免魔法数字
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 批量整理 Skill 配置
 */
export const BATCH_ORGANIZE_CONFIG = {
  /** 单次最大处理书签数量 */
  MAX_BOOKMARKS_LIMIT: 500,

  /** 单次最大书签 ID 数量（用于 selected 模式） */
  MAX_BOOKMARK_IDS: 100,

  /** 默认归档天数阈值 */
  DEFAULT_ARCHIVE_DAYS: 180,

  /** 最小分类置信度 */
  MIN_CATEGORIZE_CONFIDENCE: 0.2,

  /** 最大标签建议数 */
  MAX_TAG_SUGGESTIONS: 3,
} as const;

/**
 * 复杂度评估配置
 */
export const COMPLEXITY_CONFIG = {
  /** 简单任务阈值 */
  SIMPLE_THRESHOLD: 35,

  /** 复杂任务阈值 */
  COMPLEX_THRESHOLD: 60,
} as const;

/**
 * 导出 Skill 配置
 */
export const DATA_EXPORT_CONFIG = {
  /** 默认导出格式 */
  DEFAULT_FORMAT: "markdown" as const,

  /** 单次最大导出数量 */
  MAX_EXPORT_COUNT: 1000,

  /** 分块大小（用于大文件导出） */
  CHUNK_SIZE: 100,
} as const;

/**
 * 洞察报告配置
 */
export const INSIGHT_REPORT_CONFIG = {
  /** 默认报告类型 */
  DEFAULT_REPORT_TYPE: "monthly" as const,

  /** 默认时间范围 */
  DEFAULT_TIME_RANGE: "month" as const,

  /** 热门项目数量 */
  TOP_ITEMS_COUNT: 10,

  /** 趋势分析最大数据点 */
  MAX_TREND_POINTS: 30,
} as const;

/**
 * 知识回顾配置
 */
export const KNOWLEDGE_REVIEW_CONFIG = {
  /** 默认回顾数量 */
  DEFAULT_COUNT: 5,

  /** 最大回顾数量 */
  MAX_COUNT: 20,

  /** 间隔重复默认天数 */
  DEFAULT_SPACED_DAYS: [1, 3, 7, 14, 30],
} as const;

/**
 * 重复清理 Skill 配置
 */
export const DUPLICATE_CLEANUP_CONFIG = {
  /** 最大扫描书签数 */
  MAX_SCAN_LIMIT: 1000,

  /** 最大选择书签数 */
  MAX_SELECTED_IDS: 100,

  /** 默认语义阈值 */
  DEFAULT_SEMANTIC_THRESHOLD: 0.9,

  /** 最小语义阈值 */
  MIN_SEMANTIC_THRESHOLD: 0.8,

  /** 最大语义阈值 */
  MAX_SEMANTIC_THRESHOLD: 0.99,

  /** 完整度权重 */
  COMPLETENESS_WEIGHTS: {
    hasSummary: 40,
    hasTags: 30,
    hasFolder: 20,
    hasDescription: 10,
  },
} as const;

/**
 * URL 验证配置
 */
export const URL_VALIDATION_CONFIG = {
  /** 允许的协议 */
  ALLOWED_PROTOCOLS: ["http:", "https:"] as const,

  /** 验证超时时间（毫秒） */
  VALIDATION_TIMEOUT_MS: 5000,

  /** 并发验证数量 */
  CONCURRENT_VALIDATIONS: 5,
} as const;

/**
 * 错误代码
 */
export const SKILL_ERROR_CODES = {
  /** 需要认证 */
  AUTH_REQUIRED: "AUTH_REQUIRED",

  /** 输入验证失败 */
  INPUT_VALIDATION_ERROR: "INPUT_VALIDATION_ERROR",

  /** 输出验证失败 */
  OUTPUT_VALIDATION_ERROR: "OUTPUT_VALIDATION_ERROR",

  /** 超时 */
  TIMEOUT_ERROR: "TIMEOUT_ERROR",

  /** 执行器未配置 */
  EXECUTOR_NOT_CONFIGURED: "EXECUTOR_NOT_CONFIGURED",

  /** 执行错误 */
  EXECUTION_ERROR: "EXECUTION_ERROR",

  /** 输入过大 */
  INPUT_TOO_LARGE: "INPUT_TOO_LARGE",

  /** 未知错误 */
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type SkillErrorCode = keyof typeof SKILL_ERROR_CODES;
