/**
 * RelatedDiscoverySkill - 相关内容发现助手
 *
 * 基于语义相似度搜索，发现与指定书签/主题/查询相关的内容，
 * 帮助用户建立知识连接。
 *
 * 功能：
 * - 向量相似度搜索
 * - 标签相似度匹配（fallback）
 * - 聚类分析
 * - 知识图谱生成
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import type {
  RelatedDiscoveryInput,
  RelatedDiscoveryOutput,
  BookmarkForDiscovery,
  SourceInfo,
  RelatedItem,
  DiscoveryStats,
  Cluster,
} from "./types";
import { relatedDiscoveryInputSchema } from "./types";
import { SimilarityFinder } from "./similarity-finder";

// ============================================
// Output Schema 定义
// ============================================

const RelatedDiscoveryOutputSchema = z.object({
  source: z.object({
    type: z.enum(["bookmark", "topic", "query"]),
    bookmark: z
      .object({
        id: z.number(),
        title: z.string(),
        url: z.string(),
      })
      .optional(),
    topic: z.string().optional(),
    query: z.string().optional(),
  }),
  relatedItems: z.array(z.any()),
  clusters: z.array(z.any()).optional(),
  knowledgeGraph: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
    })
    .optional(),
  stats: z.any(),
  suggestions: z.array(z.string()),
});

// ============================================
// 步骤定义
// ============================================

const DISCOVERY_STEPS = [
  { id: "embed", name: "获取向量", description: "获取源向量", weight: 20 },
  { id: "search", name: "相似搜索", description: "执行相似度搜索", weight: 30 },
  { id: "cluster", name: "聚类分析", description: "聚类相关内容", weight: 20 },
  {
    id: "explain",
    name: "生成解释",
    description: "生成相关性解释",
    weight: 20,
  },
  { id: "report", name: "生成报告", description: "生成发现报告", weight: 10 },
];

/**
 * RelatedDiscoverySkill 实现
 */
export class RelatedDiscoverySkill extends OrchestrationSkill<
  RelatedDiscoveryInput,
  RelatedDiscoveryOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "related_discovery",
    name: "相关发现助手",
    description:
      "基于语义相似度搜索，发现与您的收藏内容相关的书签，建立知识连接",
    version: "1.0.0",
    category: "understanding",
    author: "AnyKeep",
    requiresConfirmation: false,
    estimatedDurationMs: 45000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["graph", "list"],
    outputFormats: ["json", "markdown"],
    capabilities: [
      "语义相似度搜索",
      "标签相似度匹配",
      "主题聚类分析",
      "知识图谱可视化",
      "相关性解释",
    ],
    steps: DISCOVERY_STEPS,
  };

  readonly inputSchema = relatedDiscoveryInputSchema;
  readonly outputSchema = RelatedDiscoveryOutputSchema;

  private finder = new SimilarityFinder();

  /**
   * 解析用户输入
   */
  async parseInput(
    userMessage: string,
    context: OrchestrationContext,
  ): Promise<RelatedDiscoveryInput> {
    const messageLower = userMessage.toLowerCase();

    // 默认值
    let source: RelatedDiscoveryInput["source"] = "query";
    let bookmarkId: number | undefined;
    let topic: string | undefined;
    let query: string | undefined;

    // 解析来源类型和参数
    // 检查是否指定了书签 ID
    const bookmarkIdMatch = userMessage.match(
      /书签\s*(?:ID|id|编号)?[\s:：]*(\d+)|ID[\s:：]*(\d+)|#(\d+)/,
    );
    if (bookmarkIdMatch) {
      bookmarkId = parseInt(
        bookmarkIdMatch[1] || bookmarkIdMatch[2] || bookmarkIdMatch[3],
        10,
      );
      source = "bookmark";
    }

    // 检查上下文参数
    const params = context.params as Record<string, unknown> | undefined;
    if (params?.bookmarkId) {
      bookmarkId = params.bookmarkId as number;
      source = "bookmark";
    }

    // 检查是否是主题搜索
    const topicPatterns = [
      /(?:关于|有关|相关|涉及)(.+?)(?:的|相关|内容|书签|收藏)/,
      /(.+?)(?:主题|领域|方向|技术)/,
      /查找(.+?)(?:相关|的)/,
    ];

    if (!bookmarkId) {
      for (const pattern of topicPatterns) {
        const match = userMessage.match(pattern);
        if (match?.[1]) {
          const extracted = match[1].trim();
          if (extracted.length >= 2 && extracted.length <= 30) {
            topic = extracted;
            source = "topic";
            break;
          }
        }
      }
    }

    // 如果既没有书签 ID 也没有主题，使用查询方式
    if (!bookmarkId && !topic) {
      query = userMessage;
      source = "query";
    }

    // 解析数量限制
    let limit = 20;
    const limitMatch = userMessage.match(/(\d+)\s*(?:个|条|篇)/);
    if (limitMatch) {
      const parsed = parseInt(limitMatch[1], 10);
      if (parsed >= 5 && parsed <= 50) {
        limit = parsed;
      }
    }

    // 解析是否需要解释
    const includeExplanation =
      messageLower.includes("解释") ||
      messageLower.includes("为什么") ||
      messageLower.includes("explain");

    // 解析是否需要聚类
    const groupByCluster =
      messageLower.includes("分类") ||
      messageLower.includes("聚类") ||
      messageLower.includes("分组") ||
      messageLower.includes("cluster");

    return {
      source,
      bookmarkId,
      topic,
      query,
      limit,
      minSimilarity: 0.5, // 使用较低的默认阈值以获得更多结果
      includeExplanation,
      groupByCluster,
    };
  }

  /**
   * 执行相关发现
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as RelatedDiscoveryInput;
    const supabase = await createClient();

    // 初始化进度
    this.initProgress(DISCOVERY_STEPS);

    try {
      // Step 1: 获取源信息和向量
      yield* this.reportProgress("获取向量", 0, "正在准备搜索源...");

      const sourceInfo = await this.getSourceInfo(
        input,
        context.userId,
        supabase,
      );
      const sourceBookmark = await this.getSourceBookmark(
        input,
        context.userId,
        supabase,
      );

      yield* this.emitText(
        `🔍 搜索源：${this.formatSourceDescription(sourceInfo)}\n`,
      );

      yield* this.reportProgress("获取向量", 20, "准备完成");

      // Step 2: 执行相似度搜索
      yield* this.reportProgress("相似搜索", 25, "正在搜索相关内容...");

      let relatedItems: RelatedItem[] = [];

      // 尝试向量搜索
      if (sourceBookmark?.embedding) {
        const vectorResults = await this.finder.findByVector(
          sourceBookmark.embedding,
          context.userId,
          {
            limit: input.limit,
            minSimilarity: input.minSimilarity,
            excludeIds: sourceBookmark ? [sourceBookmark.id] : [],
          },
          supabase,
        );

        if (vectorResults.length > 0) {
          yield* this.emitText(
            `📊 使用向量搜索找到 ${vectorResults.length} 篇相关内容\n`,
          );

          relatedItems = vectorResults.map((r) => ({
            bookmarkId: r.id,
            title: r.title,
            url: r.url,
            platform: r.platform,
            similarity: r.similarity,
            sharedTopics: [],
            aiTags: r.ai_tags,
            aiSummary: r.ai_summary,
          }));
        }
      }

      // 如果向量搜索无结果，使用标签匹配
      if (relatedItems.length === 0) {
        yield* this.emitText("📝 使用标签匹配搜索...\n");

        const candidates = await this.fetchCandidates(
          context.userId,
          input,
          supabase,
        );

        if (sourceBookmark) {
          relatedItems = this.finder.findByTags(sourceBookmark, candidates, {
            limit: input.limit,
            minSimilarity: input.minSimilarity,
            excludeIds: [sourceBookmark.id],
          });
        } else {
          // 基于查询/主题的搜索
          const searchTerm = input.topic || input.query || "";
          relatedItems = this.searchByTerm(
            searchTerm,
            candidates,
            input.limit,
            input.minSimilarity,
          );
        }
      }

      yield* this.emitText(`📚 找到 ${relatedItems.length} 篇相关内容\n`);

      yield* this.reportProgress(
        "相似搜索",
        50,
        `找到 ${relatedItems.length} 篇相关内容`,
      );

      if (relatedItems.length === 0) {
        yield* this.emitText(
          "💡 建议：尝试降低相似度阈值或使用更通用的搜索词\n",
        );

        // 返回空结果
        const emptyDeliverable = this.createDeliverable(
          "list",
          "相关内容发现",
          {
            source: sourceInfo,
            relatedItems: [],
            stats: this.finder.calculateStats([]),
            suggestions: ["未找到相关内容，请尝试其他搜索条件"],
          },
          "json",
        );
        yield* this.emitDeliverable(emptyDeliverable);
        yield* this.emitDone(true, "未找到相关内容");
        return;
      }

      // Step 3: 聚类分析
      let clusters: Cluster[] | undefined;
      if (input.groupByCluster) {
        yield* this.reportProgress("聚类分析", 55, "正在进行聚类分析...");

        clusters = this.finder.clusterItems(relatedItems);

        yield* this.emitText(`🗂️ 分为 ${clusters.length} 个主题聚类\n`);
      }

      yield* this.reportProgress("聚类分析", 70, "聚类分析完成");

      // Step 4: 生成解释
      if (input.includeExplanation) {
        yield* this.reportProgress("生成解释", 75, "正在生成相关性解释...");

        const sourceTitle =
          sourceBookmark?.title || input.topic || input.query || "";

        for (const item of relatedItems) {
          item.explanation = this.finder.generateExplanation(sourceTitle, item);
        }
      }

      yield* this.reportProgress("生成解释", 90, "解释生成完成");

      // Step 5: 生成报告
      yield* this.reportProgress("生成报告", 95, "正在生成发现报告...");

      const stats = this.finder.calculateStats(relatedItems);
      const suggestions = this.finder.generateSuggestions(
        stats,
        clusters || [],
      );

      // 生成知识图谱
      let knowledgeGraph;
      if (sourceBookmark) {
        knowledgeGraph = this.finder.generateKnowledgeGraph(
          sourceBookmark,
          relatedItems,
        );
      }

      // 输出统计摘要
      yield* this.emitText(this.formatStatsSummary(stats));

      // 输出建议
      if (suggestions.length > 0) {
        yield* this.emitText(
          "\n💡 建议：\n" +
            suggestions.map((s) => `  • ${s}`).join("\n") +
            "\n",
        );
      }

      yield* this.reportProgress("生成报告", 100, "发现报告生成完成！");

      // 输出交付物
      const output: RelatedDiscoveryOutput = {
        source: sourceInfo,
        relatedItems,
        clusters,
        knowledgeGraph,
        stats,
        suggestions,
      };

      const deliverable = this.createDeliverable(
        "graph",
        "相关内容发现",
        output,
        "json",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            generatedAt: new Date().toISOString(),
            executionTimeMs: Date.now() - startTime,
          },
        },
      );
      yield* this.emitDeliverable(deliverable);

      // 输出后续建议
      yield* this.emitSuggestions([
        {
          text: "查看详情",
          action: "view_related",
          params: { items: relatedItems.slice(0, 5).map((i) => i.bookmarkId) },
        },
        {
          text: "导出关系图",
          action: "export_graph",
          params: { format: "json" },
        },
      ]);

      yield* this.emitDone(true, `发现 ${relatedItems.length} 篇相关内容`);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          source: input.source,
          foundCount: relatedItems.length,
          clusterCount: clusters?.length,
          executionTimeMs: Date.now() - startTime,
        },
        "RelatedDiscoverySkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          error: error instanceof Error ? error.message : String(error),
        },
        "RelatedDiscoverySkill: Execution failed",
      );

      yield* this.emitError(
        `搜索失败：${error instanceof Error ? error.message : "未知错误"}`,
        "EXECUTION_ERROR",
        true,
      );

      throw error;
    }
  }

  /**
   * 获取源信息
   */
  private async getSourceInfo(
    input: RelatedDiscoveryInput,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
  ): Promise<SourceInfo> {
    const sourceInfo: SourceInfo = {
      type: input.source,
    };

    if (input.source === "bookmark" && input.bookmarkId) {
      const { data } = await supabase
        .from("bookmarks")
        .select("id, title, url")
        .eq("id", input.bookmarkId)
        .eq("user_id", userId)
        .single();

      if (data) {
        sourceInfo.bookmark = {
          id: data.id,
          title: data.title,
          url: data.url,
        };
      }
    } else if (input.source === "topic") {
      sourceInfo.topic = input.topic;
    } else {
      sourceInfo.query = input.query;
    }

    return sourceInfo;
  }

  /**
   * 获取源书签
   */
  private async getSourceBookmark(
    input: RelatedDiscoveryInput,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
  ): Promise<BookmarkForDiscovery | null> {
    if (input.source === "bookmark" && input.bookmarkId) {
      const { data } = await supabase
        .from("bookmarks")
        .select("id, title, url, platform, ai_tags, ai_summary, embedding")
        .eq("id", input.bookmarkId)
        .eq("user_id", userId)
        .single();

      return data;
    }

    return null;
  }

  /**
   * 获取候选书签
   */
  private async fetchCandidates(
    userId: string,
    input: RelatedDiscoveryInput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
  ): Promise<BookmarkForDiscovery[]> {
    let query = supabase
      .from("bookmarks")
      .select("id, title, url, platform, ai_tags, ai_summary, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null);

    // 如果有主题，尝试过滤
    if (input.topic) {
      query = query.or(
        `title.ilike.%${input.topic}%,ai_tags.cs.{${input.topic}}`,
      );
    }

    query = query.order("created_at", { ascending: false }).limit(200);

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error: error.message },
        "RelatedDiscoverySkill: Failed to fetch candidates",
      );
      return [];
    }

    return data || [];
  }

  /**
   * 基于搜索词搜索
   */
  private searchByTerm(
    term: string,
    candidates: BookmarkForDiscovery[],
    limit: number,
    minSimilarity: number,
  ): RelatedItem[] {
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/\s+/);

    const results: RelatedItem[] = [];

    for (const candidate of candidates) {
      let score = 0;
      const maxScore = 3;

      // 标题匹配
      const titleLower = candidate.title.toLowerCase();
      for (const word of termWords) {
        if (titleLower.includes(word)) {
          score += 1;
        }
      }

      // 标签匹配
      if (candidate.ai_tags) {
        for (const tag of candidate.ai_tags) {
          const tagLower = tag.toLowerCase();
          for (const word of termWords) {
            if (tagLower.includes(word)) {
              score += 1;
              break;
            }
          }
        }
      }

      // 摘要匹配
      if (candidate.ai_summary) {
        const summaryLower = candidate.ai_summary.toLowerCase();
        for (const word of termWords) {
          if (summaryLower.includes(word)) {
            score += 0.5;
          }
        }
      }

      const similarity = Math.min(score / maxScore, 1);

      if (similarity >= minSimilarity) {
        results.push({
          bookmarkId: candidate.id,
          title: candidate.title,
          url: candidate.url,
          platform: candidate.platform || "unknown",
          similarity,
          sharedTopics:
            candidate.ai_tags?.filter((tag) =>
              termWords.some((word) => tag.toLowerCase().includes(word)),
            ) || [],
          aiTags: candidate.ai_tags,
          aiSummary: candidate.ai_summary,
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * 格式化源描述
   */
  private formatSourceDescription(source: SourceInfo): string {
    switch (source.type) {
      case "bookmark":
        return `书签「${source.bookmark?.title || "未知"}」`;
      case "topic":
        return `主题「${source.topic}」`;
      case "query":
        return `查询「${source.query}」`;
      default:
        return "未知来源";
    }
  }

  /**
   * 格式化统计摘要
   */
  private formatStatsSummary(stats: DiscoveryStats): string {
    const parts: string[] = [];

    parts.push(`\n📊 发现统计：`);
    parts.push(`  • 总计 ${stats.totalFound} 篇相关内容`);
    parts.push(`  • 平均相似度：${(stats.avgSimilarity * 100).toFixed(1)}%`);

    if (stats.topicsDiscovered.length > 0) {
      parts.push(
        `  • 涉及主题：${stats.topicsDiscovered.slice(0, 5).join("、")}${
          stats.topicsDiscovered.length > 5
            ? `等 ${stats.topicsDiscovered.length} 个`
            : ""
        }`,
      );
    }

    const platforms = Object.entries(stats.platformDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    if (platforms.length > 0) {
      parts.push(
        `  • 主要来源：${platforms.map(([p, c]) => `${p}(${c})`).join("、")}`,
      );
    }

    return parts.join("\n");
  }
}

/**
 * 默认实例
 */
export const relatedDiscoverySkill = new RelatedDiscoverySkill();
