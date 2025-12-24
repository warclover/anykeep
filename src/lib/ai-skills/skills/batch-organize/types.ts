/**
 * BatchOrganizeSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 整理操作类型
 */
export type OrganizeAction =
  | "auto-categorize" // 自动分类到文件夹
  | "auto-tag" // 自动打标签
  | "clean-duplicates" // 清理重复
  | "archive-old" // 归档旧内容
  | "validate-urls"; // 验证链接有效性

/**
 * 整理范围
 */
export type OrganizeScope = "all" | "uncategorized" | "untagged" | "selected";

/**
 * BatchOrganize Skill 输入
 */
export interface BatchOrganizeInput {
  /** 整理操作 */
  actions: OrganizeAction[];
  /** 整理范围 */
  scope: OrganizeScope;
  /** 是否需要确认 */
  requireConfirmation?: boolean;
  /** 自动执行 */
  autoExecute?: boolean;
  /** 筛选条件 */
  filter?: {
    /** 文件夹 ID */
    folderId?: number;
    /** 平台 */
    platforms?: string[];
    /** 书签 ID 列表 */
    bookmarkIds?: number[];
    /** 时间范围 */
    olderThanDays?: number;
  };
}

/**
 * 分类建议
 */
export interface CategorizeSuggestion {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 当前文件夹 */
  currentFolder: string | null;
  /** 建议文件夹 */
  suggestedFolder: string;
  /** 建议文件夹 ID（如存在） */
  suggestedFolderId?: number;
  /** 置信度 0-1 */
  confidence: number;
  /** 推荐原因 */
  reason: string;
}

/**
 * 标签建议
 */
export interface TagSuggestion {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 当前标签 */
  currentTags: string[];
  /** 建议添加的标签 */
  suggestedTags: string[];
  /** 置信度 */
  confidence: number;
}

/**
 * 重复书签组
 */
export interface DuplicateGroup {
  /** URL（规范化后） */
  normalizedUrl: string;
  /** 重复的书签列表 */
  bookmarks: {
    id: number;
    title: string;
    createdAt: string;
    folderId: number | null;
  }[];
  /** 建议保留的书签 ID */
  keepBookmarkId: number;
}

/**
 * 归档候选
 */
export interface ArchiveCandidate {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 创建天数 */
  daysSinceCreated: number;
  /** 是否被访问过 */
  neverAccessed: boolean;
  /** 归档原因 */
  reason: string;
}

/**
 * URL 验证结果
 */
export interface UrlValidationResult {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** URL */
  url: string;
  /** 是否有效 */
  isValid: boolean;
  /** HTTP 状态码 */
  statusCode?: number;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 整理结果统计
 */
export interface OrganizeStats {
  /** 处理的书签总数 */
  totalProcessed: number;
  /** 分类建议数 */
  categorizeSuggestions: number;
  /** 标签建议数 */
  tagSuggestions: number;
  /** 发现的重复数 */
  duplicatesFound: number;
  /** 归档候选数 */
  archiveCandidates: number;
  /** 失效链接数 */
  invalidUrls: number;
  /** 执行的操作数 */
  actionsExecuted: number;
}

/**
 * BatchOrganize Skill 输出
 */
export interface BatchOrganizeOutput {
  /** 统计信息 */
  stats: OrganizeStats;
  /** 分类建议 */
  categorizeSuggestions: CategorizeSuggestion[];
  /** 标签建议 */
  tagSuggestions: TagSuggestion[];
  /** 重复书签组 */
  duplicateGroups: DuplicateGroup[];
  /** 归档候选 */
  archiveCandidates: ArchiveCandidate[];
  /** URL 验证结果 */
  urlValidations: UrlValidationResult[];
  /** 摘要 */
  summary: string;
  /** 建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 操作配置
 */
export const ORGANIZE_ACTION_CONFIG: Record<
  OrganizeAction,
  {
    name: string;
    description: string;
    icon: string;
    requiresConfirmation: boolean;
  }
> = {
  "auto-categorize": {
    name: "智能分类",
    description: "根据内容自动推荐文件夹分类",
    icon: "📁",
    requiresConfirmation: true,
  },
  "auto-tag": {
    name: "智能打标",
    description: "根据内容自动推荐标签",
    icon: "🏷️",
    requiresConfirmation: true,
  },
  "clean-duplicates": {
    name: "清理重复",
    description: "查找并清理重复的书签",
    icon: "🔄",
    requiresConfirmation: true,
  },
  "archive-old": {
    name: "归档旧内容",
    description: "归档长期未访问的旧书签",
    icon: "📦",
    requiresConfirmation: true,
  },
  "validate-urls": {
    name: "验证链接",
    description: "检查书签链接是否有效",
    icon: "🔗",
    requiresConfirmation: false,
  },
};

/**
 * 默认整理配置
 */
export const DEFAULT_ORGANIZE_CONFIG: Partial<BatchOrganizeInput> = {
  scope: "uncategorized",
  requireConfirmation: true,
  autoExecute: false,
};
