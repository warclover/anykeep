/**
 * Knowledge Studio v2 - Constants
 * @module knowledge-studio/v2
 */

// ============================================================
// Material Limits
// ============================================================

/** 素材选择器默认加载数量 */
export const MATERIAL_SELECTOR_LIMIT = 100;

/** 最少需要的素材数量 */
export const MIN_MATERIALS_REQUIRED = 2;

/** 最多允许的素材数量（限制为5篇以确保生成稳定性） */
export const MAX_MATERIALS_ALLOWED = 5;

/** 素材数量限制配置（Phase 1.1 优化） */
export const MATERIAL_LIMITS = {
  /** 最少素材数 */
  MIN: 2,
  /** 推荐上限（超过显示提示） */
  RECOMMENDED_MAX: 3,
  /** 硬上限 */
  HARD_MAX: 5,
  /** 警告阈值（超过显示黄色警告） */
  WARNING_THRESHOLD: 4,
} as const;

/** 素材选择器 UI 文案 */
export const MATERIAL_SELECTOR_TEXT = {
  LABEL: "精选 2-3 篇核心素材（最多 5 篇）",
  HINT: "素材越精准，生成质量越高",
  WARNING_TOO_MANY: "素材过多可能导致内容发散，建议精选 2-3 篇核心素材",
} as const;

// ============================================================
// Output Length Configuration（Phase 1.2 优化）
// ============================================================

/** 输出长度模式配置 */
export const LENGTH_MODE_CONFIG = {
  short: {
    label: "简洁",
    description: "适合小红书、公众号短文",
    minWords: 1200,
    maxWords: 1800,
    maxOutputTokens: 3000,
    visible: true,
  },
  medium: {
    label: "标准",
    description: "适合公众号标准文章",
    minWords: 2000,
    maxWords: 2800,
    maxOutputTokens: 5000,
    visible: true,
  },
  long: {
    label: "详细",
    description: "适合深度长文（专业用户）",
    minWords: 3500,
    maxWords: 5000,
    maxOutputTokens: 8192,
    visible: false, // 默认隐藏，需展开高级选项
  },
} as const;

export type LengthMode = keyof typeof LENGTH_MODE_CONFIG;

// ============================================================
// Platform Style Configuration（Phase 3.1）
// ============================================================

/** 平台风格配置 */
export const PLATFORM_STYLE_CONFIG = {
  wechat: {
    id: "wechat",
    label: "公众号风格",
    description: "标题吸睛、分段清晰、适当留白",
    icon: "💬",
    minWords: 1500,
    maxWords: 3000,
    features: ["吸引眼球的标题", "清晰的段落分隔", "适当留白增强可读性"],
  },
  xiaohongshu: {
    id: "xiaohongshu",
    label: "小红书风格",
    description: "短段落、emoji 点缀、口语化",
    icon: "📕",
    minWords: 600,
    maxWords: 1500,
    features: ["短段落易阅读", "emoji 点缀活泼", "口语化表达亲切"],
  },
  general: {
    id: "general",
    label: "通用风格",
    description: "正式书面语、结构完整",
    icon: "📝",
    minWords: 2000,
    maxWords: 5000,
    features: ["正式书面语", "结构完整", "适合多场景"],
  },
} as const;

export type PlatformStyle = keyof typeof PLATFORM_STYLE_CONFIG;

/** 平台风格选择器 UI 文案 */
export const PLATFORM_STYLE_TEXT = {
  LABEL: "选择输出风格",
  HINT: "不同风格适合不同平台，影响语言和排版",
} as const;

// ============================================================
// SSE Configuration
// ============================================================

/** SSE chunk 发送间隔（毫秒），用于背压控制 */
export const SSE_CHUNK_DELAY_MS = 30;

/** SSE 请求超时时间（毫秒）(P2 #6) */
export const SSE_REQUEST_TIMEOUT_MS = 300_000; // 5 minutes (长内容生成需要更多时间)

/** SSE 解析错误阈值，超过此数量视为流损坏 (P2 #4) */
export const SSE_PARSE_ERROR_THRESHOLD = 10;

// ============================================================
// Error Codes
// ============================================================

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_REQUEST: "INVALID_REQUEST",
  BLUEPRINT_NOT_FOUND: "BLUEPRINT_NOT_FOUND",
  ACCESS_DENIED: "ACCESS_DENIED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  OUTLINE_GENERATION_FAILED: "OUTLINE_GENERATION_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  STREAM_ERROR: "STREAM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// ============================================================
// UI Configuration
// ============================================================

/** 大纲编辑器默认最大高度 */
export const OUTLINE_EDITOR_MAX_HEIGHT = "400px";

/** 结构化输出查看器默认最大高度 */
export const STRUCTURED_OUTPUT_MAX_HEIGHT = "600px";
