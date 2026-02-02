/**
 * summarize_unread_messages Tool
 *
 * 生成未读消息的智能摘要
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { MessageType, MessageLevel, Message } from "@/lib/messages/types";

// ============================================
// 查询结果类型
// ============================================

/** Supabase 查询返回的消息记录类型 */
type MessageQueryRow = Pick<
  Message,
  "id" | "type" | "level" | "title" | "content" | "created_at"
>;

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  includeContent: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含消息详细内容（默认仅统计）"),
});

type SummarizeUnreadParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

/** 按类型分组的消息统计 */
interface MessageTypeSummary {
  type: MessageType;
  typeLabel: string;
  count: number;
  latestTitle?: string;
  latestAt?: string;
}

/** 按级别分组的统计 */
interface MessageLevelSummary {
  level: MessageLevel;
  levelLabel: string;
  count: number;
}

/** 摘要结果 */
interface SummarizeUnreadResult {
  /** 未读消息总数 */
  totalUnread: number;
  /** 按级别统计 */
  byLevel: MessageLevelSummary[];
  /** 按类型统计 */
  byType: MessageTypeSummary[];
  /** 重要消息列表（前 5 条） */
  importantMessages: Array<{
    id: number;
    title: string;
    type: MessageType;
    createdAt: string;
  }>;
  /** 文字摘要 */
  summary: string;
  /** 建议动作 */
  suggestedActions: string[];
}

// ============================================
// 消息类型标签映射
// ============================================

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  // 分类相关
  classification_auto: "自动分类",
  classification_batch: "批量分类",
  classification_suggest: "分类建议",
  classification_failed: "分类失败",
  reclassify_complete: "重新分类",
  // 导入相关
  import_complete: "导入完成",
  import_partial: "部分导入",
  import_failed: "导入失败",
  // 批量操作
  batch_move: "批量移动",
  batch_delete: "批量删除",
  batch_tag: "批量标签",
  batch_restore: "批量恢复",
  // 书签状态
  bookmark_saved: "书签保存",
  bookmark_invalid: "失效链接",
  bookmark_expired: "书签过期",
  // 文件夹操作
  folder_created: "文件夹创建",
  folder_merged: "文件夹合并",
  folder_auto_created: "AI 创建文件夹",
  folder_auto_split: "AI 分拆文件夹",
  folder_auto_merged: "AI 合并文件夹",
  folder_auto_renamed: "AI 重命名",
  folder_operation_undone: "操作撤销",
  // 系统消息
  system_announcement: "系统公告",
  system_maintenance: "系统维护",
  system_update: "版本更新",
  // 配额相关
  quota_warning: "配额预警",
  quota_critical: "配额临界",
  quota_exceeded: "配额超限",
  // 用户反馈
  feedback_received: "反馈已收到",
  feedback_response: "反馈回复",
  // AI 处理
  ai_summary_complete: "AI 摘要完成",
  ai_tags_complete: "AI 标签完成",
  ai_processing_failed: "AI 处理失败",
  ai_evolution_report: "AI 进化报告",
  // 成本监控
  cost_warning: "成本预警",
  cost_critical: "成本超限",
  cost_daily_exceeded: "日成本超限",
  // 页面监控
  page_content_changed: "页面内容变更",
  page_monitor_failed: "监控失败",
  page_monitor_quota_reached: "监控配额已满",
};

const MESSAGE_LEVEL_LABELS: Record<MessageLevel, string> = {
  silent: "静默通知",
  normal: "普通通知",
  important: "重要通知",
};

// ============================================
// Tool 实现
// ============================================

export const summarizeUnreadMessagesTool: Tool<
  SummarizeUnreadParams,
  SummarizeUnreadResult
> = {
  definition: {
    name: "summarize_unread_messages",
    description: `生成未读消息的智能摘要。

功能：
- 统计未读消息数量
- 按类型/级别分组统计
- 列出重要消息
- 生成文字摘要和建议

使用场景：
- "总结一下未读消息"
- "有什么重要的消息吗"
- "消息摘要"
- "未读通知概览"

返回：统计数据、分组摘要、建议动作`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: SummarizeUnreadParams,
    context: ToolContext,
  ): Promise<ToolResult<SummarizeUnreadResult>> {
    const startTime = performance.now();
    const supabase = await createClient();

    // 获取所有未读消息
    const { data: messages, error } = await supabase
      .from("user_notifications")
      .select("id, type_code, priority, title, body, created_at")
      .eq("user_id", context.userId)
      .eq("status", "unread")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error(
        {
          toolName: "summarize_unread_messages",
          userId: context.userId,
          error: error.message,
        },
        "summarize_unread_messages: DB Error",
      );

      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    const totalUnread = messages?.length ?? 0;

    if (totalUnread === 0) {
      return {
        success: true,
        data: {
          totalUnread: 0,
          byLevel: [],
          byType: [],
          importantMessages: [],
          summary: "没有未读消息，一切都处理完毕了！",
          suggestedActions: [],
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: 0,
        },
      };
    }

    // 按级别统计
    const levelCounts: Record<MessageLevel, number> = {
      silent: 0,
      normal: 0,
      important: 0,
    };
    (messages as MessageQueryRow[]).forEach((msg) => {
      const level = msg.level;
      if (level in levelCounts) {
        levelCounts[level]++;
      }
    });

    const byLevel: MessageLevelSummary[] = Object.entries(levelCounts)
      .filter(([, count]) => count > 0)
      .map(([level, count]) => ({
        level: level as MessageLevel,
        levelLabel: MESSAGE_LEVEL_LABELS[level as MessageLevel],
        count,
      }))
      .sort((a, b) => {
        // 重要 > 普通 > 静默
        const order: Record<MessageLevel, number> = {
          important: 0,
          normal: 1,
          silent: 2,
        };
        return order[a.level] - order[b.level];
      });

    // 按类型统计
    const typeGroups: Record<
      string,
      { count: number; latestMsg: MessageQueryRow }
    > = {};
    (messages as MessageQueryRow[]).forEach((msg) => {
      const type = msg.type as string;
      if (!typeGroups[type]) {
        typeGroups[type] = { count: 0, latestMsg: msg };
      }
      typeGroups[type].count++;
    });

    const byType: MessageTypeSummary[] = Object.entries(typeGroups)
      .map(([type, { count, latestMsg }]) => ({
        type: type as MessageType,
        typeLabel: MESSAGE_TYPE_LABELS[type] ?? type,
        count,
        latestTitle: latestMsg.title,
        latestAt: latestMsg.created_at,
      }))
      .sort((a, b) => b.count - a.count);

    // 获取重要消息（前 5 条）
    const importantMessages = (messages as MessageQueryRow[])
      .filter((msg) => msg.level === "important")
      .slice(0, 5)
      .map((msg) => ({
        id: msg.id,
        title: msg.title,
        type: msg.type,
        createdAt: msg.created_at,
      }));

    // 生成文字摘要
    const summaryParts: string[] = [];
    summaryParts.push(`您有 ${totalUnread} 条未读消息`);

    if (levelCounts.important > 0) {
      summaryParts.push(`其中 ${levelCounts.important} 条重要通知`);
    }

    // 找出最多的消息类型
    if (byType.length > 0) {
      const topType = byType[0];
      if (topType.count >= 3) {
        summaryParts.push(
          `${topType.typeLabel}消息最多（${topType.count} 条）`,
        );
      }
    }

    const summary = summaryParts.join("，") + "。";

    // 生成建议动作
    const suggestedActions: string[] = [];

    if (levelCounts.important > 0) {
      suggestedActions.push("建议优先查看重要通知");
    }

    if (totalUnread > 20) {
      suggestedActions.push("消息较多，可以考虑批量标记已读");
    }

    // 检查特定类型消息
    if (typeGroups["import_failed"]) {
      suggestedActions.push("有导入失败的消息，请检查导入状态");
    }
    if (typeGroups["quota_warning"] || typeGroups["quota_critical"]) {
      suggestedActions.push("配额预警，请关注存储空间");
    }
    if (typeGroups["bookmark_invalid"]) {
      suggestedActions.push("有失效链接提醒，建议清理无效书签");
    }

    logger.info(
      {
        toolName: "summarize_unread_messages",
        userId: context.userId,
        totalUnread,
        importantCount: levelCounts.important,
        typeCount: byType.length,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "summarize_unread_messages: Success",
    );

    return {
      success: true,
      data: {
        totalUnread,
        byLevel,
        byType,
        importantMessages,
        summary,
        suggestedActions,
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: totalUnread,
      },
    };
  },
};
