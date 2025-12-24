/**
 * PeriodicReportSkill - 周期报告编排 Skill
 *
 * 功能：
 * - 生成日报/周报/月报/季报
 * - 支持历史周期对比
 * - 提供图表数据
 * - 精选亮点推荐
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
  PeriodicReportInput,
  PeriodicReportOutput,
  PeriodStats,
  PeriodComparison,
  ChartData,
  ChartDataPoint,
  HighlightBookmark,
  PeriodInsight,
} from "./types";
import { PERIOD_CONFIG, DEFAULT_PERIODIC_REPORT_CONFIG } from "./types";

// ============================================
// Schema 定义
// ============================================

const PeriodicReportInputSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("weekly"),
  reportType: z
    .enum(["summary", "activity", "trends", "highlights"])
    .default("summary"),
  includeComparison: z.boolean().default(true),
  comparisonPeriods: z.number().min(1).max(4).default(1),
  includeChartData: z.boolean().default(true),
  filter: z
    .object({
      folderId: z.number().optional(),
      platforms: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

const PeriodicReportOutputSchema = z.object({
  title: z.string(),
  period: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  periodLabel: z.string(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  stats: z.any(),
  comparison: z.any().optional(),
  chartData: z.any().optional(),
  highlights: z.array(z.any()),
  insights: z.array(z.any()),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const REPORT_STEPS = [
  {
    id: "collect",
    name: "收集数据",
    description: "收集当前周期数据",
    weight: 20,
  },
  {
    id: "compare",
    name: "历史对比",
    description: "与上一周期对比",
    weight: 20,
  },
  { id: "analyze", name: "分析趋势", description: "分析数据趋势", weight: 20 },
  {
    id: "highlights",
    name: "精选亮点",
    description: "筛选亮点内容",
    weight: 20,
  },
  { id: "generate", name: "生成报告", description: "生成最终报告", weight: 20 },
];

// ============================================
// PeriodicReportSkill 实现
// ============================================

export class PeriodicReportSkill extends OrchestrationSkill<
  PeriodicReportInput,
  PeriodicReportOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "periodic_report",
    name: "周期报告助手",
    description:
      "自动生成日报、周报、月报或季报，包含收藏统计、历史对比、趋势分析和精选亮点，帮助您定期回顾知识积累。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "periodic-summary",
      "historical-comparison",
      "trend-charts",
      "highlight-selection",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["report", "graph"],
    outputFormats: ["markdown", "json"],
    steps: REPORT_STEPS,
  };

  readonly inputSchema = PeriodicReportInputSchema;
  readonly outputSchema = PeriodicReportOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<PeriodicReportInput> {
    const input: PeriodicReportInput = {
      ...DEFAULT_PERIODIC_REPORT_CONFIG,
    };

    // 解析周期
    if (/日报|今天|今日/.test(message)) {
      input.period = "daily";
    } else if (/周报|这周|本周|上周/.test(message)) {
      input.period = "weekly";
    } else if (/月报|这个月|本月|上月/.test(message)) {
      input.period = "monthly";
    } else if (/季报|季度|本季/.test(message)) {
      input.period = "quarterly";
    }

    // 解析报告类型
    if (/活跃|活动/.test(message)) {
      input.reportType = "activity";
    } else if (/趋势|变化/.test(message)) {
      input.reportType = "trends";
    } else if (/亮点|精选|推荐/.test(message)) {
      input.reportType = "highlights";
    }

    // 解析对比选项
    if (/不.*对比|无需对比/.test(message)) {
      input.includeComparison = false;
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
    const input = context.params as PeriodicReportInput;
    const periodConfig = PERIOD_CONFIG[input.period];

    // 初始化进度
    this.initProgress(REPORT_STEPS);

    try {
      // Step 1: 收集数据
      yield* this.reportProgress("收集数据", 5, "正在收集数据...");
      yield* this.emitText(
        `${periodConfig.icon} 正在生成${periodConfig.name}，请稍候...\n\n`,
      );

      const { currentPeriod, previousPeriod } = this.calculateDateRanges(
        input.period,
      );

      const currentBookmarks = await this.fetchBookmarks(
        context.userId,
        currentPeriod,
        input.filter,
      );

      yield* this.reportProgress(
        "收集数据",
        20,
        `收集到 ${currentBookmarks.length} 条收藏`,
      );

      if (currentBookmarks.length === 0) {
        yield* this.emitText("本周期内暂无收藏数据。\n\n");
        yield* this.emitDone(true, "没有找到收藏数据");
        return;
      }

      // Step 2: 历史对比
      let comparison: PeriodComparison | undefined;
      if (input.includeComparison) {
        yield* this.reportProgress("历史对比", 25, "正在获取历史数据...");

        const previousBookmarks = await this.fetchBookmarks(
          context.userId,
          previousPeriod,
          input.filter,
        );

        comparison = this.calculateComparison(
          currentBookmarks,
          previousBookmarks,
          currentPeriod,
          previousPeriod,
        );

        yield* this.reportProgress("历史对比", 40, "历史对比完成");
      }

      // Step 3: 分析趋势
      yield* this.reportProgress("分析趋势", 45, "正在分析趋势...");

      const stats = this.calculateStats(currentBookmarks, input.period);
      const chartData = input.includeChartData
        ? this.generateChartData(currentBookmarks, input.period)
        : undefined;

      yield* this.reportProgress("分析趋势", 60, "趋势分析完成");

      // Step 4: 精选亮点
      yield* this.reportProgress("精选亮点", 65, "正在筛选亮点...");

      const highlights = this.selectHighlights(currentBookmarks);

      yield* this.reportProgress("精选亮点", 80, "亮点筛选完成");

      // Step 5: 生成报告
      yield* this.reportProgress("生成报告", 85, "正在生成报告...");

      const insights = this.generateInsights(stats, comparison, highlights);
      const summary = this.generateSummary(stats, comparison, input.period);
      const suggestions = this.generateSuggestions(stats, insights);

      const output: PeriodicReportOutput = {
        title: `${periodConfig.name} - ${periodConfig.labelFormat(new Date())}`,
        period: input.period,
        periodLabel: periodConfig.labelFormat(new Date()),
        dateRange: currentPeriod,
        stats,
        comparison,
        chartData,
        highlights,
        insights,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      yield* this.reportProgress("生成报告", 95, "报告生成完成");

      // 输出报告内容
      yield* this.emitText(`## ${periodConfig.icon} ${output.title}\n\n`);
      yield* this.emitText(`${summary}\n\n`);

      // 统计概览
      yield* this.emitText(`### 📊 统计概览\n\n`);
      yield* this.emitText(`- 新增收藏: **${stats.newBookmarks}** 条\n`);
      yield* this.emitText(`- 活跃天数: **${stats.activeDays}** 天\n`);
      yield* this.emitText(
        `- 日均收藏: **${stats.dailyAverage.toFixed(1)}** 条\n`,
      );
      if (stats.mostActiveDay) {
        yield* this.emitText(`- 最活跃日: **${stats.mostActiveDay}**\n`);
      }
      yield* this.emitText("\n");

      // 历史对比
      if (comparison) {
        yield* this.emitText(`### 📈 与上期对比\n\n`);
        const trendIcon =
          comparison.bookmarksChange.trend === "up"
            ? "🔼"
            : comparison.bookmarksChange.trend === "down"
              ? "🔽"
              : "➡️";
        yield* this.emitText(
          `- 收藏变化: ${trendIcon} ${comparison.bookmarksChange.changeRate >= 0 ? "+" : ""}${comparison.bookmarksChange.changeRate.toFixed(0)}%\n`,
        );
        yield* this.emitText(
          `  (本期 ${comparison.bookmarksChange.current} 条 vs 上期 ${comparison.bookmarksChange.previous} 条)\n\n`,
        );
      }

      // 亮点推荐
      if (highlights.length > 0) {
        yield* this.emitText(`### ✨ 本期亮点\n\n`);
        for (const highlight of highlights.slice(0, 5)) {
          yield* this.emitText(`- **${highlight.title}**\n`);
          yield* this.emitText(`  ${highlight.reason}\n`);
        }
        yield* this.emitText("\n");
      }

      // 洞察建议
      if (insights.length > 0) {
        yield* this.emitText(`### 💡 洞察\n\n`);
        for (const insight of insights.slice(0, 4)) {
          yield* this.emitText(`${insight.icon} **${insight.title}**\n`);
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
            period: input.period,
            totalBookmarks: stats.newBookmarks,
            hasComparison: !!comparison,
            highlightsCount: highlights.length,
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
            action: "report",
            icon: "💡",
          })),
        );
      }

      yield* this.reportProgress("完成", 100, "报告生成完成");
      yield* this.emitDone(
        true,
        `已为您生成${periodConfig.name}，包含 ${highlights.length} 个亮点推荐`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          period: input.period,
          totalBookmarks: stats.newBookmarks,
          durationMs: Date.now() - startTime,
        },
        "PeriodicReportSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "PeriodicReportSkill: Execution failed",
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
   * 计算日期范围
   */
  private calculateDateRanges(period: PeriodicReportInput["period"]): {
    currentPeriod: { start: string; end: string };
    previousPeriod: { start: string; end: string };
  } {
    const now = new Date();
    const config = PERIOD_CONFIG[period];
    const dayMs = 24 * 60 * 60 * 1000;

    const currentEnd = now;
    const currentStart = new Date(now.getTime() - config.days * dayMs);

    const previousEnd = new Date(currentStart.getTime() - dayMs);
    const previousStart = new Date(previousEnd.getTime() - config.days * dayMs);

    return {
      currentPeriod: {
        start: currentStart.toISOString(),
        end: currentEnd.toISOString(),
      },
      previousPeriod: {
        start: previousStart.toISOString(),
        end: previousEnd.toISOString(),
      },
    };
  }

  /**
   * 获取收藏数据
   */
  private async fetchBookmarks(
    userId: string,
    dateRange: { start: string; end: string },
    filter?: PeriodicReportInput["filter"],
  ): Promise<BookmarkRow[]> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        platform,
        ai_tags,
        ai_summary,
        user_tags,
        rating,
        folder_id,
        created_at,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("created_at", dateRange.start)
      .lte("created_at", dateRange.end)
      .order("created_at", { ascending: false });

    if (filter?.folderId) {
      query = query.eq("folder_id", filter.folderId);
    }

    if (filter?.platforms?.length) {
      query = query.in("platform", filter.platforms);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "PeriodicReportSkill: Failed to fetch bookmarks");
      throw new Error(`获取收藏数据失败: ${error.message}`);
    }

    return (data || []) as BookmarkRow[];
  }

  /**
   * 计算统计数据
   */
  private calculateStats(
    bookmarks: BookmarkRow[],
    period: PeriodicReportInput["period"],
  ): PeriodStats {
    const periodDays = PERIOD_CONFIG[period].days;

    // 统计每天的收藏
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

    // 估算阅读时长（假设每条收藏平均阅读 5 分钟）
    const estimatedReadingTime = bookmarks.length * 5;

    return {
      newBookmarks: bookmarks.length,
      activeDays: dailyCounts.size,
      dailyAverage: bookmarks.length / periodDays,
      estimatedReadingTime,
      mostActiveDay,
      mostActiveHour,
    };
  }

  /**
   * 计算周期对比
   */
  private calculateComparison(
    current: BookmarkRow[],
    previous: BookmarkRow[],
    currentRange: { start: string; end: string },
    previousRange: { start: string; end: string },
  ): PeriodComparison {
    const currentCount = current.length;
    const previousCount = previous.length;

    const bookmarksChangeRate =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : currentCount > 0
          ? 100
          : 0;

    // 计算平台变化
    const currentPlatforms = new Map<string, number>();
    const previousPlatforms = new Map<string, number>();

    for (const b of current) {
      currentPlatforms.set(
        b.platform,
        (currentPlatforms.get(b.platform) || 0) + 1,
      );
    }
    for (const b of previous) {
      previousPlatforms.set(
        b.platform,
        (previousPlatforms.get(b.platform) || 0) + 1,
      );
    }

    const allPlatforms = new Set([
      ...currentPlatforms.keys(),
      ...previousPlatforms.keys(),
    ]);
    const platformChanges = Array.from(allPlatforms).map((platform) => {
      const curr = currentPlatforms.get(platform) || 0;
      const prev = previousPlatforms.get(platform) || 0;
      const changeRate =
        prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
      return { platform, current: curr, previous: prev, changeRate };
    });

    // 活跃度对比（基于不同日期的收藏数）
    const currentActiveDays = new Set(
      current.map((b) => new Date(b.created_at).toISOString().split("T")[0]),
    ).size;
    const previousActiveDays = new Set(
      previous.map((b) => new Date(b.created_at).toISOString().split("T")[0]),
    ).size;

    const activityChangeRate =
      previousActiveDays > 0
        ? ((currentActiveDays - previousActiveDays) / previousActiveDays) * 100
        : currentActiveDays > 0
          ? 100
          : 0;

    return {
      currentPeriod: `${new Date(currentRange.start).toLocaleDateString("zh-CN")} - ${new Date(currentRange.end).toLocaleDateString("zh-CN")}`,
      previousPeriod: `${new Date(previousRange.start).toLocaleDateString("zh-CN")} - ${new Date(previousRange.end).toLocaleDateString("zh-CN")}`,
      bookmarksChange: {
        current: currentCount,
        previous: previousCount,
        changeRate: bookmarksChangeRate,
        trend:
          bookmarksChangeRate > 5
            ? "up"
            : bookmarksChangeRate < -5
              ? "down"
              : "stable",
      },
      activityChange: {
        current: currentActiveDays,
        previous: previousActiveDays,
        changeRate: activityChangeRate,
        trend:
          activityChangeRate > 5
            ? "up"
            : activityChangeRate < -5
              ? "down"
              : "stable",
      },
      platformChanges: platformChanges.slice(0, 5),
    };
  }

  /**
   * 生成图表数据
   */
  private generateChartData(
    bookmarks: BookmarkRow[],
    _period: PeriodicReportInput["period"],
  ): ChartData {
    // 收藏趋势
    const trendData = new Map<string, number>();
    for (const b of bookmarks) {
      const date = new Date(b.created_at).toISOString().split("T")[0];
      trendData.set(date, (trendData.get(date) || 0) + 1);
    }

    const bookmarkTrend: ChartDataPoint[] = Array.from(trendData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    // 平台分布
    const platformData = new Map<string, number>();
    for (const b of bookmarks) {
      platformData.set(b.platform, (platformData.get(b.platform) || 0) + 1);
    }

    const platformDistribution: ChartDataPoint[] = Array.from(
      platformData.entries(),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    // 标签分布
    const tagData = new Map<string, number>();
    for (const b of bookmarks) {
      const tags = [...(b.user_tags || []), ...(b.ai_tags || [])];
      for (const tag of tags) {
        tagData.set(tag, (tagData.get(tag) || 0) + 1);
      }
    }

    const tagDistribution: ChartDataPoint[] = Array.from(tagData.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));

    // 时段分布
    const hourData = new Map<number, number>();
    for (const b of bookmarks) {
      const hour = new Date(b.created_at).getHours();
      hourData.set(hour, (hourData.get(hour) || 0) + 1);
    }

    const hourlyDistribution: ChartDataPoint[] = Array.from(hourData.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, value]) => ({
        label: `${hour}:00`,
        value,
      }));

    return {
      bookmarkTrend,
      platformDistribution,
      tagDistribution,
      hourlyDistribution,
    };
  }

  /**
   * 筛选亮点书签
   */
  private selectHighlights(bookmarks: BookmarkRow[]): HighlightBookmark[] {
    const highlights: HighlightBookmark[] = [];

    // 高评分书签
    const ratedBookmarks = bookmarks
      .filter((b) => b.rating !== null && b.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    for (const b of ratedBookmarks.slice(0, 3)) {
      highlights.push({
        id: b.id,
        title: b.title,
        url: b.url,
        platform: b.platform,
        summary: b.ai_summary || undefined,
        reason: `⭐ 高评分收藏 (${b.rating} 分)`,
        createdAt: b.created_at,
      });
    }

    // 有 AI 摘要的书签
    const summarizedBookmarks = bookmarks
      .filter((b) => b.ai_summary && !ratedBookmarks.includes(b))
      .slice(0, 2);

    for (const b of summarizedBookmarks) {
      highlights.push({
        id: b.id,
        title: b.title,
        url: b.url,
        platform: b.platform,
        summary: b.ai_summary || undefined,
        reason: "📝 AI 已生成摘要，值得回顾",
        createdAt: b.created_at,
      });
    }

    // 最新收藏
    if (highlights.length < 5 && bookmarks.length > 0) {
      const latest = bookmarks.find(
        (b) => !highlights.some((h) => h.id === b.id),
      );
      if (latest) {
        highlights.push({
          id: latest.id,
          title: latest.title,
          url: latest.url,
          platform: latest.platform,
          summary: latest.ai_summary || undefined,
          reason: "🆕 最新收藏",
          createdAt: latest.created_at,
        });
      }
    }

    return highlights;
  }

  /**
   * 生成洞察
   */
  private generateInsights(
    stats: PeriodStats,
    comparison: PeriodComparison | undefined,
    highlights: HighlightBookmark[],
  ): PeriodInsight[] {
    const insights: PeriodInsight[] = [];

    // 活跃度洞察
    if (stats.activeDays >= 5) {
      insights.push({
        type: "achievement",
        title: "活跃用户",
        description: `本周期内有 ${stats.activeDays} 天有收藏记录，保持活跃！`,
        icon: "🏆",
      });
    }

    // 对比洞察
    if (comparison) {
      if (comparison.bookmarksChange.trend === "up") {
        insights.push({
          type: "trend",
          title: "收藏量增长",
          description: `相比上期，收藏量增长了 ${comparison.bookmarksChange.changeRate.toFixed(0)}%`,
          icon: "📈",
        });
      } else if (comparison.bookmarksChange.trend === "down") {
        insights.push({
          type: "suggestion",
          title: "收藏量下降",
          description: `相比上期，收藏量减少了 ${Math.abs(comparison.bookmarksChange.changeRate).toFixed(0)}%，可以多关注感兴趣的内容`,
          icon: "📉",
        });
      }
    }

    // 里程碑洞察
    if (stats.newBookmarks >= 50) {
      insights.push({
        type: "milestone",
        title: "收藏达人",
        description: `本周期收藏了 ${stats.newBookmarks} 条内容，是一位勤奋的知识收藏者！`,
        icon: "🎯",
      });
    }

    // 亮点洞察
    if (highlights.length > 0) {
      insights.push({
        type: "suggestion",
        title: "值得回顾",
        description: `发现 ${highlights.length} 条值得回顾的亮点内容，抽空看看吧`,
        icon: "✨",
      });
    }

    return insights;
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    stats: PeriodStats,
    comparison: PeriodComparison | undefined,
    period: PeriodicReportInput["period"],
  ): string {
    const periodConfig = PERIOD_CONFIG[period];
    const lines: string[] = [];

    lines.push(
      `本${periodConfig.name.replace("报", "")}您共收藏了 **${stats.newBookmarks}** 条内容，`,
    );
    lines.push(`日均 **${stats.dailyAverage.toFixed(1)}** 条。`);

    if (stats.mostActiveDay) {
      lines.push(`最活跃的一天是 **${stats.mostActiveDay}**。`);
    }

    if (comparison) {
      const trend =
        comparison.bookmarksChange.trend === "up"
          ? "增长"
          : comparison.bookmarksChange.trend === "down"
            ? "下降"
            : "持平";
      lines.push(
        `与上期相比，收藏量${trend}了 ${Math.abs(comparison.bookmarksChange.changeRate).toFixed(0)}%。`,
      );
    }

    return lines.join("");
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    stats: PeriodStats,
    insights: PeriodInsight[],
  ): string[] {
    const suggestions: string[] = [];

    // 基于统计的建议
    if (stats.dailyAverage < 1) {
      suggestions.push("建议养成每日收藏的习惯，积少成多");
    }

    if (stats.activeDays < 3) {
      suggestions.push("本周期活跃天数较少，尝试每天花几分钟浏览感兴趣的内容");
    }

    // 基于洞察的建议
    for (const insight of insights) {
      if (insight.type === "suggestion") {
        suggestions.push(insight.description);
      }
    }

    // 默认建议
    if (suggestions.length === 0) {
      suggestions.push("继续保持良好的收藏习惯，定期回顾已收藏的内容");
    }

    return suggestions.slice(0, 3);
  }

  /**
   * 非流式执行
   */
  protected async executeInternal(
    input: PeriodicReportInput,
    context: SkillContext,
  ): Promise<PeriodicReportOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: PeriodicReportOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as PeriodicReportOutput;
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
  ai_summary: string | null;
  user_tags: string[] | null;
  rating: number | null;
  folder_id: number | null;
  created_at: string;
  folders?: Array<{ name: string }> | { name: string } | null;
}

// ============================================
// 导出
// ============================================

export const periodicReportSkill = new PeriodicReportSkill();
