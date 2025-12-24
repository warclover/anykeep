/**
 * InsightReportSkill - 洞察报告编排 Skill
 *
 * 功能：
 * - 分析用户收藏活动数据
 * - 生成使用洞察报告（收藏趋势、热门标签、平台分布等）
 * - 提供个性化建议
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
  InsightReportInput,
  InsightReportOutput,
  ReportType,
  ReportTimeRange,
  ActivityAnalysis,
  ContentAnalysis,
  TrendAnalysis,
  TrendDataPoint,
  DistributionItem,
  TopItem,
  Insight,
} from "./types";
import { REPORT_TYPE_CONFIG, DEFAULT_REPORT_CONFIG } from "./types";

// ============================================
// Schema 定义
// ============================================

const InsightReportInputSchema = z.object({
  reportType: z
    .enum(["weekly", "monthly", "usage", "content", "trends"])
    .default("monthly")
    .describe("报告类型"),
  timeRange: z
    .enum(["week", "month", "quarter", "year", "all"])
    .default("month")
    .describe("时间范围"),
  includeDetails: z.boolean().default(true).describe("是否包含详细分析"),
  filter: z
    .object({
      folderId: z.number().optional(),
      tags: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
    })
    .optional()
    .describe("筛选条件"),
});

const InsightReportOutputSchema = z.object({
  title: z.string(),
  reportType: z.enum(["weekly", "monthly", "usage", "content", "trends"]),
  timeRangeDescription: z.string(),
  activity: z.any(),
  content: z.any(),
  trends: z.any(),
  insights: z.array(z.any()),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const REPORT_STEPS = [
  { id: "collect", name: "收集数据", description: "收集收藏数据", weight: 20 },
  {
    id: "analyze-activity",
    name: "活跃度分析",
    description: "分析收藏活跃度",
    weight: 20,
  },
  {
    id: "analyze-content",
    name: "内容分析",
    description: "分析内容分布",
    weight: 20,
  },
  {
    id: "analyze-trends",
    name: "趋势分析",
    description: "分析变化趋势",
    weight: 20,
  },
  {
    id: "generate-insights",
    name: "生成洞察",
    description: "生成洞察建议",
    weight: 20,
  },
];

// ============================================
// InsightReportSkill 实现
// ============================================

export class InsightReportSkill extends OrchestrationSkill<
  InsightReportInput,
  InsightReportOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "insight_report",
    name: "洞察报告助手",
    description:
      "分析您的收藏活动数据，生成个性化的使用洞察报告，包括收藏趋势、热门标签、平台分布等，帮助您更好地了解自己的知识管理习惯。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "activity-analysis",
      "content-analysis",
      "trend-analysis",
      "personalized-insights",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 20000,
    maxExecutionTimeMs: 90000,
    deliverableTypes: ["report", "graph"],
    outputFormats: ["markdown", "json"],
    steps: REPORT_STEPS,
  };

  readonly inputSchema = InsightReportInputSchema;
  readonly outputSchema = InsightReportOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<InsightReportInput> {
    const input: InsightReportInput = {
      reportType: DEFAULT_REPORT_CONFIG.reportType,
      timeRange: DEFAULT_REPORT_CONFIG.timeRange,
      includeDetails: DEFAULT_REPORT_CONFIG.includeDetails,
    };

    // 解析报告类型
    if (/周报|这周|本周|一周/.test(message)) {
      input.reportType = "weekly";
      input.timeRange = "week";
    } else if (/月报|月度|这个月|本月/.test(message)) {
      input.reportType = "monthly";
      input.timeRange = "month";
    } else if (/使用.*分析|习惯|模式/.test(message)) {
      input.reportType = "usage";
    } else if (/内容.*分析|分类.*分析/.test(message)) {
      input.reportType = "content";
    } else if (/趋势|变化|走势/.test(message)) {
      input.reportType = "trends";
    }

    // 解析时间范围
    if (/季度|三个月/.test(message)) {
      input.timeRange = "quarter";
    } else if (/年度|一年|全年/.test(message)) {
      input.timeRange = "year";
    } else if (/全部|所有|所有时间/.test(message)) {
      input.timeRange = "all";
    }

    return input;
  }

  /**
   * 流式执行报告生成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as InsightReportInput;

    // 初始化进度
    this.initProgress(REPORT_STEPS);

    try {
      const reportConfig = REPORT_TYPE_CONFIG[input.reportType];

      // Step 1: 收集数据
      yield* this.reportProgress("收集数据", 5, "正在收集收藏数据...");
      yield* this.emitText(
        `${reportConfig.icon} 正在生成${reportConfig.name}，请稍候...\n\n`,
      );

      const bookmarks = await this.fetchBookmarks(context.userId, input);

      yield* this.reportProgress(
        "收集数据",
        20,
        `收集到 ${bookmarks.length} 条收藏`,
      );
      yield* this.emitText(
        `📚 共收集到 **${bookmarks.length}** 条收藏数据。\n\n`,
      );

      if (bookmarks.length === 0) {
        yield* this.emitText("您在此时间范围内还没有收藏内容。");
        yield* this.emitDone(true, "没有找到收藏数据");
        return;
      }

      // Step 2: 活跃度分析
      yield* this.reportProgress("活跃度分析", 25, "正在分析收藏活跃度...");

      const activity = this.analyzeActivity(bookmarks, input);

      yield* this.reportProgress("活跃度分析", 40, "活跃度分析完成");

      // Step 3: 内容分析
      yield* this.reportProgress("内容分析", 45, "正在分析内容分布...");

      const content = this.analyzeContent(bookmarks);

      yield* this.reportProgress("内容分析", 60, "内容分析完成");

      // Step 4: 趋势分析
      yield* this.reportProgress("趋势分析", 65, "正在分析变化趋势...");

      const trends = this.analyzeTrends(bookmarks, input);

      yield* this.reportProgress("趋势分析", 80, "趋势分析完成");

      // Step 5: 生成洞察
      yield* this.reportProgress("生成洞察", 85, "正在生成洞察建议...");

      const insights = this.generateInsights(activity, content, trends);
      const summary = this.generateSummary(
        input.reportType,
        activity,
        content,
        trends,
      );
      const suggestions = this.generateSuggestions(activity, content, insights);

      yield* this.reportProgress("生成洞察", 95, "洞察生成完成");

      // 构建输出
      const output: InsightReportOutput = {
        title: `${reportConfig.name} - ${this.getTimeRangeDescription(input.timeRange)}`,
        reportType: input.reportType,
        timeRangeDescription: this.getTimeRangeDescription(input.timeRange),
        activity,
        content,
        trends,
        insights,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出报告内容
      yield* this.emitText(`## ${reportConfig.icon} ${output.title}\n\n`);
      yield* this.emitText(`${summary}\n\n`);

      // 活跃度概览
      yield* this.emitText(`### 📊 活跃度概览\n\n`);
      yield* this.emitText(`- 总收藏数: **${activity.totalBookmarks}**\n`);
      yield* this.emitText(`- 新增收藏: **${activity.newBookmarks}**\n`);
      yield* this.emitText(
        `- 日均收藏: **${activity.dailyAverage.toFixed(1)}** 条\n`,
      );
      yield* this.emitText(
        `- 最活跃日: **${activity.mostActiveDay || "暂无数据"}**\n`,
      );
      yield* this.emitText(`- 活跃天数: **${activity.activeDays}** 天\n\n`);

      // 内容分布
      if (content.byPlatform.length > 0) {
        yield* this.emitText(`### 🌐 平台分布\n\n`);
        for (const item of content.byPlatform.slice(0, 5)) {
          yield* this.emitText(
            `- **${item.name}**: ${item.count} 条 (${item.percentage.toFixed(1)}%)\n`,
          );
        }
        yield* this.emitText("\n");
      }

      // 热门标签
      if (content.topTags.length > 0) {
        yield* this.emitText(`### 🏷️ 热门标签\n\n`);
        for (const tag of content.topTags.slice(0, 8)) {
          yield* this.emitText(`- \`${tag.name}\`: ${tag.count} 次\n`);
        }
        yield* this.emitText("\n");
      }

      // 洞察建议
      if (insights.length > 0) {
        yield* this.emitText(`### 💡 洞察建议\n\n`);
        for (const insight of insights) {
          const icon =
            insight.type === "highlight"
              ? "✨"
              : insight.type === "warning"
                ? "⚠️"
                : "💡";
          yield* this.emitText(`${icon} **${insight.title}**\n`);
          yield* this.emitText(`   ${insight.description}\n\n`);
        }
      }

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        output.title,
        output,
        "markdown",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            reportType: input.reportType,
            timeRange: input.timeRange,
            totalBookmarks: activity.totalBookmarks,
            insightsCount: insights.length,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (suggestions.length > 0) {
        yield* this.emitSuggestions(
          suggestions.map((s, i) => ({
            text: s,
            label: `建议 ${i + 1}`,
            action: "insight",
            icon: "💡",
          })),
        );
      }

      yield* this.reportProgress("完成", 100, "报告生成完成");
      yield* this.emitDone(
        true,
        `已为您生成${reportConfig.name}，包含 ${insights.length} 条洞察建议`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          reportType: input.reportType,
          totalBookmarks: activity.totalBookmarks,
          insightsCount: insights.length,
          durationMs: Date.now() - startTime,
        },
        "InsightReportSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "InsightReportSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "报告生成失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "报告生成失败");
    }
  }

  /**
   * 获取时间范围描述
   */
  private getTimeRangeDescription(timeRange: ReportTimeRange): string {
    const now = new Date();
    switch (timeRange) {
      case "week": {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return `${weekAgo.toLocaleDateString("zh-CN")} - ${now.toLocaleDateString("zh-CN")}`;
      }
      case "month": {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return `${monthAgo.toLocaleDateString("zh-CN")} - ${now.toLocaleDateString("zh-CN")}`;
      }
      case "quarter": {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return `${quarterAgo.toLocaleDateString("zh-CN")} - ${now.toLocaleDateString("zh-CN")}`;
      }
      case "year": {
        return `${now.getFullYear()} 年度`;
      }
      case "all":
        return "全部时间";
    }
  }

  /**
   * 获取收藏数据
   */
  private async fetchBookmarks(
    userId: string,
    input: InsightReportInput,
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
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
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
        platform,
        ai_tags,
        user_tags,
        rating,
        folder_id,
        created_at,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    if (input.filter?.folderId) {
      query = query.eq("folder_id", input.filter.folderId);
    }

    if (input.filter?.platforms?.length) {
      query = query.in("platform", input.filter.platforms);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "InsightReportSkill: Failed to fetch bookmarks");
      throw new Error(`获取收藏数据失败: ${error.message}`);
    }

    return (data || []) as BookmarkRow[];
  }

  /**
   * 分析活跃度
   */
  private analyzeActivity(
    bookmarks: BookmarkRow[],
    input: InsightReportInput,
  ): ActivityAnalysis {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // 计算时间范围天数
    let rangeDays = 30;
    switch (input.timeRange) {
      case "week":
        rangeDays = 7;
        break;
      case "month":
        rangeDays = 30;
        break;
      case "quarter":
        rangeDays = 90;
        break;
      case "year":
        rangeDays = 365;
        break;
      case "all":
        rangeDays = Math.max(
          1,
          bookmarks.length > 0
            ? Math.ceil(
                (now -
                  new Date(
                    bookmarks[bookmarks.length - 1].created_at,
                  ).getTime()) /
                  dayMs,
              )
            : 1,
        );
        break;
    }

    // 统计每天的收藏数
    const dailyCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();

    for (const bookmark of bookmarks) {
      const date = new Date(bookmark.created_at);
      const dateKey = date.toISOString().split("T")[0];
      const hour = date.getHours();

      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // 找出最活跃的日期和时段
    let mostActiveDay = "";
    let maxDayCount = 0;
    for (const [day, count] of dailyCounts) {
      if (count > maxDayCount) {
        maxDayCount = count;
        mostActiveDay = day;
      }
    }

    let mostActiveHour = 0;
    let maxHourCount = 0;
    for (const [hour, count] of hourCounts) {
      if (count > maxHourCount) {
        maxHourCount = count;
        mostActiveHour = hour;
      }
    }

    return {
      totalBookmarks: bookmarks.length,
      newBookmarks: bookmarks.length,
      dailyAverage: bookmarks.length / rangeDays,
      mostActiveDay,
      mostActiveHour,
      activeDays: dailyCounts.size,
    };
  }

  /**
   * 分析内容分布
   */
  private analyzeContent(bookmarks: BookmarkRow[]): ContentAnalysis {
    const total = bookmarks.length;

    // 平台分布
    const platformCounts = new Map<string, number>();
    for (const b of bookmarks) {
      platformCounts.set(b.platform, (platformCounts.get(b.platform) || 0) + 1);
    }

    const byPlatform: DistributionItem[] = Array.from(platformCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // 文件夹分布
    const folderCounts = new Map<string, number>();
    for (const b of bookmarks) {
      const folderName = this.getFolderName(b) || "未分类";
      folderCounts.set(folderName, (folderCounts.get(folderName) || 0) + 1);
    }

    const byFolder: DistributionItem[] = Array.from(folderCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // 热门标签
    const tagCounts = new Map<string, number>();
    for (const b of bookmarks) {
      const tags = [...(b.user_tags || [])];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topTags: TopItem[] = Array.from(tagCounts.entries())
      .map(([name, count], index) => ({
        name,
        count,
        rank: index + 1,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // AI 标签分布
    const aiTagCounts = new Map<string, number>();
    for (const b of bookmarks) {
      const aiTags = b.ai_tags || [];
      for (const tag of aiTags) {
        aiTagCounts.set(tag, (aiTagCounts.get(tag) || 0) + 1);
      }
    }

    const topAiTags: TopItem[] = Array.from(aiTagCounts.entries())
      .map(([name, count], index) => ({
        name,
        count,
        rank: index + 1,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // 评分统计
    const ratedBookmarks = bookmarks.filter((b) => b.rating !== null);
    const ratedRate = ratedBookmarks.length / total;
    const averageRating =
      ratedBookmarks.length > 0
        ? ratedBookmarks.reduce((sum, b) => sum + (b.rating || 0), 0) /
          ratedBookmarks.length
        : null;

    return {
      byPlatform,
      byFolder,
      topTags,
      topAiTags,
      summaryRate: 0, // 需要 ai_summary 字段，暂时设为 0
      ratedRate,
      averageRating,
    };
  }

  /**
   * 获取文件夹名称
   */
  private getFolderName(bookmark: BookmarkRow): string | null {
    if (!bookmark.folders) return null;
    const folder = Array.isArray(bookmark.folders)
      ? bookmark.folders[0]
      : bookmark.folders;
    return folder?.name || null;
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(
    bookmarks: BookmarkRow[],
    input: InsightReportInput,
  ): TrendAnalysis {
    // 按时间粒度分组
    const granularity =
      input.timeRange === "week"
        ? "day"
        : input.timeRange === "month"
          ? "day"
          : "week";

    const trendData = new Map<string, number>();

    for (const b of bookmarks) {
      const date = new Date(b.created_at);
      let key: string;

      if (granularity === "day") {
        key = date.toISOString().split("T")[0];
      } else {
        // 按周分组
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      }

      trendData.set(key, (trendData.get(key) || 0) + 1);
    }

    // 转换为趋势数据点
    const bookmarkTrend: TrendDataPoint[] = Array.from(trendData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value], index, arr) => {
        const prevValue = index > 0 ? arr[index - 1][1] : value;
        const changeRate =
          prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
        return { label, value, changeRate };
      });

    // 平台趋势（简化实现）
    const platformTrend: Record<string, TrendDataPoint[]> = {};

    // 标签趋势（简化实现）
    const tagTrend = {
      rising: [] as TopItem[],
      declining: [] as TopItem[],
    };

    // 生成趋势摘要
    const totalChange =
      bookmarkTrend.length >= 2
        ? bookmarkTrend[bookmarkTrend.length - 1].value - bookmarkTrend[0].value
        : 0;

    const summary =
      totalChange > 0
        ? `收藏量呈上升趋势，期末比期初增加了 ${totalChange} 条`
        : totalChange < 0
          ? `收藏量有所下降，期末比期初减少了 ${Math.abs(totalChange)} 条`
          : "收藏量保持稳定";

    return {
      bookmarkTrend,
      platformTrend,
      tagTrend,
      summary,
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(
    activity: ActivityAnalysis,
    content: ContentAnalysis,
    trends: TrendAnalysis,
  ): Insight[] {
    const insights: Insight[] = [];

    // 活跃度洞察
    if (activity.dailyAverage >= 5) {
      insights.push({
        type: "highlight",
        title: "高活跃用户",
        description: `您日均收藏 ${activity.dailyAverage.toFixed(1)} 条内容，是一位活跃的知识收藏者！`,
        priority: "high",
      });
    } else if (activity.dailyAverage < 1 && activity.totalBookmarks > 0) {
      insights.push({
        type: "suggestion",
        title: "提升收藏频率",
        description:
          "您的收藏频率较低，建议养成每日收藏优质内容的习惯，积少成多。",
        priority: "medium",
      });
    }

    // 平台多样性
    if (content.byPlatform.length >= 5) {
      insights.push({
        type: "highlight",
        title: "多平台收藏",
        description: `您从 ${content.byPlatform.length} 个不同平台收藏内容，涉猎广泛！`,
        priority: "medium",
      });
    } else if (
      content.byPlatform.length === 1 &&
      activity.totalBookmarks > 10
    ) {
      insights.push({
        type: "suggestion",
        title: "扩展内容来源",
        description: `您的收藏主要来自 ${content.byPlatform[0].name}，可以尝试探索其他平台的优质内容。`,
        priority: "low",
      });
    }

    // 标签使用
    if (content.topTags.length === 0 && activity.totalBookmarks > 10) {
      insights.push({
        type: "warning",
        title: "建议添加标签",
        description: "您的收藏暂无标签，添加标签可以帮助更好地分类和检索内容。",
        priority: "high",
      });
    }

    // 评分使用
    if (content.ratedRate < 0.1 && activity.totalBookmarks > 10) {
      insights.push({
        type: "suggestion",
        title: "使用评分功能",
        description: "您很少为收藏评分，评分可以帮助区分内容的重要程度。",
        priority: "low",
      });
    }

    // 趋势洞察
    if (trends.bookmarkTrend.length >= 2) {
      const lastTrend = trends.bookmarkTrend[trends.bookmarkTrend.length - 1];
      if (lastTrend.changeRate && lastTrend.changeRate > 50) {
        insights.push({
          type: "highlight",
          title: "收藏活跃度提升",
          description: `最近的收藏量较之前增长了 ${lastTrend.changeRate.toFixed(0)}%，学习热情高涨！`,
          priority: "high",
        });
      }
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    reportType: ReportType,
    activity: ActivityAnalysis,
    content: ContentAnalysis,
    trends: TrendAnalysis,
  ): string {
    const lines: string[] = [];

    lines.push(
      `在此统计周期内，您共收藏了 **${activity.totalBookmarks}** 条内容，` +
        `日均 **${activity.dailyAverage.toFixed(1)}** 条。`,
    );

    if (content.byPlatform.length > 0) {
      const topPlatform = content.byPlatform[0];
      lines.push(
        `最常收藏的平台是 **${topPlatform.name}**（${topPlatform.percentage.toFixed(0)}%）。`,
      );
    }

    if (content.topTags.length > 0) {
      const topTag = content.topTags[0];
      lines.push(
        `最热门的标签是 **${topTag.name}**（出现 ${topTag.count} 次）。`,
      );
    }

    lines.push(trends.summary);

    return lines.join("");
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    activity: ActivityAnalysis,
    content: ContentAnalysis,
    insights: Insight[],
  ): string[] {
    const suggestions: string[] = [];

    // 基于洞察生成建议
    const warningInsights = insights.filter((i) => i.type === "warning");
    const suggestionInsights = insights.filter((i) => i.type === "suggestion");

    for (const insight of [...warningInsights, ...suggestionInsights].slice(
      0,
      2,
    )) {
      suggestions.push(insight.description);
    }

    // 通用建议
    if (activity.totalBookmarks > 50 && content.byFolder.length < 3) {
      suggestions.push("收藏数量较多，建议创建更多文件夹进行分类管理");
    }

    if (suggestions.length === 0) {
      suggestions.push("继续保持良好的收藏习惯，定期回顾收藏的内容");
    }

    return suggestions;
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: InsightReportInput,
    context: SkillContext,
  ): Promise<InsightReportOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: InsightReportOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as InsightReportOutput;
      }
    }

    if (!output) {
      throw new Error("报告生成失败");
    }

    return output;
  }
}

// ============================================
// 辅助类型
// ============================================

interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  platform: string;
  ai_tags: string[] | null;
  user_tags: string[] | null;
  rating: number | null;
  folder_id: number | null;
  created_at: string;
  folders?: Array<{ name: string }> | { name: string } | null;
}

// ============================================
// 导出
// ============================================

export const insightReportSkill = new InsightReportSkill();
