/**
 * KnowledgeGraphExploreSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

// ============================================
// 步骤定义
// ============================================

export const KNOWLEDGE_GRAPH_STEPS: StepDefinition[] = [
  {
    id: "build",
    name: "构建图谱",
    description: "获取知识关联数据",
    weight: 30,
  },
  {
    id: "analyze",
    name: "分析结构",
    description: "识别核心节点和社区",
    weight: 30,
  },
  {
    id: "insight",
    name: "生成洞察",
    description: "提供学习建议",
    weight: 40,
  },
];

// ============================================
// Input Schema
// ============================================

export const KnowledgeGraphExploreInputSchema = z.object({
  depth: z.number().min(1).max(3).default(2).describe("探索深度"),
  maxNodes: z.number().min(10).max(200).default(100).describe("最大节点数"),
});

export type KnowledgeGraphExploreInput = z.infer<
  typeof KnowledgeGraphExploreInputSchema
>;

// ============================================
// Output Schema
// ============================================

export const KnowledgeGraphExploreOutputSchema = z.object({
  nodeCount: z.number(),
  edgeCount: z.number(),
  communityCount: z.number(),
  centralNodes: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      connectionCount: z.number(),
    }),
  ),
});

export type KnowledgeGraphExploreOutput = z.infer<
  typeof KnowledgeGraphExploreOutputSchema
>;

// ============================================
// 内部类型
// ============================================

/**
 * 图谱节点
 */
export interface GraphNode {
  id: number;
  title: string;
  connectionCount: number;
}

/**
 * 图谱统计信息
 */
export interface GraphStats {
  totalNodes: number;
  totalLinks: number;
  avgDegree: number;
}
