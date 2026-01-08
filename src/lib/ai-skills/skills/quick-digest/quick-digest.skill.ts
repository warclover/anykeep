/**
 * QuickDigestSkill - 快速摘要生成 Skill
 *
 * 功能：
 * - 批量收藏内容摘要生成
 * - 智能主题聚类
 * - 多种输出格式支持
 * - 阅读洞察分析
 *
 * 执行流程：
 * 1. 收集 - 根据范围获取书签
 * 2. 聚类 - 按主题/平台/日期分组
 * 3. 摘要 - 生成主题级摘要
 * 4. 格式化 - 转换为目标格式
 * 5. 输出 - 生成可下载交付物
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  QuickDigestInput,
  QuickDigestOutput,
  TopicGroup,
  DigestStats,
  DigestInsight,
} from "./types";
import { QUICK_DIGEST_CONFIG, DEFAULT_DIGEST_INPUT } from "./types";
import {
  TopicClusterer,
  groupByPlatform,
  groupByDate,
  groupByNone,
} from "./topic-clustering";
import {
  createFormatter,
  generateDigestTitle,
  generateInsights,
} from "./formatters";

// ============================================
// Schema 定义
// ============================================

const QuickDigestInputSchema = z.object({
  scope: z
    .enum(["today", "week", "month", "folder", "selected", "all"])
    .default("week")
    .describe("摘要范围"),
  folderId: z.number().int().positive().optional().describe("文件夹 ID"),
  bookmarkIds: z
    .array(z.number().int().positive())
    .max(100)
    .optional()
    .describe("书签 ID 列表"),
  outputFormat: z
    .enum(["markdown", "mindmap", "cards", "outline"])
    .default("markdown")
    .describe("输出格式"),
  groupBy: z
    .enum(["topic", "platform", "date", "none"])
    .default("topic")
    .describe("分组方式"),
  maxItems: z
    .number()
    .int()
    .min(QUICK_DIGEST_CONFIG.MIN_ITEMS)
    .max(QUICK_DIGEST_CONFIG.MAX_ITEMS)
    .default(QUICK_DIGEST_CONFIG.DEFAULT_MAX_ITEMS)
    .describe("最大条目数"),
  summaryLength: z
    .enum(["brief", "standard", "detailed"])
    .default("standard")
    .describe("摘要长度"),
  includeInsights: z.boolean().default(true).describe("是否包含洞察"),
});

const QuickDigestOutputSchema = z.object({
  stats: z.object({
    totalProcessed: z.number(),
    topicsIdentified: z.number(),
    platformDistribution: z.record(z.string(), z.number()),
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
    }),
  }),
  digest: z.object({
    title: z.string(),
    generatedAt: z.string(),
    format: z.enum(["markdown", "mindmap", "cards", "outline"]),
    content: z.string(),
  }),
  topics: z.array(z.any()),
  insights: z.array(z.any()).optional(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const DIGEST_STEPS = [
  {
    id: "collect",
    name: "收集数据",
    description: "获取收藏书签数据",
    weight: 15,
  },
  {
    id: "cluster",
    name: "主题聚类",
    description: "按主题对内容进行分组",
    weight: 25,
  },
  {
    id: "summarize",
    name: "生成摘要",
    description: "生成主题级别的摘要",
    weight: 30,
  },
  {
    id: "format",
    name: "格式化输出",
    description: "转换为目标输出格式",
    weight: 20,
  },
  {
    id: "deliver",
    name: "输出交付物",
    description: "生成可下载的摘要文件",
    weight: 10,
  },
];

// ============================================
// QuickDigestSkill 实现
// ============================================

export class QuickDigestSkill extends OrchestrationSkill<
  QuickDigestInput,
  QuickDigestOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "quick_digest",
    name: "快速摘要助手",
    description:
      "批量生成收藏内容的主题摘要，支持智能聚类和多种输出格式，帮助您快速回顾和整理知识。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "topic-clustering",
      "batch-summarization",
      "multi-format-output",
      "insight-generation",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 20000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["document", "report"],
    outputFormats: ["markdown", "mindmap", "cards", "plain"],
    steps: DIGEST_STEPS,
  };

  readonly inputSchema = QuickDigestInputSchema;
  readonly outputSchema = QuickDigestOutputSchema;

  // ============================================
  // 输入解析
  // ============================================

  async parseInput(
    userMessage: string,
    context: OrchestrationContext,
  ): Promise<QuickDigestInput> {
    const input: QuickDigestInput = {
      ...(DEFAULT_DIGEST_INPUT as QuickDigestInput),
    };

    // ============================================
    // 优先处理附件书签（用户显式选择的内容）
    // 附件书签具有最高优先级，覆盖所有其他范围设置
    // ============================================
    if (
      context.attachmentBookmarkIds &&
      context.attachmentBookmarkIds.length > 0
    ) {
      input.scope = "selected";
      input.bookmarkIds = context.attachmentBookmarkIds;

      logger.debug(
        {
          attachmentBookmarkIds: context.attachmentBookmarkIds,
          count: context.attachmentBookmarkIds.length,
        },
        "QuickDigestSkill: Using attachment bookmarks as primary scope",
      );

      // 附件模式下，不分组更合适（因为用户明确选择了这些书签）
      if (context.attachmentBookmarkIds.length <= 3) {
        input.groupBy = "none";
      }

      // 继续解析其他选项（格式、长度等），但 scope 已锁定
      this.parseFormatOptions(userMessage, input);
      return input;
    }

    // ============================================
    // 无附件时，解析用户消息确定范围
    // ============================================

    // 解析范围
    if (/今[天日]|today/i.test(userMessage)) {
      input.scope = "today";
    } else if (/本周|这周|week/i.test(userMessage)) {
      input.scope = "week";
    } else if (/本月|这月|month/i.test(userMessage)) {
      input.scope = "month";
    } else if (/全部|所有|all/i.test(userMessage)) {
      input.scope = "all";
    }

    // 解析其他格式选项
    this.parseFormatOptions(userMessage, input);

    // 使用上下文中的参数覆盖（兼容旧逻辑）
    const params = context.params as Record<string, unknown> | undefined;
    if (params?.folderId) {
      input.scope = "folder";
      input.folderId = Number(params.folderId);
    }

    if (params?.bookmarkIds) {
      input.scope = "selected";
      input.bookmarkIds = params.bookmarkIds as number[];
    }

    return input;
  }

  /**
   * 解析格式相关选项（输出格式、分组方式、摘要长度等）
   */
  private parseFormatOptions(
    userMessage: string,
    input: QuickDigestInput,
  ): void {
    // 解析输出格式
    if (/思维导图|mindmap|脑图/i.test(userMessage)) {
      input.outputFormat = "mindmap";
    } else if (/卡片|cards/i.test(userMessage)) {
      input.outputFormat = "cards";
    } else if (/大纲|outline/i.test(userMessage)) {
      input.outputFormat = "outline";
    }

    // 解析分组方式
    if (/按平台|platform/i.test(userMessage)) {
      input.groupBy = "platform";
    } else if (/按日期|按时间|date/i.test(userMessage)) {
      input.groupBy = "date";
    } else if (/不分组|none/i.test(userMessage)) {
      input.groupBy = "none";
    }

    // 解析摘要长度
    if (/简短|brief|简洁/i.test(userMessage)) {
      input.summaryLength = "brief";
    } else if (/详细|detailed|完整/i.test(userMessage)) {
      input.summaryLength = "detailed";
    }

    // 解析洞察选项
    if (/不要洞察|无洞察|no.*insight/i.test(userMessage)) {
      input.includeInsights = false;
    }
  }

  // ============================================
  // 主执行流程
  // ============================================

  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();

    // 初始化进度
    this.initProgress(DIGEST_STEPS);

    try {
      // 步骤 1: 收集数据
      yield* this.reportProgress("收集数据", 0, "正在收集收藏数据...");

      const input = context.params as QuickDigestInput;
      const bookmarks = await this.collectBookmarks(input, context.userId);

      if (bookmarks.length === 0) {
        yield* this.emitText(
          "未找到符合条件的收藏内容，请调整筛选条件后重试。",
        );
        yield* this.emitDone(false, "未找到收藏内容");
        return;
      }

      yield* this.reportProgress(
        "收集数据",
        15,
        `已收集 ${bookmarks.length} 条收藏`,
      );
      yield* this.emitText(
        `📚 找到 ${bookmarks.length} 条收藏内容，开始进行主题分析...\n`,
      );

      // 步骤 2: 主题聚类
      yield* this.reportProgress("主题聚类", 20, "正在进行主题聚类...");

      const topics = await this.clusterBookmarks(bookmarks, input.groupBy);

      yield* this.reportProgress(
        "主题聚类",
        40,
        `识别出 ${topics.length} 个主题`,
      );
      yield* this.emitText(`🎯 识别出 ${topics.length} 个主题分组\n`);

      // 输出主题列表
      const topTopics = topics.slice(0, 5);
      for (let index = 0; index < topTopics.length; index++) {
        const topic = topTopics[index];
        yield* this.emitText(
          `   ${index + 1}. ${topic.name} (${topic.count}篇)\n`,
        );
      }

      if (topics.length > 5) {
        yield* this.emitText(`   ... 还有 ${topics.length - 5} 个主题\n`);
      }

      // 步骤 3: 生成摘要
      yield* this.reportProgress("生成摘要", 45, "正在生成主题摘要...");

      const enrichedTopics = await this.generateTopicSummaries(
        topics,
        input.summaryLength,
      );

      yield* this.reportProgress("生成摘要", 70, "摘要生成完成");

      // 步骤 4: 格式化输出
      yield* this.reportProgress("格式化输出", 75, "正在格式化输出...");

      // 计算统计信息
      const stats = this.calculateStats(bookmarks, enrichedTopics);

      // 生成洞察
      let insights: DigestInsight[] | undefined;
      if (input.includeInsights) {
        insights = generateInsights(enrichedTopics, stats);
      }

      // 格式化内容
      const formatter = createFormatter(input.outputFormat);
      const title = generateDigestTitle(input.scope);
      const generatedAt = new Date().toISOString();

      const formattedContent = formatter.format(enrichedTopics, stats, {
        title,
        summaryLength: input.summaryLength,
        includeInsights: input.includeInsights,
        insights,
        generatedAt: new Date().toLocaleString("zh-CN"),
      });

      yield* this.reportProgress("格式化输出", 90, "格式化完成");

      // 步骤 5: 输出交付物
      yield* this.reportProgress("输出交付物", 95, "正在生成交付物...");

      // 构建输出
      const output: QuickDigestOutput = {
        stats,
        digest: {
          title,
          generatedAt: new Date().toLocaleString("zh-CN"),
          format: input.outputFormat,
          content: formattedContent,
        },
        topics: enrichedTopics,
        insights,
        suggestions: this.generateSuggestions(enrichedTopics, stats),
        generatedAt,
      };

      // 输出交付物 - 使用 createDeliverable 创建正确格式
      const outputFormat =
        input.outputFormat === "cards"
          ? "json"
          : input.outputFormat === "outline"
            ? "plain"
            : (input.outputFormat as
                | "markdown"
                | "mindmap"
                | "json"
                | "html"
                | "plain");

      const deliverable = this.createDeliverable(
        "document",
        title,
        formattedContent,
        outputFormat,
        {
          downloadable: true,
          metadata: {
            filename: this.generateFilename(input.scope, input.outputFormat),
            stats,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      yield* this.reportProgress("输出交付物", 100, "摘要生成完成");

      // 输出摘要信息
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      yield* this.emitText(`\n✅ 摘要生成完成！\n`);
      yield* this.emitText(
        `   📊 处理 ${stats.totalProcessed} 条收藏，识别 ${stats.topicsIdentified} 个主题\n`,
      );
      yield* this.emitText(`   ⏱️ 用时 ${duration} 秒\n`);

      if (insights && insights.length > 0) {
        yield* this.emitText(`\n💡 洞察：\n`);
        for (const insight of insights) {
          yield* this.emitText(`   - ${insight.content}\n`);
        }
      }

      // 输出建议
      yield* this.emitSuggestions(
        output.suggestions.map((s, i) => ({
          text: `建议 ${i + 1}`,
          action: "digest",
          icon: "💡",
          params: { suggestion: s },
        })),
      );

      yield* this.emitDone(
        true,
        `处理 ${stats.totalProcessed} 条收藏，生成 ${stats.topicsIdentified} 个主题摘要`,
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          context,
        },
        "QuickDigestSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "摘要生成失败，请稍后重试",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "摘要生成失败");
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 收集书签数据
   */
  private async collectBookmarks(
    input: QuickDigestInput,
    userId: string,
  ): Promise<
    Array<{
      id: number;
      title: string;
      url: string;
      ai_summary?: string | null;
      ai_tags?: string[] | null;
      platform?: string | null;
      created_at: string;
    }>
  > {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, ai_tags, platform, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(input.maxItems);

    // 根据范围添加筛选条件
    switch (input.scope) {
      case "today": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
        break;
      }
      case "week": {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
        break;
      }
      case "month": {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte("created_at", monthAgo.toISOString());
        break;
      }
      case "folder":
        if (input.folderId) {
          query = query.eq("folder_id", input.folderId);
        }
        break;
      case "selected":
        if (input.bookmarkIds && input.bookmarkIds.length > 0) {
          query = query.in("id", input.bookmarkIds);
        }
        break;
      // "all" 不需要额外筛选
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "QuickDigestSkill: Failed to fetch bookmarks");
      throw new Error("获取收藏数据失败");
    }

    // 过滤掉 created_at 为 null 的数据，并进行类型转换
    return (data || [])
      .filter(
        (item): item is typeof item & { created_at: string } =>
          item.created_at !== null,
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        ai_summary: item.ai_summary,
        ai_tags: item.ai_tags,
        platform: item.platform,
        created_at: item.created_at,
      }));
  }

  /**
   * 对书签进行聚类
   */
  private async clusterBookmarks(
    bookmarks: Array<{
      id: number;
      title: string;
      url: string;
      ai_summary?: string | null;
      ai_tags?: string[] | null;
      platform?: string | null;
      created_at: string;
    }>,
    groupBy: string,
  ): Promise<TopicGroup[]> {
    switch (groupBy) {
      case "topic": {
        const clusterer = new TopicClusterer();
        const topics = clusterer.cluster(bookmarks);
        // 如果聚类结果太少，把剩余的放入"其他"分组
        const clusteredIds = new Set(
          topics.flatMap((t) => t.bookmarks.map((b) => b.id)),
        );
        const unclustered = bookmarks.filter((b) => !clusteredIds.has(b.id));
        if (unclustered.length > 0) {
          topics.push({
            name: "其他",
            count: unclustered.length,
            keywords: [],
            bookmarks: unclustered.map((b) => ({
              id: b.id,
              title: b.title,
              summary: b.ai_summary || "",
              url: b.url,
              platform: b.platform || undefined,
              createdAt: b.created_at,
            })),
          });
        }
        return topics;
      }
      case "platform":
        return groupByPlatform(bookmarks);
      case "date":
        return groupByDate(bookmarks);
      case "none":
      default:
        return groupByNone(bookmarks);
    }
  }

  /**
   * 生成主题级摘要
   */
  private async generateTopicSummaries(
    topics: TopicGroup[],
    summaryLength: string,
  ): Promise<TopicGroup[]> {
    // 为每个主题生成摘要
    return topics.map((topic) => {
      if (topic.summary) {
        return topic;
      }

      // 聚合书签摘要
      const summaries = topic.bookmarks
        .map((b) => b.summary)
        .filter((s) => s && s.length > 0);

      if (summaries.length === 0) {
        return {
          ...topic,
          summary: `关于「${topic.name}」的 ${topic.count} 篇收藏内容`,
        };
      }

      // 简单聚合（后续可接入 LLM 进行智能总结）
      const maxLength =
        QUICK_DIGEST_CONFIG.SUMMARY_LENGTHS[
          summaryLength as keyof typeof QUICK_DIGEST_CONFIG.SUMMARY_LENGTHS
        ]?.topicSummaryChars || 400;

      const combined = summaries.slice(0, 3).join(" ");
      const summary =
        combined.length > maxLength
          ? combined.slice(0, maxLength - 3) + "..."
          : combined;

      return {
        ...topic,
        summary,
      };
    });
  }

  /**
   * 计算统计信息
   */
  private calculateStats(
    bookmarks: Array<{
      platform?: string | null;
      created_at: string;
    }>,
    topics: TopicGroup[],
  ): DigestStats {
    // 平台分布
    const platformDistribution: Record<string, number> = {};
    bookmarks.forEach((b) => {
      const platform = b.platform || "other";
      platformDistribution[platform] =
        (platformDistribution[platform] || 0) + 1;
    });

    // 日期范围
    const dates = bookmarks.map((b) => new Date(b.created_at).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return {
      totalProcessed: bookmarks.length,
      topicsIdentified: topics.length,
      platformDistribution,
      dateRange: {
        start: minDate.toLocaleDateString("zh-CN"),
        end: maxDate.toLocaleDateString("zh-CN"),
      },
    };
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    topics: TopicGroup[],
    stats: DigestStats,
  ): string[] {
    const suggestions: string[] = [];

    if (stats.totalProcessed < 10) {
      suggestions.push("收藏数量较少，建议持续积累更多内容");
    }

    if (topics.length === 1) {
      suggestions.push("内容较为集中，可以考虑拓展阅读范围");
    }

    if (topics.length > 8) {
      suggestions.push("主题较为分散，建议聚焦重点领域深入学习");
    }

    const topTopic = topics[0];
    if (topTopic && topTopic.count >= 5) {
      suggestions.push(
        `「${topTopic.name}」是您的主要关注领域，可以创建专题文件夹`,
      );
    }

    return suggestions;
  }

  /**
   * 生成文件名
   */
  private generateFilename(scope: string, format: string): string {
    const date = new Date().toISOString().split("T")[0];
    const extension = format === "cards" ? "json" : "md";
    return `digest-${scope}-${date}.${extension}`;
  }
}

// 导出单例实例
export const quickDigestSkill = new QuickDigestSkill();
