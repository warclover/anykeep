/**
 * SearchSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

/**
 * 搜索模式
 */
export type SearchMode = "keyword" | "semantic" | "hybrid";

/**
 * 搜索输入参数
 */
export interface SearchSkillInput {
  /** 搜索查询文本 */
  query: string;
  /** 搜索模式，默认 hybrid */
  mode?: SearchMode;
  /** 返回结果数量，默认 10 */
  limit?: number;
  /** 语义搜索相似度阈值 (0-1)，默认 0.5 */
  threshold?: number;
  /** 筛选条件：平台 */
  platform?: string;
  /** 筛选条件：文件夹 ID */
  folderId?: number;
  /** 筛选条件：标签 */
  tags?: string[];
  /** 是否只搜索已标星 */
  starredOnly?: boolean;
}

/**
 * 搜索结果书签项
 */
export interface SearchResultBookmark {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 描述 */
  description: string | null;
  /** 封面图 URL */
  coverUrl: string | null;
  /** 平台 */
  platform: string;
  /** AI 摘要 */
  aiSummary: string | null;
  /** AI 标签 */
  aiTags: string[] | null;
  /** 用户标签 */
  userTags: string[] | null;
  /** 文件夹 ID */
  folderId: number | null;
  /** 文件夹名称 */
  folderName: string | null;
  /** 作者 */
  author: string | null;
  /** 发布时间 */
  publishTime: string | null;
  /** 创建时间 */
  createdAt: string;
  /** 语义相似度分数 (0-1) */
  similarity?: number;
}

/**
 * 搜索结果输出
 */
export interface SearchSkillOutput {
  /** 搜索查询文本 */
  query: string;
  /** 实际使用的搜索模式 */
  searchMode: SearchMode;
  /** 搜索结果 */
  results: SearchResultBookmark[];
  /** 结果总数 */
  totalCount: number;
  /** 是否有更多结果 */
  hasMore: boolean;
  /** 搜索建议（当结果为空时） */
  suggestions?: string[];
}
