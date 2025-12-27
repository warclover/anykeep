/**
 * 记忆 Prompt 构建器
 *
 * 将情景记忆格式化为可注入 System Prompt 的文本
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import type {
  EpisodicMemoryContext,
  RecentSummary,
  UserPreferencesAnalysis,
} from "./types";

// =============================================================================
// 常量
// =============================================================================

/**
 * 记忆段落标题
 */
const MEMORY_SECTION_HEADER = "## 情景记忆";

/**
 * 默认 Token 预算
 */
const DEFAULT_TOKEN_BUDGET = 300;

// =============================================================================
// 记忆 Prompt 构建器
// =============================================================================

const log = logger.child({ module: "MemoryPromptBuilder" });

/**
 * 构建记忆 Prompt 段落
 *
 * 将情景记忆上下文格式化为可注入 System Prompt 的 Markdown 文本
 */
export function buildMemoryPrompt(
  context: EpisodicMemoryContext,
  tokenBudget: number = DEFAULT_TOKEN_BUDGET,
): string {
  const sections: string[] = [];

  // 1. 最近会话摘要
  if (context.recentSummaries.length > 0) {
    sections.push(buildSummariesSection(context.recentSummaries));
  }

  // 2. 未完成意图
  if (context.pendingIntents.length > 0) {
    sections.push(buildPendingIntentsSection(context.pendingIntents));
  }

  // 3. 用户偏好
  if (context.preferences) {
    sections.push(buildPreferencesSection(context.preferences));
  }

  // 如果没有任何记忆内容，返回空字符串
  if (sections.length === 0) {
    return "";
  }

  // 组合并截断
  const fullPrompt = `${MEMORY_SECTION_HEADER}\n\n${sections.join("\n\n")}`;
  return truncateToTokenBudget(fullPrompt, tokenBudget);
}

/**
 * 构建最近会话摘要段落
 */
function buildSummariesSection(summaries: RecentSummary[]): string {
  const lines: string[] = ["### 最近对话"];

  for (const summary of summaries) {
    const intentsStr =
      summary.intents.length > 0 ? `（${summary.intents.join("、")}）` : "";
    lines.push(`- ${summary.timeAgo}：${summary.summary}${intentsStr}`);
  }

  return lines.join("\n");
}

/**
 * 构建未完成意图段落
 */
function buildPendingIntentsSection(intents: string[]): string {
  const lines: string[] = ["### 待处理事项"];

  lines.push("用户之前提到但尚未完成的事项：");
  for (const intent of intents) {
    lines.push(`- ${intent}`);
  }
  lines.push("");
  lines.push(
    "_提示：可以主动询问用户是否需要继续处理这些事项，但不要过于打扰。_",
  );

  return lines.join("\n");
}

/**
 * 构建用户偏好段落
 */
function buildPreferencesSection(prefs: UserPreferencesAnalysis): string {
  const lines: string[] = ["### 用户偏好"];

  // 满意度
  const satisfactionDesc = getSatisfactionDescription(prefs.positiveRate);
  lines.push(`- 历史满意度：${satisfactionDesc}`);

  // 常用操作
  if (prefs.commonActions.length > 0) {
    lines.push(`- 常用功能：${prefs.commonActions.join("、")}`);
  }

  // 交互量（只在有一定量时显示）
  if (prefs.totalInteractions >= 10) {
    lines.push(`- 累计交互：${prefs.totalInteractions} 次`);
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
 * 截断文本以控制 Token 使用
 *
 * 粗略估算：中文约 1.5 字符/token
 */
function truncateToTokenBudget(text: string, tokenBudget: number): string {
  const maxChars = Math.floor(tokenBudget * 1.5);
  if (text.length <= maxChars) {
    return text;
  }

  log.debug(
    { originalLength: text.length, maxChars },
    "Truncating memory prompt",
  );

  // 尝试在段落边界截断
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n\n");

  if (lastNewline > maxChars * 0.7) {
    // 在段落边界截断
    return truncated.slice(0, lastNewline) + "\n\n_（记忆内容已截断）_";
  }

  // 直接截断
  return truncated.slice(0, maxChars - 20) + "...\n\n_（记忆内容已截断）_";
}

// =============================================================================
// System-Reminder 构建器
// =============================================================================

/**
 * 构建 System-Reminder 格式的记忆提示
 *
 * 用于在对话中动态注入提醒
 */
export function buildMemoryReminder(
  context: EpisodicMemoryContext,
): string | null {
  const reminders: string[] = [];

  // 检查是否有未完成意图需要提醒
  if (context.pendingIntents.length > 0) {
    reminders.push(
      `用户之前提到想要「${context.pendingIntents[0]}」，如果相关可以主动询问是否继续。`,
    );
  }

  // 检查用户满意度是否较低
  if (context.preferences && context.preferences.positiveRate < 0.5) {
    reminders.push(
      "用户历史满意度较低，建议在执行操作前多询问确认，避免自作主张。",
    );
  }

  if (reminders.length === 0) {
    return null;
  }

  return `<system-reminder>\n${reminders.join("\n")}\n</system-reminder>`;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 估算文本的 Token 数量
 *
 * 粗略估算：
 * - 中文：约 1.5 字符/token
 * - 英文：约 4 字符/token
 * - 混合：约 2.5 字符/token
 */
export function estimateTokens(text: string): number {
  // 检测文本语言类型
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalChars = text.length;
  const chineseRatio = chineseChars / totalChars;

  // 根据中文占比选择系数
  let charsPerToken: number;
  if (chineseRatio > 0.7) {
    charsPerToken = 1.5; // 主要中文
  } else if (chineseRatio > 0.3) {
    charsPerToken = 2.5; // 混合
  } else {
    charsPerToken = 4; // 主要英文
  }

  return Math.ceil(totalChars / charsPerToken);
}

/**
 * 检查记忆上下文是否为空
 */
export function isEmptyMemoryContext(
  context: EpisodicMemoryContext | undefined | null,
): boolean {
  if (!context) return true;
  return (
    context.recentSummaries.length === 0 &&
    context.pendingIntents.length === 0 &&
    context.preferences === null
  );
}
