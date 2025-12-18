/**
 * MD 收藏功能 - 常量定义
 * P2-007: Markdown 内容收藏
 */

import type { ContentTypeConfig } from "../types";

/**
 * MD 收藏限制配置
 */
export const MD_COLLECTION_LIMITS = {
  /** 最大内容长度（100KB） */
  maxContentLength: 100 * 1024,
  /** 最大标题长度 */
  maxTitleLength: 500,
  /** 最大文件大小（1MB） */
  maxFileSize: 1 * 1024 * 1024,
  /** 最大标签数量 */
  maxTagCount: 10,
  /** 最大标签长度 */
  maxTagLength: 20,
  /** 批量上传最大文件数 */
  maxFilesPerRequest: 10,
} as const;

/**
 * 允许的文件扩展名
 */
export const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

/**
 * 允许的 MIME 类型
 */
export const ALLOWED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "text/x-markdown",
] as const;

/**
 * 阅读视图配置
 */
export const READER_CONFIG = {
  typography: {
    maxWidth: "65ch",
    lineHeight: 1.75,
    fontSize: "16px",
    paragraphSpacing: "1.25em",
  },
  codeBlock: {
    theme: "one-dark",
    showLineNumbers: true,
    copyButton: true,
    languageLabel: true,
    maxHeight: "500px",
  },
  features: {
    aiSummaryExpanded: true,
    tableOfContents: true,
    readingProgress: true,
    smoothScroll: true,
  },
} as const;

/**
 * 内容类型配置
 * 支持大写（AI 返回）和小写（用户选择）两种键名
 */
export const CONTENT_TYPE_CONFIG: Record<string, ContentTypeConfig> = {
  // 大写键名（AI 分类返回）
  TUTORIAL: {
    label: "教程",
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  CODE_SNIPPET: {
    label: "代码",
    color:
      "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  },
  ANALYSIS: {
    label: "分析",
    color:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
  SUMMARY: {
    label: "摘要",
    color:
      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  QA: {
    label: "问答",
    color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  },
  DOCUMENTATION: {
    label: "文档",
    color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  OTHER: {
    label: "其他",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  // 小写键名（用户选择的内容类型）
  article: {
    label: "文章",
    color:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  tutorial: {
    label: "教程",
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  code: {
    label: "代码",
    color:
      "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  },
  note: {
    label: "笔记",
    color:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
  documentation: {
    label: "文档",
    color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
} as const;

/**
 * 默认内容类型配置
 */
export const DEFAULT_CONTENT_TYPE_CONFIG: ContentTypeConfig = {
  label: "文档",
  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

/**
 * 处理状态配置
 */
export const PROCESSING_STATUS_CONFIG = {
  pending: {
    label: "等待处理",
    color: "bg-yellow-100 text-yellow-600",
  },
  processing: {
    label: "处理中",
    color: "bg-blue-100 text-blue-600",
  },
  completed: {
    label: "已完成",
    color: "bg-green-100 text-green-600",
  },
  failed: {
    label: "处理失败",
    color: "bg-red-100 text-red-600",
  },
} as const;

/**
 * 分页默认值
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
} as const;

/**
 * localStorage 键名
 */
export const STORAGE_KEYS = {
  viewMode: "md-collections-view-mode",
  VIEW_PREFERENCE: "md-collections-view-preference",
} as const;
