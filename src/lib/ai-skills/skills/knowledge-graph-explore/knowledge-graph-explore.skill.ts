/**
 * KnowledgeGraphExploreSkill - 知识图谱探索
 *
 * 通过对话探索知识关联，发现学习盲区
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationSkillMetadata,
  OrchestrationContext,
} from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import { getGraphBuilderService } from "@/lib/knowledge-link/services/graph-builder.service";
import {
  KNOWLEDGE_GRAPH_STEPS,
  KnowledgeGraphExploreInputSchema,
  KnowledgeGraphExploreOutputSchema,
  type KnowledgeGraphExploreInput,
  type KnowledgeGraphExploreOutput,
} from "./types";

/**
 * 知识图谱探索 Skill
 *
 * 设计为编排 Skill，因为：
 * 1. 多步骤执行（构建 → 分析 → 生成洞察）
 * 2. 需要进度报告
 * 3. 输出可视化交付物
 */
export class KnowledgeGraphExploreSkill extends OrchestrationSkill<
  KnowledgeGraphExploreInput,
  KnowledgeGraphExploreOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "knowledge_graph_explore",
    name: "知识图谱探索",
    description: "通过对话探索知识关联，发现学习盲区",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["visualize", "analyze", "recommend"],
    steps: KNOWLEDGE_GRAPH_STEPS,
  };

  readonly inputSchema = KnowledgeGraphExploreInputSchema;
  readonly outputSchema = KnowledgeGraphExploreOutputSchema;

  /**
   * 解析用户输入
   */
  async parseInput(
    _message: string,
    _context: OrchestrationContext,
  ): Promise<KnowledgeGraphExploreInput> {
    return {
      depth: 2,
      maxNodes: 100,
    };
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const input = context.params as KnowledgeGraphExploreInput;

    // 获取 GraphBuilderService 单例
    const graphService = getGraphBuilderService();

    this.initProgress(KNOWLEDGE_GRAPH_STEPS);

    // Step 1: 构建图谱
    yield* this.reportProgress("build", 10, "正在获取知识关联数据...");

    const graphData = await graphService.getGraphData(context.userId, {
      maxNodes: input.maxNodes,
      minStrength: 0.3,
    });

    yield* this.reportProgress(
      "build",
      30,
      `获取到 ${graphData.nodes.length} 个节点`,
    );

    // Step 2: 分析结构
    yield* this.reportProgress("analyze", 40, "正在分析知识结构...");

    const centralNodes = await graphService.getCentralNodes(context.userId, 5);
    const communities = await graphService.detectCommunities(context.userId);

    yield* this.reportProgress(
      "analyze",
      60,
      `发现 ${communities.size} 个知识社区`,
    );

    // Step 3: 生成洞察
    yield* this.reportProgress("insight", 70, "正在生成学习建议...");

    // 输出可视化数据
    const deliverable = this.createDeliverable(
      "graph",
      "知识图谱",
      {
        nodes: graphData.nodes.slice(0, 50), // 限制前端渲染数量
        edges: graphData.edges.slice(0, 100),
        centralNodes: centralNodes.map((n) => ({
          id: n.id,
          title: n.title,
          connectionCount: n.connectionCount,
        })),
        stats: graphData.stats,
      },
      "json",
      {
        metadata: {
          renderHint: "force-directed-graph",
          communityCount: communities.size,
        },
      },
    );
    yield* this.emitDeliverable(deliverable);

    // 输出文本洞察
    const insights = this.formatInsights(
      centralNodes,
      communities,
      graphData as {
        nodes: unknown[];
        edges: unknown[];
        stats: { totalLinks: number };
      },
    );
    yield* this.emitText(insights);

    yield* this.reportProgress("insight", 100, "完成");
    yield* this.emitDone(true);
  }

  /**
   * 格式化洞察报告
   */
  private formatInsights(
    centralNodes: Array<{ id: number; title: string; connectionCount: number }>,
    communities: Map<number, number[]>,
    graphData: {
      nodes: unknown[];
      edges: unknown[];
      stats: { totalLinks: number };
    },
  ): string {
    const lines: string[] = ["📊 **知识图谱分析结果**\n"];

    // 核心节点
    if (centralNodes.length > 0) {
      lines.push("**🌟 核心知识节点**（连接最多）：");
      centralNodes.slice(0, 3).forEach((node, i) => {
        lines.push(
          `${i + 1}. 「${node.title}」- ${node.connectionCount} 个关联`,
        );
      });
      lines.push("");
    }

    // 社区概览
    lines.push(`**🔗 知识社区**：共发现 ${communities.size} 个独立主题群`);
    lines.push(`**📈 关联密度**：${graphData.stats.totalLinks} 条知识链接`);

    return lines.join("\n");
  }
}

// 单例导出
export const knowledgeGraphExploreSkill = new KnowledgeGraphExploreSkill();
