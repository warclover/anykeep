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
import { logger } from "@/lib/logger";
import type { InsightReportInput, InsightReportOutput } from "./types";
import { REPORT_TYPE_CONFIG, DEFAULT_REPORT_CONFIG } from "./types";
import { analyzeActivity, analyzeContent, analyzeTrends } from "./analyzers";
import {
  generateInsights,
  generateSummary,
  generateSuggestions,
} from "./generators";
import { fetchBookmarks, getTimeRangeDescription } from "./bookmark-fetcher";

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

      const bookmarks = await fetchBookmarks(context.userId, input);

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

      const activity = analyzeActivity(bookmarks, input);

      yield* this.reportProgress("活跃度分析", 40, "活跃度分析完成");

      // Step 3: 内容分析
      yield* this.reportProgress("内容分析", 45, "正在分析内容分布...");

      const content = analyzeContent(bookmarks);

      yield* this.reportProgress("内容分析", 60, "内容分析完成");

      // Step 4: 趋势分析
      yield* this.reportProgress("趋势分析", 65, "正在分析变化趋势...");

      const trends = analyzeTrends(bookmarks, input);

      yield* this.reportProgress("趋势分析", 80, "趋势分析完成");

      // Step 5: 生成洞察
      yield* this.reportProgress("生成洞察", 85, "正在生成洞察建议...");

      const insights = generateInsights(activity, content, trends);
      const summary = generateSummary(
        input.reportType,
        activity,
        content,
        trends,
      );
      const suggestions = generateSuggestions(activity, content, insights);

      yield* this.reportProgress("生成洞察", 95, "洞察生成完成");

      // 构建输出
      const output: InsightReportOutput = {
        title: `${reportConfig.name} - ${getTimeRangeDescription(input.timeRange)}`,
        reportType: input.reportType,
        timeRangeDescription: getTimeRangeDescription(input.timeRange),
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
// 导出
// ============================================

export const insightReportSkill = new InsightReportSkill();
