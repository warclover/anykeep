/**
 * KnowledgeAgent - 知识管理智能助手
 *
 * 职责：
 * - 使用 Skills 和 Tools 进行知识管理任务
 * - 支持流式响应和非流式响应
 * - 管理会话上下文和记忆
 *
 * @version 1.3.0
 * @since 2025-12-22
 */

import { generateText, streamText, stepCountIs, type CoreMessage } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";
import { getSkillsAsTools } from "@/lib/ai-skills";
import { registerDefaultTools, getToolsAsVercelTools } from "../tools";
// PendingConfirmation type is used by extractPendingConfirmations internally
import { mergeToolSets } from "./ai-sdk-types";
import { getUserFriendlyError } from "./error-messages";
import { logger } from "@/lib/logger";
import { AgentMemory } from "./agent-memory";
import type {
  AgentContext,
  AgentExecuteOptions,
  AgentExecuteResult,
  AgentMessage,
  AgentStreamChunk,
  AgentToolCall,
  AgentConfig,
} from "./types";
import { KNOWLEDGE_AGENT_SYSTEM_PROMPT } from "./prompts";
import {
  extractToolCalls,
  extractToolCallsFromSteps,
  extractPendingConfirmations,
  mapFinishReason,
} from "./helpers";

// 注册默认 Tools（模块加载时执行一次）
registerDefaultTools();

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<AgentExecuteOptions> = {
  streaming: true,
  maxToolRounds: 5,
  temperature: 0.7,
  maxTokens: 2048,
  timeout: 60000,
  signal: undefined as unknown as AbortSignal,
};

/**
 * KnowledgeAgent 配置
 */
const KNOWLEDGE_AGENT_CONFIG: AgentConfig = {
  type: "knowledge",
  name: "知识助手",
  description: "帮助用户管理和组织知识收藏的智能助手",
  systemPrompt: KNOWLEDGE_AGENT_SYSTEM_PROMPT,
  enabledSkills: ["search", "classify", "summary"],
  defaultOptions: DEFAULT_OPTIONS,
};

/**
 * KnowledgeAgent 类
 */
export class KnowledgeAgent {
  private config: AgentConfig;
  private memory: AgentMemory;

  constructor(
    config: Partial<AgentConfig> = {},
    memory: AgentMemory = new AgentMemory(),
  ) {
    this.config = { ...KNOWLEDGE_AGENT_CONFIG, ...config };
    this.memory = memory;
  }

  /**
   * 执行 Agent（非流式）
   */
  async execute(
    input: string,
    context: AgentContext,
    options: Partial<AgentExecuteOptions> = {},
  ): Promise<AgentExecuteResult> {
    const startTime = performance.now();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    // 获取或创建会话
    let conversation = context.conversationId
      ? this.memory.getConversation(context.conversationId)
      : null;

    if (!conversation) {
      conversation = this.memory.createConversation(
        context.userId,
        this.config.type,
        {
          contextBookmarkIds: context.bookmarkIds,
        },
      );
      context.conversationId = conversation.id;
    }

    // 添加用户消息
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: new Date(),
    };
    this.memory.addMessage(conversation.id, userMessage);

    try {
      // 获取模型
      const selection = aiProviderRouter.selectProvider({
        taskType: "tool_calling",
        requiresToolCalling: true,
      });

      if (!selection) {
        throw new Error("No suitable AI provider available");
      }

      // 获取 Skills 和 Tools 作为 Vercel AI SDK tools
      const skillTools = getSkillsAsTools(() => ({
        userId: context.userId,
        conversationId: context.conversationId,
      }));
      const dataTools = getToolsAsVercelTools({
        userId: context.userId,
        conversationId: context.conversationId,
      });
      // 使用类型安全的 mergeToolSets 合并 Skills 和 Tools
      const tools = mergeToolSets(skillTools, dataTools);

      // 构建消息历史
      const messages = this.buildMessages(conversation, context);

      logger.info(
        {
          userId: context.userId,
          conversationId: conversation.id,
          provider: selection.provider.name,
          toolCount: Object.keys(tools).length,
          messageCount: messages.length,
        },
        "KnowledgeAgent: Executing",
      );

      // 调用 LLM
      const result = await generateText({
        model: selection.model,
        messages,
        tools,
        toolChoice: "auto",
        stopWhen: stepCountIs(mergedOptions.maxToolRounds),
        temperature: mergedOptions.temperature,
        maxOutputTokens: mergedOptions.maxTokens,
        abortSignal: mergedOptions.signal,
      });

      // 记录成功
      const durationMs = Math.round(performance.now() - startTime);
      aiProviderRouter.recordSuccess(selection.provider.name, durationMs);

      // 提取工具调用记录
      const toolCalls = extractToolCalls(result);

      // 添加助手消息
      const assistantMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.text,
        toolCalls,
        createdAt: new Date(),
      };
      this.memory.addMessage(conversation.id, assistantMessage);

      logger.info(
        {
          conversationId: conversation.id,
          durationMs,
          toolCallsCount: toolCalls.length,
          finishReason: result.finishReason,
        },
        "KnowledgeAgent: Execution completed",
      );

      return {
        success: true,
        content: result.text,
        toolCalls,
        tokensUsed: result.usage
          ? {
              prompt: result.usage.inputTokens ?? 0,
              completion: result.usage.outputTokens ?? 0,
              total: result.usage.totalTokens ?? 0,
            }
          : undefined,
        durationMs,
        finishReason: mapFinishReason(result.finishReason),
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const originalMessage =
        error instanceof Error ? error.message : "Unknown error";
      const friendlyMessage = getUserFriendlyError(error);

      logger.error(
        {
          conversationId: conversation.id,
          error: originalMessage,
          durationMs,
        },
        "KnowledgeAgent: Execution failed",
      );

      return {
        success: false,
        content: "",
        toolCalls: [],
        durationMs,
        error: friendlyMessage,
        finishReason: "error",
      };
    }
  }

  /**
   * 执行 Agent（流式）
   */
  async *executeStream(
    input: string,
    context: AgentContext,
    options: Partial<AgentExecuteOptions> = {},
  ): AsyncGenerator<AgentStreamChunk> {
    const startTime = performance.now();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    // 获取或创建会话
    let conversation = context.conversationId
      ? this.memory.getConversation(context.conversationId)
      : null;

    if (!conversation) {
      conversation = this.memory.createConversation(
        context.userId,
        this.config.type,
        {
          contextBookmarkIds: context.bookmarkIds,
        },
      );
      context.conversationId = conversation.id;
    }

    // 添加用户消息
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: new Date(),
    };
    this.memory.addMessage(conversation.id, userMessage);

    try {
      // 获取模型
      const selection = aiProviderRouter.selectProvider({
        taskType: "tool_calling",
        requiresToolCalling: true,
        requiresStreaming: true,
      });

      if (!selection) {
        yield {
          type: "error",
          error: "No suitable AI provider available",
        };
        return;
      }

      // 获取 Skills 和 Tools 作为 Vercel AI SDK tools
      const skillTools = getSkillsAsTools(() => ({
        userId: context.userId,
        conversationId: context.conversationId,
      }));
      const dataTools = getToolsAsVercelTools({
        userId: context.userId,
        conversationId: context.conversationId,
      });
      // 使用类型安全的 mergeToolSets 合并 Skills 和 Tools
      const tools = mergeToolSets(skillTools, dataTools);

      // 构建消息历史
      const messages = this.buildMessages(conversation, context);

      logger.info(
        {
          userId: context.userId,
          conversationId: conversation.id,
          provider: selection.provider.name,
          streaming: true,
          toolCount: Object.keys(tools).length,
          toolNames: Object.keys(tools).slice(0, 10), // 只记录前10个
          messageCount: messages.length,
          lastMessageRole: messages[messages.length - 1]?.role,
          lastMessagePreview: messages[messages.length - 1]?.content
            ?.toString()
            .slice(0, 50),
        },
        "KnowledgeAgent: Starting stream execution",
      );

      // 流式调用 LLM
      const result = streamText({
        model: selection.model,
        messages,
        tools,
        toolChoice: "auto",
        stopWhen: stepCountIs(mergedOptions.maxToolRounds),
        temperature: mergedOptions.temperature,
        maxOutputTokens: mergedOptions.maxTokens,
        abortSignal: mergedOptions.signal,
      });

      let fullText = "";
      const toolCalls: AgentToolCall[] = [];
      let chunkCount = 0;

      // 使用 fullStream 处理所有类型的流式事件（包括工具调用）
      // textStream 在只有工具调用没有文本时会抛出 "No output generated" 错误
      try {
        for await (const chunk of result.fullStream) {
          chunkCount++;
          logger.debug(
            { chunkType: chunk.type, chunkCount },
            "KnowledgeAgent: Stream chunk received",
          );

          if (chunk.type === "text-delta") {
            fullText += chunk.text;
            yield {
              type: "text",
              text: chunk.text,
            };
          } else if (chunk.type === "error") {
            // 处理流中的错误事件
            logger.error(
              { error: chunk.error },
              "KnowledgeAgent: Stream error event",
            );
            throw new Error(
              chunk.error instanceof Error
                ? chunk.error.message
                : String(chunk.error),
            );
          }
        }
      } catch (streamError) {
        logger.error(
          {
            error:
              streamError instanceof Error
                ? streamError.message
                : String(streamError),
            chunkCount,
            fullTextLength: fullText.length,
          },
          "KnowledgeAgent: Stream iteration failed",
        );
        throw streamError;
      }

      logger.info(
        { chunkCount, fullTextLength: fullText.length },
        "KnowledgeAgent: Stream iteration completed",
      );

      // 等待完成并获取最终结果
      const durationMs = Math.round(performance.now() - startTime);

      // 记录成功
      aiProviderRouter.recordSuccess(selection.provider.name, durationMs);

      // 提取工具调用 - 需要 await steps Promise
      const steps = await result.steps;
      const extractedToolCalls = extractToolCallsFromSteps(steps);
      toolCalls.push(...extractedToolCalls);

      // 输出工具调用信息
      for (const tc of toolCalls) {
        yield {
          type: "tool-call",
          toolCall: tc,
        };
      }

      // 检测并输出待确认操作
      const pendingConfirmations = extractPendingConfirmations(toolCalls);
      for (const confirmation of pendingConfirmations) {
        yield {
          type: "confirmation",
          confirmation,
        };
      }

      // 添加助手消息
      const assistantMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullText,
        toolCalls,
        createdAt: new Date(),
      };
      this.memory.addMessage(conversation.id, assistantMessage);

      // 获取 usage 和 finishReason - 需要 await Promises
      const usage = await result.usage;
      const finishReason = await result.finishReason;

      // 输出完成信号
      yield {
        type: "done",
        result: {
          success: true,
          conversationId: conversation.id,
          content: fullText,
          toolCalls,
          tokensUsed: usage
            ? {
                prompt: usage.inputTokens ?? 0,
                completion: usage.outputTokens ?? 0,
                total: usage.totalTokens ?? 0,
              }
            : undefined,
          durationMs,
          finishReason: mapFinishReason(finishReason),
        },
      };

      logger.info(
        {
          conversationId: conversation.id,
          durationMs,
          toolCallsCount: toolCalls.length,
        },
        "KnowledgeAgent: Stream execution completed",
      );
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : "Unknown error";
      const friendlyMessage = getUserFriendlyError(error);

      logger.error(
        {
          conversationId: conversation?.id,
          error: originalMessage,
        },
        "KnowledgeAgent: Stream execution failed",
      );

      yield {
        type: "error",
        error: friendlyMessage,
      };
    }
  }

  /**
   * 构建消息历史
   *
   * @param conversation - 会话对象（包含已添加到内存的当前用户消息）
   * @param context - 上下文（可能包含前端提供的 messageHistory）
   */
  private buildMessages(
    conversation: { messages: AgentMessage[] },
    context: AgentContext,
  ): CoreMessage[] {
    const messages: CoreMessage[] = [];

    // 系统提示语
    const systemPrompt = context.systemPrompt || this.config.systemPrompt;
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

    return messages;
  }

  /**
   * 获取会话
   */
  getConversation(conversationId: string) {
    return this.memory.getConversation(conversationId);
  }

  /**
   * 清除会话
   */
  clearConversation(conversationId: string) {
    this.memory.clearConversation(conversationId);
  }

  /**
   * 获取用户会话列表
   */
  getUserConversations(userId: string) {
    return this.memory.getUserConversations(userId);
  }

  /**
   * 获取 Agent 配置
   */
  getConfig(): AgentConfig {
    return this.config;
  }
}

/**
 * 默认 KnowledgeAgent 实例
 */
export const knowledgeAgent = new KnowledgeAgent();
