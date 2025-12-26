/**
 * Prompt 注入器
 *
 * 将动态上下文转换为可注入 System Prompt 的文本片段
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import type { DynamicContext } from "./types";

// =============================================================================
// 时间段描述
// =============================================================================

const PERIOD_DESCRIPTIONS: Record<string, string> = {
  morning: "上午",
  afternoon: "下午",
  evening: "晚上",
  night: "深夜",
};

// =============================================================================
// Prompt 构建函数
// =============================================================================

/**
 * 将动态上下文转换为 Prompt 片段
 *
 * @param ctx 动态上下文
 * @returns 可注入 System Prompt 的文本
 */
export function buildContextPrompt(ctx: DynamicContext): string {
  const lines: string[] = ["## 用户数据概况", ""];

  // 时间信息
  const weekendNote = ctx.time.isWeekend ? "（周末）" : "";
  const periodNote = PERIOD_DESCRIPTIONS[ctx.time.period] || "";
  lines.push(`【时间】${ctx.time.current}${weekendNote} ${periodNote}`);

  // 收藏概况
  lines.push(
    `【收藏概况】共 ${ctx.stats.totalBookmarks} 条收藏，最近 7 天新增 ${ctx.stats.recentWeekCount} 条`,
  );

  // 最常用平台
  if (ctx.stats.topPlatform.count > 0) {
    lines.push(
      `【最常用平台】${ctx.stats.topPlatform.name}（${ctx.stats.topPlatform.count} 条）`,
    );
  }

  // 常用文件夹
  if (ctx.stats.topFolders.length > 0) {
    const folderStr = ctx.stats.topFolders
      .map((f) => `${f.name}(ID:${f.id}, ${f.count}条)`)
      .join("、");
    lines.push(`【常用文件夹】${folderStr}`);
  }

  // 常用标签
  if (ctx.preferences.frequentTags.length > 0) {
    lines.push(`【常用标签】${ctx.preferences.frequentTags.join("、")}`);
  }

  // 最近活动
  if (ctx.recentActivity.lastSaved) {
    const { title, platform, time } = ctx.recentActivity.lastSaved;
    lines.push(`【最近收藏】${time}收藏了「${title}」(${platform})`);
  }

  // 当前会话上下文
  if (
    ctx.session.selectedBookmarkIds &&
    ctx.session.selectedBookmarkIds.length > 0
  ) {
    lines.push(
      `【当前选中】用户选中了 ${ctx.session.selectedBookmarkIds.length} 条书签`,
    );
  }

  if (ctx.session.currentFolder) {
    lines.push(
      `【当前文件夹】${ctx.session.currentFolder.name}(ID:${ctx.session.currentFolder.id})`,
    );
  }

  // 使用说明
  lines.push("");
  lines.push(
    "**注意**：上述信息已预加载，可直接引用回答用户，无需调用工具查询。",
  );

  return lines.join("\n");
}

/**
 * 构建精简版上下文 Prompt（仅包含必要信息）
 *
 * 用于简单查询，减少 Token 消耗
 *
 * @param ctx 动态上下文
 * @returns 精简的 Prompt 文本
 */
export function buildMinimalContextPrompt(ctx: DynamicContext): string {
  const lines: string[] = ["## 快速参考", ""];

  lines.push(`时间: ${ctx.time.current}`);
  lines.push(
    `收藏: ${ctx.stats.totalBookmarks}条, 本周+${ctx.stats.recentWeekCount}`,
  );

  if (ctx.stats.topFolders.length > 0) {
    const folderStr = ctx.stats.topFolders
      .map((f) => `${f.name}(${f.id})`)
      .join("、");
    lines.push(`常用文件夹: ${folderStr}`);
  }

  return lines.join("\n");
}

/**
 * 合并基础 Prompt 和动态上下文
 *
 * @param basePrompt 基础 System Prompt
 * @param ctx 动态上下文
 * @param options 合并选项
 * @returns 完整的 System Prompt
 */
export function mergeSystemPrompt(
  basePrompt: string,
  ctx: DynamicContext,
  options: { minimal?: boolean } = {},
): string {
  const contextPrompt = options.minimal
    ? buildMinimalContextPrompt(ctx)
    : buildContextPrompt(ctx);

  return `${basePrompt}\n\n${contextPrompt}`;
}

// =============================================================================
// Token 估算
// =============================================================================

/**
 * 估算动态上下文的 Token 数量
 *
 * 粗略估算：中文约 2 字符/token，英文约 4 字符/token
 *
 * @param ctx 动态上下文
 * @returns 估算的 Token 数量
 */
export function estimateContextTokens(ctx: DynamicContext): number {
  const prompt = buildContextPrompt(ctx);
  // 中英混合文本，取平均值约 3 字符/token
  return Math.ceil(prompt.length / 3);
}
