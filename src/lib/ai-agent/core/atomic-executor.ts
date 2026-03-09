/**
 * 原子模式执行器
 *
 * 提供基于 AI SDK streamText 的原子执行能力，
 * 作为统一引擎的原子模式后端。
 *
 * 替代已移除的 KnowledgeAgent 流式执行器。
 *
 * @version 1.0.0
 * @since 2026-03-09
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
import type { AgentContext, AgentStreamChunk, AgentToolCall } from "./types";
import {
  extractToolCallsFromSteps,
  extractPendingConfirmations,
  mapFinishReason,
} from "./helpers";
import { recordToolUsage } from "../preferences";

const log = logger.child({ namespace: "atomic-executor" });

// 注册默认 Tools（模块加载时执行一次）
registerDefaultTools();

/**
 * 简单意图类型集合
 * 这些意图类型不需要加载复杂的 Skills，仅使用 Core/Intent Tools
 */
const SIMPLE_INTENT_TYPES = new Set(["query", "chitchat"]);

/**
 * Skills 加载的置信度阈值
 */
const SKILLS_CONFIDENCE_THRESHOLD = 0.7;

/** 默认执行选项 */
const DEFAULT_OPTIONS = {
  maxToolRounds: 5,
  temperature: 0.7,
  maxTokens: 4096,
};

/**
 * 原子模式流式执行器
 *
 * 使用 AI SDK streamText 处理用户输入并流式返回结果
 */
export async function* atomicExecuteStream(
  input: string,
  context: AgentContext,
  options?: {
    maxToolRounds?: number;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  },
): AsyncGenerator<AgentStreamChunk> {
  const startTime = performance.now();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

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

    // 获取工具集
    const tools = buildTools(context, input);

    // 构建消息
    const messages = buildMessages(input, context);

    log.info(
      {
        userId: context.userId,
        provider: selection.provider.name,
        toolCount: Object.keys(tools).length,
        messageCount: messages.length,
      },
      "Starting atomic stream execution",
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

    try {
      for await (const chunk of result.fullStream) {
        chunkCount++;

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

    // 记录工具使用（偏好学习）
    for (const tc of toolCalls) {
      const success = tc.status === "completed";
      recordToolUsage(context.userId, tc.toolName, tc.args, success);
    }

    // 检测并输出待确认操作
    const pendingConfirmations = extractPendingConfirmations(toolCalls);
    for (const confirmation of pendingConfirmations) {
      yield {
        type: "confirmation",
        confirmation,
      };
    }

    // 获取 usage 和 finishReason
    const usage = await result.usage;
    const finishReason = await result.finishReason;

    // 输出完成信号
    yield {
      type: "done",
      result: {
        success: true,
        conversationId: context.conversationId,
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
        conversationId: context.conversationId,
        durationMs,
        toolCallsCount: toolCalls.length,
      },
      "Atomic stream execution completed",
    );
  } catch (error) {
    const friendlyMessage = getUserFriendlyError(error);

    log.error(
      {
        conversationId: context.conversationId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Atomic stream execution failed",
    );

    yield {
      type: "error",
      error: friendlyMessage,
    };
  }
}

/**
 * 构建消息数组
 */
function buildMessages(
  input: string,
  context: AgentContext,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];

  // 系统提示
  if (context.systemPrompt) {
    messages.push({ role: "system", content: context.systemPrompt });
  }

  // 消息历史
  if (context.messageHistory) {
    for (const msg of context.messageHistory) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  // 当前用户消息
  messages.push({ role: "user", content: input });

  return messages;
}

/**
 * 构建工具集
 */
function buildTools(context: AgentContext, input: string) {
  const toolContext = {
    userId: context.userId,
    conversationId: context.conversationId,
    onSearchResults: context.onSearchResults
      ? (info: { query: string; resultIds: number[] }) =>
          context.onSearchResults?.(info.query, info.resultIds)
      : undefined,
  };

  // 有意图信息：按需加载工具
  if (context.intentType) {
    const result = getToolsForIntentAsVercel(
      context.intentType,
      context.intentSubType,
      context.intentConfidence ?? 0.7,
      input,
      toolContext,
    );

    const confidence = context.intentConfidence ?? 0;
    const isSimpleIntent = SIMPLE_INTENT_TYPES.has(context.intentType);
    const isHighConfidence = confidence >= SKILLS_CONFIDENCE_THRESHOLD;

    // 精确模式或简单意图+高置信度 = 跳过 Skills
    if (
      result.selectionResult.isPreciseMode ||
      (isSimpleIntent && isHighConfidence)
    ) {
      return result.tools;
    }

    // 复杂意图或低置信度：加载 Skills
    const skillTools = getSkillsAsTools(() => ({
      userId: context.userId,
      conversationId: context.conversationId,
    }));

    return mergeToolSets(skillTools, result.tools);
  }

  // 无意图信息：全量加载
  const dataTools = getToolsAsVercelTools(toolContext);
  const skillTools = getSkillsAsTools(() => ({
    userId: context.userId,
    conversationId: context.conversationId,
  }));

  return mergeToolSets(skillTools, dataTools);
}
