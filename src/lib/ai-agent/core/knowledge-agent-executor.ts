/**
 * KnowledgeAgent 非流式执行器
 *
 * 职责：
 * - 处理非流式 LLM 调用
 * - 管理工具调用
 * - 记录执行结果
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { generateText, stepCountIs } from "ai";
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
  AgentExecuteResult,
  AgentMessage,
  AgentConfig,
} from "./types";
import { extractToolCalls, mapFinishReason } from "./helpers";
import { buildDynamicContext, type DynamicContext } from "../context";
import type { KnowledgeAgentContextBuilder } from "./knowledge-agent-context";

const log = logger.child({ namespace: "agent-executor" });

// 注册默认 Tools（模块加载时执行一次）
registerDefaultTools();

/**
 * 默认执行选项
 */
export const DEFAULT_EXECUTE_OPTIONS: Required<AgentExecuteOptions> = {
  streaming: true,
  maxToolRounds: 5,
  temperature: 0.7,
  maxTokens: 2048,
  timeout: 60000,
  signal: undefined as unknown as AbortSignal,
};

/**
 * 执行器依赖
 */
export interface ExecutorDependencies {
  config: AgentConfig;
  memory: AgentMemory;
  contextBuilder: KnowledgeAgentContextBuilder;
}

/**
 * KnowledgeAgent 非流式执行器
 */
export class KnowledgeAgentExecutor {
  constructor(private deps: ExecutorDependencies) {}

  /**
   * 执行 Agent（非流式）
   */
  async execute(
    input: string,
    context: AgentContext,
    options: Partial<AgentExecuteOptions> = {},
  ): Promise<AgentExecuteResult> {
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
      });

      if (!selection) {
        throw new Error("No suitable AI provider available");
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
          toolCount: Object.keys(tools).length,
          messageCount: messages.length,
        },
        "Executing non-streaming",
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
      this.deps.memory.addMessage(conversation.id, assistantMessage);

      log.info(
        {
          conversationId: conversation.id,
          durationMs,
          toolCallsCount: toolCalls.length,
          finishReason: result.finishReason,
        },
        "Execution completed",
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

      log.error(
        {
          conversationId: conversation.id,
          error: originalMessage,
          durationMs,
        },
        "Execution failed",
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
