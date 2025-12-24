/**
 * QuickDigestSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 摘要范围
 */
export type DigestScope =
  | "today"
  | "week"
  | "month"
  | "folder"
  | "selected"
  | "all";

/**
 * 输出格式
 */
export type DigestOutputFormat = "markdown" | "mindmap" | "cards" | "outline";

/**
 * 分组方式
 */
export type DigestGroupBy = "topic" | "platform" | "date" | "none";

/**
 * 摘要长度
 */
export type SummaryLength = "brief" | "standard" | "detailed";

/**
 * 快速摘要输入
 */
export interface QuickDigestInput {
  /** 摘要范围 */
  scope: DigestScope;
  /** 文件夹 ID（scope 为 folder 时使用） */
  folderId?: number;
  /** 书签 ID 列表（scope 为 selected 时使用） */
  bookmarkIds?: number[];
  /** 输出格式 */
  outputFormat: DigestOutputFormat;
  /** 分组方式 */
  groupBy: DigestGroupBy;
  /** 最大条目数 */
  maxItems: number;
  /** 摘要长度 */
  summaryLength: SummaryLength;
  /** 是否包含洞察 */
  includeInsights: boolean;
}

/**
 * 主题书签
 */
export interface TopicBookmark {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** 摘要 */
  summary: string;
  /** URL */
  url: string;
  /** 平台 */
  platform?: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 主题分组
 */
export interface TopicGroup {
  /** 主题名称 */
  name: string;
  /** 书签数量 */
  count: number;
  /** 关键词 */
  keywords: string[];
  /** 主题摘要 */
  summary?: string;
  /** 书签列表 */
  bookmarks: TopicBookmark[];
}

/**
 * 洞察类型
 */
export type InsightType = "trend" | "gap" | "recommendation";

/**
 * 洞察
 */
export interface DigestInsight {
  /** 洞察类型 */
  type: InsightType;
  /** 洞察内容 */
  content: string;
}

/**
 * 摘要统计
 */
export interface DigestStats {
  /** 处理总数 */
  totalProcessed: number;
  /** 识别主题数 */
  topicsIdentified: number;
  /** 平台分布 */
  platformDistribution: Record<string, number>;
  /** 日期范围 */
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * 摘要内容
 */
export interface DigestContent {
  /** 标题 */
  title: string;
  /** 生成时间 */
  generatedAt: string;
  /** 格式 */
  format: DigestOutputFormat;
  /** 内容 */
  content: string;
}

/**
 * 快速摘要输出
 */
export interface QuickDigestOutput {
  /** 统计信息 */
  stats: DigestStats;
  /** 摘要内容 */
  digest: DigestContent;
  /** 主题列表 */
  topics: TopicGroup[];
  /** 洞察（可选） */
  insights?: DigestInsight[];
  /** 建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 聚类配置
 */
export interface ClusteringConfig {
  /** 最小聚类大小 */
  minClusterSize: number;
  /** 最大聚类数 */
  maxClusters: number;
  /** 相似度阈值 */
  similarityThreshold: number;
}

/**
 * 配置常量
 */
export const QUICK_DIGEST_CONFIG = {
  /** 默认最大条目数 */
  DEFAULT_MAX_ITEMS: 30,
  /** 最小条目数 */
  MIN_ITEMS: 10,
  /** 最大条目数 */
  MAX_ITEMS: 100,
  /** 聚类配置 */
  CLUSTERING: {
    minClusterSize: 2,
    maxClusters: 10,
    similarityThreshold: 0.3,
  } as ClusteringConfig,
  /** 摘要长度配置 */
  SUMMARY_LENGTHS: {
    brief: { maxChars: 100, topicSummaryChars: 200 },
    standard: { maxChars: 200, topicSummaryChars: 400 },
    detailed: { maxChars: 400, topicSummaryChars: 800 },
  },
  /** 停用词（中文） */
  STOP_WORDS_ZH: [
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
    "着",
    "或者",
    "并",
    "个",
    "为",
    "这",
    "那",
    "有",
    "我",
    "你",
    "他",
    "她",
    "它",
    "们",
    "什么",
    "怎么",
    "如何",
    "为什么",
    "哪",
    "那个",
    "这个",
    "一个",
    "一些",
    "一种",
  ],
  /** 停用词（英文） */
  STOP_WORDS_EN: [
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
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
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
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "and",
    "but",
    "or",
    "nor",
    "so",
    "yet",
    "both",
    "either",
    "neither",
    "not",
    "only",
    "own",
    "same",
    "than",
    "too",
    "very",
    "just",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
  ],
} as const;

/**
 * 默认输入配置
 */
export const DEFAULT_DIGEST_INPUT: Partial<QuickDigestInput> = {
  scope: "week",
  outputFormat: "markdown",
  groupBy: "topic",
  maxItems: QUICK_DIGEST_CONFIG.DEFAULT_MAX_ITEMS,
  summaryLength: "standard",
  includeInsights: true,
};
