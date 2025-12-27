/**
 * WechatDigestSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";

// ============================================
// 输入 Schema
// ============================================

export const WechatDigestInputSchema = z.object({
  /** 分组方式 */
  groupBy: z
    .enum(["account", "topic", "date"])
    .default("account")
    .describe("分组方式：account-按公众号，topic-按话题，date-按日期"),

  /** 时间范围 */
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional()
    .describe("时间范围筛选"),

  /** 筛选条件 */
  filter: z
    .object({
      accountName: z.string().optional().describe("公众号名称（模糊匹配）"),
      tags: z.array(z.string()).optional().describe("标签筛选"),
      keyword: z.string().optional().describe("关键词搜索"),
    })
    .optional()
    .describe("筛选条件"),

  /** 摘要深度 */
  depth: z
    .enum(["brief", "standard", "detailed"])
    .default("standard")
    .describe("摘要深度：brief-简要，standard-标准，detailed-详细"),

  /** 最大文章数量 */
  maxArticles: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("最大处理文章数量"),
});

export type WechatDigestInput = z.infer<typeof WechatDigestInputSchema>;

// ============================================
// 输出 Schema
// ============================================

export const WechatDigestOutputSchema = z.object({
  /** Markdown 格式报告 */
  report: z.string(),

  /** 结构化数据 */
  data: z.object({
    /** 概览统计 */
    overview: z.object({
      totalArticles: z.number(),
      totalAccounts: z.number(),
      totalWordCount: z.number(),
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }),
      topTopics: z.array(z.string()),
    }),

    /** 分组数据 */
    groups: z.array(
      z.object({
        name: z.string(),
        articleCount: z.number(),
        wordCount: z.number(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
        articles: z.array(
          z.object({
            title: z.string(),
            url: z.string(),
            excerpt: z.string(),
          }),
        ),
      }),
    ),

    /** 洞察建议 */
    insights: z.object({
      readingTrends: z.string(),
      topRecommendations: z.array(z.string()),
      suggestions: z.array(z.string()),
    }),
  }),
});

export type WechatDigestOutput = z.infer<typeof WechatDigestOutputSchema>;

// ============================================
// 内部类型
// ============================================

/** 文章数据（带快照信息） */
export interface WechatArticleData {
  bookmarkId: number;
  title: string;
  url: string;
  wordCount: number;
  excerpt: string;
  fullContent?: string;
  tags: string[];
  createdAt: string;
  accountName: string;
  accountId?: string;
}

/** 分组结果 */
export interface ArticleGroup {
  name: string;
  articles: WechatArticleData[];
  wordCount: number;
}

/** 分组摘要 */
export interface GroupSummary {
  name: string;
  articleCount: number;
  wordCount: number;
  summary: string;
  keyPoints: string[];
  articles: Array<{
    title: string;
    url: string;
    excerpt: string;
  }>;
}

/** 洞察数据 */
export interface DigestInsights {
  readingTrends: string;
  topRecommendations: string[];
  suggestions: string[];
}

/** Skill 执行上下文 */
export interface WechatDigestContext {
  input: WechatDigestInput;
  userId: string;
  articles: WechatArticleData[];
  topics: string[];
  groups: ArticleGroup[];
  summaries: GroupSummary[];
  stats?: {
    totalArticles: number;
    totalAccounts: number;
    totalWordCount: number;
  };
  insights?: DigestInsights;
}

// ============================================
// 步骤定义
// ============================================

export const WECHAT_DIGEST_STEPS = [
  {
    id: "analyze",
    name: "分析收藏集合",
    description: "获取并分析微信文章数据",
    weight: 15,
  },
  {
    id: "extract",
    name: "提取主题标签",
    description: "分析文章主题和标签分布",
    weight: 20,
  },
  {
    id: "group",
    name: "分组整理内容",
    description: "按条件对文章进行分组",
    weight: 15,
  },
  {
    id: "summarize",
    name: "生成各组摘要",
    description: "为每个分组生成摘要",
    weight: 35,
  },
  {
    id: "compile",
    name: "编译摘要报告",
    description: "生成最终报告",
    weight: 15,
  },
];
