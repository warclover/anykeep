/**
 * 上下文压缩 Prompt 模板
 *
 * 定义用于压缩对话历史的 Prompt 模板
 * 采用 4 段式书签场景压缩模板
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { ConversationMessage } from "./compression-types";

// =============================================================================
// 压缩 Prompt 模板
// =============================================================================

/**
 * AnyKeep 4 段式压缩 Prompt 模板
 *
 * 针对书签管理场景优化，比通用的 8 段式更精简：
 * 1. 用户目标 - 核心需求
 * 2. 已完成操作 - 搜索、标签、移动等操作记录
 * 3. 重要上下文 - 平台、文件夹、分类偏好
 * 4. 待处理事项 - 未完成请求、后续建议
 */
export const ANYKEEP_COMPRESSION_PROMPT = `你是 AnyKeep 书签助手的上下文压缩专家。请将以下对话历史压缩为结构化摘要。

## 压缩要求

1. **保留关键信息**：用户的核心需求、重要决策、执行结果
2. **丢弃冗余信息**：问候语、确认语、重复内容
3. **保持可操作性**：压缩后的内容应能指导后续对话

## 输出格式（严格遵循）

### 1. 用户目标 (User Goals)
- 用户本次会话想要达成的主要目标
- 任何明确表达的偏好或限制

### 2. 已完成操作 (Completed Actions)
- 已执行的搜索查询及结果数量
- 已完成的书签操作（添加标签、移动、删除等）
- 涉及的书签 ID 或数量

### 3. 重要上下文 (Key Context)
- 提及的特定平台、文件夹、标签
- 用户表达的分类偏好
- 发现的数据模式（如"技术文章居多"）

### 4. 待处理事项 (Pending Items)
- 用户提到但尚未完成的请求
- 建议的后续操作
- 任何未解决的问题

## 对话历史

{conversation_history}

## 注意事项

- 输出必须是中文
- 每个段落不超过 5 个要点
- 总长度控制在 500 字以内
- 如果某个段落无内容，写"无"
`;

// =============================================================================
// Prompt 构建函数
// =============================================================================

/**
 * 格式化单条消息
 *
 * @param message 消息对象
 * @param index 消息索引
 * @returns 格式化后的消息字符串
 */
function formatMessage(message: ConversationMessage, index: number): string {
  const roleLabel = message.role === "user" ? "用户" : "助手";
  const timestamp = message.timestamp
    ? ` (${message.timestamp.toLocaleString("zh-CN")})`
    : "";

  return `[${index + 1}] ${roleLabel}${timestamp}:\n${message.content}`;
}

/**
 * 格式化对话历史
 *
 * @param messages 消息数组
 * @returns 格式化后的对话历史字符串
 */
export function formatConversationHistory(
  messages: ConversationMessage[],
): string {
  // 过滤掉系统消息，只保留用户和助手消息
  const dialogMessages = messages.filter((m) => m.role !== "system");

  if (dialogMessages.length === 0) {
    return "（无对话历史）";
  }

  return dialogMessages.map((msg, idx) => formatMessage(msg, idx)).join("\n\n");
}

/**
 * 构建压缩 Prompt
 *
 * @param messages 待压缩的消息数组
 * @returns 完整的压缩 Prompt
 */
export function buildCompressionPrompt(
  messages: ConversationMessage[],
): string {
  const conversationHistory = formatConversationHistory(messages);

  return ANYKEEP_COMPRESSION_PROMPT.replace(
    "{conversation_history}",
    conversationHistory,
  );
}

/**
 * 构建压缩后注入到 System Prompt 的摘要块
 *
 * @param summary 压缩摘要
 * @returns 格式化的摘要块
 */
export function buildSummaryBlock(summary: string): string {
  return `## 对话历史摘要

${summary}

---
以上是之前对话的摘要。以下是最近的对话：`;
}

/**
 * 合并 System Prompt 和压缩摘要
 *
 * @param baseSystemPrompt 基础系统提示
 * @param summary 压缩摘要
 * @returns 合并后的系统提示
 */
export function mergeSystemPromptWithSummary(
  baseSystemPrompt: string,
  summary: string,
): string {
  const summaryBlock = buildSummaryBlock(summary);

  // 在基础系统提示末尾添加摘要块
  return `${baseSystemPrompt}

${summaryBlock}`;
}

// =============================================================================
// 压缩用户提示
// =============================================================================

/**
 * 压缩执行提示（发送给 LLM 的用户消息）
 */
export const COMPRESSION_USER_PROMPT = "请压缩以上对话历史。";

/**
 * 获取压缩执行的消息数组
 *
 * @param messages 待压缩的消息
 * @returns 发送给 LLM 的消息数组
 */
export function getCompressionMessages(
  messages: ConversationMessage[],
): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: buildCompressionPrompt(messages),
    },
    {
      role: "user",
      content: COMPRESSION_USER_PROMPT,
    },
  ];
}
