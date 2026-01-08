/**
 * AI 附件系统类型定义
 *
 * 支持用户关联收藏和上传文件作为 AI 参考上下文
 *
 * @version 2.0.0
 * @since 2025-12-26
 * @updated 2026-01-08 - 增强内容状态追踪和来源标识
 */

// =============================================================================
// 附件类型
// =============================================================================

/** 附件来源类型 */
export type AttachmentType = "bookmark" | "file";

/**
 * 附件内容状态
 *
 * 追踪附件内容的加载状态，支持用户反馈
 */
export type AttachmentContentStatus =
  | "pending" // 等待验证
  | "loading" // 正在抓取内容
  | "ready" // 内容就绪
  | "empty" // 无内容（仅有标题/URL）
  | "error"; // 抓取失败

/**
 * 附件内容来源
 *
 * 标识内容的获取方式，便于调试和优化
 */
export type AttachmentContentSource =
  | "ai_summary" // 来自 AI 摘要
  | "description" // 来自描述
  | "raw_content" // 来自原始内容
  | "fetched" // 实时抓取
  | "file_extracted" // 文件提取
  | "none"; // 无内容

/** 附件项 */
export interface AttachmentItem {
  /** 唯一标识（字符串化的 ID 或生成的 UUID） */
  id: string;
  /** 附件类型 */
  type: AttachmentType;
  /** 显示标题 */
  title: string;
  /** 来源 URL（bookmark 类型） */
  url?: string;
  /** 提取的内容（书签摘要/文件文本） */
  content?: string;
  /** 原始文件对象（file 类型） */
  fileData?: File;
  /** 文件 MIME 类型 */
  mimeType?: string;
  /** 文件大小（字节） */
  size?: number;
  /** 是否内容被截断 */
  truncated?: boolean;
  /** 平台来源（bookmark 类型，如 wechat/bilibili） */
  platform?: string;

  // ========== v2.0 新增字段 ==========

  /** 原始书签 ID（数字类型，用于 API 调用） */
  bookmarkId?: number;

  /** 内容状态 */
  contentStatus: AttachmentContentStatus;

  /** 内容来源 */
  contentSource: AttachmentContentSource;

  /** 错误信息（当 contentStatus 为 error 时） */
  errorMessage?: string;

  /** 内容字符数 */
  contentLength?: number;

  /** 添加时间 */
  addedAt: Date;
}

/** 从书签创建的附件 */
export interface BookmarkAttachment extends AttachmentItem {
  type: "bookmark";
  url: string;
  platform?: string;
}

/** 从文件创建的附件 */
export interface FileAttachment extends AttachmentItem {
  type: "file";
  fileData: File;
  mimeType: string;
  size: number;
}

// =============================================================================
// 附件管理状态
// =============================================================================

/** 附件管理状态 */
export interface AttachmentState {
  /** 已选附件列表 */
  items: AttachmentItem[];
  /** 弹出面板是否打开 */
  isPopoverOpen: boolean;
  /** 搜索关键词 */
  searchQuery: string;
  /** 是否正在搜索 */
  isSearching: boolean;
}

// =============================================================================
// 常量配置
// =============================================================================

/** 附件限制常量 */
export const ATTACHMENT_LIMITS = {
  /** 最多附件数量 */
  MAX_COUNT: 3,
  /** 最大文件大小（5MB） */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  /** 允许的文件类型 */
  ACCEPTED_TYPES: [".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg"] as const,
  /** 允许的 MIME 类型 */
  ACCEPTED_MIME_TYPES: [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
  ] as const,
  /** 单个附件最大内容长度（字符） */
  MAX_CONTENT_LENGTH: 8000,
  /** AI 上下文总最大长度（字符） */
  MAX_CONTEXT_CONTENT_LENGTH: 20000,
  /** 最近收藏默认数量 */
  RECENT_BOOKMARKS_LIMIT: 10,
  /** 支持的文件类型 */
  SUPPORTED_FILE_TYPES: [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "image/png",
    "image/jpeg",
  ] as const,
} as const;

/** 文件类型显示名称映射 */
export const FILE_TYPE_NAMES: Record<string, string> = {
  "application/pdf": "PDF 文档",
  "text/plain": "文本文件",
  "text/markdown": "Markdown 文档",
  "image/png": "PNG 图片",
  "image/jpeg": "JPEG 图片",
};

// =============================================================================
// UI 文案常量
// =============================================================================

export const ATTACHMENT_TEXT = {
  /** 按钮标题 */
  BUTTON_TITLE: "添加附件",
  /** 弹出面板标题 */
  POPOVER_TITLE: "添加附件",
  /** 搜索框占位符 */
  SEARCH_PLACEHOLDER: "搜索全部收藏...",
  /** 最近收藏标题 */
  RECENT_BOOKMARKS_TITLE: "最近收藏",
  /** 搜索结果标题 */
  SEARCH_RESULTS_TITLE: "搜索结果",
  /** 文件上传标题 */
  FILE_UPLOAD_TITLE: "上传文件",
  /** 文件上传提示 */
  FILE_UPLOAD_HINT: "点击或拖拽上传",
  /** 文件格式提示 */
  FILE_FORMAT_HINT: "PDF/TXT/MD/图片 ≤5MB",
  /** 确认按钮 */
  CONFIRM_BUTTON: "确认添加",
  /** 清除按钮 */
  CLEAR_BUTTON: "清除",
  /** 空状态 - 无收藏 */
  EMPTY_NO_BOOKMARKS: "还没有收藏内容",
  /** 空状态 - 无搜索结果 */
  EMPTY_NO_RESULTS: "未找到相关收藏",
  /** 已达上限提示 */
  LIMIT_REACHED: "已达附件上限",
  /** 附件指示器前缀 */
  INDICATOR_PREFIX: "附件:",
  /** 附件指示器更多 */
  INDICATOR_MORE: "更多",
  /** 文件过大错误 */
  ERROR_FILE_TOO_LARGE: "文件大小不能超过 5MB",
  /** 文件类型错误 */
  ERROR_FILE_TYPE: "不支持的文件类型",
  /** 提取失败错误 */
  ERROR_EXTRACT_FAILED: "文件内容提取失败",
} as const;

// =============================================================================
// 函数式更新类型（修复闭包陷阱）
// =============================================================================

/**
 * 附件选择变化回调类型
 *
 * 支持两种调用方式：
 * 1. 直接传递新数组：onSelectionChange([item1, item2])
 * 2. 函数式更新（避免闭包陷阱）：onSelectionChange(prev => [...prev, newItem])
 */
export type AttachmentSelectionUpdater =
  | AttachmentItem[]
  | ((prev: AttachmentItem[]) => AttachmentItem[]);

/**
 * 附件选择变化回调函数
 */
export type OnSelectionChange = (updater: AttachmentSelectionUpdater) => void;

// =============================================================================
// 工具函数类型
// =============================================================================

/** 文件内容提取结果 */
export interface ExtractedContent {
  /** 提取的文本内容 */
  text: string;
  /** 是否被截断 */
  truncated: boolean;
  /** 提取错误信息 */
  error?: string;
}

/** 附件上下文构建选项 */
export interface AttachmentContextOptions {
  /** 单个附件最大内容长度，默认 2000 */
  maxContentLength?: number;
  /** 是否包含 URL，默认 true */
  includeUrl?: boolean;
}
