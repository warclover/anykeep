/**
 * KnowledgeAgent - 知识管理智能助手
 *
 * 职责：
 * - 使用 Skills 作为工具进行知识管理任务
 * - 支持流式响应和非流式响应
 * - 管理会话上下文和记忆
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { generateText, streamText, stepCountIs, type CoreMessage } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";
import { getSkillsAsTools } from "@/lib/ai-skills";
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

/**
 * KnowledgeAgent 默认系统提示语
 */
const DEFAULT_SYSTEM_PROMPT = `你是 AnyKeep 的智能知识助手。

你的职责是帮助用户管理和组织他们的知识收藏，包括：
- 搜索和查找书签内容
- 对内容进行智能分类
- 生成内容摘要和标签
- 回答关于用户收藏内容的问题

使用指南：
1. 当用户需要搜索内容时，使用 search 工具
2. 当用户需要分类内容时，使用 classify 工具
3. 当用户需要生成摘要时，使用 summary 工具

请始终保持友好、专业的态度，用中文回复用户。`;

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
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
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

      // 获取 Skills 作为 Tools
      const tools = getSkillsAsTools(() => ({
        userId: context.userId,
        conversationId: context.conversationId,
      }));

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
      const toolCalls = this.extractToolCalls(result);

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
        finishReason: this.mapFinishReason(result.finishReason),
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          conversationId: conversation.id,
          error: errorMessage,
          durationMs,
        },
        "KnowledgeAgent: Execution failed",
      );

      return {
        success: false,
        content: "",
        toolCalls: [],
        durationMs,
        error: errorMessage,
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

      // 获取 Skills 作为 Tools
      const tools = getSkillsAsTools(() => ({
        userId: context.userId,
        conversationId: context.conversationId,
      }));

      // 构建消息历史
      const messages = this.buildMessages(conversation, context);

      logger.info(
        {
          userId: context.userId,
          conversationId: conversation.id,
          provider: selection.provider.name,
          streaming: true,
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

      // 流式输出文本
      for await (const chunk of result.textStream) {
        fullText += chunk;
        yield {
          type: "text",
          text: chunk,
        };
      }

      // 等待完成并获取最终结果
      const durationMs = Math.round(performance.now() - startTime);

      // 记录成功
      aiProviderRouter.recordSuccess(selection.provider.name, durationMs);

      // 提取工具调用 - 需要 await steps Promise
      const steps = await result.steps;
      const extractedToolCalls = this.extractToolCallsFromSteps(steps);
      toolCalls.push(...extractedToolCalls);

      // 输出工具调用信息
      for (const tc of toolCalls) {
        yield {
          type: "tool-call",
          toolCall: tc,
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
          finishReason: this.mapFinishReason(finishReason),
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          conversationId: conversation?.id,
          error: errorMessage,
        },
        "KnowledgeAgent: Stream execution failed",
      );

      yield {
        type: "error",
        error: errorMessage,
      };
    }
  }

  /**
   * 构建消息历史
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

    // 历史消息
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

    return messages;
  }

  /**
   * 从 generateText 结果提取工具调用
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractToolCalls(result: any): AgentToolCall[] {
    const toolCalls: AgentToolCall[] = [];

    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolCalls.push({
              id: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
              status: "completed",
              result: step.toolResults?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (r: any) => r.toolCallId === tc.toolCallId,
              )?.result,
            });
          }
        }
      }
    }

    return toolCalls;
  }

  /**
   * 从 steps 提取工具调用
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractToolCallsFromSteps(steps: any[]): AgentToolCall[] {
    const toolCalls: AgentToolCall[] = [];

    if (!steps) return toolCalls;

    for (const step of steps) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          toolCalls.push({
            id: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
            status: "completed",
            result: step.toolResults?.find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (r: any) => r.toolCallId === tc.toolCallId,
            )?.result,
          });
        }
      }
    }

    return toolCalls;
  }

  /**
   * 映射完成原因
   */
  private mapFinishReason(
    reason: string | undefined,
  ): "stop" | "length" | "tool-calls" | "error" {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool-calls":
        return "tool-calls";
      default:
        return "stop";
    }
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
