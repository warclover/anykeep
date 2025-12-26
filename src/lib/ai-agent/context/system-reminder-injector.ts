/**
 * System-Reminder 动态注入器
 *
 * 基于用户数据状态，动态注入提醒到 System Prompt
 * 让 AI 能主动提供有价值的建议
 *
 * 借鉴：Claude Code Agent 的 <system-reminder> 机制
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { DynamicContext } from "./types";

/**
 * 提醒触发器配置
 */
export interface ReminderTrigger {
  /** 触发器 ID */
  id: string;
  /** 触发条件 */
  condition: (context: DynamicContext) => boolean;
  /** 提醒内容 */
  reminder: string;
  /** 优先级（越高越优先） */
  priority: number;
  /** 是否为主动建议（影响提醒风格） */
  isProactive: boolean;
}

/**
 * 扩展 StatsContext 以支持可选的 untaggedCount
 */
interface ExtendedStatsContext {
  untaggedCount?: number;
}

/**
 * 获取未标签数量（安全访问）
 */
function getUntaggedCount(context: DynamicContext): number {
  return (context.stats as ExtendedStatsContext).untaggedCount ?? 0;
}

/**
 * 默认提醒触发器
 */
export const REMINDER_TRIGGERS: ReminderTrigger[] = [
  {
    id: "long-inactive",
    condition: (ctx) =>
      ctx.stats.recentWeekCount === 0 && ctx.stats.totalBookmarks > 100,
    reminder:
      "用户已有一段时间未整理收藏（本周无新增），可在合适时机主动建议整理方案",
    priority: 80,
    isProactive: true,
  },
  {
    id: "platform-dominant",
    condition: (ctx) =>
      ctx.stats.topPlatform.count > ctx.stats.totalBookmarks * 0.6,
    reminder: "用户 {topPlatform} 收藏占比超60%，可建议按主题/UP主分类",
    priority: 70,
    isProactive: true,
  },
  {
    id: "untagged-many",
    condition: (ctx) => getUntaggedCount(ctx) > 50,
    reminder: "用户有大量无标签收藏，在整理相关操作时可主动建议打标签",
    priority: 60,
    isProactive: true,
  },
  {
    id: "folder-empty",
    condition: (ctx) =>
      ctx.stats.topFolders.length > 0 &&
      ctx.stats.topFolders.some((f) => f.count === 0),
    reminder: "用户有空文件夹存在，可在整理时建议清理或使用",
    priority: 50,
    isProactive: false,
  },
  {
    id: "recent-activity-high",
    condition: (ctx) => ctx.stats.recentWeekCount > 30,
    reminder: "用户本周收藏活跃（30+条），可建议定期整理以保持有序",
    priority: 65,
    isProactive: true,
  },
  {
    id: "selected-items",
    condition: (ctx) => (ctx.session.selectedBookmarkIds?.length ?? 0) > 0,
    reminder: "用户当前选中了 {selectedCount} 条书签，操作时优先考虑选中项",
    priority: 90,
    isProactive: false,
  },
];

/**
 * 格式化提醒内容（替换占位符）
 */
function formatReminder(reminder: string, context: DynamicContext): string {
  return reminder
    .replace("{topPlatform}", context.stats.topPlatform.name)
    .replace(
      "{selectedCount}",
      String(context.session.selectedBookmarkIds?.length ?? 0),
    );
}

/**
 * 获取匹配的提醒列表
 *
 * @param context 动态上下文
 * @param maxReminders 最大提醒数量（默认2，避免干扰）
 */
export function getActiveReminders(
  context: DynamicContext,
  maxReminders: number = 2,
): ReminderTrigger[] {
  return REMINDER_TRIGGERS.filter((t) => t.condition(context))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxReminders);
}

/**
 * 注入 System-Reminder 到 Prompt
 *
 * @param basePrompt 基础 Prompt
 * @param context 动态上下文
 * @param options 注入选项
 */
export function injectSystemReminders(
  basePrompt: string,
  context: DynamicContext,
  options: { maxReminders?: number; enableProactive?: boolean } = {},
): string {
  const { maxReminders = 2, enableProactive = true } = options;

  let triggers = getActiveReminders(context, maxReminders);

  // 如果禁用主动建议，过滤掉 isProactive 的提醒
  if (!enableProactive) {
    triggers = triggers.filter((t) => !t.isProactive);
  }

  if (triggers.length === 0) {
    return basePrompt;
  }

  const reminderBlock = triggers
    .map(
      (t) =>
        `<system-reminder>${formatReminder(t.reminder, context)}</system-reminder>`,
    )
    .join("\n");

  return `${basePrompt}\n\n## 智能提醒\n\n${reminderBlock}`;
}

/**
 * 判断是否应该注入提醒
 *
 * 避免过度干扰：仅在特定条件下注入
 */
export function shouldInjectReminders(context: DynamicContext): boolean {
  // 有选中项时始终注入（非干扰性）
  if ((context.session.selectedBookmarkIds?.length ?? 0) > 0) {
    return true;
  }

  // 收藏数量较多时才考虑主动建议
  if (context.stats.totalBookmarks < 50) {
    return false;
  }

  return true;
}
