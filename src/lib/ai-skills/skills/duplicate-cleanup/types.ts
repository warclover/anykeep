/**
 * DuplicateCleanupSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 去重策略
 */
export type DuplicateStrategy = "exact" | "normalized" | "semantic";

/**
 * 保留策略
 */
export type KeepStrategy = "oldest" | "newest" | "most_complete";

/**
 * 重复清理范围
 */
export type CleanupScope = "all" | "folder" | "selected";

/**
 * 重复清理输入
 */
export interface DuplicateCleanupInput {
  /** 清理范围 */
  scope: CleanupScope;
  /** 文件夹 ID（scope 为 folder 时使用） */
  folderId?: number;
  /** 书签 ID 列表（scope 为 selected 时使用） */
  bookmarkIds?: number[];
  /** 去重策略 */
  strategy: DuplicateStrategy;
  /** 语义相似度阈值（0.8-0.99，默认 0.9） */
  semanticThreshold?: number;
  /** 是否自动清理（默认 false，需要确认） */
  autoCleanup: boolean;
  /** 保留策略 */
  keepStrategy: KeepStrategy;
}

/**
 * 重复组中的书签信息
 */
export interface DuplicateBookmark {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 创建时间 */
  createdAt: string;
  /** 文件夹名称 */
  folderName?: string;
  /** 文件夹 ID */
  folderId?: number;
  /** 完整度评分（0-100） */
  completeness: number;
  /** 有摘要 */
  hasSummary: boolean;
  /** 标签数量 */
  tagCount: number;
}

/**
 * 重复书签组
 */
export interface DuplicateGroup {
  /** 组 ID */
  id: string;
  /** 检测策略 */
  strategy: DuplicateStrategy;
  /** 规范化后的 URL */
  normalizedUrl: string;
  /** 相似度（语义模式时使用） */
  similarity?: number;
  /** 组内书签列表 */
  bookmarks: DuplicateBookmark[];
  /** 推荐保留的书签 ID */
  recommendedKeep: number;
  /** 推荐原因 */
  reason: string;
}

/**
 * 清理操作记录
 */
export interface CleanupAction {
  /** 操作类型 */
  action: "deleted" | "merged" | "skipped";
  /** 操作的书签 ID */
  bookmarkId: number;
  /** 合并目标书签 ID */
  mergedInto?: number;
  /** 跳过原因 */
  skipReason?: string;
}

/**
 * 清理统计信息
 */
export interface CleanupStats {
  /** 扫描总数 */
  totalScanned: number;
  /** 发现的重复组数 */
  duplicateGroupsFound: number;
  /** 重复书签总数 */
  totalDuplicates: number;
  /** 按策略分类的重复数 */
  byStrategy: {
    exact: number;
    normalized: number;
    semantic: number;
  };
  /** 已执行的操作数 */
  actionsExecuted: number;
  /** 已删除数量 */
  deletedCount: number;
}

/**
 * 重复清理输出
 */
export interface DuplicateCleanupOutput {
  /** 统计信息 */
  stats: CleanupStats;
  /** 重复组列表 */
  duplicateGroups: DuplicateGroup[];
  /** 执行的操作记录 */
  actionsExecuted: CleanupAction[];
  /** 摘要 */
  summary: string;
  /** 建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * URL 规范化配置
 */
export const URL_NORMALIZE_CONFIG = {
  /** 需要移除的追踪参数 */
  TRACKING_PARAMS: [
    // Google Analytics
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    // Facebook
    "fbclid",
    // Google Ads
    "gclid",
    "gclsrc",
    // Microsoft
    "msclkid",
    // 通用追踪
    "ref",
    "source",
    "from",
    "share",
    "share_source",
    "share_medium",
    // 微信
    "scene",
    "subscene",
    "clicktime",
    "enterid",
    // 知乎
    "origin",
    // 小红书
    "xhsshare",
    "appuid",
    "apptime",
  ],
  /** 需要移除的 hash 模式 */
  REMOVE_HASH_PATTERNS: [
    /^#\/?$/, // 空 hash
    /^#comment/, // 评论锚点
    /^#reply/, // 回复锚点
  ],
} as const;

/**
 * 重复清理配置
 */
export const DUPLICATE_CLEANUP_CONFIG = {
  /** 最大扫描书签数 */
  MAX_SCAN_LIMIT: 1000,
  /** 最大选择书签数 */
  MAX_SELECTED_IDS: 100,
  /** 默认语义阈值 */
  DEFAULT_SEMANTIC_THRESHOLD: 0.9,
  /** 最小语义阈值 */
  MIN_SEMANTIC_THRESHOLD: 0.8,
  /** 最大语义阈值 */
  MAX_SEMANTIC_THRESHOLD: 0.99,
  /** 完整度权重 */
  COMPLETENESS_WEIGHTS: {
    hasSummary: 40,
    hasTags: 30,
    hasFolder: 20,
    hasDescription: 10,
  },
} as const;

/**
 * 默认输入配置
 */
export const DEFAULT_CLEANUP_INPUT: Partial<DuplicateCleanupInput> = {
  scope: "all",
  strategy: "normalized",
  autoCleanup: false,
  keepStrategy: "most_complete",
};
