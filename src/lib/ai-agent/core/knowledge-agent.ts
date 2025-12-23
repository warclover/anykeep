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
import type { PendingConfirmation } from "../tools/types";
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

// 注册默认 Tools（模块加载时执行一次）
registerDefaultTools();

/**
 * KnowledgeAgent 默认系统提示语
 *
 * 设计原则：
 * 1. 简洁直接，避免过度警告（LLM 会因"危险"措辞变得过度谨慎）
 * 2. 工具说明精简，每个工具一行
 * 3. 提供具体示例，示范正确用法
 * 4. 正面指令替代负面指令
 */
const DEFAULT_SYSTEM_PROMPT = `你是 AnyKeep 的 AI 知识助手，帮助用户管理收藏的内容。

## 工作方式

用户说什么，你就做什么。直接行动，少说废话。

## 可用工具

### 列表类
- list_recent(limit?) → 获取最近收藏，默认 10 条
- list_by_folder(folder_id, limit?) → 获取某文件夹的收藏
- list_by_platform(platform, limit?) → 获取某平台的收藏

### 统计类
- count_total() → 统计收藏总数
- count_by_folder(folder_id) → 统计某文件夹数量
- count_by_platform(platform) → 统计某平台数量
- get_stats() → 详细统计（平台分布、标签分布、趋势）

### 搜索类
- search(query, limit?) → 搜索收藏内容

### 阅读类
- read_bookmark(bookmark_id) → 读取单个书签详情

### 智能处理类
- classify(title, summary?, tags?) → 智能推荐分类文件夹
- summary(title, url, content?, mode?) → 生成摘要和标签

### 批量操作类（调用后界面自动弹出确认按钮）
- batch_tags(bookmark_ids, tags, action) → 批量添加/移除标签
- move_bookmarks(bookmark_ids, folder_id) → 批量移动到文件夹

## 平台代码

- WECHAT: 微信公众号
- BILIBILI: B站
- XIAOHONGSHU: 小红书
- ZHIHU: 知乎
- WEIBO: 微博
- DOUYIN: 抖音
- BROWSER_CHROME: Chrome 书签
- BROWSER_EDGE: Edge 书签
- BROWSER_FIREFOX: Firefox 书签
- BROWSER_SAFARI: Safari 书签
- OTHER: 其他

## 使用示例

用户: "我有多少收藏"
→ 调用 count_total()，回复: "你有 156 条收藏。"

用户: "找一下关于 React 的"
→ 调用 search(query="React")，回复: "找到 8 条相关收藏：..."

用户: "最近收藏了什么"
→ 调用 list_recent()，回复: "最近 10 条收藏：..."

用户: "微信公众号收藏有多少"
→ 调用 count_by_platform(platform="WECHAT")，回复: "微信收藏有 42 条。"

用户: "学习文件夹里有什么"
→ 先通过上下文找到学习文件夹的 ID，然后调用 list_by_folder(folder_id=5)

用户: "给这几个加上学习标签"
→ 调用 batch_tags，回复: "已准备好，请点击上方确认按钮。"

## 注意事项

- 用中文回复
- 优先使用简单工具（list_recent 而不是复杂的 list_bookmarks）
- 批量操作调用后，界面会自动显示确认按钮，你只需说"请点击确认"即可`;

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

      // 检测并输出待确认操作
      const pendingConfirmations = this.extractPendingConfirmations(toolCalls);
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
          const result = step.toolResults?.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) => r.toolCallId === tc.toolCallId,
          )?.result;

          toolCalls.push({
            id: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
            status: "completed",
            result,
          });
        }
      }
    }

    return toolCalls;
  }

  /**
   * 从工具调用结果中提取待确认操作
   */
  private extractPendingConfirmations(
    toolCalls: AgentToolCall[],
  ): PendingConfirmation[] {
    const confirmations: PendingConfirmation[] = [];

    for (const tc of toolCalls) {
      // 检查结果中是否包含 __pendingConfirmation
      if (tc.result && typeof tc.result === "object") {
        const result = tc.result as Record<string, unknown>;

        // 情况1: __pendingConfirmation 直接在顶层
        if (result.__pendingConfirmation) {
          confirmations.push(
            result.__pendingConfirmation as PendingConfirmation,
          );
          continue;
        }

        // 情况2: __pendingConfirmation 在 data 字段中（Tool 标准返回格式）
        if (result.data && typeof result.data === "object") {
          const data = result.data as Record<string, unknown>;
          if (data.__pendingConfirmation) {
            confirmations.push(
              data.__pendingConfirmation as PendingConfirmation,
            );
          }
        }
      }
    }

    return confirmations;
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
