/**
 * 会话摘要生成器
 *
 * 使用 LLM 智能生成会话结束摘要，提取：
 * - 会话核心内容摘要
 * - 用户主要意图
 * - 执行的操作
 * - 待办事项（用户提到但未完成的）
 * - 学到的用户偏好
 *
 * @module @/lib/ai-memory/session-summarizer
 * @version 1.0.0
 * @since 2026-01-13
 */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { aiEnv } from "@/lib/env";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 会话摘要 Schema
 */
const SessionSummarySchema = z.object({
  summary: z
    .string()
    .min(10)
    .max(200)
    .describe("会话摘要，50-100字，突出用户目标和结果"),
  key_intents: z
    .array(z.string())
    .max(5)
    .describe('用户主要意图列表，如"搜索技术文章"、"整理微信收藏"'),
  key_actions: z
    .array(z.string())
    .max(5)
    .describe('执行的主要操作，如"搜索"、"移动文件夹"、"添加标签"'),
  user_feedback: z
    .enum(["positive", "neutral", "negative"])
    .optional()
    .describe("整体用户反馈情绪"),
  learned_preferences: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      '学到的用户偏好，如{"preferred_folder": "技术", "tag_style": "中文"}',
    ),
});

/**
 * 会话摘要类型
 */
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/**
 * 消息格式（简化版）
 */
export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 摘要生成配置
 */
export interface SessionSummarizerConfig {
  /** 使用的模型 */
  model?: string;
  /** 最大消息数量（超过则截断） */
  maxMessages?: number;
  /** 单条消息最大长度 */
  maxMessageLength?: number;
  /** API 超时时间（毫秒） */
  timeoutMs?: number;
}

// =============================================================================
// 常量
// =============================================================================

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<SessionSummarizerConfig> = {
  model: "qwen-turbo",
  maxMessages: 20,
  maxMessageLength: 500,
  timeoutMs: 30000,
};

/**
 * 摘要生成 Prompt
 */
const SUMMARIZER_PROMPT = `你是一个对话分析专家。分析用户与AI助手的对话，生成结构化摘要。

## 任务
根据对话内容，提取以下信息：

### 1. summary (必填)
用1-2句话概括对话主题和结果，50-100字。
- 突出用户的核心目标
- 说明是否达成目标
- 不要包含无关细节

### 2. key_intents (必填)
提取用户的主要意图（最多5个）。
- 使用动宾短语，如"搜索技术文章"、"整理微信收藏"
- 只记录明确表达的意图

### 3. key_actions (必填)
记录AI实际执行的操作（最多5个）。
- 使用简洁动词短语，如"搜索"、"添加标签"、"移动到文件夹"
- 只记录已执行的操作

### 4. user_feedback (可选)
判断用户整体情绪：
- positive: 用户表示满意、感谢、赞扬
- negative: 用户表示不满、抱怨、失望
- neutral: 无明显情绪表达

### 5. learned_preferences (可选)
记录从对话中学到的用户偏好。
使用 key-value 格式，例如：
- preferred_folder: "技术学习"
- tag_language: "中文"
- search_style: "精确匹配"
- notification_time: "早上9点"

## 注意事项
- 如果对话很简短或只是闲聊，返回简单摘要即可
- learned_preferences 只记录用户明确表达的偏好`;

// =============================================================================
// 日志
// =============================================================================

const log = logger.child({ module: "SessionSummarizer" });

// =============================================================================
// 核心函数
// =============================================================================

/**
 * 生成会话摘要
 *
 * 使用 LLM 分析对话历史，生成结构化摘要
 *
 * @param messages 对话消息列表
 * @param config 可选配置
 * @returns 会话摘要或 null（如果生成失败）
 *
 * @example
 * ```typescript
 * const messages = [
 *   { role: "user", content: "帮我搜索关于 React 的文章" },
 *   { role: "assistant", content: "找到 15 篇相关文章..." }
 * ];
 * const summary = await generateSessionSummary(messages);
 * console.log(summary?.learned_preferences);
 * ```
 */
export async function generateSessionSummary(
  messages: SessionMessage[],
  config?: SessionSummarizerConfig,
): Promise<SessionSummary | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 检查 Feature Flag
  if (!FeatureFlags.ENABLE_CROSS_SESSION_MEMORY) {
    log.debug("Cross-session memory disabled, skipping summary generation");
    return null;
  }

  // 验证消息
  if (messages.length < 2) {
    log.debug(
      { messageCount: messages.length },
      "Too few messages for summary",
    );
    return null;
  }

  // 过滤并截断消息
  const filteredMessages = prepareMessages(messages, cfg);
  if (filteredMessages.length === 0) {
    return null;
  }

  // 构建对话文本
  const conversationText = formatConversation(filteredMessages);

  try {
    // 使用 DashScope (阿里云百炼) API
    const dashscopeProvider = createOpenAI({
      apiKey: aiEnv.dashscopeApiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    const result = await generateObject({
      model: dashscopeProvider.chat(cfg.model),
      schema: SessionSummarySchema,
      system: SUMMARIZER_PROMPT,
      prompt: `请分析以下对话并生成摘要：\n\n${conversationText}`,
      temperature: 0.3,
    });

    log.info(
      {
        messageCount: messages.length,
        intentCount: result.object.key_intents.length,
        hasPreferences: !!result.object.learned_preferences,
      },
      "Session summary generated",
    );

    return result.object;
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : String(error),
        messageCount: messages.length,
      },
      "Failed to generate session summary",
    );
    return null;
  }
}

/**
 * 生成简单摘要（降级方案）
 *
 * 当 LLM 不可用时，使用规则提取基本信息
 *
 * @param messages 对话消息列表
 * @returns 简化的会话摘要
 */
export function generateSimpleSummary(
  messages: SessionMessage[],
): SessionSummary {
  const userMessages = messages.filter((m) => m.role === "user");

  // 提取最后一条用户消息作为摘要
  const lastUserMessage = userMessages[userMessages.length - 1];
  let summary = lastUserMessage?.content || "空会话";
  if (summary.length > 100) {
    summary = summary.slice(0, 97) + "...";
  }

  // 简单意图提取
  const keyIntents = extractSimpleIntents(userMessages);

  // 简单操作提取
  const keyActions = extractSimpleActions(messages);

  return {
    summary,
    key_intents: keyIntents,
    key_actions: keyActions,
    user_feedback: "neutral",
    learned_preferences: undefined,
  };
}

/**
 * 智能生成摘要（带降级）
 *
 * 优先使用 LLM，失败时降级为简单摘要
 *
 * @param messages 对话消息列表
 * @param config 可选配置
 * @returns 会话摘要
 */
export async function generateSessionSummaryWithFallback(
  messages: SessionMessage[],
  config?: SessionSummarizerConfig,
): Promise<SessionSummary> {
  // 尝试 LLM 生成
  const llmSummary = await generateSessionSummary(messages, config);
  if (llmSummary) {
    return llmSummary;
  }

  // 降级为简单摘要
  log.warn("Falling back to simple summary extraction");
  return generateSimpleSummary(messages);
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 准备消息（过滤和截断）
 */
function prepareMessages(
  messages: SessionMessage[],
  config: Required<SessionSummarizerConfig>,
): SessionMessage[] {
  // 过滤有效消息
  let filtered = messages.filter(
    (m) => m.content && m.content.trim().length > 0,
  );

  // 限制数量
  if (filtered.length > config.maxMessages) {
    filtered = filtered.slice(-config.maxMessages);
  }

  // 截断单条消息
  return filtered.map((m) => ({
    ...m,
    content:
      m.content.length > config.maxMessageLength
        ? m.content.slice(0, config.maxMessageLength - 3) + "..."
        : m.content,
  }));
}

/**
 * 格式化对话为文本
 */
function formatConversation(messages: SessionMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "用户" : "AI助手"}: ${m.content}`)
    .join("\n\n");
}

/**
 * 简单意图提取（规则匹配）
 */
function extractSimpleIntents(userMessages: SessionMessage[]): string[] {
  const intents: string[] = [];
  const patterns: Array<{ pattern: RegExp; intent: string }> = [
    { pattern: /搜索|找|查|检索/i, intent: "搜索内容" },
    { pattern: /整理|分类|归档|排序/i, intent: "整理收藏" },
    { pattern: /标签|打标|分组/i, intent: "标签管理" },
    { pattern: /导出|备份|下载|保存/i, intent: "数据导出" },
    { pattern: /删除|移除|清理|清空/i, intent: "删除操作" },
    { pattern: /统计|分析|报告|数量/i, intent: "数据分析" },
    { pattern: /移动|放到|归到/i, intent: "移动文件" },
    { pattern: /创建|新建|添加/i, intent: "创建内容" },
  ];

  const allText = userMessages.map((m) => m.content).join(" ");

  for (const { pattern, intent } of patterns) {
    if (pattern.test(allText) && !intents.includes(intent)) {
      intents.push(intent);
    }
  }

  return intents.slice(0, 5);
}

/**
 * 简单操作提取（规则匹配）
 */
function extractSimpleActions(messages: SessionMessage[]): string[] {
  const actions: string[] = [];
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const patterns: Array<{ pattern: RegExp; action: string }> = [
    { pattern: /找到.*条|搜索结果/i, action: "搜索" },
    { pattern: /已添加标签|标签已/i, action: "添加标签" },
    { pattern: /已移动到|移到了/i, action: "移动" },
    { pattern: /已删除|删除了/i, action: "删除" },
    { pattern: /已导出|导出完成/i, action: "导出" },
    { pattern: /统计|共有.*条/i, action: "统计" },
    { pattern: /已创建|新建了/i, action: "创建" },
  ];

  const allText = assistantMessages.map((m) => m.content).join(" ");

  for (const { pattern, action } of patterns) {
    if (pattern.test(allText) && !actions.includes(action)) {
      actions.push(action);
    }
  }

  return actions.slice(0, 5);
}

// =============================================================================
// 导出类型
// =============================================================================

export { SessionSummarySchema };
