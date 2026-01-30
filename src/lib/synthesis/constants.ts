/**
 * 主题合成器常量定义
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

// ============================================
// Token 限制
// ============================================

/** 单个来源的最大 Token 数 */
export const MAX_PER_SOURCE_TOKENS = 8000;

/** 总输入 Token 上限 */
export const MAX_TOTAL_INPUT_TOKENS = 100000;

/** 输出 Token 预留 */
export const OUTPUT_TOKEN_RESERVE = 4000;

// ============================================
// 书签限制
// ============================================

/** 最小书签数量 */
export const MIN_BOOKMARKS_COUNT = 2;

/** 最大书签数量（标准模式） */
export const MAX_BOOKMARKS_STANDARD = 100;

/** 最大书签数量（学术模式） */
export const MAX_BOOKMARKS_ACADEMIC = 200;

/** 建议分批处理阈值 */
export const BATCH_THRESHOLD = 50;

/** 强制建议阈值 */
export const FORCE_SUGGEST_THRESHOLD = 100;

// ============================================
// 超时配置
// ============================================

/** 快读模式超时（毫秒） */
export const QUICK_MODE_TIMEOUT_MS = 90 * 1000;

/** 标准模式超时（毫秒） */
export const STANDARD_MODE_TIMEOUT_MS = 150 * 1000;

/** 学术模式超时（毫秒） */
export const ACADEMIC_MODE_TIMEOUT_MS = 300 * 1000;

/** 单步骤最大超时（毫秒） */
export const STEP_TIMEOUT_MS = 60 * 1000;

// ============================================
// 输出限制
// ============================================

/** 快读模式概述字数范围 */
export const QUICK_OVERVIEW_WORDS: [number, number] = [50, 150];

/** 标准模式概述字数范围 */
export const STANDARD_OVERVIEW_WORDS: [number, number] = [300, 500];

/** 学术模式概述字数范围 */
export const ACADEMIC_OVERVIEW_WORDS: [number, number] = [800, 1200];

/** 最大共识点数量 */
export const MAX_CONSENSUS_POINTS = 10;

/** 最大分歧点数量 */
export const MAX_DIVERGENCE_POINTS = 5;

/** 最大盲区数量 */
export const MAX_BLIND_SPOTS = 5;

// ============================================
// 分页配置
// ============================================

/** 默认每页数量 */
export const DEFAULT_PAGE_SIZE = 20;

/** 最大每页数量 */
export const MAX_PAGE_SIZE = 100;

// ============================================
// AI 推荐配置
// ============================================

/** 推荐触发阈值（书签数） */
export const RECOMMEND_THRESHOLD = 30;

/** 每日最大推荐次数 */
export const MAX_DAILY_RECOMMENDATIONS = 3;

/** 推荐气泡自动隐藏时间（秒） */
export const RECOMMENDATION_AUTO_HIDE_SECONDS = 5;

// ============================================
// 缓存配置
// ============================================

/** 综述列表缓存时间（秒） */
export const LIST_CACHE_TTL_SECONDS = 60;

/** 综述详情缓存时间（秒） */
export const DETAIL_CACHE_TTL_SECONDS = 300;

// ============================================
// 预览配置
// ============================================

/** 概述预览最大长度 */
export const OVERVIEW_PREVIEW_MAX_LENGTH = 200;

/** 来源列表预览最大数量 */
export const SOURCE_PREVIEW_MAX_COUNT = 5;

// ============================================
// UI 文本常量
// ============================================

export const UI_TEXT = {
  // 页面标题
  PAGE_TITLE_LIST: "我的综述",
  PAGE_TITLE_DETAIL: "综述详情",
  PAGE_TITLE_NEW: "生成主题综述",

  // 按钮文本
  BUTTON_GENERATE: "开始生成",
  BUTTON_CANCEL: "取消生成",
  BUTTON_EXPORT: "导出",
  BUTTON_SHARE: "分享",
  BUTTON_DELETE: "删除",
  BUTTON_RETRY: "重试",

  // 步骤名称
  STEP_PREPARE: "准备阶段",
  STEP_ANALYZE: "分析阶段",
  STEP_SYNTHESIZE: "合成阶段",
  STEP_CONFLICT: "冲突检测",
  STEP_BLINDSPOT: "盲区发现",

  // 状态文本
  STATUS_PENDING: "等待中",
  STATUS_GENERATING: "生成中",
  STATUS_COMPLETED: "已完成",
  STATUS_FAILED: "生成失败",
  STATUS_CANCELLED: "已取消",

  // 来源类型
  SOURCE_TYPE_FOLDER: "文件夹",
  SOURCE_TYPE_TAG: "标签",
  SOURCE_TYPE_SELECTION: "手动选择",
  SOURCE_TYPE_AI_RECOMMEND: "AI 推荐",

  // 深度模式
  DEPTH_QUICK: "快读模式",
  DEPTH_STANDARD: "标准模式",
  DEPTH_ACADEMIC: "学术模式",

  // 四维标题
  DIMENSION_OVERVIEW: "概述",
  DIMENSION_CONSENSUS: "核心共识",
  DIMENSION_DIVERGENCE: "观点分歧",
  DIMENSION_BLIND_SPOTS: "知识盲区",

  // 提示消息
  TIP_GENERATING: "生成过程中可随时取消，已完成部分会被保存",
  TIP_EMPTY_LIST: "还没有生成过综述，快去整理你的收藏吧！",
  TIP_MIN_BOOKMARKS: "至少需要 3 个书签才能生成综述",
  TIP_LARGE_CONTENT: "内容量较大，建议缩小范围或使用快读模式",

  // 错误消息
  ERROR_SOURCE_NOT_FOUND: "来源未找到",
  ERROR_INSUFFICIENT_CONTENT: "内容不足，无法生成有价值的综述",
  ERROR_TOKEN_EXCEEDED: "内容量超过限制，请减少书签数量",
  ERROR_LLM_FAILED: "AI 服务暂时不可用，请稍后重试",
  ERROR_TIMEOUT: "生成超时，请尝试缩小范围或使用快读模式",
  ERROR_UNAUTHORIZED: "请先登录",
  ERROR_NOT_FOUND: "综述不存在或已被删除",
} as const;

// ============================================
// 导出格式配置
// ============================================

export const EXPORT_FORMATS = {
  markdown: {
    id: "markdown",
    name: "Markdown",
    extension: ".md",
    mimeType: "text/markdown",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    extension: ".md",
    mimeType: "text/markdown",
  },
  json: {
    id: "json",
    name: "JSON",
    extension: ".json",
    mimeType: "application/json",
  },
  html: {
    id: "html",
    name: "HTML",
    extension: ".html",
    mimeType: "text/html",
  },
} as const;
