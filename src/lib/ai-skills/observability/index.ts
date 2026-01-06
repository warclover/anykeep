/**
 * AI Skills 可观测性模块
 *
 * 提供追踪和指标能力，集成现有 telemetry 基础设施
 *
 * @example
 * ```typescript
 * import {
 *   withSkillTracing,
 *   recordSkillExecution,
 *   getAIMetrics,
 * } from "@/lib/ai-skills/observability";
 *
 * // 追踪 Skill 执行
 * const result = await withSkillTracing('search', context, async (span) => {
 *   span.setAttribute('query', 'test');
 *   return await executeSearch();
 * });
 *
 * // 记录指标
 * recordSkillExecution('search', 150, { success: true, category: 'search' });
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

// ============================================
// 追踪导出
// ============================================

export {
  // 常量
  AI_SPAN_PREFIX,
  AI_SPAN_NAMES,
  AI_SPAN_ATTRIBUTES,
  // 辅助函数
  getAITracer,
  getSkillSpanName,
  extractSkillContextAttributes,
  extractEngineContextAttributes,
  // 追踪包装器
  withSkillTracing,
  withUnifiedEngineTracing,
  withRouterTracing,
  withOrchestrationTracing,
  withAsyncGeneratorTracing,
  // 记录函数
  recordRouteResult,
  recordSkillResult,
  // 重新导出
  getActiveSpan,
} from "./tracing";

// ============================================
// 指标导出
// ============================================

export {
  // 常量
  AI_METRICS_PREFIX,
  AI_METRIC_NAMES,
  AI_METRIC_LABELS,
  // 类型
  type AIMetrics,
  // 获取函数
  getAIMetrics,
  resetAIMetrics,
  // 便捷记录函数
  recordSkillExecution,
  recordRoutingResult,
  recordOrchestrationExecution,
  trackActiveSkill,
  trackActiveOrchestration,
  recordCacheAccess,
} from "./metrics";
