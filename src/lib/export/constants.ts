/**
 * 数据导出功能 - 常量配置
 * V2.1: 独立页面 + 多入口复用
 */

import type { ExportErrorCode, ExportFormat } from "./types";

// ============================================
// 导出阈值配置
// ============================================

/** 导出阈值配置 */
export const EXPORT_THRESHOLDS = {
  /** 立即导出，无进度条 */
  INSTANT: 500,
  /** 显示进度条 */
  WITH_PROGRESS: 2000,
  /** 分块处理 */
  CHUNKED: 5000,
  /** 提示后端处理 */
  BACKEND_REQUIRED: 10000,
} as const;

/** 分块大小 */
export const CHUNK_SIZE = 500;

/** 超时配置（毫秒） */
export const EXPORT_TIMEOUT = 30000;

/** Obsidian ZIP 阈值：超过此数量自动使用 ZIP */
export const OBSIDIAN_ZIP_THRESHOLD = 10;

// ============================================
// CSV 配置
// ============================================

/** CSV 默认字段 */
export const DEFAULT_CSV_FIELDS = [
  "title",
  "url",
  "folder",
  "created_at",
  "platform",
] as const;

/** CSV 可选字段 */
export const OPTIONAL_CSV_FIELDS = [
  "ai_tags",
  "user_tags",
  "ai_summary",
  "description",
  "author",
  "notes",
  "rating",
  "is_starred",
] as const;

/** CSV 字段配置 */
export const CSV_FIELD_CONFIG: Record<
  string,
  { label: string; description: string; default: boolean }
> = {
  title: { label: "标题", description: "书签标题", default: true },
  url: { label: "链接", description: "书签 URL", default: true },
  folder: { label: "文件夹", description: "所属文件夹名称", default: true },
  created_at: { label: "收藏时间", description: "收藏创建时间", default: true },
  platform: { label: "来源平台", description: "内容来源平台", default: true },
  ai_tags: {
    label: "AI 标签",
    description: "AI 自动生成的标签",
    default: false,
  },
  user_tags: {
    label: "用户标签",
    description: "用户手动添加的标签",
    default: false,
  },
  ai_summary: {
    label: "AI 摘要",
    description: "AI 生成的内容摘要",
    default: false,
  },
  description: { label: "描述", description: "书签描述", default: false },
  author: { label: "作者", description: "内容作者", default: false },
  notes: { label: "笔记", description: "用户笔记", default: false },
  rating: { label: "评级", description: "用户评级（0-5）", default: false },
  is_starred: { label: "收藏", description: "是否已收藏", default: false },
};

/** CSV 字段映射（导出时的表头） */
export const CSV_FIELD_LABELS: Record<string, string> = {
  title: "标题",
  url: "链接",
  folder: "文件夹",
  created_at: "收藏时间",
  platform: "来源平台",
  ai_tags: "AI 标签",
  user_tags: "用户标签",
  ai_summary: "AI 摘要",
  description: "描述",
  author: "作者",
  notes: "笔记",
  rating: "评级",
  is_starred: "已收藏",
};

// ============================================
// 导出格式配置
// ============================================

/** 导出格式配置 */
export const EXPORT_FORMAT_CONFIG: Record<
  ExportFormat,
  {
    label: string;
    description: string;
    extension: string;
    mimeType: string;
    icon: string;
  }
> = {
  csv: {
    label: "CSV (.csv)",
    description: "适合 Excel 分析",
    extension: "csv",
    mimeType: "text/csv",
    icon: "FileSpreadsheet",
  },
  markdown: {
    label: "Markdown (.md)",
    description: "适合笔记工具",
    extension: "md",
    mimeType: "text/markdown",
    icon: "FileText",
  },
  obsidian: {
    label: "Obsidian (.md)",
    description: "带 Frontmatter 格式",
    extension: "md",
    mimeType: "text/markdown",
    icon: "FileCode",
  },
  "obsidian-zip": {
    label: "Obsidian ZIP",
    description: "每条书签独立文件",
    extension: "zip",
    mimeType: "application/zip",
    icon: "FileArchive",
  },
  json: {
    label: "JSON (.json)",
    description: "适合数据备份",
    extension: "json",
    mimeType: "application/json",
    icon: "FileJson",
  },
  html: {
    label: "HTML (.html)",
    description: "浏览器书签格式",
    extension: "html",
    mimeType: "text/html",
    icon: "FileCode2",
  },
};

// ============================================
// 错误消息
// ============================================

/** 错误消息 */
export const EXPORT_ERROR_MESSAGES: Record<ExportErrorCode, string> = {
  MEMORY_EXCEEDED: "数据量过大，请筛选后重试",
  NETWORK_ERROR: "网络异常，请检查连接后重试",
  TIMEOUT: "导出超时，请减少数据量后重试",
  CANCELLED: "导出已取消",
  NO_DATA: "没有符合条件的数据",
  FORMAT_ERROR: "格式化失败，请稍后重试",
  UNKNOWN: "导出失败，请稍后重试",
};

// ============================================
// UI 文本配置
// ============================================

/** 导出页面文本 */
export const EXPORT_PAGE_TEXT = {
  title: "数据导出",
  historyButton: "导出历史",
  formatSection: {
    title: "选择导出格式",
  },
  filterSection: {
    title: "筛选条件",
    scopeLabel: "范围",
    scopeOptions: {
      all: "全部收藏",
      all_with_browser: "全部收藏（含浏览器书签）",
      current_view: "当前视图",
      selected: "已选中",
    },
    platformLabel: "平台",
    folderLabel: "文件夹",
    dateRangeLabel: "时间范围",
    starredOnly: "仅导出收藏",
    readOnly: "仅导出已读",
  },
  csvOptionsSection: {
    title: "CSV 高级选项",
    fieldsLabel: "导出字段",
  },
  previewSection: {
    title: "导出预览",
    countLabel: "符合条件的书签",
    formatLabel: "导出格式",
    sizeLabel: "预估文件大小",
    viewSampleButton: "查看示例",
  },
  exportButton: "开始导出",
} as const;

/** 导出对话框文本 */
export const EXPORT_DIALOG_TEXT = {
  confirmTitle: "确认导出",
  progressTitle: "正在导出...",
  successTitle: "导出成功！",
  infoSection: {
    title: "导出信息",
    countLabel: "导出数量",
    formatLabel: "导出格式",
    sizeLabel: "预估大小",
  },
  progress: {
    processed: "已处理",
    total: "条",
  },
  success: {
    downloaded: "已下载",
    totalExported: "共导出",
    items: "条书签",
  },
  buttons: {
    cancel: "取消",
    confirm: "确认导出",
    cancelExport: "取消导出",
    openFolder: "打开下载文件夹",
    exportAgain: "再次导出",
    close: "关闭",
  },
} as const;

// ============================================
// 数据埋点事件
// ============================================

/** 埋点事件名称 */
export const EXPORT_ANALYTICS_EVENTS = {
  /** 访问导出页面 */
  PAGE_VIEWED: "export_page_viewed",
  /** 打开导出对话框 */
  DIALOG_OPENED: "export_dialog_opened",
  /** 选择导出格式 */
  FORMAT_SELECTED: "export_format_selected",
  /** 应用筛选条件 */
  FILTER_APPLIED: "export_filter_applied",
  /** 查看导出预览 */
  PREVIEW_VIEWED: "export_preview_viewed",
  /** 开始导出 */
  EXPORT_STARTED: "export_started",
  /** 导出完成 */
  EXPORT_COMPLETED: "export_completed",
  /** 导出失败 */
  EXPORT_FAILED: "export_failed",
  /** 取消导出 */
  EXPORT_CANCELLED: "export_cancelled",
} as const;
