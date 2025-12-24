/**
 * DataExportSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 导出格式
 */
export type ExportFormat = "csv" | "markdown" | "json" | "html" | "obsidian";

/**
 * 可导出字段
 */
export type ExportField =
  | "title"
  | "url"
  | "platform"
  | "folder"
  | "tags"
  | "aiSummary"
  | "aiTags"
  | "rating"
  | "note"
  | "createdAt"
  | "updatedAt";

/**
 * 导出范围
 */
export type ExportScope = "all" | "folder" | "tag" | "search" | "selected";

/**
 * DataExport Skill 输入
 */
export interface DataExportInput {
  /** 导出格式 */
  format: ExportFormat;
  /** 导出范围 */
  scope: ExportScope;
  /** 导出字段（默认全部） */
  fields?: ExportField[];
  /** 筛选条件 */
  filter?: {
    /** 文件夹 ID */
    folderId?: number;
    /** 标签 */
    tags?: string[];
    /** 搜索关键词 */
    keyword?: string;
    /** 书签 ID 列表 */
    bookmarkIds?: number[];
    /** 时间范围 */
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
  /** 导出选项 */
  options?: {
    /** 是否包含 AI 生成内容 */
    includeAiContent?: boolean;
    /** 是否包含用户笔记 */
    includeNotes?: boolean;
    /** 文件名前缀 */
    filenamePrefix?: string;
    /** Markdown 标题级别 */
    markdownHeadingLevel?: 1 | 2 | 3;
  };
}

/**
 * 默认导出字段
 */
export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  "title",
  "url",
  "platform",
  "folder",
  "tags",
  "createdAt",
];

/**
 * 导出格式配置
 */
export const EXPORT_FORMAT_CONFIG: Record<
  ExportFormat,
  {
    name: string;
    extension: string;
    mimeType: string;
    description: string;
  }
> = {
  csv: {
    name: "CSV",
    extension: ".csv",
    mimeType: "text/csv",
    description: "表格数据格式，可用 Excel 打开",
  },
  markdown: {
    name: "Markdown",
    extension: ".md",
    mimeType: "text/markdown",
    description: "适合笔记软件的纯文本格式",
  },
  json: {
    name: "JSON",
    extension: ".json",
    mimeType: "application/json",
    description: "结构化数据格式，便于程序处理",
  },
  html: {
    name: "HTML",
    extension: ".html",
    mimeType: "text/html",
    description: "浏览器书签格式，可导入浏览器",
  },
  obsidian: {
    name: "Obsidian",
    extension: ".md",
    mimeType: "text/markdown",
    description: "Obsidian 双链笔记格式",
  },
};

/**
 * 导出结果书签项
 */
export interface ExportedBookmark {
  id: number;
  title: string;
  url: string;
  platform: string;
  folderName: string | null;
  tags: string[];
  aiTags: string[];
  aiSummary: string | null;
  rating: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 导出统计
 */
export interface ExportStats {
  /** 导出数量 */
  totalExported: number;
  /** 按平台分布 */
  byPlatform: Record<string, number>;
  /** 按文件夹分布 */
  byFolder: Record<string, number>;
  /** 文件大小（字节） */
  fileSize: number;
  /** 导出耗时（毫秒） */
  durationMs: number;
}

/**
 * DataExport Skill 输出
 */
export interface DataExportOutput {
  /** 导出统计 */
  stats: ExportStats;
  /** 导出文件名 */
  filename: string;
  /** 导出内容 */
  content: string;
  /** MIME 类型 */
  mimeType: string;
  /** 是否为 Base64 编码 */
  isBase64: boolean;
  /** 导出摘要 */
  summary: string;
  /** 下一步建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}
