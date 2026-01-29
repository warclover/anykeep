/**
 * Knowledge Link Tools
 *
 * 知识图谱相关 AI Agent Tools 导出
 *
 * 精简重构 2026-01-29: 移除 get_knowledge_graph，保留 find_related_by_topic
 *
 * @version 1.1.0
 * @since 2025-12-28
 */

// [已移除] getKnowledgeGraphTool - 知识图谱精简重构 2026-01-29
export { findRelatedByTopicTool } from "./find-related-by-topic.tool";

export type {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphStatsResult,
  GetKnowledgeGraphResult,
  TopicClusterInfo,
  RelatedBookmarkByTopic,
  FindRelatedByTopicResult,
} from "./types";

// 批量注册用的 Tools 数组
import { findRelatedByTopicTool } from "./find-related-by-topic.tool";

export const knowledgeLinkTools = [
  // [已移除] getKnowledgeGraphTool - 知识图谱精简重构 2026-01-29
  findRelatedByTopicTool,
];
