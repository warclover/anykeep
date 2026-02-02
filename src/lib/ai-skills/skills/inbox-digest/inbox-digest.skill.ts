/**
 * InboxDigestSkill - 收件箱摘要 Skill
 *
 * 功能：
 * - 统计指定时间段的消息数据
 * - 按类型和级别进行分组分析
 * - 识别重要消息和趋势
 * - 生成结构化摘要报告
 *
 * 执行流程：
 * 1. 获取指定时间段的消息
 * 2. 按类型/级别统计分析
 * 3. 分析趋势变化
 * 4. 生成摘要报告
 * 5. 输出交付物
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  InboxDigestInputSchema,
  InboxDigestOutputSchema,
  INBOX_DIGEST_STEPS,
  MESSAGE_TYPE_LABELS,
  MESSAGE_LEVEL_LABELS,
  type InboxDigestInput,
  type InboxDigestOutput,
  type MessageRow,
} from "./types";

// ============================================
// InboxDigestSkill 实现
// ============================================

export class InboxDigestSkill extends OrchestrationSkill<
  InboxDigestInput,
  InboxDigestOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "inbox_digest",
    name: "收件箱摘要",
    description:
      "生成收件箱消息的智能摘要报告，包括消息统计、类型分布、趋势分析和待办建议。支持每日、每周、每月周期。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "message-statistics",
      "type-distribution",
      "trend-analysis",
      "actionable-insights",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    maxExecutionTimeMs: 30000,
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    steps: INBOX_DIGEST_STEPS,
  };

  readonly inputSchema = InboxDigestInputSchema;
  readonly outputSchema = InboxDigestOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<InboxDigestInput> {
    // 解析周期
    let period: "daily" | "weekly" | "monthly" = "daily";
    if (/每周|周报|这周|本周|一周/.test(message)) {
      period = "weekly";
    } else if (/每月|月报|这个月|本月|一个月/.test(message)) {
      period = "monthly";
    }

    // 是否包含已读
    const includeRead =
      /包含已读|全部消息|所有消息|已读/.test(message) || false;

    // 是否自动标记已读
    const autoMarkRead = /标记已读|自动已读|清理/.test(message) || false;

    return {
      period,
      includeRead,
      autoMarkRead,
    };
  }

  /**
   * 流式执行摘要生成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as InboxDigestInput;

    // 初始化进度
    this.initProgress(INBOX_DIGEST_STEPS);

    try {
      // Step 1: 获取消息数据
      yield* this.reportProgress("获取消息", 5, "正在获取消息数据...");
      yield* this.emitText("📬 正在获取收件箱消息，请稍候...\n\n");

      const { messages, periodStart, periodEnd } = await this.fetchMessages(
        context.userId,
        input,
      );

      yield* this.reportProgress(
        "获取消息",
        15,
        `找到 ${messages.length} 条消息`,
      );

      if (messages.length === 0) {
        yield* this.emitText(
          `在 ${this.formatDate(periodStart)} 至 ${this.formatDate(periodEnd)} 期间没有消息。\n\n`,
        );
        yield* this.emitText("🎉 收件箱一切清爽！");
        yield* this.emitDone(true, "没有需要处理的消息");
        return;
      }

      yield* this.emitText(
        `找到 **${messages.length}** 条消息（${this.formatDate(periodStart)} ~ ${this.formatDate(periodEnd)}）\n\n`,
      );

      // Step 2: 统计分析
      yield* this.reportProgress("分析统计", 25, "正在分析消息分布...");
      yield* this.emitText("📊 正在分析消息分布...\n\n");

      const { byLevel, byType, highlights, overview } = this.analyzeMessages(
        messages,
        periodStart,
        periodEnd,
      );

      yield* this.reportProgress("分析统计", 45, "统计分析完成");

      // Step 3: 趋势分析
      yield* this.reportProgress("趋势分析", 50, "正在分析趋势变化...");

      const trends = this.analyzeTrends(messages, input.period);

      yield* this.reportProgress("趋势分析", 65, "趋势分析完成");

      // Step 4: 生成报告
      yield* this.reportProgress("生成报告", 70, "正在生成摘要报告...");

      const suggestions = this.generateSuggestions(
        overview,
        byLevel,
        byType,
        trends,
      );
      const report = this.generateReport(
        overview,
        byLevel,
        byType,
        highlights,
        trends,
        suggestions,
        input.period,
      );

      yield* this.reportProgress("生成报告", 90, "报告生成完成");

      // 构建输出
      const output: InboxDigestOutput = {
        report,
        data: {
          overview,
          byLevel,
          byType,
          highlights,
          trends,
          suggestions,
        },
        generatedAt: new Date().toISOString(),
      };

      // 输出报告内容
      yield* this.emitText(report);

      // Step 5: 输出交付物
      yield* this.reportProgress("输出交付物", 95, "正在生成交付物...");

      const deliverable = this.createDeliverable(
        "report",
        `收件箱摘要 - ${this.getPeriodLabel(input.period)}`,
        output,
        "markdown",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            period: input.period,
            totalMessages: overview.totalMessages,
            unreadCount: overview.unreadCount,
            generatedAt: output.generatedAt,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (suggestions.length > 0) {
        yield* this.emitSuggestions(
          suggestions.slice(0, 3).map((s, i) => ({
            text: `建议 ${i + 1}`,
            action: "message_action",
            params: { suggestion: s },
            icon: "💡",
          })),
        );
      }

      // 如果需要自动标记已读
      if (input.autoMarkRead && overview.unreadCount > 0) {
        yield* this.emitText(
          `\n\n✅ 已将 ${overview.unreadCount} 条消息标记为已读`,
        );
        await this.markMessagesAsRead(context.userId, messages);
      }

      yield* this.reportProgress("完成", 100, "摘要生成完成");
      yield* this.emitDone(
        true,
        `已为您生成${this.getPeriodLabel(input.period)}收件箱摘要`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          period: input.period,
          totalMessages: messages.length,
          durationMs: Date.now() - startTime,
        },
        "InboxDigestSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "InboxDigestSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "摘要生成失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "摘要生成失败");
    }
  }

  /**
   * 获取消息数据
   */
  private async fetchMessages(
    userId: string,
    input: InboxDigestInput,
  ): Promise<{
    messages: MessageRow[];
    periodStart: Date;
    periodEnd: Date;
  }> {
    const supabase = await createClient();
    const now = new Date();
    let periodStart: Date;

    // 计算时间范围
    switch (input.period) {
      case "daily":
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        periodStart = new Date(now);
        periodStart.setMonth(periodStart.getMonth() - 1);
        periodStart.setHours(0, 0, 0, 0);
        break;
    }

    let query = supabase
      .from("user_notifications")
      .select(
        "id, type_code, priority, title, body, status, created_at, read_at, action_url",
      )
      .eq("user_id", userId)
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false });

    // 是否包含已读消息
    if (!input.includeRead) {
      query = query.eq("status", "unread");
    }

    // 消息类型筛选
    if (input.messageTypes && input.messageTypes.length > 0) {
      query = query.in("type_code", input.messageTypes);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "InboxDigestSkill: Failed to fetch messages");
      throw new Error(`获取消息数据失败: ${error.message}`);
    }

    return {
      messages: (data || []) as MessageRow[],
      periodStart,
      periodEnd: now,
    };
  }

  /**
   * 分析消息数据
   */
  private analyzeMessages(
    messages: MessageRow[],
    periodStart: Date,
    periodEnd: Date,
  ): {
    byLevel: InboxDigestOutput["data"]["byLevel"];
    byType: InboxDigestOutput["data"]["byType"];
    highlights: InboxDigestOutput["data"]["highlights"];
    overview: InboxDigestOutput["data"]["overview"];
  } {
    const total = messages.length;
    const unreadCount = messages.filter((m) => m.status === "unread").length;
    const readCount = total - unreadCount;

    // 按级别统计
    const levelCounts: Record<string, number> = {
      silent: 0,
      normal: 0,
      important: 0,
    };
    messages.forEach((m) => {
      if (m.level in levelCounts) {
        levelCounts[m.level]++;
      }
    });

    const byLevel = Object.entries(levelCounts)
      .filter(([, count]) => count > 0)
      .map(([level, count]) => ({
        level: level as "silent" | "normal" | "important",
        levelLabel: MESSAGE_LEVEL_LABELS[level] || level,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => {
        const order = { important: 0, normal: 1, silent: 2 };
        return order[a.level] - order[b.level];
      });

    // 按类型统计
    const typeGroups: Record<string, { count: number; latestMsg: MessageRow }> =
      {};
    messages.forEach((m) => {
      if (!typeGroups[m.type]) {
        typeGroups[m.type] = { count: 0, latestMsg: m };
      }
      typeGroups[m.type].count++;
    });

    const byType = Object.entries(typeGroups)
      .map(([type, { count, latestMsg }]) => ({
        type,
        typeLabel: MESSAGE_TYPE_LABELS[type] || type,
        count,
        latestTitle: latestMsg.title,
      }))
      .sort((a, b) => b.count - a.count);

    // 重要消息列表（前 10 条重要或普通级别的未读消息）
    const highlights = messages
      .filter((m) => m.level !== "silent" && m.status === "unread")
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        content: m.content,
        createdAt: m.created_at,
        actionUrl: m.action_url,
      }));

    return {
      byLevel,
      byType,
      highlights,
      overview: {
        totalMessages: total,
        unreadCount,
        readCount,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    };
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(
    messages: MessageRow[],
    _period: "daily" | "weekly" | "monthly",
  ): InboxDigestOutput["data"]["trends"] {
    // 按天分组统计
    const dailyCounts: Record<string, number> = {};
    messages.forEach((m) => {
      const day = m.created_at.split("T")[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    const days = Object.keys(dailyCounts).sort();
    const counts = days.map((d) => dailyCounts[d]);

    // 计算平均和峰值
    const avgDailyCount =
      counts.length > 0
        ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
        : 0;

    let peakDay: string | null = null;
    let peakCount = 0;
    days.forEach((day) => {
      if (dailyCounts[day] > peakCount) {
        peakCount = dailyCounts[day];
        peakDay = day;
      }
    });

    // 判断趋势
    let trend: "increasing" | "stable" | "decreasing" = "stable";
    let trendLabel = "保持稳定";

    if (counts.length >= 3) {
      const recentHalf = counts.slice(-Math.ceil(counts.length / 2));
      const earlyHalf = counts.slice(0, Math.floor(counts.length / 2));

      const recentAvg =
        recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
      const earlyAvg = earlyHalf.reduce((a, b) => a + b, 0) / earlyHalf.length;

      if (recentAvg > earlyAvg * 1.2) {
        trend = "increasing";
        trendLabel = "消息量上升";
      } else if (recentAvg < earlyAvg * 0.8) {
        trend = "decreasing";
        trendLabel = "消息量下降";
      }
    }

    return {
      trend,
      trendLabel,
      avgDailyCount,
      peakDay,
      peakCount,
    };
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    overview: InboxDigestOutput["data"]["overview"],
    byLevel: InboxDigestOutput["data"]["byLevel"],
    byType: InboxDigestOutput["data"]["byType"],
    trends: InboxDigestOutput["data"]["trends"],
  ): string[] {
    const suggestions: string[] = [];

    // 基于未读数量
    if (overview.unreadCount > 20) {
      suggestions.push("未读消息较多，建议批量标记已读以保持清爽");
    }

    // 基于重要消息
    const importantLevel = byLevel.find((l) => l.level === "important");
    if (importantLevel && importantLevel.count > 0) {
      suggestions.push(`有 ${importantLevel.count} 条重要通知，建议优先查看`);
    }

    // 基于消息类型
    const importFailedType = byType.find((t) => t.type === "import_failed");
    if (importFailedType) {
      suggestions.push("有导入失败的消息，请检查导入状态");
    }

    const quotaTypes = byType.filter(
      (t) =>
        t.type === "quota_warning" ||
        t.type === "quota_critical" ||
        t.type === "quota_exceeded",
    );
    if (quotaTypes.length > 0) {
      suggestions.push("存在配额预警，请关注存储空间使用情况");
    }

    const invalidType = byType.find((t) => t.type === "bookmark_invalid");
    if (invalidType) {
      suggestions.push(`有 ${invalidType.count} 条失效链接提醒，建议清理`);
    }

    // 基于趋势
    if (trends.trend === "increasing") {
      suggestions.push("消息量呈上升趋势，建议定期查看和整理");
    }

    // 基于静默消息占比
    const silentLevel = byLevel.find((l) => l.level === "silent");
    if (silentLevel && silentLevel.percentage > 70) {
      suggestions.push("静默通知占比较高，可以考虑批量标记已读");
    }

    return suggestions;
  }

  /**
   * 生成报告
   */
  private generateReport(
    overview: InboxDigestOutput["data"]["overview"],
    byLevel: InboxDigestOutput["data"]["byLevel"],
    byType: InboxDigestOutput["data"]["byType"],
    highlights: InboxDigestOutput["data"]["highlights"],
    trends: InboxDigestOutput["data"]["trends"],
    suggestions: string[],
    period: "daily" | "weekly" | "monthly",
  ): string {
    const lines: string[] = [];

    // 标题
    lines.push(`## 📬 ${this.getPeriodLabel(period)}收件箱摘要\n`);

    // 概览
    lines.push("### 📊 概览\n");
    lines.push(`- **总消息数**: ${overview.totalMessages}`);
    lines.push(`- **未读消息**: ${overview.unreadCount}`);
    lines.push(`- **已读消息**: ${overview.readCount}`);
    lines.push(
      `- **统计周期**: ${this.formatDate(new Date(overview.periodStart))} ~ ${this.formatDate(new Date(overview.periodEnd))}`,
    );
    lines.push("");

    // 按级别分布
    if (byLevel.length > 0) {
      lines.push("### 📈 消息级别分布\n");
      byLevel.forEach((l) => {
        const emoji = this.getLevelEmoji(l.level);
        lines.push(
          `- ${emoji} **${l.levelLabel}**: ${l.count} 条 (${l.percentage}%)`,
        );
      });
      lines.push("");
    }

    // 按类型分布（前 5 个）
    if (byType.length > 0) {
      lines.push("### 📋 消息类型分布（Top 5）\n");
      byType.slice(0, 5).forEach((t, i) => {
        lines.push(`${i + 1}. **${t.typeLabel}**: ${t.count} 条`);
      });
      if (byType.length > 5) {
        lines.push(`\n*...还有 ${byType.length - 5} 种类型*`);
      }
      lines.push("");
    }

    // 重要消息
    if (highlights.length > 0) {
      lines.push("### ⭐ 重要消息\n");
      highlights.slice(0, 5).forEach((h) => {
        const typeLabel = MESSAGE_TYPE_LABELS[h.type] || h.type;
        lines.push(`- **${h.title}** (${typeLabel})`);
      });
      if (highlights.length > 5) {
        lines.push(`\n*...还有 ${highlights.length - 5} 条重要消息*`);
      }
      lines.push("");
    }

    // 趋势
    lines.push("### 📉 趋势分析\n");
    lines.push(`- **趋势**: ${trends.trendLabel}`);
    lines.push(`- **日均消息**: ${trends.avgDailyCount} 条`);
    if (trends.peakDay) {
      lines.push(
        `- **峰值**: ${this.formatDate(new Date(trends.peakDay))} (${trends.peakCount} 条)`,
      );
    }
    lines.push("");

    // 建议
    if (suggestions.length > 0) {
      lines.push("### 💡 建议\n");
      suggestions.forEach((s) => {
        lines.push(`- ${s}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 批量标记已读
   */
  private async markMessagesAsRead(
    userId: string,
    messages: MessageRow[],
  ): Promise<void> {
    const supabase = await createClient();
    const unreadIds = messages
      .filter((m) => m.status === "unread")
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase.rpc("mark_messages_read", {
      p_user_id: userId,
      p_message_ids: unreadIds,
    });

    if (error) {
      logger.error(
        { error, userId, messageCount: unreadIds.length },
        "Failed to mark messages as read",
      );
      // 不抛出错误，标记已读失败不影响主流程
    }
  }

  /**
   * 获取周期标签
   */
  private getPeriodLabel(period: "daily" | "weekly" | "monthly"): string {
    switch (period) {
      case "daily":
        return "今日";
      case "weekly":
        return "本周";
      case "monthly":
        return "本月";
    }
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  }

  /**
   * 获取级别表情
   */
  private getLevelEmoji(level: string): string {
    switch (level) {
      case "important":
        return "🔴";
      case "normal":
        return "🟡";
      case "silent":
        return "⚪";
      default:
        return "📌";
    }
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: InboxDigestInput,
    context: SkillContext,
  ): Promise<InboxDigestOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: InboxDigestOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as InboxDigestOutput;
      }
    }

    if (!output) {
      throw new Error("摘要生成失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const inboxDigestSkill = new InboxDigestSkill();
