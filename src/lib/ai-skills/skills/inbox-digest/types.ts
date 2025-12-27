/**
 * InboxDigestSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";

// ============================================
// 输入 Schema
// ============================================

export const InboxDigestInputSchema = z.object({
  /** 摘要周期 */
  period: z
    .enum(["daily", "weekly", "monthly"])
    .default("daily")
    .describe("摘要周期：daily-每日，weekly-每周，monthly-每月"),

  /** 是否包含已读消息 */
  includeRead: z.boolean().default(false).describe("是否包含已读消息"),

  /** 消息类型筛选 */
  messageTypes: z
    .array(z.string())
    .optional()
    .describe("指定消息类型（不传则全部）"),

  /** 是否自动标记已读 */
  autoMarkRead: z
    .boolean()
    .default(false)
    .describe("生成摘要后是否自动标记为已读"),
});

export type InboxDigestInput = z.infer<typeof InboxDigestInputSchema>;

// ============================================
// 输出 Schema
// ============================================

export const InboxDigestOutputSchema = z.object({
  /** 摘要报告（Markdown） */
  report: z.string(),

  /** 结构化数据 */
  data: z.object({
    /** 概览统计 */
    overview: z.object({
      totalMessages: z.number(),
      unreadCount: z.number(),
      readCount: z.number(),
      periodStart: z.string(),
      periodEnd: z.string(),
    }),

    /** 按级别统计 */
    byLevel: z.array(
      z.object({
        level: z.enum(["silent", "normal", "important"]),
        levelLabel: z.string(),
        count: z.number(),
        percentage: z.number(),
      }),
    ),

    /** 按类型统计 */
    byType: z.array(
      z.object({
        type: z.string(),
        typeLabel: z.string(),
        count: z.number(),
        latestTitle: z.string().optional(),
      }),
    ),

    /** 重要消息列表 */
    highlights: z.array(
      z.object({
        id: z.number(),
        type: z.string(),
        title: z.string(),
        content: z.string().nullable(),
        createdAt: z.string(),
        actionUrl: z.string().nullable(),
      }),
    ),

    /** 趋势分析 */
    trends: z.object({
      trend: z.enum(["increasing", "stable", "decreasing"]),
      trendLabel: z.string(),
      avgDailyCount: z.number(),
      peakDay: z.string().nullable(),
      peakCount: z.number(),
    }),

    /** 建议动作 */
    suggestions: z.array(z.string()),
  }),

  /** 生成时间 */
  generatedAt: z.string(),
});

export type InboxDigestOutput = z.infer<typeof InboxDigestOutputSchema>;

// ============================================
// 内部类型
// ============================================

/** 消息记录（数据库行） */
export interface MessageRow {
  id: number;
  type: string;
  level: string;
  title: string;
  content: string | null;
  status: string;
  created_at: string;
  read_at: string | null;
  action_url: string | null;
}

/** 消息类型标签映射 */
export const MESSAGE_TYPE_LABELS: Record<string, string> = {
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
};

/** 消息级别标签 */
export const MESSAGE_LEVEL_LABELS: Record<string, string> = {
  silent: "静默通知",
  normal: "普通通知",
  important: "重要通知",
};

// ============================================
// 步骤定义
// ============================================

export const INBOX_DIGEST_STEPS = [
  {
    id: "fetch",
    name: "获取消息",
    description: "获取指定时间段的消息数据",
    weight: 15,
  },
  {
    id: "analyze",
    name: "分析统计",
    description: "按类型和级别进行统计分析",
    weight: 25,
  },
  {
    id: "trends",
    name: "趋势分析",
    description: "分析消息趋势变化",
    weight: 20,
  },
  {
    id: "generate",
    name: "生成报告",
    description: "生成摘要报告",
    weight: 30,
  },
  {
    id: "deliver",
    name: "输出交付物",
    description: "输出最终报告",
    weight: 10,
  },
];
