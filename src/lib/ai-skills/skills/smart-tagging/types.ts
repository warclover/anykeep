/**
 * SmartTaggingSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 标签范围
 */
export type TaggingScope = "untagged" | "all" | "selected";

/**
 * 标签模式
 */
export type TaggingMode = "suggest" | "auto-apply" | "normalize";

/**
 * 标签规范化选项
 */
export interface NormalizeOptions {
  /** 合并相似标签（如 "React" 和 "react"） */
  mergeSimilar: boolean;
  /** 移除只使用一次的标签 */
  removeRare: boolean;
  /** 翻译目标语言 */
  translateToLanguage?: string;
}

/**
 * 智能标签输入
 */
export interface SmartTaggingInput {
  /** 处理范围 */
  scope: TaggingScope;
  /** 书签 ID 列表（scope 为 selected 时使用） */
  bookmarkIds?: number[];
  /** 处理模式 */
  mode: TaggingMode;
  /** 每个书签最大标签数 */
  maxTagsPerBookmark: number;
  /** 是否优先使用现有标签词汇 */
  useExistingTags: boolean;
  /** 规范化选项 */
  normalizeOptions?: NormalizeOptions;
}

/**
 * 标签建议
 */
export interface TagSuggestion {
  /** 标签名称 */
  tag: string;
  /** 置信度（0-1） */
  confidence: number;
  /** 建议原因 */
  reason: string;
  /** 来源 */
  source: "ai" | "title" | "summary" | "platform" | "existing";
}

/**
 * 书签标签建议
 */
export interface BookmarkTagSuggestion {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 当前标签 */
  currentTags: string[];
  /** 建议标签 */
  suggestedTags: TagSuggestion[];
}

/**
 * 合并的标签
 */
export interface MergedTag {
  /** 原始标签列表 */
  original: string[];
  /** 规范化后的标签 */
  normalized: string;
  /** 影响的书签数量 */
  affectedBookmarks: number;
}

/**
 * 移除的标签
 */
export interface RemovedTag {
  /** 标签名称 */
  tag: string;
  /** 移除原因 */
  reason: string;
}

/**
 * 规范化结果
 */
export interface NormalizationResult {
  /** 合并的标签 */
  mergedTags: MergedTag[];
  /** 移除的标签 */
  removedTags: RemovedTag[];
}

/**
 * 标签统计
 */
export interface TagStatistics {
  /** 唯一标签总数 */
  totalUniqueTags: number;
  /** 热门标签 */
  topTags: Array<{ tag: string; count: number }>;
  /** 建议的新标签 */
  suggestedNewTags: string[];
}

/**
 * 智能标签统计
 */
export interface SmartTaggingStats {
  /** 处理的书签总数 */
  totalProcessed: number;
  /** 生成的建议数 */
  suggestionsGenerated: number;
  /** 规范化的标签数 */
  tagsNormalized: number;
  /** 应用的标签数 */
  tagsApplied: number;
}

/**
 * 智能标签输出
 */
export interface SmartTaggingOutput {
  /** 统计信息 */
  stats: SmartTaggingStats;
  /** 标签建议列表 */
  suggestions: BookmarkTagSuggestion[];
  /** 规范化结果 */
  normalization?: NormalizationResult;
  /** 标签统计 */
  tagStatistics: TagStatistics;
  /** 摘要 */
  summary: string;
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 配置常量
 */
export const SMART_TAGGING_CONFIG = {
  /** 默认最大标签数 */
  DEFAULT_MAX_TAGS: 5,
  /** 最小标签数 */
  MIN_TAGS: 3,
  /** 最大标签数 */
  MAX_TAGS: 10,
  /** 最大处理书签数 */
  MAX_BOOKMARKS: 200,
  /** 置信度阈值 */
  CONFIDENCE_THRESHOLD: 0.5,
  /** 平台标签映射 */
  PLATFORM_TAG_MAP: {
    wechat: ["微信", "公众号"],
    weixin: ["微信", "公众号"],
    zhihu: ["知乎", "问答"],
    bilibili: ["B站", "视频"],
    xiaohongshu: ["小红书", "生活"],
    juejin: ["掘金", "技术"],
    github: ["GitHub", "开源"],
    twitter: ["Twitter", "社交"],
    youtube: ["YouTube", "视频"],
    medium: ["Medium", "博客"],
  } as Record<string, string[]>,
  /** 常见技术标签 */
  TECH_KEYWORDS: [
    "react",
    "vue",
    "angular",
    "javascript",
    "typescript",
    "python",
    "java",
    "go",
    "rust",
    "node",
    "nextjs",
    "docker",
    "kubernetes",
    "aws",
    "api",
    "database",
    "sql",
    "nosql",
    "redis",
    "mongodb",
    "graphql",
    "rest",
    "微服务",
    "架构",
    "性能",
    "优化",
    "安全",
    "测试",
    "devops",
    "ci/cd",
    "ai",
    "机器学习",
    "深度学习",
  ],
  /** 停用词 */
  STOP_WORDS: [
    "的",
    "是",
    "在",
    "了",
    "和",
    "与",
    "或",
    "等",
    "也",
    "就",
    "都",
    "而",
    "及",
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "and",
    "but",
    "or",
    "so",
    "this",
    "that",
    "it",
  ],
} as const;

/**
 * 默认输入配置
 */
export const DEFAULT_TAGGING_INPUT: Partial<SmartTaggingInput> = {
  scope: "untagged",
  mode: "suggest",
  maxTagsPerBookmark: SMART_TAGGING_CONFIG.DEFAULT_MAX_TAGS,
  useExistingTags: true,
};
