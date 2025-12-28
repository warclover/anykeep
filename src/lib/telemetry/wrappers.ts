/**
 * Span 包装器工具函数
 *
 * 提供便捷的追踪包装方法：
 * - withSpan: 基本 Span 包装
 * - withApiSpan: API 路由包装
 * - withAISpan: AI Agent 包装
 * - withDBSpan: 数据库操作包装
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { getTracer, getActiveSpan } from "./tracer";
import { SPAN_NAMES, ATTR_KEYS } from "./types";
import type { Span, SpanAttributes } from "./types";

/**
 * 基本 Span 包装器
 *
 * @example
 * ```typescript
 * const result = await withSpan('my.operation', async () => {
 *   // 你的代码
 * }, { 'custom.attr': 'value' });
 * ```
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: SpanAttributes,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes }, fn);
}

/**
 * 同步 Span 包装器
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: SpanAttributes,
): T {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes }, fn) as T;
}

/**
 * API 路由 Span 包装器
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withApiSpan('bookmarks.list', request, async (span) => {
 *     // 处理逻辑
 *   });
 * }
 * ```
 */
export async function withApiSpan<T>(
  operationName: string,
  request: { method: string; url: string },
  fn: (span: Span) => T | Promise<T>,
): Promise<T> {
  const url = new URL(request.url);

  return withSpan(`${SPAN_NAMES.API}.${operationName}`, fn, {
    [ATTR_KEYS.HTTP_METHOD]: request.method,
    [ATTR_KEYS.HTTP_URL]: url.pathname,
    [ATTR_KEYS.HTTP_ROUTE]: url.pathname,
  });
}

/**
 * AI Agent Span 包装器
 *
 * @example
 * ```typescript
 * return withAIAgentSpan('execute', {
 *   userId: request.userId,
 *   model: 'deepseek-chat',
 * }, async (span) => {
 *   // Agent 执行逻辑
 * });
 * ```
 */
export async function withAIAgentSpan<T>(
  operation: string,
  context: {
    userId?: string;
    conversationId?: string;
    model?: string;
    provider?: string;
  },
  fn: (span: Span) => T | Promise<T>,
): Promise<T> {
  const attributes: SpanAttributes = {};

  if (context.userId) attributes[ATTR_KEYS.USER_ID] = context.userId;
  if (context.conversationId)
    attributes[ATTR_KEYS.SESSION_ID] = context.conversationId;
  if (context.model) attributes[ATTR_KEYS.AI_MODEL] = context.model;
  if (context.provider) attributes[ATTR_KEYS.AI_PROVIDER] = context.provider;

  return withSpan(`${SPAN_NAMES.AI_AGENT}.${operation}`, fn, attributes);
}

/**
 * AI 工具调用 Span 包装器
 *
 * @example
 * ```typescript
 * return withAIToolSpan('search_bookmarks', async (span) => {
 *   const result = await searchBookmarks(query);
 *   span.setAttribute('result.count', result.length);
 *   return result;
 * });
 * ```
 */
export async function withAIToolSpan<T>(
  toolName: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: SpanAttributes,
): Promise<T> {
  return withSpan(
    `${SPAN_NAMES.AI_TOOL}.${toolName}`,
    async (span) => {
      span.setAttribute(ATTR_KEYS.AI_TOOL_NAME, toolName);
      try {
        const result = await fn(span);
        span.setAttribute(ATTR_KEYS.AI_TOOL_SUCCESS, true);
        return result;
      } catch (error) {
        span.setAttribute(ATTR_KEYS.AI_TOOL_SUCCESS, false);
        throw error;
      }
    },
    attributes,
  );
}

/**
 * 数据库操作 Span 包装器
 *
 * @example
 * ```typescript
 * return withDBSpan('select', 'bookmarks', async () => {
 *   return supabase.from('bookmarks').select();
 * });
 * ```
 */
export async function withDBSpan<T>(
  operation: string,
  table: string,
  fn: (span: Span) => T | Promise<T>,
): Promise<T> {
  return withSpan(`${SPAN_NAMES.DB}.${operation}`, fn, {
    [ATTR_KEYS.DB_SYSTEM]: "postgresql",
    [ATTR_KEYS.DB_OPERATION]: operation,
    [ATTR_KEYS.DB_TABLE]: table,
  });
}

/**
 * 缓存操作 Span 包装器
 */
export async function withCacheSpan<T>(
  operation: "get" | "set" | "delete" | "invalidate",
  key: string,
  fn: (span: Span) => T | Promise<T>,
): Promise<T> {
  return withSpan(`${SPAN_NAMES.CACHE}.${operation}`, fn, {
    "cache.key": key,
    "cache.operation": operation,
  });
}

/**
 * 外部服务调用 Span 包装器
 *
 * @example
 * ```typescript
 * return withExternalSpan('openai', 'chat.completions', async (span) => {
 *   const response = await openai.chat.completions.create(params);
 *   span.setAttribute('ai.tokens.output', response.usage?.completion_tokens);
 *   return response;
 * });
 * ```
 */
export async function withExternalSpan<T>(
  service: string,
  operation: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: SpanAttributes,
): Promise<T> {
  return withSpan(`${SPAN_NAMES.EXTERNAL}.${service}.${operation}`, fn, {
    "external.service": service,
    "external.operation": operation,
    ...attributes,
  });
}

/**
 * 添加事件到当前 Span
 */
export function addSpanEvent(name: string, attributes?: SpanAttributes): void {
  const span = getActiveSpan();
  span?.addEvent(name, attributes);
}

/**
 * 设置当前 Span 的属性
 */
export function setSpanAttributes(attributes: SpanAttributes): void {
  const span = getActiveSpan();
  span?.setAttributes(attributes);
}

/**
 * 设置当前 Span 为错误状态
 */
export function setSpanError(error: Error): void {
  const span = getActiveSpan();
  span?.recordException(error);
}

/**
 * 记录 AI Token 使用量
 */
export function recordTokenUsage(
  inputTokens: number,
  outputTokens: number,
): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttribute(ATTR_KEYS.AI_TOKENS_INPUT, inputTokens);
    span.setAttribute(ATTR_KEYS.AI_TOKENS_OUTPUT, outputTokens);
  }
}
