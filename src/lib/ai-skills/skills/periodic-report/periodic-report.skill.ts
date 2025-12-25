/**
 * PeriodicReportSkill - 周期报告编排 Skill (V1.1 协调器)
 *
 * 功能：
 * - 生成日报/周报/月报/季报
 * - 支持历史周期对比
 * - 提供图表数据
 * - 精选亮点推荐
 *
 * @version 1.1.0
 * @since 2025-12-24 - Initial implementation
 * @since 2025-12-25 - Refactored into coordinator pattern
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { logger } from "@/lib/logger";

// Schema 和步骤定义
import {
  PeriodicReportInputSchema,
  PeriodicReportOutputSchema,
  REPORT_STEPS,
} from "./schema";

// 类型定义
import type {
  PeriodicReportInput,
  PeriodicReportOutput,
  PeriodComparison,
} from "./types";
import { PERIOD_CONFIG, DEFAULT_PERIODIC_REPORT_CONFIG } from "./types";

// 子模块
import {
  calculateDateRanges,
  fetchBookmarks,
  calculateStats,
} from "./collectors";
import {
  calculateComparison,
  generateChartData,
  selectHighlights,
  generateInsights,
} from "./analyzers";
import { generateSummary, generateSuggestions } from "./formatters";

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
    version: "1.1.0",
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

    // 初��化进度
    this.initProgress(REPORT_STEPS);

    try {
      // Step 1: 收集数据
      yield* this.reportProgress("收集数据", 5, "正在收集数据...");
      yield* this.emitText(
        `${periodConfig.icon} 正在生成${periodConfig.name}，请稍候...\n\n`,
      );

      const { currentPeriod, previousPeriod } = calculateDateRanges(
        input.period,
      );

      const currentBookmarks = await fetchBookmarks(
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

        const previousBookmarks = await fetchBookmarks(
          context.userId,
          previousPeriod,
          input.filter,
        );

        comparison = calculateComparison(
          currentBookmarks,
          previousBookmarks,
          currentPeriod,
          previousPeriod,
        );

        yield* this.reportProgress("历史对比", 40, "历史对比完成");
      }

      // Step 3: 分析趋势
      yield* this.reportProgress("分析趋势", 45, "正在分析趋势...");

      const stats = calculateStats(currentBookmarks, input.period);
      const chartData = input.includeChartData
        ? generateChartData(currentBookmarks)
        : undefined;

      yield* this.reportProgress("分析趋势", 60, "趋势分析完成");

      // Step 4: 精选亮点
      yield* this.reportProgress("精选亮点", 65, "正在筛选亮点...");

      const highlights = selectHighlights(currentBookmarks);

      yield* this.reportProgress("精选亮点", 80, "亮点筛选完成");

      // Step 5: 生成报告
      yield* this.reportProgress("生成报告", 85, "正在生成报告...");

      const insights = generateInsights(stats, comparison, highlights);
      const summary = generateSummary(stats, comparison, input.period);
      const suggestions = generateSuggestions(stats, insights);

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
      yield* this.emitReportContent(
        output,
        stats,
        comparison,
        highlights,
        insights,
      );

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
   * 输出报告内容到流
   */
  private async *emitReportContent(
    output: PeriodicReportOutput,
    stats: PeriodicReportOutput["stats"],
    comparison: PeriodComparison | undefined,
    highlights: PeriodicReportOutput["highlights"],
    insights: PeriodicReportOutput["insights"],
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const periodConfig = PERIOD_CONFIG[output.period];

    yield* this.emitText(`## ${periodConfig.icon} ${output.title}\n\n`);
    yield* this.emitText(`${output.summary}\n\n`);

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
// 导出
// ============================================

export const periodicReportSkill = new PeriodicReportSkill();
