/**
 * Prompt 注入器
 *
 * 将动态上下文转换为可注入 System Prompt 的文本片段
 *
 * @version 2.2.0
 * @since 2025-12-26
 * @updated 2025-12-27 - 集成 System-Reminder 动态注入
 * @updated 2025-12-27 - 添加情景记忆注入支持
 * @updated 2025-12-28 - 添加画像推断集成 [v3.1]
 */

import type { DynamicContext, EpisodicMemoryContext } from "./types";
import {
  injectSystemReminders,
  shouldInjectReminders,
} from "./system-reminder-injector";
import { FeatureFlags } from "../config/feature-flags";
import { personaInferrer, adaptQuickStatsToInference } from "../inference";
import { getPersonaPrompt } from "../personas";
import { getQuickStats } from "../services/quick-stats.service";
import { logger } from "@/lib/logger";

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

// =============================================================================
// 情景记忆 Prompt 构建
// =============================================================================

/**
 * 构建情景记忆 Prompt 段落
 *
 * @param memory 情景记忆上下文
 * @returns Markdown 格式的记忆 Prompt
 */
export function buildEpisodicMemoryPrompt(
  memory: EpisodicMemoryContext,
): string {
  const lines: string[] = ["## 情景记忆", ""];

  // 最近会话摘要
  if (memory.recentSummaries.length > 0) {
    lines.push("### 最近对话");
    for (const summary of memory.recentSummaries) {
      const intentsStr =
        summary.intents.length > 0 ? `（${summary.intents.join("、")}）` : "";
      lines.push(`- ${summary.timeAgo}：${summary.summary}${intentsStr}`);
    }
    lines.push("");
  }

  // 未完成意图
  if (memory.pendingIntents.length > 0) {
    lines.push("### 待处理事项");
    lines.push("用户之前提到但尚未完成的事项：");
    for (const intent of memory.pendingIntents) {
      lines.push(`- ${intent}`);
    }
    lines.push("");
    lines.push(
      "_提示：可以主动询问用户是否需要继续处理这些事项，但不要过于打扰。_",
    );
    lines.push("");
  }

  // 用户偏好（来自交互日志）
  if (memory.preferences) {
    lines.push("### 用户偏好");
    const satisfactionDesc = getSatisfactionDescription(
      memory.preferences.positiveRate,
    );
    lines.push(`- 历史满意度：${satisfactionDesc}`);

    if (memory.preferences.commonActions.length > 0) {
      lines.push(`- 常用功能：${memory.preferences.commonActions.join("、")}`);
    }

    if (memory.preferences.totalInteractions >= 10) {
      lines.push(`- 累计交互：${memory.preferences.totalInteractions} 次`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 获取满意度描述
 */
function getSatisfactionDescription(rate: number): string {
  if (rate >= 0.9) {
    return "非常高（建议保持当前互动风格）";
  } else if (rate >= 0.7) {
    return "较高";
  } else if (rate >= 0.5) {
    return "一般（可适当调整建议方式）";
  } else {
    return "较低（建议更谨慎地提供建议，多询问确认）";
  }
}

/**
 * 检查情景记忆是否为空
 */
function isEmptyEpisodicMemory(memory?: EpisodicMemoryContext): boolean {
  if (!memory) return true;
  return (
    memory.recentSummaries.length === 0 &&
    memory.pendingIntents.length === 0 &&
    memory.preferences === null
  );
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
 * 合并选项
 */
export interface MergePromptOptions {
  /** 使用精简版上下文 */
  minimal?: boolean;
  /** 启用 System-Reminder 注入 */
  enableReminders?: boolean;
  /** 启用主动建议（仅在 enableReminders 为 true 时有效） */
  enableProactive?: boolean;
  /** 最大提醒数量 */
  maxReminders?: number;
  /** 启用情景记忆注入 */
  enableEpisodicMemory?: boolean;
}

/**
 * 异步合并选项（扩展同步选项）
 */
export interface MergePromptOptionsAsync extends MergePromptOptions {
  /** 启用画像推断注入 */
  enablePersonaInference?: boolean;
  /** 用户 ID（画像推断必需） */
  userId?: string;
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
  options: MergePromptOptions = {},
): string {
  const {
    minimal = false,
    enableReminders = FeatureFlags.ENABLE_SYSTEM_REMINDER,
    enableProactive = true,
    maxReminders = 2,
    enableEpisodicMemory = FeatureFlags.ENABLE_EPISODIC_MEMORY &&
      FeatureFlags.ENABLE_MEMORY_PROMPT,
  } = options;

  const contextPrompt = minimal
    ? buildMinimalContextPrompt(ctx)
    : buildContextPrompt(ctx);

  let result = `${basePrompt}\n\n${contextPrompt}`;

  // 注入情景记忆（如果启用且有内容）
  if (enableEpisodicMemory && !isEmptyEpisodicMemory(ctx.episodicMemory)) {
    const memoryPrompt = buildEpisodicMemoryPrompt(ctx.episodicMemory!);
    result = `${result}\n\n${memoryPrompt}`;
  }

  // 注入 System-Reminder（如果启用且满足条件）
  if (enableReminders && shouldInjectReminders(ctx)) {
    result = injectSystemReminders(result, ctx, {
      maxReminders,
      enableProactive,
    });
  }

  return result;
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

// =============================================================================
// 画像推断集成 [v3.1 新增]
// =============================================================================

/**
 * 构建画像 Prompt 段落
 *
 * 基于用户行为数据推断画像类型，返回对应的专属 Prompt
 *
 * @param userId 用户 ID
 * @returns 画像 Prompt 文本，如果无法推断则返回 null
 */
export async function buildPersonaPrompt(
  userId: string,
): Promise<string | null> {
  // 检查 Feature Flag
  if (!FeatureFlags.ENABLE_PERSONA_INFERENCE) {
    return null;
  }

  try {
    // 获取用户统计数据
    const quickStats = await getQuickStats(userId);

    // 转换为推断引擎所需格式
    const userStats = adaptQuickStatsToInference(userId, quickStats);

    // 执行画像推断
    const result = await personaInferrer.infer(userStats);

    // 检查置信度是否足够（置信度 0-100，阈值 60%）
    if (!result.primaryPersona || result.confidence < 60) {
      logger.debug(
        {
          userId: userId.slice(0, 8) + "...",
          confidence: result.confidence,
          persona: result.primaryPersona,
        },
        "PersonaPrompt: Confidence too low, skipping",
      );
      return null;
    }

    // 获取画像专属 Prompt
    const prompt = getPersonaPrompt(result.primaryPersona);
    if (!prompt) {
      return null;
    }

    logger.info(
      {
        userId: userId.slice(0, 8) + "...",
        persona: result.primaryPersona,
        confidence: result.confidence,
      },
      "PersonaPrompt: Injected",
    );

    return `## 用户画像\n\n${prompt}`;
  } catch (error) {
    logger.error(
      {
        userId: userId.slice(0, 8) + "...",
        error: error instanceof Error ? error.message : String(error),
      },
      "PersonaPrompt: Failed to build",
    );
    return null;
  }
}

/**
 * 异步合并基础 Prompt 和动态上下文
 *
 * 支持画像推断注入（需要异步获取用户数据）
 *
 * @param basePrompt 基础 System Prompt
 * @param ctx 动态上下文
 * @param options 合并选项
 * @returns 完整的 System Prompt
 */
export async function mergeSystemPromptAsync(
  basePrompt: string,
  ctx: DynamicContext,
  options: MergePromptOptionsAsync = {},
): Promise<string> {
  const {
    minimal = false,
    enableReminders = FeatureFlags.ENABLE_SYSTEM_REMINDER,
    enableProactive = true,
    maxReminders = 2,
    enableEpisodicMemory = FeatureFlags.ENABLE_EPISODIC_MEMORY &&
      FeatureFlags.ENABLE_MEMORY_PROMPT,
    enablePersonaInference = FeatureFlags.ENABLE_PERSONA_INFERENCE,
    userId,
  } = options;

  const contextPrompt = minimal
    ? buildMinimalContextPrompt(ctx)
    : buildContextPrompt(ctx);

  let result = `${basePrompt}\n\n${contextPrompt}`;

  // 注入画像 Prompt（如果启用且有 userId）
  if (enablePersonaInference && userId) {
    const personaPrompt = await buildPersonaPrompt(userId);
    if (personaPrompt) {
      result = `${result}\n\n${personaPrompt}`;
    }
  }

  // 注入情景记忆（如果启用且有内容）
  if (enableEpisodicMemory && !isEmptyEpisodicMemory(ctx.episodicMemory)) {
    const memoryPrompt = buildEpisodicMemoryPrompt(ctx.episodicMemory!);
    result = `${result}\n\n${memoryPrompt}`;
  }

  // 注入 System-Reminder（如果启用且满足条件）
  if (enableReminders && shouldInjectReminders(ctx)) {
    result = injectSystemReminders(result, ctx, {
      maxReminders,
      enableProactive,
    });
  }

  return result;
}
