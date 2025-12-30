/**
 * ActiveRecallSkill - 主动复习 Skill (Brain-Sync)
 *
 * 功能：
 * - 智能生成 Flashcards 问答卡片
 * - 基于 SM-2 算法管理复习调度
 * - 交互式复习会话
 * - 掌握度统计和进度追踪
 *
 * 执行流程：
 * 1. 解析用户意图（生成/复习/查看统计）
 * 2. 获取相关数据
 * 3. 执行对应操作
 * 4. 输出结果和建议
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  generateFlashcards,
  filterValidFlashcards,
  calculatePriority,
  sortByPriority,
  calculateQueueStats,
} from "../../shared/review";
import type {
  FlashcardStatus,
  ReviewQueueItem,
  ReviewResponse,
} from "../../shared/review/types";
import type {
  BatchCreateFlashcardsResult,
  UpdateFlashcardReviewResult,
  PendingFlashcardRow,
  ReviewStatsResult,
  ReviewPreferencesRow,
} from "@/types/brain-sync";

// ============================================
// 类型定义
// ============================================

type ActiveRecallAction = "generate" | "review" | "stats" | "preferences";

interface ActiveRecallInput {
  action: ActiveRecallAction;
  bookmarkId?: number;
  flashcardId?: number;
  response?: ReviewResponse;
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
  timeRange?: "week" | "month" | "all";
}

interface ActiveRecallOutput {
  action: ActiveRecallAction;
  success: boolean;
  message: string;
  data?: unknown;
  generatedAt: string;
}

// ============================================
// Schema 定义
// ============================================

const ActiveRecallInputSchema = z.object({
  action: z
    .enum(["generate", "review", "stats", "preferences"])
    .default("review")
    .describe("操作类型：generate-生成卡片，review-开始复习，stats-查看统计"),
  bookmarkId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("书签ID（生成卡片时需要）"),
  flashcardId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("卡片ID（提交反馈时需要）"),
  response: z
    .enum(["mastered", "fuzzy", "forgotten"])
    .optional()
    .describe("复习反馈"),
  count: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe("生成数量"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .default("medium")
    .describe("难度级别"),
  timeRange: z
    .enum(["week", "month", "all"])
    .optional()
    .default("week")
    .describe("统计时间范围"),
});

const ActiveRecallOutputSchema = z.object({
  action: z.enum(["generate", "review", "stats", "preferences"]),
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const SKILL_STEPS = [
  { id: "parse", name: "解析意图", description: "理解用户需求", weight: 10 },
  { id: "fetch", name: "获取数据", description: "获取相关数据", weight: 30 },
  { id: "execute", name: "执行操作", description: "执行复习操作", weight: 40 },
  { id: "report", name: "生成报告", description: "输出结果", weight: 20 },
];

// ============================================
// ActiveRecallSkill 实现
// ============================================

export class ActiveRecallSkill extends OrchestrationSkill<
  ActiveRecallInput,
  ActiveRecallOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "active_recall",
    name: "主动复习助手 (Brain-Sync)",
    description:
      "基于 SM-2 间隔重复算法，为您的收藏内容生成问答卡片，科学安排复习计划，帮助您牢固记忆知识。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "flashcard-generation",
      "sm2-scheduling",
      "spaced-repetition",
      "progress-tracking",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: SKILL_STEPS,
  };

  readonly inputSchema = ActiveRecallInputSchema;
  readonly outputSchema = ActiveRecallOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<ActiveRecallInput> {
    // 判断操作类型
    let action: ActiveRecallAction = "review";

    if (/生成|创建|制作/.test(message) && /卡片|flashcard/i.test(message)) {
      action = "generate";
    } else if (/统计|进度|掌握|情况/.test(message)) {
      action = "stats";
    } else if (/设置|偏好|配置/.test(message)) {
      action = "preferences";
    }

    // 解析难度
    let difficulty: "easy" | "medium" | "hard" = "medium";
    if (/简单|基础/.test(message)) {
      difficulty = "easy";
    } else if (/困难|高级|深度/.test(message)) {
      difficulty = "hard";
    }

    // 解析数量
    let count = 3;
    const countMatch = message.match(/(\d+)\s*[个张条]/);
    if (countMatch) {
      count = Math.min(10, Math.max(1, parseInt(countMatch[1], 10)));
    }

    // 解析时间范围
    let timeRange: "week" | "month" | "all" = "week";
    if (/本月|月/.test(message)) {
      timeRange = "month";
    } else if (/全部|所有/.test(message)) {
      timeRange = "all";
    }

    return {
      action,
      count,
      difficulty,
      timeRange,
    };
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as ActiveRecallInput;

    this.initProgress(SKILL_STEPS);

    try {
      yield* this.reportProgress("解析意图", 10, "正在理解您的需求...");

      switch (input.action) {
        case "generate":
          yield* this.executeGenerate(context, input);
          break;
        case "review":
          yield* this.executeReview(context, input);
          break;
        case "stats":
          yield* this.executeStats(context, input);
          break;
        case "preferences":
          yield* this.executePreferences(context);
          break;
      }

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          action: input.action,
          durationMs: Date.now() - startTime,
        },
        "ActiveRecallSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        },
        "ActiveRecallSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "操作失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "操作失败");
    }
  }

  /**
   * 执行生成 Flashcards
   */
  private async *executeGenerate(
    context: OrchestrationContext,
    input: ActiveRecallInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.emitText("📝 正在为您生成复习卡片...\n\n");

    if (!input.bookmarkId) {
      yield* this.emitText(
        "请提供要生成卡片的书签 ID。\n\n" +
          "您可以在书签详情页找到 ID，或者告诉我书签名称让我帮您查找。",
      );
      yield* this.emitDone(true, "需要书签 ID");
      return;
    }

    yield* this.reportProgress("获取数据", 30, "正在获取书签内容...");

    const supabase = await createClient();

    // 获取书签内容（使用类型断言处理可能缺失的列）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error } = (await (supabase as any)
      .from("bookmarks")
      .select("id, title, summary, content")
      .eq("id", input.bookmarkId)
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .single()) as {
      data: {
        id: number;
        title: string | null;
        summary: string | null;
        content: string | null;
      } | null;
      error: { message: string } | null;
    };

    if (error || !bookmark) {
      yield* this.emitText("❌ 未找到该书签或无权访问。");
      yield* this.emitDone(false, "书签不存在");
      return;
    }

    if (!bookmark.content || bookmark.content.length < 50) {
      yield* this.emitText("❌ 书签内容不足，无法生成卡片（至少需要 50 字）。");
      yield* this.emitDone(false, "内容不足");
      return;
    }

    yield* this.reportProgress("执行操作", 50, "正在使用 AI 生成问答卡片...");
    yield* this.emitText(`📖 正在分析「${bookmark.title}」...\n\n`);

    // 生成 Flashcards
    const result = await generateFlashcards({
      title: bookmark.title || "未命名书签",
      summary: bookmark.summary || "",
      content: bookmark.content,
      count: input.count || 3,
      difficulty: input.difficulty || "medium",
    });

    if (!result.success || result.flashcards.length === 0) {
      yield* this.emitText(`❌ 生成失败：${result.error || "未知错误"}`);
      yield* this.emitDone(false, "生成失败");
      return;
    }

    // 过滤有效卡片
    const validFlashcards = filterValidFlashcards(result.flashcards);

    yield* this.reportProgress("执行操作", 70, "正在保存卡片...");

    // 保存到数据库（使用类型断言处理新 RPC）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedCards, error: saveError } = (await (supabase as any).rpc(
      "batch_create_flashcards",
      {
        p_user_id: context.userId,
        p_bookmark_id: input.bookmarkId,
        p_flashcards: validFlashcards.map((fc) => ({
          question: fc.question,
          answer: fc.answer,
          source_paragraph: fc.sourceParagraph || null,
          difficulty: input.difficulty || "medium",
        })),
      },
    )) as {
      data: BatchCreateFlashcardsResult | null;
      error: { message: string } | null;
    };

    if (saveError) {
      yield* this.emitText(`❌ 保存失败：${saveError.message}`);
      yield* this.emitDone(false, "保存失败");
      return;
    }

    yield* this.reportProgress("生成报告", 90, "正在生成报告...");

    // 输出结果
    const savedCount = savedCards?.inserted_count || validFlashcards.length;
    yield* this.emitText(`## ✅ 已生成 ${savedCount} 张卡片\n\n`);

    for (let i = 0; i < validFlashcards.length; i++) {
      const fc = validFlashcards[i];
      yield* this.emitText(`### 卡片 ${i + 1}\n`);
      yield* this.emitText(`**Q:** ${fc.question}\n\n`);
      yield* this.emitText(`**A:** ${fc.answer}\n\n`);
      if (fc.sourceParagraph) {
        yield* this.emitText(`> ${fc.sourceParagraph}\n\n`);
      }
    }

    yield* this.emitText("\n💡 卡片已加入复习队列，第一次复习将在明天安排。\n");

    const output: ActiveRecallOutput = {
      action: "generate",
      success: true,
      message: `已为「${bookmark.title}」生成 ${savedCount} 张卡片`,
      data: { flashcards: validFlashcards, savedCount },
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitDeliverable(
      this.createDeliverable("list", "复习卡片", output.data, "json"),
    );
    yield* this.emitDone(true, output.message);
  }

  /**
   * 执行复习会话
   */
  private async *executeReview(
    context: OrchestrationContext,
    input: ActiveRecallInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.emitText("📚 正在加载您的复习队列...\n\n");
    yield* this.reportProgress("获取数据", 30, "正在获取待复习卡片...");

    const supabase = await createClient();

    // 如果有反馈，先处理反馈
    if (input.flashcardId && input.response) {
      yield* this.reportProgress("执行操作", 50, "正在处理您的反馈...");

      const { data: updateResult, error: updateError } =
        (await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RPC 类型推断限制
        (supabase as any).rpc("update_flashcard_review", {
          p_user_id: context.userId,
          p_flashcard_id: input.flashcardId,
          p_response: input.response,
          p_response_time_ms: null,
          p_session_type: "chat",
        })) as {
          data: UpdateFlashcardReviewResult | null;
          error: { message: string } | null;
        };

      if (updateError) {
        yield* this.emitText(`❌ 更新失败：${updateError.message}\n\n`);
      } else if (updateResult) {
        const responseEmojis: Record<ReviewResponse, string> = {
          mastered: "🌟",
          fuzzy: "🤔",
          forgotten: "😅",
          archived: "🎉",
        };
        const responseLabels: Record<ReviewResponse, string> = {
          mastered: "太棒了！完全掌握",
          fuzzy: "有点模糊，需要巩固",
          forgotten: "没关系，我们再来",
          archived: "已永久归档，不再复习",
        };
        yield* this.emitText(
          `${responseEmojis[input.response]} ${responseLabels[input.response]}\n` +
            `下次复习：${updateResult.new_interval} 天后\n\n`,
        );
      }
    }

    // 获取待复习队列
    const { data: pendingCards, error: fetchError } =
      (await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RPC 类型推断限制
      (supabase as any).rpc("get_pending_flashcards", {
        p_user_id: context.userId,
        p_limit: 20,
      })) as {
        data: PendingFlashcardRow[] | null;
        error: { message: string } | null;
      };

    if (fetchError) {
      yield* this.emitText(`❌ 获取队列失败：${fetchError.message}`);
      yield* this.emitDone(false, "获取失败");
      return;
    }

    yield* this.reportProgress("生成报告", 80, "正在生成复习报告...");

    if (!pendingCards || pendingCards.length === 0) {
      yield* this.emitText("🎉 **太棒了！没有待复习的卡片。**\n\n");
      yield* this.emitText("您可以：\n");
      yield* this.emitText("- 为新收藏的内容生成复习卡片\n");
      yield* this.emitText("- 查看复习统计了解学习进度\n");
      yield* this.emitDone(true, "暂无待复习卡片");
      return;
    }

    // 转换并排序
    const now = new Date();
    const queueItems: ReviewQueueItem[] = (pendingCards || []).map(
      (fc: PendingFlashcardRow) => {
        const nextReviewAt = fc.next_review_at
          ? new Date(fc.next_review_at)
          : null;
        const daysOverdue = nextReviewAt
          ? Math.floor(
              (now.getTime() - nextReviewAt.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

        return {
          flashcardId: fc.flashcard_id,
          bookmarkId: fc.bookmark_id,
          bookmarkTitle: fc.bookmark_title,
          bookmarkUrl: fc.bookmark_url,
          question: fc.question,
          answer: fc.answer,
          sourceParagraph: fc.source_paragraph || undefined,
          status: fc.status as FlashcardStatus,
          easeFactor: fc.ease_factor || 2.5,
          intervalDays: fc.interval_days || 1,
          repetitions: fc.repetitions || 0,
          nextReviewAt,
          daysOverdue,
          priorityScore: 0,
        };
      },
    );

    // 计算优先级并排序
    queueItems.forEach((item) => {
      item.priorityScore = calculatePriority(item);
    });
    const sortedItems = sortByPriority(queueItems);
    const stats = calculateQueueStats(sortedItems);

    // 输出统计
    yield* this.emitText(`## 📋 复习队列\n\n`);
    yield* this.emitText(`- 总计：**${stats.total}** 张卡片\n`);
    if (stats.overdue > 0) {
      yield* this.emitText(`- 🔴 逾期：**${stats.overdue}** 张\n`);
    }
    if (stats.dueToday > 0) {
      yield* this.emitText(`- 🟡 今日到期：**${stats.dueToday}** 张\n`);
    }
    yield* this.emitText(`- 平均优先级：${stats.avgPriority.toFixed(1)}\n\n`);

    // 显示第一张卡片
    const firstCard = sortedItems[0];
    yield* this.emitText(`---\n\n`);
    yield* this.emitText(`### 🎴 当前卡片\n\n`);
    yield* this.emitText(`**来源：** ${firstCard.bookmarkTitle}\n\n`);
    yield* this.emitText(`**问题：**\n> ${firstCard.question}\n\n`);
    yield* this.emitText(`<details>\n<summary>点击查看答案</summary>\n\n`);
    yield* this.emitText(`${firstCard.answer}\n\n`);
    yield* this.emitText(`</details>\n\n`);

    yield* this.emitText(`---\n\n`);
    yield* this.emitText(
      `回答后，请告诉我您的掌握情况：\n` +
        `- 🌟 **掌握** - 完全记住了\n` +
        `- 🤔 **模糊** - 有点想起来\n` +
        `- 😅 **遗忘** - 完全不记得\n\n` +
        `说 "掌握"、"模糊" 或 "遗忘" 来记录反馈。`,
    );

    const output: ActiveRecallOutput = {
      action: "review",
      success: true,
      message: `待复习 ${stats.total} 张卡片`,
      data: { currentCard: firstCard, stats },
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitDeliverable(
      this.createDeliverable("list", "复习队列", output.data, "json"),
    );
    yield* this.emitDone(true, output.message);
  }

  /**
   * 执行统计查询
   */
  private async *executeStats(
    context: OrchestrationContext,
    input: ActiveRecallInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.emitText("📊 正在生成学习统计...\n\n");
    yield* this.reportProgress("获取数据", 30, "正在获取统计数据...");

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stats, error } = (await (supabase as any).rpc(
      "get_review_stats",
      {
        p_user_id: context.userId,
        p_time_range: input.timeRange || "week",
      },
    )) as { data: ReviewStatsResult | null; error: { message: string } | null };

    if (error) {
      yield* this.emitText(`❌ 获取统计失败：${error.message}`);
      yield* this.emitDone(false, "获取失败");
      return;
    }

    if (!stats) {
      yield* this.emitText("❌ 获取统计数据为空");
      yield* this.emitDone(false, "数据为空");
      return;
    }

    yield* this.reportProgress("生成报告", 80, "正在生成报告...");

    const timeRangeLabels = {
      week: "本周",
      month: "本月",
      all: "全部",
    };

    const masteredRate =
      stats.total_flashcards > 0
        ? Math.round((stats.mastered_count / stats.total_flashcards) * 100)
        : 0;

    yield* this.emitText(
      `## 📈 ${timeRangeLabels[input.timeRange || "week"]}学习统计\n\n`,
    );

    yield* this.emitText(`### 卡片状态\n`);
    yield* this.emitText(`- 总计：**${stats.total_flashcards}** 张\n`);
    yield* this.emitText(`- ✅ 已掌握：**${stats.mastered_count}** 张\n`);
    yield* this.emitText(`- 📖 学习中：**${stats.learning_count}** 张\n`);
    yield* this.emitText(`- 📝 待学习：**${stats.pending_count}** 张\n\n`);

    yield* this.emitText(`### 掌握率\n`);
    yield* this.emitText(
      `${"█".repeat(Math.floor(masteredRate / 5))}${"░".repeat(20 - Math.floor(masteredRate / 5))} **${masteredRate}%**\n\n`,
    );

    if (stats.sessions_in_period > 0) {
      yield* this.emitText(`### 复习会话\n`);
      yield* this.emitText(`- 会话次数：**${stats.sessions_in_period}** 次\n`);
      yield* this.emitText(`- 🌟 掌握：${stats.mastered_sessions} 次\n`);
      yield* this.emitText(`- 🤔 模糊：${stats.fuzzy_sessions} 次\n`);
      yield* this.emitText(`- 😅 遗忘：${stats.forgotten_sessions} 次\n`);
      if (stats.avg_response_time_ms) {
        yield* this.emitText(
          `- 平均响应时间：${(stats.avg_response_time_ms / 1000).toFixed(1)} 秒\n`,
        );
      }
      yield* this.emitText("\n");
    }

    if (stats.streak_days > 0) {
      yield* this.emitText(`### 🔥 连续复习\n`);
      yield* this.emitText(
        `已连续复习 **${stats.streak_days}** 天！继续保持！\n\n`,
      );
    }

    // 建议
    yield* this.emitText(`### 💡 建议\n`);
    if (masteredRate >= 80) {
      yield* this.emitText(`- 太棒了！您的掌握率很高，可以尝试增加新内容\n`);
    } else if (masteredRate >= 50) {
      yield* this.emitText(`- 进步不错！继续坚持每日复习\n`);
    } else {
      yield* this.emitText(`- 建议增加复习频率，每天 10-15 分钟效果最佳\n`);
    }

    const output: ActiveRecallOutput = {
      action: "stats",
      success: true,
      message: `掌握率 ${masteredRate}%`,
      data: stats,
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitDeliverable(
      this.createDeliverable("report", "学习统计", output.data, "json"),
    );
    yield* this.emitDone(true, output.message);
  }

  /**
   * 执行偏好设置
   */
  private async *executePreferences(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.emitText("⚙️ 正在加载您的复习偏好设置...\n\n");
    yield* this.reportProgress("获取数据", 50, "正在获取设置...");

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prefs, error } = (await (supabase as any).rpc(
      "get_or_create_review_preferences",
      {
        p_user_id: context.userId,
      },
    )) as {
      data: ReviewPreferencesRow | null;
      error: { message: string } | null;
    };

    if (error) {
      yield* this.emitText(`❌ 获取设置失败：${error.message}`);
      yield* this.emitDone(false, "获取失败");
      return;
    }

    if (!prefs) {
      yield* this.emitText("❌ 获取偏好设置失败");
      yield* this.emitDone(false, "数据为空");
      return;
    }

    yield* this.reportProgress("生成报告", 90, "正在显示设置...");

    const dayNames: Record<string, string> = {
      monday: "周一",
      tuesday: "周二",
      wednesday: "周三",
      thursday: "周四",
      friday: "周五",
      saturday: "周六",
      sunday: "周日",
    };

    const channelNames: Record<string, string> = {
      sidebar: "侧边栏提醒",
      push: "推送通知",
      both: "侧边栏+推送",
      none: "关闭通知",
    };

    yield* this.emitText(`## ⚙️ 复习偏好设置\n\n`);
    yield* this.emitText(
      `- 主动复习：**${prefs.enabled ? "✅ 已开启" : "❌ 已关闭"}**\n`,
    );
    yield* this.emitText(
      `- 首选复习日：**${dayNames[prefs.preferred_day] || prefs.preferred_day}**\n`,
    );
    yield* this.emitText(`- 首选时间：**${prefs.preferred_time}**\n`);
    yield* this.emitText(`- 每周上限：**${prefs.weekly_limit}** 张\n`);
    yield* this.emitText(
      `- 通知方式：**${channelNames[prefs.notification_channel] || prefs.notification_channel}**\n\n`,
    );

    yield* this.emitText(
      `如需修改，请告诉我，例如：\n` +
        `- "开启主动复习"\n` +
        `- "设置每周上限为 20"\n` +
        `- "把复习时间改到晚上 8 点"\n`,
    );

    const output: ActiveRecallOutput = {
      action: "preferences",
      success: true,
      message: "已加载偏好设置",
      data: prefs,
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitDone(true, output.message);
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: ActiveRecallInput,
    context: SkillContext,
  ): Promise<ActiveRecallOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: ActiveRecallOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = {
          action: input.action,
          success: true,
          message: "Success",
          data: chunk.data.content,
          generatedAt: new Date().toISOString(),
        };
      }
    }

    if (!output) {
      throw new Error("执行失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const activeRecallSkill = new ActiveRecallSkill();
