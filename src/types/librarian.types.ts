/**
 * 整理大师 (AI Librarian) 共享类型定义
 *
 * 统一 hooks 和 services 中的类型，避免重复定义
 */

/**
 * 文件夹基础信息
 */
export interface LibrarianFolder {
  id: number;
  name: string;
  bookmarkCount?: number;
}

/**
 * 重复文件夹组
 */
export interface DuplicateFolderGroup {
  folders: LibrarianFolder[];
  similarity: number;
  suggestedMerge: string;
}

/**
 * 过大文件夹
 */
export interface OversizedFolder {
  folder: LibrarianFolder;
  bookmarkCount: number;
  suggestedSplits: string[];
}

/**
 * 命名问题文件夹
 */
export interface PoorlyNamedFolder {
  folder: LibrarianFolder;
  issue: "too_short" | "too_vague" | "contains_special" | "duplicate_style";
  suggestedName: string;
}

/**
 * 缺失分类建议
 */
export interface MissingCategory {
  category: string;
  bookmarkCount: number;
  reason: string;
  sampleTitles: string[];
}

/**
 * 整理分析结果
 */
export interface LibrarianAnalysis {
  /** 重复文件夹 */
  duplicateFolders: DuplicateFolderGroup[];

  /** 空文件夹 */
  emptyFolders: LibrarianFolder[];

  /** 过大文件夹（建议拆分） */
  oversizedFolders: OversizedFolder[];

  /** 命名不规范文件夹 */
  poorlyNamedFolders: PoorlyNamedFolder[];

  /** 缺失的关键分类 */
  missingCategories: MissingCategory[];

  /** 整体健康评分 (0-100) */
  healthScore: number;

  /** 分析时间 */
  analyzedAt: Date;

  /** 建议数量 */
  totalSuggestions: number;
}
