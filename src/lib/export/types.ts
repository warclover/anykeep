/**
 * 数据导出功能 - 类型定义
 * V2.1: 独立页面 + 多入口复用
 */

import type { Bookmark } from "@/types/supabase";

// ============================================
// 导出格式相关
// ============================================

/** 导出格式 */
export type ExportFormat =
  | "csv"
  | "markdown"
  | "obsidian"
  | "obsidian-zip"
  | "json"
  | "html";

/** 导出状态 */
export type ExportStatus =
  | "idle"
  | "preparing"
  | "exporting"
  | "success"
  | "failed"
  | "cancelled";

/** 导出范围 */
export type ExportScope =
  | "all" // 全部收藏（不含浏览器书签）
  | "all_with_browser" // 全部收藏（含浏览器书签）
  | "current_view" // 当前视图
  | "selected"; // 选中的书签

/** 导出模式 - 用于 ExportDialogV2 */
export type ExportMode =
  | "full" // 完整模式：显示筛选面板，用于导出页面
  | "selected"; // 选中模式：直接导出传入的书签，用于批量操作

// ============================================
// 筛选与配置
// ============================================

/** 导出筛选条件 */
export interface ExportFilter {
  /** 导出范围 */
  scope?: ExportScope;
  /** 文件夹 ID 列表 */
  folderIds?: number[];
  /** 平台列表 */
  platforms?: string[];
  /** 时间范围 */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** 标签（AI 或用户标签） */
  tags?: string[];
  /** 仅导出收藏 */
  isStarred?: boolean;
  /** 仅导出已读 */
  isRead?: boolean;
}

/** CSV 格式选项 */
export interface CsvFormatOptions {
  /** 导出字段 */
  fields?: string[];
  /** 分隔符 */
  delimiter?: "," | ";" | "\t";
  /** 包含表头 */
  includeHeader?: boolean;
  /** 编码 */
  encoding?: "utf-8" | "gbk";
}

/** Markdown 格式选项 */
export interface MarkdownFormatOptions {
  /** 包含 Frontmatter */
  includeFrontmatter?: boolean;
  /** 按文件夹分组 */
  groupByFolder?: boolean;
  /** 包含 AI 摘要 */
  includeAiSummary?: boolean;
}

/** Obsidian 格式选项 */
export interface ObsidianFormatOptions {
  /** 输出模式：single = 单文件, zip = 多文件压缩包 */
  outputMode?: "single" | "zip";
  /** ZIP 阈值：超过此数量自动使用 ZIP */
  zipThreshold?: number;
  /** 文件命名模式 */
  fileNamePattern?: "title" | "url-hash" | "date-title";
}

/** 格式特定选项 */
export interface ExportFormatOptions {
  csv?: CsvFormatOptions;
  markdown?: MarkdownFormatOptions;
  obsidian?: ObsidianFormatOptions;
}

/** 导出配置 */
export interface ExportConfig {
  /** 导出格式 */
  format: ExportFormat;
  /** 筛选条件 */
  filter?: ExportFilter;
  /** 格式选项 */
  options?: ExportFormatOptions;
}

// ============================================
// 导出结果与错误
// ============================================

/** 错误码 */
export type ExportErrorCode =
  | "MEMORY_EXCEEDED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "CANCELLED"
  | "NO_DATA"
  | "FORMAT_ERROR"
  | "UNKNOWN";

/** 导出结果 */
export interface ExportResult {
  /** 是否成功 */
  success: boolean;
  /** 导出文件名 */
  filename: string;
  /** 导出内容（字符串或 Blob） */
  content: string | Blob;
  /** 导出数量 */
  count: number;
  /** 导出格式 */
  format: ExportFormat;
  /** 文件大小（字节） */
  size?: number;
  /** 错误信息 */
  error?: string;
  /** 错误码 */
  errorCode?: ExportErrorCode;
  /** 耗时（毫秒） */
  duration?: number;
}

/** 导出进度 */
export interface ExportProgress {
  /** 当前状态 */
  status: ExportStatus;
  /** 当前处理数量 */
  current: number;
  /** 总数量 */
  total: number;
  /** 进度百分比 */
  percentage: number;
  /** 当前阶段描述 */
  stage?: string;
}

// ============================================
// 组件 Props
// ============================================

/** ExportDialogV2 Props */
export interface ExportDialogV2Props {
  /** 对话框开关 */
  open: boolean;
  /** 开关回调 */
  onOpenChange: (open: boolean) => void;
  /** 模式：full = 完整筛选模式, selected = 选中模式 */
  mode: ExportMode;
  /** 选中模式时传入的书签列表 */
  bookmarks?: BookmarkWithFolder[];
  /** 完整模式时的筛选参数（可选，用于预设筛选条件） */
  initialFilter?: ExportFilter;
  /** 导出成功回调 */
  onSuccess?: (result: ExportResult) => void;
  /** 导出失败回调 */
  onError?: (error: ExportErrorCode, message: string) => void;
}

/** 导出预览数据 */
export interface ExportPreviewData {
  /** 符合条件的总数 */
  totalCount: number;
  /** 预估文件大小（字节） */
  estimatedSize: number;
  /** 预览数据（前 3 条） */
  previewItems: BookmarkWithFolder[];
  /** 预览内容（格式化后的文本） */
  previewContent?: string;
}

// ============================================
// 数据类型扩展
// ============================================

/** 带文件夹信息的书签 */
export type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

/** 格式化器接口 */
export interface ExportFormatter {
  /** 格式化单条书签 */
  formatItem(bookmark: BookmarkWithFolder, index: number): string;
  /** 格式化多条书签 */
  formatAll(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
  ): string | Promise<Blob>;
  /** 生成预览 */
  generatePreview(bookmarks: BookmarkWithFolder[], count?: number): string;
  /** 获取 MIME 类型 */
  getMimeType(): string;
  /** 获取文件扩展名 */
  getExtension(): string;
}

// ============================================
// 数据埋点
// ============================================

/** 导出入口来源 */
export type ExportSource =
  | "page" // 导出页面
  | "batch" // 批量操作
  | "home" // 首页
  | "folder" // 文件夹页
  | "settings"; // 设置页

/** 埋点参数 */
export interface ExportAnalyticsParams {
  /** 入口来源 */
  source?: ExportSource;
  /** 导出格式 */
  format?: ExportFormat;
  /** 导出数量 */
  count?: number;
  /** 筛选条件类型 */
  filterTypes?: string[];
  /** 耗时（毫秒） */
  duration?: number;
  /** 文件大小（字节） */
  fileSize?: number;
  /** 错误码 */
  errorCode?: ExportErrorCode;
}
