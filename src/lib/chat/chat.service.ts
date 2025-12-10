/**
 * AI 对话服务
 * Phase 4.2: 基于 RAG 检索的智能对话功能
 *
 * 支持：
 * - 流式响应 (Server-Sent Events)
 * - 多轮对话上下文
 * - 引用来源标注
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { logger } from "@/lib/logger";
import {
  ragRetrievalService,
  type RAGRetrievalResult,
  type RAGRetrievalOptions,
} from "./rag-retrieval.service";

/**
 * 对话消息类型
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * 引用来源
 */
export interface Citation {
  bookmarkId: number;
  title: string;
  url: string;
  folderName: string | null;
  similarity: number;
}

/**
 * 对话请求
 */
export interface ChatRequest {
  userId: string;
  query: string;
  conversationHistory?: ChatMessage[];
  options?: {
    /** RAG 检索选项 */
    retrieval?: RAGRetrievalOptions;
    /** AI 生成温度 */
    temperature?: number;
    /** 最大生成 token 数 */
    maxTokens?: number;
    /** 是否启用流式响应 */
    stream?: boolean;
  };
}

/**
 * 对话响应（非流式）
 */
export interface ChatResponse {
  answer: string;
  citations: Citation[];
  metadata: {
    retrievalTimeMs: number;
    generationTimeMs: number;
    totalTimeMs: number;
    tokensUsed?: number;
  };
}

/**
 * 流式响应事件
 */
export type StreamEvent =
  | { type: "retrieval"; data: { bookmarks: Citation[] } }
  | { type: "content"; data: { delta: string } }
  | { type: "done"; data: { totalTime: number; tokensUsed?: number } }
  | { type: "error"; data: { message: string } };

/**
 * 系统提示词
 */
const SYSTEM_PROMPT = `你是一个智能收藏助手，帮助用户理解和探索他们收藏的内容。

你的任务是：
1. 根据用户提供的收藏内容（上下文）回答问题
2. 当引用特定收藏内容时，在回答中标注来源（使用 [1]、[2] 等编号）
3. 如果上下文中没有相关信息，诚实地说明并提供你所知道的一般性信息
4. 回答要简洁、准确、有帮助

回答风格：
- 使用中文回答
- 保持专业但友好的语气
- 适当使用列表和结构化格式
- 优先基于用户的收藏内容回答`;

/**
 * AI 对话服务类
 */
export class ChatService {
  private apiKey: string;
  private baseUrl: string = "https://api.deepseek.com/v1/chat/completions";

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("ChatService: DEEPSEEK_API_KEY not configured");
    }
  }

  /**
   * 发送对话请求（非流式）
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    // 1. RAG 检索
    const retrieval = await ragRetrievalService.retrieve(
      request.userId,
      request.query,
      request.options?.retrieval
    );

    const retrievalEndTime = Date.now();

    // 2. 构建对话消息
    const messages = this.buildMessages(
      request.query,
      retrieval,
      request.conversationHistory
    );

    // 3. 调用 AI 生成
    const aiResponse = await this.callAI(messages, {
      temperature: request.options?.temperature ?? 0.7,
      maxTokens: request.options?.maxTokens ?? 1000,
      stream: false,
    });

    const generationEndTime = Date.now();

    // 4. 构建响应
    const citations: Citation[] = retrieval.bookmarks.map((b) => ({
      bookmarkId: b.id,
      title: b.title,
      url: b.url,
      folderName: b.folderName,
      similarity: b.similarity,
    }));

    return {
      answer: aiResponse.content,
      citations,
      metadata: {
        retrievalTimeMs: retrievalEndTime - startTime,
        generationTimeMs: generationEndTime - retrievalEndTime,
        totalTimeMs: generationEndTime - startTime,
        tokensUsed: aiResponse.tokensUsed,
      },
    };
  }

  /**
   * 发送对话请求（流式）
   *
   * 返回一个异步生成器，产出流式事件
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamEvent> {
    const startTime = Date.now();

    try {
      // 1. RAG 检索
      const retrieval = await ragRetrievalService.retrieve(
        request.userId,
        request.query,
        request.options?.retrieval
      );

      // 发送检索结果
      const citations: Citation[] = retrieval.bookmarks.map((b) => ({
        bookmarkId: b.id,
        title: b.title,
        url: b.url,
        folderName: b.folderName,
        similarity: b.similarity,
      }));

      yield { type: "retrieval", data: { bookmarks: citations } };

      // 2. 构建对话消息
      const messages = this.buildMessages(
        request.query,
        retrieval,
        request.conversationHistory
      );

      // 3. 调用 AI 流式生成（带超时控制）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        logger.warn("ChatService: Stream request timed out after 60s");
      }, 60000); // 60 秒超时

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          temperature: request.options?.temperature ?? 0.7,
          max_tokens: request.options?.maxTokens ?? 1000,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      // 4. 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let tokensUsed = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              clearTimeout(timeoutId); // 清除超时定时器
              yield {
                type: "done",
                data: {
                  totalTime: Date.now() - startTime,
                  tokensUsed: tokensUsed || undefined,
                },
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                yield { type: "content", data: { delta } };
              }
              // 累计 token 使用
              if (parsed.usage?.total_tokens) {
                tokensUsed = parsed.usage.total_tokens;
              }
            } catch (parseError) {
              // SSE 解析错误日志（debug 级别，避免刷屏）
              logger.debug(
                {
                  data: data.slice(0, 100),
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                },
                "ChatService: SSE parse warning (non-fatal)"
              );
            }
          }
        }
      }

      clearTimeout(timeoutId); // 清除超时定时器
      yield {
        type: "done",
        data: {
          totalTime: Date.now() - startTime,
          tokensUsed: tokensUsed || undefined,
        },
      };
    } catch (error) {
      // 检查是否为超时/取消错误
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const errorMessage = isAbortError
        ? "请求超时或被取消"
        : error instanceof Error
          ? error.message
          : "对话生成失败";

      logger.error(
        {
          error: errorMessage,
          isAbort: isAbortError,
        },
        "ChatService: Stream error"
      );
      yield {
        type: "error",
        data: {
          message: errorMessage,
        },
      };
    }
  }

  /**
   * 构建对话消息列表
   */
  private buildMessages(
    query: string,
    retrieval: RAGRetrievalResult,
    history?: ChatMessage[]
  ): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // 添加对话历史（限制最近 10 轮）
    if (history && history.length > 0) {
      const recentHistory = history.slice(-20); // 最近 20 条消息（10 轮对话）
      messages.push(...recentHistory);
    }

    // 构建用户消息（包含检索上下文）
    let userMessage = "";

    if (retrieval.context) {
      userMessage += `## 相关收藏内容\n\n${retrieval.context}\n\n`;
    }

    userMessage += `## 用户问题\n\n${query}`;

    if (retrieval.bookmarks.length > 0) {
      userMessage += `\n\n（注意：如果回答基于上面的收藏内容，请使用 [1]、[2] 等标注引用）`;
    }

    messages.push({ role: "user", content: userMessage });

    return messages;
  }

  /**
   * 调用 AI API（非流式）
   */
  private async callAI(
    messages: ChatMessage[],
    options: {
      temperature: number;
      maxTokens: number;
      stream: boolean;
    }
  ): Promise<{ content: string; tokensUsed?: number }> {
    if (!this.apiKey) {
      throw new Error("DEEPSEEK_API_KEY 未配置");
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI 未返回内容");
    }

    return {
      content,
      tokensUsed: data.usage?.total_tokens,
    };
  }
}

// 导出单例
export const chatService = new ChatService();
