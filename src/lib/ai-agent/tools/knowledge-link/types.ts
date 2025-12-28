/**
 * Knowledge Link Tools 类型定义
 *
 * 知识图谱相关 AI Agent Tools 的共享类型
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  LinkType,
  KnowledgeGraphStats,
} from "@/lib/knowledge-link/types/link.types";
import type {
  GraphNode,
  GraphEdge,
} from "@/lib/knowledge-link/services/graph-builder.service";
import type { ClusterResult } from "@/lib/knowledge-link/services/topic-clusterer.service";

// ============================================
// 关联类型显示名称
// ============================================

export const LINK_TYPE_DISPLAY_NAMES: Record<LinkType, string> = {
  semantic: "语义相似",
  entity: "共享实体",
  tag: "共享标签",
  topic: "同主题",
};

// ============================================
// get_knowledge_graph 返回类型
// ============================================

/**
 * 简化的图谱节点（用于 Tool 返回）
 */
export interface KnowledgeGraphNode {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform: string | null;
  /** 连接数 */
  connectionCount: number;
  /** 平均关联强度（0-1） */
  avgStrength: number;
}

/**
 * 简化的图谱边（用于 Tool 返回）
 */
export interface KnowledgeGraphEdge {
  /** 源节点 ID */
  source: number;
  /** 目标节点 ID */
  target: number;
  /** 关联类型 */
  type: LinkType;
  /** 关联类型显示名称 */
  typeLabel: string;
  /** 关联强度（0-1） */
  strength: number;
}

/**
 * 简化的统计信息（用于 Tool 返回）
 */
export interface KnowledgeGraphStatsResult {
  /** 书签总数 */
  totalBookmarks: number;
  /** 关联总数 */
  totalLinks: number;
  /** 平均每书签关联数 */
  avgLinksPerBookmark: number;
  /** 按类型统计 */
  linksByType: Record<string, number>;
  /** 按强度统计 */
  linksByStrength: {
    strong: number;
    medium: number;
    weak: number;
  };
}

/**
 * get_knowledge_graph Tool 返回结果
 */
export interface GetKnowledgeGraphResult {
  /** 节点列表 */
  nodes: KnowledgeGraphNode[];
  /** 边列表 */
  edges: KnowledgeGraphEdge[];
  /** 统计信息 */
  stats: KnowledgeGraphStatsResult;
  /** 友好消息 */
  message: string;
}

// ============================================
// find_related_by_topic 返回类型
// ============================================

/**
 * 主题簇信息
 */
export interface TopicClusterInfo {
  /** 聚类 ID */
  clusterId: string;
  /** 聚类标签 */
  label: string;
  /** 聚类内书签数量 */
  bookmarkCount: number;
  /** 聚类内聚度（0-1） */
  cohesion: number;
  /** 代表性标签 */
  representativeTags: string[];
}

/**
 * 相关书签（按主题）
 */
export interface RelatedBookmarkByTopic {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 关联强度 */
  strength: number;
  /** 主题标签 */
  topicLabel: string;
}

/**
 * find_related_by_topic Tool 返回结果
 */
export interface FindRelatedByTopicResult {
  /** 源书签 ID */
  bookmarkId: number;
  /** 所属聚类信息 */
  cluster: TopicClusterInfo | null;
  /** 相关书签列表 */
  relatedBookmarks: RelatedBookmarkByTopic[];
  /** 友好消息 */
  message: string;
}

// ============================================
// 转换函数
// ============================================

/**
 * 转换 GraphNode 到 KnowledgeGraphNode
 */
export function transformGraphNode(node: GraphNode): KnowledgeGraphNode {
  return {
    id: node.id,
    title: node.title,
    url: node.url,
    platform: node.platform ?? null,
    connectionCount: node.connectionCount,
    avgStrength: Math.round(node.avgStrength * 100) / 100,
  };
}

/**
 * 转换 GraphEdge 到 KnowledgeGraphEdge
 */
export function transformGraphEdge(edge: GraphEdge): KnowledgeGraphEdge {
  return {
    source: edge.source,
    target: edge.target,
    type: edge.type,
    typeLabel: LINK_TYPE_DISPLAY_NAMES[edge.type] || edge.type,
    strength: Math.round(edge.strength * 100) / 100,
  };
}

/**
 * 转换 KnowledgeGraphStats 到 KnowledgeGraphStatsResult
 */
export function transformGraphStats(
  stats: KnowledgeGraphStats,
): KnowledgeGraphStatsResult {
  return {
    totalBookmarks: stats.totalBookmarks,
    totalLinks: stats.totalLinks,
    avgLinksPerBookmark: Math.round(stats.avgLinksPerBookmark * 100) / 100,
    linksByType: Object.fromEntries(
      Object.entries(stats.linksByType).map(([type, count]) => [
        LINK_TYPE_DISPLAY_NAMES[type as LinkType] || type,
        count,
      ]),
    ),
    linksByStrength: stats.linksByStrength,
  };
}

/**
 * 转换 ClusterResult 到 TopicClusterInfo
 */
export function transformClusterResult(
  cluster: ClusterResult,
): TopicClusterInfo {
  return {
    clusterId: cluster.clusterId,
    label: cluster.label,
    bookmarkCount: cluster.bookmarkIds.length,
    cohesion: Math.round(cluster.cohesion * 100) / 100,
    representativeTags: cluster.representativeTags,
  };
}
