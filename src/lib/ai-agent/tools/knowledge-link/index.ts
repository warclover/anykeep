/**
 * Knowledge Link Tools
 *
 * 知识图谱相关 AI Agent Tools 导出
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

export { getKnowledgeGraphTool } from "./get-knowledge-graph.tool";
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
import { getKnowledgeGraphTool } from "./get-knowledge-graph.tool";
import { findRelatedByTopicTool } from "./find-related-by-topic.tool";

export const knowledgeLinkTools = [
  getKnowledgeGraphTool,
  findRelatedByTopicTool,
];
