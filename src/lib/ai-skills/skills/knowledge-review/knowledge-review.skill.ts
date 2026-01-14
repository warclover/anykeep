/**
 * KnowledgeReviewSkill - 知识复习 Skill
 *
 * 功能：
 * - 分析用户收藏的时间分布
 * - 基于艾宾浩斯遗忘曲线生成复习计划
 * - 输出结构化复习清单交付物
 *
 * 执行流程：
 * 1. 解析用户输入的复习需求
 * 2. 查询用户收藏数据
 * 3. 分析复习优先级
 * 4. 生成复习计划
 * 5. 输出交付物
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  KnowledgeReviewInput,
  KnowledgeReviewOutput,
  ReviewBookmark,
  ReviewGroup,
  ReviewStats,
  ReviewPriority,
  ReviewTimeRange,
  ReviewMode,
} from "./types";
import { EBBINGHAUS_INTERVALS } from "./types";

// ============================================
// Schema 定义
// ============================================

const KnowledgeReviewInputSchema = z.object({
  timeRange: z
    .enum(["week", "month", "quarter", "all"])
    .default("month")
    .describe("复习时间范围"),
  mode: z
    .enum(["spaced", "sequential", "random"])
    .default("spaced")
    .describe("复习模式：spaced-间隔重复，sequential-顺序，random-随机"),
  limit: z
    .number()
    .int()
    .min(5)
    .max(100)
    .default(30)
    .describe("最大复习项数量"),
  folderId: z.number().int().positive().optional().describe("筛选文件夹ID"),
  tags: z.array(z.string()).optional().describe("筛选标签"),
  includeReviewed: z.boolean().default(false).describe("是否包含已复习内容"),
});

const KnowledgeReviewOutputSchema = z.object({
  stats: z.object({
    totalBookmarks: z.number(),
    needsReviewCount: z.number(),
    todayCount: z.number(),
    weekCount: z.number(),
    byPriority: z.object({
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    }),
    byPlatform: z.record(z.string(), z.number()),
    avgReviewInterval: z.number(),
  }),
  groups: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      items: z.array(z.any()),
      priority: z.enum(["high", "medium", "low"]),
      suggestedTime: z.string(),
    }),
  ),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const REVIEW_STEPS = [
  {
    id: "analyze",
    name: "分析收藏",
    description: "分析收藏数据分布",
    weight: 20,
  },
  {
    id: "calculate",
    name: "计算优先级",
    description: "计算复习优先级",
    weight: 30,
  },
  { id: "group", name: "生成分组", description: "按主题分组内容", weight: 20 },
  { id: "generate", name: "生成计划", description: "生成复习计划", weight: 20 },
  {
    id: "deliver",
    name: "输出交付物",
    description: "输出复习清单",
    weight: 10,
  },
];

// ============================================
// KnowledgeReviewSkill 实现
// ============================================

export class KnowledgeReviewSkill extends OrchestrationSkill<
  KnowledgeReviewInput,
  KnowledgeReviewOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "knowledge_review",
    name: "知识复习助手",
    description:
      "基于艾宾浩斯遗忘曲线分析您的收藏内容，生成科学的复习计划，帮助您更好地记忆和掌握知识。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "ebbinghaus-analysis",
      "priority-ranking",
      "grouped-review",
      "progress-tracking",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: REVIEW_STEPS,
  };

  readonly inputSchema = KnowledgeReviewInputSchema;
  readonly outputSchema = KnowledgeReviewOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<KnowledgeReviewInput> {
    // 解析时间范围
    let timeRange: ReviewTimeRange = "month";
    if (/最近一周|这周|本周|一周/.test(message)) {
      timeRange = "week";
    } else if (/最近三个月|三个月|季度/.test(message)) {
      timeRange = "quarter";
    } else if (/全部|所有|所有收藏/.test(message)) {
      timeRange = "all";
    }

    // 解析复习模式
    let mode: ReviewMode = "spaced";
    if (/顺序|按时间|从头/.test(message)) {
      mode = "sequential";
    } else if (/随机|打乱/.test(message)) {
      mode = "random";
    }

    // 解析数量限制
    let limit = 30;
    const limitMatch = message.match(/(\d+)\s*[条个篇]/);
    if (limitMatch) {
      limit = Math.min(100, Math.max(5, parseInt(limitMatch[1], 10)));
    }

    return {
      timeRange,
      mode,
      limit,
      includeReviewed: false,
    };
  }

  /**
   * 流式执行复习计划生成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as KnowledgeReviewInput;

    // 初始化进度
    this.initProgress(REVIEW_STEPS);

    try {
      // Step 1: 分析收藏数据
      yield* this.reportProgress("分析收藏", 5, "正在分析您的收藏数据...");
      yield* this.emitText("📚 正在分析您的收藏数据，请稍候...\n\n");

      const bookmarks = await this.fetchBookmarks(context.userId, input);

      yield* this.reportProgress(
        "分析收藏",
        20,
        `找到 ${bookmarks.length} 条收藏`,
      );
      yield* this.emitText(`找到 **${bookmarks.length}** 条收藏记录。\n\n`);

      if (bookmarks.length === 0) {
        yield* this.emitText("您还没有收藏内容，快去收藏一些文章吧！");
        yield* this.emitDone(true, "没有找到需要复习的内容");
        return;
      }

      // Step 2: 计算复习优先级
      yield* this.reportProgress("计算优先级", 30, "正在计算复习优先级...");
      yield* this.emitText("🎯 正在基于艾宾浩斯遗忘曲线计算复习优先级...\n\n");

      const reviewItems = this.calculateReviewPriority(bookmarks);

      yield* this.reportProgress("计算优先级", 50, "优先级计算完成");

      // Step 3: 生成分组
      yield* this.reportProgress("生成分组", 55, "正在按主题分组...");

      const groups = this.groupByPriority(reviewItems, input.mode);

      yield* this.reportProgress("生成分组", 70, "分组完成");

      // Step 4: 生成统计和计划
      yield* this.reportProgress("生成计划", 75, "正在生成复习计划...");

      const stats = this.calculateStats(bookmarks, reviewItems);
      const summary = this.generateSummary(stats, groups);
      const suggestions = this.generateSuggestions(stats, groups);

      yield* this.reportProgress("生成计划", 90, "复习计划生成完成");

      // 构建输出
      const output: KnowledgeReviewOutput = {
        stats,
        groups,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出文本摘要
      yield* this.emitText(`## 📋 复习计划摘要\n\n${summary}\n\n`);

      // 输出各分组
      for (const group of groups) {
        yield* this.emitText(
          `### ${this.getPriorityEmoji(group.priority)} ${group.name}\n`,
        );
        yield* this.emitText(`*${group.description}*\n\n`);

        for (const item of group.items.slice(0, 5)) {
          yield* this.emitText(
            `- **${item.title}** (${item.daysSinceCreated}天前)\n  ${item.reviewReason}\n`,
          );
        }

        if (group.items.length > 5) {
          yield* this.emitText(`\n*...还有 ${group.items.length - 5} 条*\n\n`);
        }
      }

      // Step 5: 输出交付物
      yield* this.reportProgress("输出交付物", 95, "正在生成复习清单...");

      const deliverable = this.createDeliverable(
        "report",
        "知识复习计划",
        output,
        "markdown",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            totalItems: reviewItems.length,
            generatedAt: output.generatedAt,
            timeRange: input.timeRange,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      yield* this.emitSuggestions(
        suggestions.map((s, i) => ({
          text: `建议 ${i + 1}`,
          action: "review",
          params: { suggestion: s },
          icon: "💡",
        })),
      );

      yield* this.reportProgress("完成", 100, "复习计划已生成");
      yield* this.emitDone(
        true,
        `已为您生成包含 ${reviewItems.length} 项的复习计划`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          totalBookmarks: bookmarks.length,
          reviewItems: reviewItems.length,
          durationMs: Date.now() - startTime,
        },
        "KnowledgeReviewSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "KnowledgeReviewSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "复习计划生成失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "复习计划生成失败");
    }
  }

  /**
   * 获取用户收藏数据
   */
  private async fetchBookmarks(
    userId: string,
    input: KnowledgeReviewInput,
  ): Promise<BookmarkRow[]> {
    const supabase = await createClient();

    // 计算时间范围
    const now = new Date();
    let startDate: Date | null = null;

    switch (input.timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        startDate = null;
        break;
    }

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        ai_summary,
        ai_tags,
        user_tags,
        platform,
        folder_id,
        created_at,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(input.limit * 3); // 多获取一些以便筛选

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    if (input.folderId) {
      query = query.eq("folder_id", input.folderId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error },
        "KnowledgeReviewSkill: Failed to fetch bookmarks",
      );
      throw new Error(`获取收藏数据失败: ${error.message}`);
    }

    // 标签筛选
    let bookmarks = (data || []) as BookmarkRow[];
    if (input.tags && input.tags.length > 0) {
      const tagsLower = input.tags.map((t) => t.toLowerCase());
      bookmarks = bookmarks.filter((b) => {
        const allTags = [...(b.ai_tags || []), ...(b.user_tags || [])];
        return allTags.some((t) => tagsLower.includes(t.toLowerCase()));
      });
    }

    return bookmarks;
  }

  /**
   * 计算复习优先级
   */
  private calculateReviewPriority(bookmarks: BookmarkRow[]): ReviewBookmark[] {
    const now = Date.now();

    return bookmarks.map((bookmark) => {
      const createdAt = new Date(bookmark.created_at || Date.now()).getTime();
      const daysSinceCreated = Math.floor(
        (now - createdAt) / (24 * 60 * 60 * 1000),
      );

      // 找到下一个艾宾浩斯间隔
      const nextInterval =
        EBBINGHAUS_INTERVALS.find((interval) => interval > daysSinceCreated) ||
        EBBINGHAUS_INTERVALS[EBBINGHAUS_INTERVALS.length - 1];

      // 计算优先级
      const priority = this.calculatePriority(daysSinceCreated, nextInterval);

      // 生成复习原因
      const reviewReason = this.generateReviewReason(
        daysSinceCreated,
        nextInterval,
        priority,
      );

      // 处理 folders 可能是数组或对象的情况
      const folder = Array.isArray(bookmark.folders)
        ? bookmark.folders[0]
        : bookmark.folders;

      return {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        aiSummary: bookmark.ai_summary,
        tags: [...(bookmark.ai_tags || []), ...(bookmark.user_tags || [])],
        platform: bookmark.platform,
        folderName: folder?.name || null,
        createdAt: bookmark.created_at || new Date().toISOString(),
        daysSinceCreated,
        priority,
        reviewReason,
        nextInterval,
      };
    });
  }

  /**
   * 计算优先级
   */
  private calculatePriority(
    daysSinceCreated: number,
    nextInterval: number,
  ): ReviewPriority {
    // 接近或超过下一个复习间隔的内容优先级最高
    const urgency = daysSinceCreated / nextInterval;

    if (urgency >= 0.9) {
      return "high";
    } else if (urgency >= 0.6) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * 生成复习原因
   */
  private generateReviewReason(
    daysSinceCreated: number,
    nextInterval: number,
    priority: ReviewPriority,
  ): string {
    if (priority === "high") {
      if (daysSinceCreated >= nextInterval) {
        return `已超过 ${nextInterval} 天复习间隔，建议立即复习`;
      }
      return `距离 ${nextInterval} 天复习点仅剩 ${nextInterval - daysSinceCreated} 天`;
    } else if (priority === "medium") {
      return `收藏于 ${daysSinceCreated} 天前，即将进入 ${nextInterval} 天复习窗口`;
    } else {
      return `收藏于 ${daysSinceCreated} 天前，可以适当巩固`;
    }
  }

  /**
   * 按优先级分组
   */
  private groupByPriority(
    items: ReviewBookmark[],
    mode: ReviewMode,
  ): ReviewGroup[] {
    // 按优先级分组
    const highPriority = items.filter((i) => i.priority === "high");
    const mediumPriority = items.filter((i) => i.priority === "medium");
    const lowPriority = items.filter((i) => i.priority === "low");

    // 根据模式排序
    const sortItems = (list: ReviewBookmark[]) => {
      switch (mode) {
        case "sequential":
          return list.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        case "random":
          return list.sort(() => Math.random() - 0.5);
        case "spaced":
        default:
          return list.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
      }
    };

    const groups: ReviewGroup[] = [];

    if (highPriority.length > 0) {
      groups.push({
        name: "🔴 紧急复习",
        description: "这些内容已接近或超过最佳复习时间，建议优先复习以防遗忘。",
        items: sortItems(highPriority),
        priority: "high",
        suggestedTime: "今天",
      });
    }

    if (mediumPriority.length > 0) {
      groups.push({
        name: "🟡 本周复习",
        description: "这些内容即将进入复习窗口，建议本周内完成复习。",
        items: sortItems(mediumPriority),
        priority: "medium",
        suggestedTime: "本周内",
      });
    }

    if (lowPriority.length > 0) {
      groups.push({
        name: "🟢 巩固内容",
        description: "这些内容收藏时间较短，可以适当巩固加深印象。",
        items: sortItems(lowPriority),
        priority: "low",
        suggestedTime: "有空时",
      });
    }

    return groups;
  }

  /**
   * 计算统计数据
   */
  private calculateStats(
    allBookmarks: BookmarkRow[],
    reviewItems: ReviewBookmark[],
  ): ReviewStats {
    const byPriority = {
      high: reviewItems.filter((i) => i.priority === "high").length,
      medium: reviewItems.filter((i) => i.priority === "medium").length,
      low: reviewItems.filter((i) => i.priority === "low").length,
    };

    const byPlatform: Record<string, number> = {};
    for (const item of reviewItems) {
      byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;
    }

    const avgReviewInterval =
      reviewItems.length > 0
        ? Math.round(
            reviewItems.reduce((sum, i) => sum + i.nextInterval, 0) /
              reviewItems.length,
          )
        : 0;

    return {
      totalBookmarks: allBookmarks.length,
      needsReviewCount: reviewItems.length,
      todayCount: byPriority.high,
      weekCount: byPriority.high + byPriority.medium,
      byPriority,
      byPlatform,
      avgReviewInterval,
    };
  }

  /**
   * 生成摘要
   */
  private generateSummary(stats: ReviewStats, _groups: ReviewGroup[]): string {
    const lines: string[] = [];

    lines.push(
      `在您的 **${stats.totalBookmarks}** 条收藏中，共有 **${stats.needsReviewCount}** 条需要复习。`,
    );
    lines.push("");

    if (stats.todayCount > 0) {
      lines.push(`- 🔴 今日需复习：**${stats.todayCount}** 条（紧急）`);
    }
    if (stats.weekCount - stats.todayCount > 0) {
      lines.push(
        `- 🟡 本周需复习：**${stats.weekCount - stats.todayCount}** 条`,
      );
    }
    if (stats.needsReviewCount - stats.weekCount > 0) {
      lines.push(
        `- 🟢 可适当巩固：**${stats.needsReviewCount - stats.weekCount}** 条`,
      );
    }

    lines.push("");
    lines.push(`平均复习间隔：**${stats.avgReviewInterval}** 天`);

    return lines.join("\n");
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    stats: ReviewStats,
    _groups: ReviewGroup[],
  ): string[] {
    const suggestions: string[] = [];

    if (stats.todayCount > 0) {
      suggestions.push(`今天优先复习 ${stats.todayCount} 条紧急内容`);
    }

    if (stats.todayCount > 10) {
      suggestions.push("内容较多，建议分批复习，每次 5-10 条效果更佳");
    }

    const platforms = Object.keys(stats.byPlatform);
    if (platforms.length > 1) {
      suggestions.push(
        `您的收藏来自 ${platforms.length} 个平台，可以按平台分别复习`,
      );
    }

    suggestions.push("复习时尝试回忆内容要点，效果比单纯浏览更好");

    if (stats.avgReviewInterval > 14) {
      suggestions.push("建议更频繁地收藏内容，保持知识新鲜度");
    }

    return suggestions;
  }

  /**
   * 获取优先级表情
   */
  private getPriorityEmoji(priority: ReviewPriority): string {
    switch (priority) {
      case "high":
        return "🔴";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
    }
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: KnowledgeReviewInput,
    context: SkillContext,
  ): Promise<KnowledgeReviewOutput> {
    // 创建编排上下文
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    // 收集结果
    let output: KnowledgeReviewOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as KnowledgeReviewOutput;
      }
    }

    if (!output) {
      throw new Error("复习计划生成失败");
    }

    return output;
  }
}

// ============================================
// 辅助类型
// ============================================

import type { BookmarkRow as BookmarkRowBase } from "@/types/domain";

/**
 * BookmarkRow 扩展（包含 folders 关联）
 */
interface BookmarkRow
  extends Pick<
    BookmarkRowBase,
    | "id"
    | "title"
    | "url"
    | "ai_summary"
    | "ai_tags"
    | "user_tags"
    | "platform"
    | "folder_id"
    | "created_at"
  > {
  folders?: Array<{ name: string }> | { name: string } | null;
}

// ============================================
// 导出
// ============================================

export const knowledgeReviewSkill = new KnowledgeReviewSkill();
