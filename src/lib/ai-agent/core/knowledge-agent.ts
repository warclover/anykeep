/**
 * KnowledgeAgent - 知识管理智能助手
 *
 * 职责：
 * - 使用 Skills 和 Tools 进行知识管理任务
 * - 支持流式响应和非流式响应
 * - 管理会话上下文和记忆
 * - 自动压缩过长的对话上下文
 *
 * @version 1.4.0
 * @since 2025-12-22
 * @updated 2025-12-27 - 添加对话上下文压缩功能
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
import {
  buildDynamicContext,
  buildContextPrompt,
  type DynamicContext,
  // 压缩功能（v1.4 新增）
  ConversationCompressor,
  type ConversationMessage,
} from "../context";
import { FeatureFlags } from "../config";

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
  private compressor: ConversationCompressor;

  constructor(
    config: Partial<AgentConfig> = {},
    memory: AgentMemory = new AgentMemory(),
  ) {
    this.config = { ...KNOWLEDGE_AGENT_CONFIG, ...config };
    this.memory = memory;
    this.compressor = new ConversationCompressor();
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
        // 传递搜索结果记录回调（用于上下文保持）
        onSearchResults: context.onSearchResults
          ? (info) => context.onSearchResults?.(info.query, info.resultIds)
          : undefined,
      });
      // 使用类型安全的 mergeToolSets 合并 Skills 和 Tools
      const tools = mergeToolSets(skillTools, dataTools);

      // 构建动态上下文（并行查询，带缓存）
      const dynamicContext =
        context.dynamicContext ??
        (await buildDynamicContext(context.userId, {
          session: {
            selectedBookmarkIds: context.bookmarkIds,
            currentFolder: context.sessionContext?.currentFolder,
          },
        }));

      // 构建消息历史（注入动态上下文）
      const messages = this.buildMessages(
        conversation,
        context,
        dynamicContext,
      );

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
        // 传递搜索结果记录回调（用于上下文保持）
        onSearchResults: context.onSearchResults
          ? (info) => context.onSearchResults?.(info.query, info.resultIds)
          : undefined,
      });
      // 使用类型安全的 mergeToolSets 合并 Skills 和 Tools
      const tools = mergeToolSets(skillTools, dataTools);

      // 构建动态上下文（并行查询，带缓存）
      const dynamicContext =
        context.dynamicContext ??
        (await buildDynamicContext(context.userId, {
          session: {
            selectedBookmarkIds: context.bookmarkIds,
            currentFolder: context.sessionContext?.currentFolder,
          },
        }));

      // 构建消息历史（注入动态上下文）
      const messages = this.buildMessages(
        conversation,
        context,
        dynamicContext,
      );

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
   * @param dynamicContext - 动态上下文（包含时间、统计、偏好等）
   */
  private buildMessages(
    conversation: { messages: AgentMessage[] },
    context: AgentContext,
    dynamicContext?: DynamicContext,
  ): CoreMessage[] {
    const messages: CoreMessage[] = [];

    // 系统提示语：基础提示语 + 动态上下文 + 附加上下文（如附件内容）
    let systemPrompt = this.config.systemPrompt;

    // 注入动态上下文（时间、统计、偏好等）
    if (dynamicContext) {
      const contextPrompt = buildContextPrompt(dynamicContext);
      systemPrompt = `${systemPrompt}\n\n${contextPrompt}`;
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

  // ===========================================================================
  // 上下文压缩（v1.4 新增）
  // ===========================================================================

  /**
   * 检查并压缩消息历史（如果需要）
   *
   * 在 Serverless 环境中，前端通过 messageHistory 传递历史消息。
   * 此方法可在调用 execute/executeStream 前调用，对历史消息进行压缩。
   *
   * @param messageHistory 前端传递的消息历史
   * @param context 压缩所需的上下文
   * @param maxContextTokens 最大上下文 Token 数（用于计算使用率）
   * @returns 压缩结果（包含可能已压缩的消息和摘要）
   *
   * @example
   * ```typescript
   * const { messages, summary, compressed } = await agent.compressMessagesIfNeeded(
   *   messageHistory,
   *   { userId: 'xxx', conversationId: 'yyy', baseSystemPrompt: '...' },
   *   8000
   * );
   *
   * if (compressed) {
   *   // 使用压缩后的消息
   *   context.messageHistory = messages;
   *   context.compressionSummary = summary;
   * }
   * ```
   */
  async compressMessagesIfNeeded(
    messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
    context: {
      userId: string;
      conversationId?: string;
      baseSystemPrompt?: string;
    },
    maxContextTokens: number = 8000,
  ): Promise<{
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    summary?: string;
    compressed: boolean;
    metrics?: {
      originalTokens: number;
      compressedTokens: number;
      compressionRatio: number;
    };
  }> {
    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_CONVERSATION_COMPRESSION) {
      return { messages: messageHistory, compressed: false };
    }

    // 转换为 ConversationMessage 格式
    const conversationMessages: ConversationMessage[] = messageHistory.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      }),
    );

    // 检查是否需要压缩
    const check = this.compressor.shouldCompress(
      conversationMessages,
      maxContextTokens,
    );

    if (!check.needed) {
      logger.debug(
        {
          userId: context.userId,
          conversationId: context.conversationId,
          reason: check.reason,
          currentTurns: check.currentTurns,
          tokenUsageRatio: check.tokenUsageRatio,
        },
        "KnowledgeAgent: Compression not needed",
      );
      return { messages: messageHistory, compressed: false };
    }

    logger.info(
      {
        userId: context.userId,
        conversationId: context.conversationId,
        reason: check.reason,
        currentTurns: check.currentTurns,
        tokenUsageRatio: check.tokenUsageRatio,
      },
      "KnowledgeAgent: Starting message compression",
    );

    // 执行压缩
    const result = await this.compressor.compress(conversationMessages, {
      userId: context.userId,
      conversationId: context.conversationId || crypto.randomUUID(),
      baseSystemPrompt: context.baseSystemPrompt || this.config.systemPrompt,
    });

    if (!result.success) {
      logger.warn(
        {
          userId: context.userId,
          conversationId: context.conversationId,
          reason: result.reason,
        },
        "KnowledgeAgent: Compression failed, using original messages",
      );
      return { messages: messageHistory, compressed: false };
    }

    // 转换回前端消息格式（排除系统消息）
    const compressedMessages = result.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    logger.info(
      {
        userId: context.userId,
        conversationId: context.conversationId,
        originalCount: messageHistory.length,
        compressedCount: compressedMessages.length,
        compressionRatio: result.metrics?.compressionRatio,
      },
      "KnowledgeAgent: Message compression completed",
    );

    return {
      messages: compressedMessages,
      summary: result.summary,
      compressed: true,
      metrics: result.metrics
        ? {
            originalTokens: result.metrics.originalTokens,
            compressedTokens: result.metrics.compressedTokens,
            compressionRatio: result.metrics.compressionRatio,
          }
        : undefined,
    };
  }

  /**
   * 获取压缩器实例（用于高级用途）
   */
  getCompressor(): ConversationCompressor {
    return this.compressor;
  }
}

/**
 * 默认 KnowledgeAgent 实例
 */
export const knowledgeAgent = new KnowledgeAgent();
