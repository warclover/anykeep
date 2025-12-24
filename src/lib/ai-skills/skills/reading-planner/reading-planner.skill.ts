/**
 * ReadingPlannerSkill - 阅读计划助手
 *
 * 根据用户的时间安排和偏好，自动生成个性化阅读计划。
 *
 * 功能：
 * - 评估阅读积压量
 * - 估算每篇内容的阅读时间
 * - 按优先级排序
 * - 生成每日阅读日程
 * - 设置进度里程碑
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
  ReadingPlannerInput,
  ReadingPlannerOutput,
  BookmarkForPlan,
} from "./types";
import { readingPlannerInputSchema } from "./types";
import { ReadingPlanGenerator } from "./plan-generator";

// ============================================
// Output Schema 定义
// ============================================

const ReadingPlannerOutputSchema = z.object({
  plan: z.object({
    id: z.string(),
    name: z.string(),
    goal: z.enum(["clear_backlog", "learn_topic", "daily_routine", "custom"]),
    createdAt: z.string(),
    duration: z.object({
      startDate: z.string(),
      endDate: z.string(),
      totalDays: z.number(),
    }),
  }),
  schedule: z.array(z.any()),
  stats: z.any(),
  milestones: z.array(z.any()),
  summary: z.string(),
  suggestions: z.array(z.string()),
});

// ============================================
// 步骤定义
// ============================================

const PLANNER_STEPS = [
  { id: "assess", name: "评估积压", description: "评估阅读积压量", weight: 20 },
  {
    id: "estimate",
    name: "估算时间",
    description: "估算每篇阅读时间",
    weight: 20,
  },
  {
    id: "prioritize",
    name: "排列优先",
    description: "按优先级排序",
    weight: 20,
  },
  {
    id: "schedule",
    name: "生成日程",
    description: "生成每日阅读日程",
    weight: 30,
  },
  { id: "report", name: "生成报告", description: "生成计划报告", weight: 10 },
];

/**
 * ReadingPlannerSkill 实现
 */
export class ReadingPlannerSkill extends OrchestrationSkill<
  ReadingPlannerInput,
  ReadingPlannerOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "reading_planner",
    name: "阅读计划助手",
    description:
      "根据您的可用时间和偏好，智能生成个性化阅读计划，帮助您系统性地消化收藏内容",
    version: "1.0.0",
    category: "learning",
    author: "AnyKeep",
    requiresConfirmation: false,
    estimatedDurationMs: 60000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    capabilities: [
      "智能估算阅读时间",
      "按优先级排序",
      "生成每日日程",
      "设置进度里程碑",
      "提供个性化建议",
    ],
    steps: PLANNER_STEPS,
  };

  readonly inputSchema = readingPlannerInputSchema;
  readonly outputSchema = ReadingPlannerOutputSchema;

  private generator = new ReadingPlanGenerator();

  /**
   * 解析用户输入
   */
  async parseInput(
    userMessage: string,
    _context: OrchestrationContext,
  ): Promise<ReadingPlannerInput> {
    const messageLower = userMessage.toLowerCase();

    // 解析目标
    let goal: ReadingPlannerInput["goal"] = "daily_routine";
    if (
      messageLower.includes("清理") ||
      messageLower.includes("积压") ||
      messageLower.includes("backlog")
    ) {
      goal = "clear_backlog";
    } else if (
      messageLower.includes("学习") ||
      messageLower.includes("主题") ||
      messageLower.includes("topic")
    ) {
      goal = "learn_topic";
    } else if (
      messageLower.includes("自定义") ||
      messageLower.includes("custom")
    ) {
      goal = "custom";
    }

    // 提取主题
    let topic: string | undefined;
    const topicMatches = [
      /学习(.+?)(?:的|相关|内容|文章)/,
      /关于(.+?)(?:的|相关)/,
      /(.+?)(?:技术|知识|主题)/,
    ];
    for (const pattern of topicMatches) {
      const match = userMessage.match(pattern);
      if (match?.[1]) {
        topic = match[1].trim();
        if (topic.length >= 2 && topic.length <= 20) {
          goal = "learn_topic";
          break;
        }
      }
    }

    // 解析每日时间
    let dailyMinutes = 30; // 默认 30 分钟
    const timeMatches = [
      /每天(\d+)分钟/,
      /(\d+)分钟\/天/,
      /daily\s*(\d+)\s*min/i,
      /(\d+)\s*分钟/,
    ];
    for (const pattern of timeMatches) {
      const match = userMessage.match(pattern);
      if (match?.[1]) {
        const parsed = parseInt(match[1], 10);
        if (parsed >= 15 && parsed <= 120) {
          dailyMinutes = parsed;
          break;
        }
      }
    }

    // 解析每周天数
    let daysPerWeek = 5; // 默认工作日
    if (
      messageLower.includes("每天") ||
      messageLower.includes("daily") ||
      messageLower.includes("天天")
    ) {
      daysPerWeek = 7;
    } else if (
      messageLower.includes("周末") ||
      messageLower.includes("weekend")
    ) {
      daysPerWeek = 2;
    }

    // 解析排序方式
    let prioritizeBy: ReadingPlannerInput["preferences"]["prioritizeBy"] =
      "date";
    if (messageLower.includes("重要") || messageLower.includes("important")) {
      prioritizeBy = "importance";
    } else if (messageLower.includes("短") || messageLower.includes("快速")) {
      prioritizeBy = "reading_time";
    } else if (topic) {
      prioritizeBy = "topic";
    }

    // 解析复习选项
    const includeReview =
      messageLower.includes("复习") || messageLower.includes("review");

    // 解析分组选项
    const groupByTopic =
      messageLower.includes("分类") ||
      messageLower.includes("分组") ||
      messageLower.includes("group");

    return {
      goal,
      topic,
      timeAvailable: {
        dailyMinutes,
        daysPerWeek,
        totalWeeks: 4, // 默认 4 周
      },
      preferences: {
        prioritizeBy,
        includeReview,
        groupByTopic,
      },
    };
  }

  /**
   * 执行阅读计划生成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as ReadingPlannerInput;

    // 初始化进度
    this.initProgress(PLANNER_STEPS);

    try {
      // Step 1: 评估阅读积压
      yield* this.reportProgress("评估积压", 0, "正在评估您的阅读积压...");

      const bookmarks = await this.fetchBookmarks(input, context.userId);

      yield* this.emitText(`📚 找到 ${bookmarks.length} 篇待阅读内容\n`);

      if (bookmarks.length === 0) {
        yield* this.emitText(
          "您的阅读清单为空，快去收藏一些感兴趣的内容吧！\n",
        );
        yield* this.emitDone(true, "阅读清单为空");
        return;
      }

      yield* this.reportProgress(
        "评估积压",
        20,
        `找到 ${bookmarks.length} 篇内容待安排`,
      );

      // Step 2: 估算阅读时间
      yield* this.reportProgress(
        "估算时间",
        25,
        "正在估算每篇内容的阅读时间...",
      );

      // 估算总时间
      let totalEstimate = 0;
      for (const bookmark of bookmarks) {
        totalEstimate += this.generator.estimateReadTime(bookmark);
      }

      yield* this.emitText(
        `⏱️ 预计总阅读时间：${totalEstimate} 分钟（${Math.round(totalEstimate / 60)} 小时）\n`,
      );

      yield* this.reportProgress("估算时间", 40, "阅读时间估算完成");

      // Step 3: 优先级排序
      yield* this.reportProgress("排列优先", 45, "正在按优先级排序...");

      const priorityMethod = input.preferences.prioritizeBy;
      yield* this.emitText(
        `📊 排序方式：${this.getPriorityDescription(priorityMethod)}\n`,
      );

      yield* this.reportProgress("排列优先", 60, "优先级排序完成");

      // Step 4: 生成日程安排
      yield* this.reportProgress("生成日程", 65, "正在生成每日阅读日程...");

      const plan = this.generator.generatePlan(bookmarks, input);

      yield* this.emitText(`📅 已生成 ${plan.schedule.length} 天的阅读计划\n`);

      yield* this.reportProgress("生成日程", 90, "日程生成完成");

      // Step 5: 生成报告
      yield* this.reportProgress("生成报告", 95, "正在生成计划报告...");

      // 输出里程碑信息
      if (plan.milestones.length > 0) {
        yield* this.emitText(
          "🎯 进度里程碑：\n" +
            plan.milestones
              .map((m) => `  • 第 ${m.day} 天：${m.description}`)
              .join("\n") +
            "\n",
        );
      }

      // 输出摘要
      yield* this.emitText(`\n${plan.summary}\n`);

      // 输出建议
      if (plan.suggestions.length > 0) {
        yield* this.emitText(
          "\n💡 建议：\n" +
            plan.suggestions.map((s) => `  • ${s}`).join("\n") +
            "\n",
        );
      }

      yield* this.reportProgress("生成报告", 100, "计划生成完成！");

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        "阅读计划",
        plan,
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
          label: "开始阅读",
          action: "start_reading",
          params: { planId: plan.plan.id },
        },
        {
          label: "导出计划",
          action: "export_plan",
          params: { planId: plan.plan.id, format: "markdown" },
        },
      ]);

      yield* this.emitDone(
        true,
        `成功生成 ${plan.schedule.length} 天的阅读计划`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          goal: input.goal,
          bookmarkCount: bookmarks.length,
          scheduleDays: plan.schedule.length,
          totalReadingTime: plan.stats.totalReadingTime,
          executionTimeMs: Date.now() - startTime,
        },
        "ReadingPlannerSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          error: error instanceof Error ? error.message : String(error),
        },
        "ReadingPlannerSkill: Execution failed",
      );

      yield* this.emitError(
        `生成计划时发生错误：${error instanceof Error ? error.message : "未知错误"}`,
        "EXECUTION_ERROR",
        true,
      );

      throw error;
    }
  }

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    input: ReadingPlannerInput,
    userId: string,
  ): Promise<BookmarkForPlan[]> {
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
        created_at,
        folder_id,
        is_read
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    // 应用范围筛选
    if (input.scope) {
      if (input.scope.folderId) {
        query = query.eq("folder_id", input.scope.folderId);
      }
      if (input.scope.unreadOnly) {
        query = query.or("is_read.is.null,is_read.eq.false");
      }
      if (input.scope.tags && input.scope.tags.length > 0) {
        // 标签筛选需要额外处理
        // 这里简化处理，使用 ai_tags 包含判断
        for (const tag of input.scope.tags) {
          query = query.contains("ai_tags", [tag]);
        }
      }
    }

    // 按目标过滤
    if (input.goal === "learn_topic" && input.topic) {
      // 主题学习：搜索标题和标签
      query = query.or(
        `title.ilike.%${input.topic}%,ai_tags.cs.{${input.topic}}`,
      );
    }

    // 排序（默认按创建时间）
    query = query.order("created_at", { ascending: true });

    // 限制数量
    query = query.limit(200);

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error: error.message },
        "ReadingPlannerSkill: Failed to fetch bookmarks",
      );
      throw new Error(`获取书签失败：${error.message}`);
    }

    // 获取标签（单独查询避免类型问题）
    const bookmarkIds = (data || []).map((b) => b.id);
    const bookmarkTags = new Map<number, string[]>();

    if (bookmarkIds.length > 0) {
      // 使用 any 断言绕过表名类型检查（bookmark_tags 和 tags 不在生成的类型中）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tagData } = (await (supabase as any)
        .from("bookmark_tags")
        .select("bookmark_id, tag_id")
        .in("bookmark_id", bookmarkIds)) as {
        data: Array<{ bookmark_id: number; tag_id: number }> | null;
      };

      if (tagData && tagData.length > 0) {
        const tagIds = [...new Set(tagData.map((bt) => bt.tag_id))];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tagsInfo } = (await (supabase as any)
          .from("tags")
          .select("id, name")
          .in("id", tagIds)) as {
          data: Array<{ id: number; name: string }> | null;
        };

        const tagNameMap = new Map<number, string>();
        (tagsInfo || []).forEach((t) => tagNameMap.set(t.id, t.name));

        for (const bt of tagData) {
          const tagName = tagNameMap.get(bt.tag_id);
          if (tagName) {
            const existing = bookmarkTags.get(bt.bookmark_id) || [];
            existing.push(tagName);
            bookmarkTags.set(bt.bookmark_id, existing);
          }
        }
      }
    }

    // 转换数据格式
    return (data || [])
      .filter(
        (item): item is typeof item & { created_at: string } =>
          item.created_at !== null,
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        platform: item.platform ?? undefined,
        ai_tags: item.ai_tags ?? undefined,
        ai_summary: item.ai_summary ?? undefined,
        content_length: undefined, // Not available in bookmarks table
        created_at: item.created_at,
        folder_id: item.folder_id ?? undefined,
        is_read: item.is_read ?? undefined,
        tags: (bookmarkTags.get(item.id) || []).map((name) => ({ name })),
      }));
  }

  /**
   * 获取优先级描述
   */
  private getPriorityDescription(prioritizeBy: string): string {
    const descriptions: Record<string, string> = {
      date: "按收藏时间（先进先出）",
      importance: "按重要程度",
      reading_time: "按阅读时长（短文优先）",
      topic: "按主题相关性",
    };
    return descriptions[prioritizeBy] || "默认排序";
  }
}

/**
 * 默认实例
 */
export const readingPlannerSkill = new ReadingPlannerSkill();
