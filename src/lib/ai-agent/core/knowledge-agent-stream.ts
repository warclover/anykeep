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
import {
  registerDefaultTools,
  getToolsAsVercelTools,
  getToolsForIntentAsVercel,
} from "../tools";
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
 * 简单意图类型集合
 * 这些意图类型不需要加载复杂的 Skills，仅使用 Core/Intent Tools
 */
const SIMPLE_INTENT_TYPES = new Set(["query", "chitchat"]);

/**
 * Skills 加载的置信度阈值
 * 仅当置信度低于此阈值时，才为简单意图加载 Skills（作为回退）
 */
const SKILLS_CONFIDENCE_THRESHOLD = 0.7;

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

      // 获取 Skills 和 Tools（意图驱动加载）
      const tools = this.buildTools(context, input);

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
   *
   * 性能优化：根据意图类型智能加载工具
   * - 高置信度精确意图：单工具模式（最优）
   * - 简单意图 + 高置信度：仅加载 Data Tools（跳过 Skills）
   * - 复杂意图或低置信度：加载 Skills + Data Tools
   * - 无意图信息：全量加载（兼容旧逻辑）
   */
  private buildTools(context: AgentContext, input: string) {
    // 1. 首先加载 Data Tools（意图驱动）
    let dataTools;
    let isPreciseMode = false;
    if (context.intentType) {
      // 有意图信息：按需加载工具
      const result = getToolsForIntentAsVercel(
        context.intentType,
        context.intentSubType,
        context.intentConfidence ?? 0.7,
        input,
        {
          userId: context.userId,
          conversationId: context.conversationId,
          onSearchResults: context.onSearchResults
            ? (info) => context.onSearchResults?.(info.query, info.resultIds)
            : undefined,
        },
      );
      dataTools = result.tools;
      isPreciseMode = result.selectionResult.isPreciseMode;

      log.info(
        {
          intentType: context.intentType,
          intentSubType: context.intentSubType,
          intentConfidence: context.intentConfidence,
          isPreciseMode,
          preciseTool: result.selectionResult.preciseTool,
          dataToolCount: Object.keys(dataTools).length,
          dataToolNames: Object.keys(dataTools).slice(0, 10),
        },
        "Intent-driven data tool loading",
      );
    } else {
      // 无意图信息：全量加载（兼容旧逻辑）
      dataTools = getToolsAsVercelTools({
        userId: context.userId,
        conversationId: context.conversationId,
        onSearchResults: context.onSearchResults
          ? (info) => context.onSearchResults?.(info.query, info.resultIds)
          : undefined,
      });

      log.debug(
        { toolCount: Object.keys(dataTools).length },
        "Full data tool loading (no intent info)",
      );
    }

    // 2. 判断是否需要加载 Skills
    const confidence = context.intentConfidence ?? 0;
    const isSimpleIntent =
      context.intentType && SIMPLE_INTENT_TYPES.has(context.intentType);
    const isHighConfidence = confidence >= SKILLS_CONFIDENCE_THRESHOLD;

    // 精确模式或（简单意图 + 高置信度）= 跳过 Skills
    if (isPreciseMode || (isSimpleIntent && isHighConfidence)) {
      log.info(
        {
          intentType: context.intentType,
          confidence,
          isPreciseMode,
          finalToolCount: Object.keys(dataTools).length,
          skippedSkills: true,
        },
        isPreciseMode
          ? "Using precise single-tool mode, skipping Skills"
          : "Skipping Skills for simple intent with high confidence",
      );
      return dataTools;
    }

    // 3. 复杂意图或低置信度：加载 Skills
    const skillTools = getSkillsAsTools(() => ({
      userId: context.userId,
      conversationId: context.conversationId,
    }));

    const mergedTools = mergeToolSets(skillTools, dataTools);

    log.info(
      {
        intentType: context.intentType,
        confidence,
        skillCount: Object.keys(skillTools).length,
        dataToolCount: Object.keys(dataTools).length,
        finalToolCount: Object.keys(mergedTools).length,
        skippedSkills: false,
      },
      "Loading Skills + Data Tools",
    );

    return mergedTools;
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
