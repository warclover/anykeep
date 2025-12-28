/**
 * get_knowledge_graph Tool
 *
 * 获取用户的知识图谱数据
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { logger } from "@/lib/logger";
import { getGraphBuilderService } from "@/lib/knowledge-link/services/graph-builder.service";
import type { GetKnowledgeGraphResult } from "./types";
import {
  transformGraphNode,
  transformGraphEdge,
  transformGraphStats,
} from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  minStrength: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("最小关联强度 (0-1)，默认 0.3"),
  maxNodes: z
    .number()
    .int()
    .min(10)
    .max(500)
    .optional()
    .describe("最大节点数，默认 200"),
  linkTypes: z
    .array(z.enum(["semantic", "entity", "tag", "topic"]))
    .optional()
    .describe("关联类型筛选，不填则返回全部"),
  includeIsolated: z
    .boolean()
    .optional()
    .describe("是否包含孤立节点（无关联的书签），默认 false"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type GetKnowledgeGraphParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const getKnowledgeGraphTool: Tool<
  GetKnowledgeGraphParams,
  GetKnowledgeGraphResult
> = {
  definition: {
    name: "get_knowledge_graph",
    description: `获取用户的知识图谱数据，包含书签节点、关联边和统计信息。

返回信息：
- 节点列表：书签 ID、标题、URL、平台、连接数、平均关联强度
- 边列表：源节点、目标节点、关联类型、强度
- 统计信息：总书签数、总关联数、按类型/强度分布

关联类型说明：
- semantic：语义相似（基于向量相似度）
- entity：共享实体（如共同提及的人物、公司）
- tag：共享标签
- topic：同主题（基于聚类分析）

使用场景：
- "展示我的知识图谱"
- "我的收藏有哪些关联"
- "哪些书签联系最紧密"
- "按语义相似度查看关联"`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: GetKnowledgeGraphParams,
    context: ToolContext,
  ): Promise<ToolResult<GetKnowledgeGraphResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);

    const { minStrength, maxNodes, linkTypes, includeIsolated } = params;

    try {
      const graphBuilderService = getGraphBuilderService();

      const graphData = await graphBuilderService.getGraphData(context.userId, {
        minStrength,
        maxNodes,
        linkTypes,
        includeIsolated,
      });

      // 验证服务返回的数据结构
      if (
        !graphData ||
        !Array.isArray(graphData.nodes) ||
        !Array.isArray(graphData.edges)
      ) {
        logger.warn(
          { userId: context.userId, graphData: typeof graphData },
          "get_knowledge_graph: Invalid graph data structure",
        );
        return {
          success: false,
          error: "知识图谱服务返回的数据格式异常",
          errorCode: "INVALID_RESPONSE",
        };
      }

      // 转换为 Tool 返回格式
      const nodes = graphData.nodes.map(transformGraphNode);
      const edges = graphData.edges.map(transformGraphEdge);
      const stats = transformGraphStats(graphData.stats);

      // 生成友好消息
      let message: string;
      if (nodes.length === 0) {
        message = "您的知识图谱还没有数据，收藏更多内容后会自动建立关联";
      } else if (edges.length === 0) {
        message = `发现 ${nodes.length} 个书签，但尚未建立关联。系统会在后台自动分析关联`;
      } else {
        const strongLinks = stats.linksByStrength.strong;
        const typesSummary = Object.entries(stats.linksByType)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => `${type} ${count} 条`)
          .join("、");

        message = `知识图谱包含 ${nodes.length} 个书签、${edges.length} 条关联`;
        if (strongLinks > 0) {
          message += `，其中 ${strongLinks} 条是强关联`;
        }
        if (typesSummary) {
          message += `。关联类型：${typesSummary}`;
        }
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "get_knowledge_graph",
          userId: context.userId,
          params: { minStrength, maxNodes, linkTypes, includeIsolated },
          nodeCount: nodes.length,
          edgeCount: edges.length,
          executionTimeMs,
          reasoning,
        },
        "get_knowledge_graph: Success",
      );

      return {
        success: true,
        data: {
          nodes,
          edges,
          stats,
          message,
        },
        metadata: {
          executionTimeMs,
          affectedCount: nodes.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "get_knowledge_graph",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "get_knowledge_graph: Failed",
      );

      return {
        success: false,
        error: "获取知识图谱失败，请稍后重试",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
