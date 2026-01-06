/**
 * AI Skills 追踪工具
 *
 * 提供 AI 执行路径的追踪能力，集成现有 telemetry tracer
 *
 * @example
 * ```typescript
 * // 基础使用
 * const tracer = getTracer();
 * await tracer.startActiveSpan('ai.skill.search', async (span) => {
 *   span.setAttribute('ai.skill.id', 'search');
 *   // ... 执行逻辑
 * });
 *
 * // 使用辅助函数
 * const result = await withSkillTracing('search', context, async () => {
 *   return executeSkill();
 * });
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import { getTracer, getActiveSpan } from "@/lib/telemetry/tracer";
import { SpanStatusCode, type Span } from "@/lib/telemetry/types";
import type { SkillContext } from "../core/types";
import type { EngineContext } from "../engine/types";
import type { ExecutionMode } from "../router/types";

// ============================================
// 常量定义
// ============================================

/** AI 追踪 Span 名称前缀 */
export const AI_SPAN_PREFIX = "ai" as const;

/** 预定义的 Span 名称 */
export const AI_SPAN_NAMES = {
  /** 统一引擎执行 */
  UNIFIED_EXECUTE: "ai.unified.execute",
  /** 意图路由 */
  ROUTER_ROUTE: "ai.router.route",
  /** 编排引擎执行 */
  ORCHESTRATION_EXECUTE: "ai.orchestration.execute",
  /** 原子模式执行 */
  ATOMIC_EXECUTE: "ai.atomic.execute",
  /** Skill 执行 */
  SKILL_EXECUTE: "ai.skill.execute",
  /** 意图分类 */
  INTENT_CLASSIFY: "ai.intent.classify",
  /** 复杂度评估 */
  COMPLEXITY_EVALUATE: "ai.complexity.evaluate",
  /** 模式选择 */
  MODE_SELECT: "ai.mode.select",
} as const;

/** AI 追踪属性键 */
export const AI_SPAN_ATTRIBUTES = {
  // 用户相关
  USER_ID: "ai.user.id",
  CONVERSATION_ID: "ai.conversation.id",
  // Skill 相关
  SKILL_ID: "ai.skill.id",
  SKILL_NAME: "ai.skill.name",
  SKILL_CATEGORY: "ai.skill.category",
  // 路由相关
  INTENT_TYPE: "ai.intent.type",
  INTENT_SUBTYPE: "ai.intent.subtype",
  INTENT_CONFIDENCE: "ai.intent.confidence",
  COMPLEXITY_LEVEL: "ai.complexity.level",
  COMPLEXITY_SCORE: "ai.complexity.score",
  MODE: "ai.mode",
  // 执行相关
  DURATION_MS: "ai.duration.ms",
  TOKEN_COUNT: "ai.tokens.count",
  ERROR_CODE: "ai.error.code",
  // 请求相关
  REQUEST_ID: "ai.request.id",
  TRACE_ID: "ai.trace.id",
} as const;

// ============================================
// 辅助函数
// ============================================

/**
 * 获取 AI Tracer 实例
 */
export function getAITracer() {
  return getTracer("anykeep-ai", "1.0.0");
}

/**
 * 生成 Skill 执行的 Span 名称
 */
export function getSkillSpanName(skillId: string): string {
  return `ai.skill.${skillId}`;
}

/**
 * 从 SkillContext 提取追踪属性
 */
export function extractSkillContextAttributes(
  context: SkillContext,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    [AI_SPAN_ATTRIBUTES.USER_ID]: context.userId,
  };

  if (context.conversationId) {
    attributes[AI_SPAN_ATTRIBUTES.CONVERSATION_ID] = context.conversationId;
  }
  if (context.traceId) {
    attributes[AI_SPAN_ATTRIBUTES.TRACE_ID] = context.traceId;
  }

  return attributes;
}

/**
 * 从 EngineContext 提取追踪属性
 */
export function extractEngineContextAttributes(
  context: EngineContext,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    [AI_SPAN_ATTRIBUTES.USER_ID]: context.userId,
  };

  if (context.conversationId) {
    attributes[AI_SPAN_ATTRIBUTES.CONVERSATION_ID] = context.conversationId;
  }
  if (context.traceId) {
    attributes[AI_SPAN_ATTRIBUTES.TRACE_ID] = context.traceId;
  }
  if (context.requestId) {
    attributes[AI_SPAN_ATTRIBUTES.REQUEST_ID] = context.requestId;
  }
  if (context.totalBookmarks !== undefined) {
    attributes["ai.context.total_bookmarks"] = context.totalBookmarks;
  }

  return attributes;
}

// ============================================
// 追踪包装器
// ============================================

/**
 * 为 Skill 执行添加追踪
 *
 * @param skillId - Skill ID
 * @param context - Skill 上下文
 * @param fn - 要执行的函数
 */
export async function withSkillTracing<T>(
  skillId: string,
  context: SkillContext,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getAITracer();
  const spanName = getSkillSpanName(skillId);

  return tracer.startActiveSpan(
    spanName,
    { attributes: extractSkillContextAttributes(context) },
    async (span) => {
      span.setAttribute(AI_SPAN_ATTRIBUTES.SKILL_ID, skillId);

      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      }
    },
  );
}

/**
 * 为统一引擎执行添加追踪
 *
 * @param context - 引擎上下文
 * @param mode - 执行模式
 * @param fn - 要执行的函数
 */
export async function withUnifiedEngineTracing<T>(
  context: EngineContext,
  mode: ExecutionMode,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getAITracer();

  return tracer.startActiveSpan(
    AI_SPAN_NAMES.UNIFIED_EXECUTE,
    { attributes: extractEngineContextAttributes(context) },
    async (span) => {
      span.setAttribute(AI_SPAN_ATTRIBUTES.MODE, mode);

      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      }
    },
  );
}

/**
 * 为意图路由添加追踪
 *
 * @param message - 用户消息（截断）
 * @param fn - 要执行的函数
 */
export async function withRouterTracing<T>(
  message: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getAITracer();

  return tracer.startActiveSpan(AI_SPAN_NAMES.ROUTER_ROUTE, async (span) => {
    // 记录消息摘要（限制长度）
    span.setAttribute("ai.message.preview", message.substring(0, 50));

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    }
  });
}

/**
 * 为编排引擎执行添加追踪
 *
 * @param skillId - Skill ID
 * @param context - 引擎上下文
 * @param fn - 要执行的函数
 */
export async function withOrchestrationTracing<T>(
  skillId: string,
  context: EngineContext,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getAITracer();

  return tracer.startActiveSpan(
    AI_SPAN_NAMES.ORCHESTRATION_EXECUTE,
    { attributes: extractEngineContextAttributes(context) },
    async (span) => {
      span.setAttribute(AI_SPAN_ATTRIBUTES.SKILL_ID, skillId);

      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      }
    },
  );
}

// ============================================
// 异步生成器追踪支持
// ============================================

/**
 * 为异步生成器添加追踪
 *
 * 由于异步生成器的特殊性，需要在生成器开始时创建 Span，
 * 在生成器结束（return 或 throw）时结束 Span
 *
 * @param spanName - Span 名称
 * @param attributes - 初始属性
 * @param generator - 要包装的异步生成器函数
 */
export async function* withAsyncGeneratorTracing<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  generator: () => AsyncGenerator<T>,
): AsyncGenerator<T> {
  const tracer = getAITracer();
  const span = tracer.startSpan(spanName, { attributes });

  try {
    const gen = generator();

    for await (const value of gen) {
      yield value;
    }

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * 记录路由结果到当前 Span
 */
export function recordRouteResult(
  span: Span,
  result: {
    intentType: string;
    intentSubType?: string;
    intentConfidence: number;
    complexityLevel: string;
    complexityScore: number;
    mode: string;
    suggestedSkill: string | null;
    durationMs: number;
  },
): void {
  span.setAttribute(AI_SPAN_ATTRIBUTES.INTENT_TYPE, result.intentType);
  if (result.intentSubType) {
    span.setAttribute(AI_SPAN_ATTRIBUTES.INTENT_SUBTYPE, result.intentSubType);
  }
  span.setAttribute(
    AI_SPAN_ATTRIBUTES.INTENT_CONFIDENCE,
    result.intentConfidence,
  );
  span.setAttribute(
    AI_SPAN_ATTRIBUTES.COMPLEXITY_LEVEL,
    result.complexityLevel,
  );
  span.setAttribute(
    AI_SPAN_ATTRIBUTES.COMPLEXITY_SCORE,
    result.complexityScore,
  );
  span.setAttribute(AI_SPAN_ATTRIBUTES.MODE, result.mode);
  if (result.suggestedSkill) {
    span.setAttribute(AI_SPAN_ATTRIBUTES.SKILL_ID, result.suggestedSkill);
  }
  span.setAttribute(AI_SPAN_ATTRIBUTES.DURATION_MS, result.durationMs);
}

/**
 * 记录 Skill 执行结果到当前 Span
 */
export function recordSkillResult(
  span: Span,
  result: {
    success: boolean;
    durationMs: number;
    tokensUsed?: number;
    errorCode?: string;
  },
): void {
  span.setAttribute("ai.skill.success", result.success);
  span.setAttribute(AI_SPAN_ATTRIBUTES.DURATION_MS, result.durationMs);

  if (result.tokensUsed !== undefined) {
    span.setAttribute(AI_SPAN_ATTRIBUTES.TOKEN_COUNT, result.tokensUsed);
  }
  if (result.errorCode) {
    span.setAttribute(AI_SPAN_ATTRIBUTES.ERROR_CODE, result.errorCode);
  }
}

// ============================================
// 导出获取当前 Span
// ============================================

export { getActiveSpan };
