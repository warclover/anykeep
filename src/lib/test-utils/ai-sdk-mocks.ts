/**
 * AI SDK Mock 工具函数
 *
 * 提供类型安全的 generateText/streamText/generateObject mock 工厂
 * 解决 AI SDK v5.x 类型兼容性问题
 *
 * @module test-utils/ai-sdk-mocks
 * @version 1.0.0
 */

import type { generateText, streamText, generateObject } from "ai";

/**
 * AI SDK v5.x 正确的 usage 类型
 * 注意: 是 inputTokens/outputTokens，不是 promptTokens/completionTokens
 */
export interface MockUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
}

/**
 * generateText 返回值的 response 字段类型
 */
export interface MockResponse {
  id: string;
  timestamp: Date;
  modelId: string;
  headers: Record<string, string>;
}

/**
 * generateText mock 配置选项
 */
export interface GenerateTextMockOptions {
  text?: string;
  finishReason?:
    | "stop"
    | "length"
    | "content-filter"
    | "tool-calls"
    | "error"
    | "other";
  usage?: MockUsage;
  response?: Partial<MockResponse>;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  steps?: unknown[];
  warnings?: unknown[];
  rawResponse?: unknown;
}

/**
 * 创建 generateText 返回值 mock
 *
 * @example
 * ```typescript
 * mockGenerateText.mockResolvedValue(
 *   createGenerateTextMock({
 *     text: "AI response",
 *     usage: { inputTokens: 100, outputTokens: 50 },
 *   })
 * );
 * ```
 */
export function createGenerateTextMock(
  options: GenerateTextMockOptions = {},
): Awaited<ReturnType<typeof generateText>> {
  const {
    text = "",
    finishReason = "stop",
    usage = { inputTokens: 0, outputTokens: 0 },
    response = {},
    toolCalls = [],
    toolResults = [],
    steps = [],
    warnings = [],
    rawResponse,
  } = options;

  return {
    text,
    finishReason,
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
    },
    response: {
      id: response.id ?? "mock-response-id",
      timestamp: response.timestamp ?? new Date(),
      modelId: response.modelId ?? "mock-model",
      headers: response.headers ?? {},
    },
    toolCalls,
    toolResults,
    steps,
    warnings,
    rawResponse,
    // AI SDK 可能需要的其他字段
    experimental_providerMetadata: undefined,
    logprobs: undefined,
    request: {
      body: undefined,
    },
    responseMessages: [],
    roundtrips: [],
  } as Awaited<ReturnType<typeof generateText>>;
}

/**
 * streamText mock 配置选项
 */
export interface StreamTextMockOptions {
  text?: string;
  textChunks?: string[];
  finishReason?:
    | "stop"
    | "length"
    | "content-filter"
    | "tool-calls"
    | "error"
    | "other";
  usage?: MockUsage;
  toolCalls?: unknown[];
  steps?: unknown[];
}

/**
 * 创建 streamText 返回值 mock
 *
 * @example
 * ```typescript
 * (streamText as jest.Mock).mockReturnValue(
 *   createStreamTextMock({
 *     text: "Streamed response",
 *     textChunks: ["Streamed ", "response"],
 *   })
 * );
 * ```
 */
export function createStreamTextMock(
  options: StreamTextMockOptions = {},
): ReturnType<typeof streamText> {
  const {
    text = "",
    textChunks = [text],
    finishReason = "stop",
    usage = { inputTokens: 0, outputTokens: 0 },
    toolCalls = [],
    steps = [],
  } = options;

  // 创建异步可迭代的 textStream
  async function* createTextStream(): AsyncGenerator<string> {
    for (const chunk of textChunks) {
      yield chunk;
    }
  }

  // 创建 fullStream（包含更多事件类型）
  async function* createFullStream(): AsyncGenerator<unknown> {
    for (const chunk of textChunks) {
      yield { type: "text-delta", textDelta: chunk };
    }
    yield { type: "finish", finishReason, usage };
  }

  const textStream = createTextStream();
  const fullStream = createFullStream();

  return {
    textStream,
    fullStream,
    text: Promise.resolve(text),
    usage: Promise.resolve({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
    }),
    finishReason: Promise.resolve(finishReason),
    toolCalls: Promise.resolve(toolCalls),
    toolResults: Promise.resolve([]),
    steps: Promise.resolve(steps),
    warnings: Promise.resolve([]),
    rawResponse: Promise.resolve(undefined),
    response: Promise.resolve({
      id: "mock-stream-response-id",
      timestamp: new Date(),
      modelId: "mock-model",
      headers: {},
    }),
    // AI SDK 特定属性
    experimental_providerMetadata: Promise.resolve(undefined),
    pipeTextStreamToResponse: jest.fn(),
    pipeDataStreamToResponse: jest.fn(),
    toTextStreamResponse: jest.fn().mockReturnValue(new Response()),
    toDataStreamResponse: jest.fn().mockReturnValue(new Response()),
    toDataStream: jest.fn(),
    // message 对象需要完整结构
    responseMessages: Promise.resolve([
      {
        id: "mock-message-id",
        role: "assistant" as const,
        content: [{ type: "text" as const, text }],
      },
    ]),
  } as unknown as ReturnType<typeof streamText>;
}

/**
 * generateObject mock 配置选项
 */
export interface GenerateObjectMockOptions<T> {
  object: T;
  finishReason?:
    | "stop"
    | "length"
    | "content-filter"
    | "tool-calls"
    | "error"
    | "other";
  usage?: MockUsage;
}

/**
 * 创建 generateObject 返回值 mock
 *
 * @example
 * ```typescript
 * mockGenerateObject.mockResolvedValue(
 *   createGenerateObjectMock({
 *     object: { intent: "search", confidence: 0.95 },
 *   })
 * );
 * ```
 */
export function createGenerateObjectMock<T>(
  options: GenerateObjectMockOptions<T>,
): Awaited<ReturnType<typeof generateObject<T>>> {
  const {
    object,
    finishReason = "stop",
    usage = { inputTokens: 0, outputTokens: 0 },
  } = options;

  return {
    object,
    finishReason,
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
    },
    warnings: [],
    rawResponse: undefined,
    request: {
      body: undefined,
    },
    response: {
      id: "mock-object-response-id",
      timestamp: new Date(),
      modelId: "mock-model",
      headers: {},
    },
    experimental_providerMetadata: undefined,
    logprobs: undefined,
  } as Awaited<ReturnType<typeof generateObject<T>>>;
}

/**
 * 创建默认的 jest.mock("ai") 配置
 *
 * @example
 * ```typescript
 * jest.mock("ai", () => createAIMockModule());
 * ```
 */
export function createAIMockModule() {
  return {
    generateText: jest.fn().mockResolvedValue(createGenerateTextMock()),
    streamText: jest.fn().mockReturnValue(createStreamTextMock()),
    generateObject: jest
      .fn()
      .mockResolvedValue(createGenerateObjectMock({ object: {} })),
    stepCountIs: jest.fn().mockReturnValue(() => false),
    tool: jest.fn(),
    zodSchema: jest.fn((schema) => schema),
  };
}
