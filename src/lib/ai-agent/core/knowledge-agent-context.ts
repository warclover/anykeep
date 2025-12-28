/**
 * KnowledgeAgent 消息和上下文构建模块
 *
 * 职责：
 * - 构建消息历史
 * - 注入动态上下文
 * - 画像推断集成
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { CoreMessage } from "ai";
import type { AgentContext, AgentMessage, AgentConfig } from "./types";
import { mergeSystemPromptAsync, type DynamicContext } from "../context";
import { logger } from "@/lib/logger";

const log = logger.child({ namespace: "agent-context" });

/**
 * 会话消息容器接口
 */
export interface ConversationMessages {
  messages: AgentMessage[];
}

/**
 * 消息构建配置
 */
export interface MessageBuildOptions {
  /** 是否启用画像推断 */
  enablePersonaInference?: boolean;
}

/**
 * KnowledgeAgent 上下文构建器
 *
 * 负责构建 LLM 调用所需的消息历史
 */
export class KnowledgeAgentContextBuilder {
  constructor(private config: AgentConfig) {}

  /**
   * 构建消息历史
   *
   * @param conversation - 会话对象（包含已添加到内存的当前用户消息）
   * @param context - 上下文（可能包含前端提供的 messageHistory）
   * @param dynamicContext - 动态上下文（包含时间、统计、偏好等）
   * @param userId - 用户 ID（用于画像推断）
   * @param options - 构建选项
   */
  async buildMessages(
    conversation: ConversationMessages,
    context: AgentContext,
    dynamicContext: DynamicContext | undefined,
    userId: string,
    options: MessageBuildOptions = {},
  ): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];
    const { enablePersonaInference = true } = options;

    // 系统提示语：基础提示语 + 动态上下文（含画像） + 附加上下文（如附件内容）
    let systemPrompt = this.config.systemPrompt;

    // 注入动态上下文（时间、统计、偏好、画像等）
    if (dynamicContext) {
      // 使用异步版本，支持画像推断注入
      systemPrompt = await mergeSystemPromptAsync(
        systemPrompt,
        dynamicContext,
        {
          enablePersonaInference,
          userId,
        },
      );
    }

    // 追加附加上下文（如附件内容）
    if (context.systemPrompt) {
      systemPrompt = `${systemPrompt}\n\n${context.systemPrompt}`;
    }

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    // 优先使用前端提供的消息历史（适用于无状态 Serverless 环境）
    if (context.messageHistory && context.messageHistory.length > 0) {
      for (const msg of context.messageHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      // 重要：前端的 messageHistory 不包含当前用户消息（它在 message 字段单独发送）
      // 当前用户消息已在 executeStream/execute 中添加到 conversation.messages
      // 需要从 conversation.messages 中获取最后一条用户消息并添加
      const lastMessage =
        conversation.messages[conversation.messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        messages.push({
          role: "user",
          content: lastMessage.content,
        });
      }
    } else {
      // 回退到服务端内存中的历史消息
      for (const msg of conversation.messages) {
        if (msg.role === "system") continue; // 跳过历史系统消息

        if (msg.role === "tool" && msg.toolResults) {
          messages.push({
            role: "tool",
            content: msg.toolResults,
          });
        } else {
          messages.push({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          });
        }
      }
    }

    log.debug(
      {
        messageCount: messages.length,
        hasMessageHistory: Boolean(context.messageHistory?.length),
        hasDynamicContext: Boolean(dynamicContext),
      },
      "Messages built",
    );

    return messages;
  }
}
