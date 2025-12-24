/**
 * RelatedDiscoverySkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";

/**
 * 搜索来源类型
 */
export type DiscoverySource = "bookmark" | "topic" | "query";

/**
 * 相关发现输入 Schema
 */
export const relatedDiscoveryInputSchema = z.object({
  /** 搜索来源类型 */
  source: z.enum(["bookmark", "topic", "query"]),

  /** 书签 ID（当 source 为 bookmark 时必填） */
  bookmarkId: z.number().optional(),

  /** 主题（当 source 为 topic 时必填） */
  topic: z.string().optional(),

  /** 查询文本（当 source 为 query 时必填） */
  query: z.string().optional(),

  /** 返回数量限制（5-50，默认 20） */
  limit: z.number().min(5).max(50).default(20),

  /** 最低相似度阈值（0.5-0.95，默认 0.7） */
  minSimilarity: z.number().min(0.5).max(0.95).default(0.7),

  /** 是否包含解释 */
  includeExplanation: z.boolean().default(false),

  /** 是否按聚类分组 */
  groupByCluster: z.boolean().default(false),
});

export type RelatedDiscoveryInput = z.infer<typeof relatedDiscoveryInputSchema>;

/**
 * 相关书签项
 */
export interface RelatedItem {
  /** 书签 ID */
  bookmarkId: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform: string;
  /** 相似度分数（0-1） */
  similarity: number;
  /** 相关性解释 */
  explanation?: string;
  /** 共享的主题/标签 */
  sharedTopics: string[];
  /** 所属聚类 */
  cluster?: string;
  /** AI 标签 */
  aiTags?: string[];
  /** AI 摘要 */
  aiSummary?: string;
}

/**
 * 聚类信息
 */
export interface Cluster {
  /** 聚类名称 */
  name: string;
  /** 书签数量 */
  count: number;
  /** 平均相似度 */
  avgSimilarity: number;
  /** 书签 ID 列表 */
  bookmarkIds: number[];
}

/**
 * 知识图谱节点
 */
export interface GraphNode {
  /** 节点 ID（书签 ID） */
  id: number;
  /** 标题 */
  title: string;
  /** 节点类型 */
  type: "source" | "related" | "cluster";
}

/**
 * 知识图谱边
 */
export interface GraphEdge {
  /** 源节点 ID */
  source: number;
  /** 目标节点 ID */
  target: number;
  /** 连接权重（相似度） */
  weight: number;
}

/**
 * 知识图谱
 */
export interface KnowledgeGraph {
  /** 节点列表 */
  nodes: GraphNode[];
  /** 边列表 */
  edges: GraphEdge[];
}

/**
 * 发现统计
 */
export interface DiscoveryStats {
  /** 总发现数量 */
  totalFound: number;
  /** 平均相似度 */
  avgSimilarity: number;
  /** 发现的主题列表 */
  topicsDiscovered: string[];
  /** 平台分布 */
  platformDistribution: Record<string, number>;
  /** 相似度分布 */
  similarityDistribution: {
    high: number; // > 0.8
    medium: number; // 0.6-0.8
    low: number; // < 0.6
  };
}

/**
 * 来源信息
 */
export interface SourceInfo {
  /** 来源类型 */
  type: DiscoverySource;
  /** 书签信息（当 source 为 bookmark 时） */
  bookmark?: {
    id: number;
    title: string;
    url: string;
  };
  /** 主题（当 source 为 topic 时） */
  topic?: string;
  /** 查询文本（当 source 为 query 时） */
  query?: string;
}

/**
 * 相关发现输出
 */
export interface RelatedDiscoveryOutput {
  /** 来源信息 */
  source: SourceInfo;
  /** 相关书签列表 */
  relatedItems: RelatedItem[];
  /** 聚类信息（当 groupByCluster 为 true 时） */
  clusters?: Cluster[];
  /** 知识图谱 */
  knowledgeGraph?: KnowledgeGraph;
  /** 统计信息 */
  stats: DiscoveryStats;
  /** 建议 */
  suggestions: string[];
}

/**
 * 书签数据（用于发现）
 */
export interface BookmarkForDiscovery {
  id: number;
  title: string;
  url: string;
  platform?: string;
  ai_tags?: string[];
  ai_summary?: string;
  embedding?: number[];
  created_at: string;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  id: number;
  title: string;
  url: string;
  platform: string;
  similarity: number;
  ai_tags?: string[];
  ai_summary?: string;
}
