/**
 * 浏览器书签模块类型定义
 */

import type { Platform } from "@/types/supabase";

/**
 * 解析后的书签节点
 */
export interface ParsedBookmarkNode {
  /** 节点类型 */
  type: "folder" | "bookmark";
  /** 标题 */
  title: string;
  /** URL（仅 bookmark 类型） */
  url?: string;
  /** 添加时间戳（Unix 秒） */
  addDate?: number;
  /** 最后修改时间戳（Unix 秒） */
  lastModified?: number;
  /** 图标（Base64 或 URL） */
  icon?: string;
  /** 描述 */
  description?: string;
  /** 子节点（仅 folder 类型） */
  children?: ParsedBookmarkNode[];
  /** 节点路径（用于 UI 展示） */
  path: string[];
  /** 唯一标识（使用 crypto.randomUUID()） */
  id: string;
  /** 层级深度（从 1 开始） */
  depth: number;
}

/**
 * 浏览器来源类型
 */
export type BrowserSource =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "unknown";

/**
 * 解析后的书签文件
 */
export interface ParsedBookmarkFile {
  /** 文件名 */
  fileName: string;
  /** 来源浏览器（自动检测或用户选择） */
  source: BrowserSource;
  /** 对应的平台类型 */
  platform: Platform;
  /** 根节点列表 */
  roots: ParsedBookmarkNode[];
  /** 书签总数 */
  totalBookmarks: number;
  /** 文件夹总数 */
  totalFolders: number;
  /** 最大层级深度 */
  maxDepth: number;
  /** 解析时间 */
  parsedAt: Date;
}

/**
 * 浏览器来源到平台类型的映射
 */
export const BROWSER_SOURCE_TO_PLATFORM: Record<BrowserSource, Platform> = {
  chrome: "BROWSER_CHROME",
  edge: "BROWSER_EDGE",
  firefox: "BROWSER_FIREFOX",
  safari: "BROWSER_SAFARI",
  unknown: "UNKNOWN",
};

/**
 * 平台类型到浏览器来源的映射
 */
export const PLATFORM_TO_BROWSER_SOURCE: Partial<
  Record<Platform, BrowserSource>
> = {
  BROWSER_CHROME: "chrome",
  BROWSER_EDGE: "edge",
  BROWSER_FIREFOX: "firefox",
  BROWSER_SAFARI: "safari",
};

/**
 * 导入配置选项
 */
export interface BrowserBookmarkImportOptions {
  /** 选中的节点 ID 列表 */
  selectedIds: string[];
  /** 目标文件夹 ID（null 表示根目录） */
  targetFolderId: number | null;
  /** 是否保持原文件夹结构 */
  keepFolderStructure: boolean;
  /** 是否自动创建文件夹（Phase 2） */
  autoCreateFolders: boolean;
  /** 是否启用 AI 分类（Phase 2） */
  enableAiClassify: boolean;
  /** 是否覆盖已存在的 URL */
  overwriteExisting: boolean;
  /** 是否保留原始添加时间（Phase 2） */
  preserveAddDate: boolean;
}

/**
 * 默认导入配置
 */
export const DEFAULT_IMPORT_OPTIONS: BrowserBookmarkImportOptions = {
  selectedIds: [],
  targetFolderId: null,
  keepFolderStructure: true,
  autoCreateFolders: false,
  enableAiClassify: false,
  overwriteExisting: false,
  preserveAddDate: true,
};

/**
 * 导入进度（支持分批）
 */
export interface ImportProgress {
  /** 总书签数 */
  totalBookmarks: number;
  /** 总批次数 */
  totalBatches: number;
  /** 当前批次（从 1 开始） */
  currentBatch: number;
  /** 当前批次内进度 */
  batchProgress: {
    total: number;
    processed: number;
  };
  /** 累计成功数 */
  totalSuccess: number;
  /** 累计失败数 */
  totalFailed: number;
  /** 累计跳过数（重复） */
  totalSkipped: number;
  /** 当前处理的书签标题 */
  currentItem?: string;
  /** 状态 */
  status: ImportProgressStatus;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 导入进度状态
 */
export type ImportProgressStatus =
  | "idle"
  | "parsing"
  | "importing"
  | "paused"
  | "completed"
  | "error";

/**
 * 默认导入进度
 */
export const DEFAULT_IMPORT_PROGRESS: ImportProgress = {
  totalBookmarks: 0,
  totalBatches: 0,
  currentBatch: 0,
  batchProgress: { total: 0, processed: 0 },
  totalSuccess: 0,
  totalFailed: 0,
  totalSkipped: 0,
  status: "idle",
};

/**
 * 导入结果
 */
export interface ImportResult {
  /** 成功导入数量 */
  success: number;
  /** 失败数量 */
  failed: number;
  /** 跳过数量（重复） */
  skipped: number;
  /** 失败详情 */
  errors: ImportError[];
  /** 按平台分类的导入数量 */
  platformBreakdown: Partial<Record<Platform, number>>;
  /** 扩展统计（Phase 2） */
  extendedStats?: ImportExtendedStats;
}

/**
 * 扩展导入统计
 */
export interface ImportExtendedStats {
  /** 处理总时长（毫秒） */
  durationMs: number;
  /** 创建的文件夹数量 */
  foldersCreated: number;
  /** 保留原始时间的书签数量 */
  withOriginalDate: number;
  /** 来源浏览器 */
  browserSource: string;
  /** 总书签数（导入前） */
  totalSelected: number;
  /** 是否启用了 AI 分类 */
  aiClassifyEnabled?: boolean;
}

/**
 * 导入错误详情
 */
export interface ImportError {
  /** 书签 URL */
  url: string;
  /** 书签标题 */
  title: string;
  /** 错误原因 */
  reason: string;
}

/**
 * 层级深度警告
 */
export interface DepthWarning {
  /** 超过限制的文件夹列表 */
  folders: Array<{
    path: string[];
    depth: number;
  }>;
  /** 是否允许继续（用户确认后） */
  confirmed: boolean;
}

/**
 * 分批导入队列项（Phase 2）
 */
export interface ImportBatch {
  /** 批次编号（从 1 开始） */
  batchNumber: number;
  /** 总批次数 */
  totalBatches: number;
  /** 当前批次书签列表 */
  bookmarks: ParsedBookmarkNode[];
  /** 来源平台 */
  platform: Platform;
  /** 批次状态 */
  status: "pending" | "processing" | "completed" | "failed";
  /** 批次结果 */
  result?: {
    success: number;
    failed: number;
    skipped: number;
  };
}
