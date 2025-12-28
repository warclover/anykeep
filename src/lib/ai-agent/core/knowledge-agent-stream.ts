/**
 * KnowledgeAgent 流式执行器
 *
 * 职责：
 * - 处理流式 LLM 调用
 * - 流式输出文本和工具调用
 * - 处理待确认操作
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { streamText, stepCountIs } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";
import { getSkillsAsTools } from "@/lib/ai-skills";
import { registerDefaultTools, getToolsAsVercelTools } from "../tools";
import { mergeToolSets } from "./ai-sdk-types";
import { getUserFriendlyError } from "./error-messages";
import { logger } from "@/lib/logger";
import type { AgentMemory } from "./agent-memory";
import type {
  AgentContext,
  AgentExecuteOptions,
  AgentMessage,
  AgentStreamChunk,
  AgentToolCall,
  AgentConfig,
} from "./types";
import {
  extractToolCallsFromSteps,
  extractPendingConfirmations,
  mapFinishReason,
} from "./helpers";
import { buildDynamicContext, type DynamicContext } from "../context";
import type { KnowledgeAgentContextBuilder } from "./knowledge-agent-context";
import { DEFAULT_EXECUTE_OPTIONS } from "./knowledge-agent-executor";

const log = logger.child({ namespace: "agent-stream" });

// 注册默认 Tools（模块加载时执行一次）
registerDefaultTools();

/**
 * 流式执行器依赖
 */
export interface StreamExecutorDependencies {
  config: AgentConfig;
  memory: AgentMemory;
  contextBuilder: KnowledgeAgentContextBuilder;
}

/**
 * KnowledgeAgent 流式执行器
 */
export class KnowledgeAgentStreamExecutor {
  constructor(private deps: StreamExecutorDependencies) {}

  /**
   * 执行 Agent（流式）
   */
  async *executeStream(
    input: string,
    context: AgentContext,
    options: Partial<AgentExecuteOptions> = {},
  ): AsyncGenerator<AgentStreamChunk> {
    const startTime = performance.now();
    const mergedOptions = { ...DEFAULT_EXECUTE_OPTIONS, ...options };

    // 获取或创建会话
    let conversation = context.conversationId
      ? this.deps.memory.getConversation(context.conversationId)
      : null;

    if (!conversation) {
      conversation = this.deps.memory.createConversation(
        context.userId,
        this.deps.config.type,
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
    this.deps.memory.addMessage(conversation.id, userMessage);

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

      // 获取 Skills 和 Tools
      const tools = this.buildTools(context);

      // 构建动态上下文
      const dynamicContext = await this.buildDynamicContext(context);

      // 构建消息历史
      const messages = await this.deps.contextBuilder.buildMessages(
        conversation,
        context,
        dynamicContext,
        context.userId,
      );

      log.info(
        {
          userId: context.userId,
          conversationId: conversation.id,
          provider: selection.provider.name,
          streaming: true,
          toolCount: Object.keys(tools).length,
          toolNames: Object.keys(tools).slice(0, 10),
          messageCount: messages.length,
          lastMessageRole: messages[messages.length - 1]?.role,
          lastMessagePreview: messages[messages.length - 1]?.content
            ?.toString()
            .slice(0, 50),
        },
        "Starting stream execution",
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

      // 使用 fullStream 处理所有类型的流式事件
      try {
        for await (const chunk of result.fullStream) {
          chunkCount++;
          log.debug(
            { chunkType: chunk.type, chunkCount },
            "Stream chunk received",
          );

          if (chunk.type === "text-delta") {
            fullText += chunk.text;
            yield {
              type: "text",
              text: chunk.text,
            };
          } else if (chunk.type === "error") {
            log.error({ error: chunk.error }, "Stream error event");
            throw new Error(
              chunk.error instanceof Error
                ? chunk.error.message
                : String(chunk.error),
            );
          }
        }
      } catch (streamError) {
        log.error(
          {
            error:
              streamError instanceof Error
                ? streamError.message
                : String(streamError),
            chunkCount,
            fullTextLength: fullText.length,
          },
          "Stream iteration failed",
        );
        throw streamError;
      }

      log.info(
        { chunkCount, fullTextLength: fullText.length },
        "Stream iteration completed",
      );

      // 等待完成并获取最终结果
      const durationMs = Math.round(performance.now() - startTime);

      // 记录成功
      aiProviderRouter.recordSuccess(selection.provider.name, durationMs);

      // 提取工具调用
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
      this.deps.memory.addMessage(conversation.id, assistantMessage);

      // 获取 usage 和 finishReason
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

      log.info(
        {
          conversationId: conversation.id,
          durationMs,
          toolCallsCount: toolCalls.length,
        },
        "Stream execution completed",
      );
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : "Unknown error";
      const friendlyMessage = getUserFriendlyError(error);

      log.error(
        {
          conversationId: conversation?.id,
          error: originalMessage,
        },
        "Stream execution failed",
      );

      yield {
        type: "error",
        error: friendlyMessage,
      };
    }
  }

  /**
   * 构建工具集
   */
  private buildTools(context: AgentContext) {
    const skillTools = getSkillsAsTools(() => ({
      userId: context.userId,
      conversationId: context.conversationId,
    }));
    const dataTools = getToolsAsVercelTools({
      userId: context.userId,
      conversationId: context.conversationId,
      onSearchResults: context.onSearchResults
        ? (info) => context.onSearchResults?.(info.query, info.resultIds)
        : undefined,
    });
    return mergeToolSets(skillTools, dataTools);
  }

  /**
   * 构建动态上下文
   */
  private async buildDynamicContext(
    context: AgentContext,
  ): Promise<DynamicContext | undefined> {
    return (
      context.dynamicContext ??
      (await buildDynamicContext(context.userId, {
        session: {
          selectedBookmarkIds: context.bookmarkIds,
          currentFolder: context.sessionContext?.currentFolder,
        },
      }))
    );
  }
}
