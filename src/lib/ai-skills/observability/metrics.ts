/**
 * AI Skills 指标定义
 *
 * 为 AI 执行路径定义标准指标，集成现有 metrics-collector
 *
 * @example
 * ```typescript
 * // 记录 Skill 执行
 * aiMetrics.skillExecutions.inc({ skill_id: 'search', status: 'success' });
 * aiMetrics.skillDuration.record(150, { skill_id: 'search' });
 *
 * // 记录路由
 * aiMetrics.routingDuration.record(25, { mode: 'atomic' });
 *
 * // 活跃 Skill 计数
 * aiMetrics.activeSkills.inc();
 * // ... 执行完成后
 * aiMetrics.activeSkills.dec();
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import {
  metricsCollector,
  type Counter,
  type Histogram,
  type Gauge,
} from "@/lib/telemetry";

// ============================================
// 指标名称常量
// ============================================

/** AI 指标名称前缀 */
export const AI_METRICS_PREFIX = "ai" as const;

/** 预定义的指标名称 */
export const AI_METRIC_NAMES = {
  // Skill 执行指标
  SKILL_EXECUTIONS: "ai.skill.executions",
  SKILL_DURATION: "ai.skill.duration",
  SKILL_ERRORS: "ai.skill.errors",
  // 路由指标
  ROUTING_DURATION: "ai.router.duration",
  ROUTING_REQUESTS: "ai.router.requests",
  // L0 路由指标 [V4.0 新增]
  L0_HITS: "ai.router.l0.hits",
  L0_MISSES: "ai.router.l0.misses",
  L0_DURATION: "ai.router.l0.duration",
  // 编排指标
  ORCHESTRATION_DURATION: "ai.orchestration.duration",
  ORCHESTRATION_STEPS: "ai.orchestration.steps",
  // 活跃状态
  ACTIVE_SKILLS: "ai.skills.active",
  ACTIVE_ORCHESTRATIONS: "ai.orchestrations.active",
  // Token 使用
  TOKENS_USED: "ai.tokens.used",
  // 缓存
  CACHE_HITS: "ai.cache.hits",
  CACHE_MISSES: "ai.cache.misses",
  // 胶囊指标 [V4.0 新增]
  CAPSULE_HITS: "ai.capsule.hits",
  CAPSULE_TOOL_COUNT: "ai.capsule.tool_count",
} as const;

// ============================================
// 指标标签常量
// ============================================

/** 常用标签键 */
export const AI_METRIC_LABELS = {
  SKILL_ID: "skill_id",
  SKILL_CATEGORY: "skill_category",
  MODE: "mode",
  INTENT_TYPE: "intent_type",
  STATUS: "status",
  ERROR_CODE: "error_code",
  MODEL_ID: "model_id",
} as const;

// ============================================
// 指标实例
// ============================================

/**
 * AI Skills 指标集合
 */
export interface AIMetrics {
  // Skill 执行
  skillExecutions: Counter;
  skillDuration: Histogram;
  skillErrors: Counter;
  // 路由
  routingDuration: Histogram;
  routingRequests: Counter;
  // L0 路由 [V4.0 新增]
  l0Hits: Counter;
  l0Misses: Counter;
  l0Duration: Histogram;
  // 编排
  orchestrationDuration: Histogram;
  orchestrationSteps: Histogram;
  // 活跃状态
  activeSkills: Gauge;
  activeOrchestrations: Gauge;
  // Token
  tokensUsed: Counter;
  // 缓存
  cacheHits: Counter;
  cacheMisses: Counter;
  // 胶囊 [V4.0 新增]
  capsuleHits: Counter;
  capsuleToolCount: Histogram;
}

/**
 * 创建 AI 指标实例
 */
function createAIMetrics(): AIMetrics {
  return {
    // Skill 执行计数
    skillExecutions: metricsCollector.createCounter(
      AI_METRIC_NAMES.SKILL_EXECUTIONS,
      "AI Skill 执行次数",
    ),
    // Skill 执行时长
    skillDuration: metricsCollector.createHistogram(
      AI_METRIC_NAMES.SKILL_DURATION,
      "AI Skill 执行时长",
      { unit: "ms" },
    ),
    // Skill 错误计数
    skillErrors: metricsCollector.createCounter(
      AI_METRIC_NAMES.SKILL_ERRORS,
      "AI Skill 错误次数",
    ),
    // 路由时长
    routingDuration: metricsCollector.createHistogram(
      AI_METRIC_NAMES.ROUTING_DURATION,
      "意图路由时长",
      { unit: "ms" },
    ),
    // 路由请求计数
    routingRequests: metricsCollector.createCounter(
      AI_METRIC_NAMES.ROUTING_REQUESTS,
      "意图路由请求次数",
    ),
    // L0 路由命中 [V4.0 新增]
    l0Hits: metricsCollector.createCounter(
      AI_METRIC_NAMES.L0_HITS,
      "L0 规则命中次数",
    ),
    // L0 路由未命中 [V4.0 新增]
    l0Misses: metricsCollector.createCounter(
      AI_METRIC_NAMES.L0_MISSES,
      "L0 规则未命中次数",
    ),
    // L0 路由时长 [V4.0 新增]
    l0Duration: metricsCollector.createHistogram(
      AI_METRIC_NAMES.L0_DURATION,
      "L0 规则匹配时长",
      { unit: "ms", buckets: [0.1, 0.5, 1, 2, 5, 10] },
    ),
    // 编排执行时长
    orchestrationDuration: metricsCollector.createHistogram(
      AI_METRIC_NAMES.ORCHESTRATION_DURATION,
      "编排执行时长",
      { unit: "ms" },
    ),
    // 编排步骤数
    orchestrationSteps: metricsCollector.createHistogram(
      AI_METRIC_NAMES.ORCHESTRATION_STEPS,
      "编排执行步骤数",
      { unit: "steps", buckets: [1, 2, 3, 5, 8, 10, 15, 20] },
    ),
    // 活跃 Skill 数
    activeSkills: metricsCollector.createGauge(
      AI_METRIC_NAMES.ACTIVE_SKILLS,
      "当前活跃的 Skill 执行数",
    ),
    // 活跃编排数
    activeOrchestrations: metricsCollector.createGauge(
      AI_METRIC_NAMES.ACTIVE_ORCHESTRATIONS,
      "当前活跃的编排执行数",
    ),
    // Token 使用量
    tokensUsed: metricsCollector.createCounter(
      AI_METRIC_NAMES.TOKENS_USED,
      "Token 使用总量",
    ),
    // 缓存命中
    cacheHits: metricsCollector.createCounter(
      AI_METRIC_NAMES.CACHE_HITS,
      "缓存命中次数",
    ),
    // 缓存未命中
    cacheMisses: metricsCollector.createCounter(
      AI_METRIC_NAMES.CACHE_MISSES,
      "缓存未命中次数",
    ),
    // 胶囊命中 [V4.0 新增]
    capsuleHits: metricsCollector.createCounter(
      AI_METRIC_NAMES.CAPSULE_HITS,
      "胶囊工具加载命中次数",
    ),
    // 胶囊工具数量 [V4.0 新增]
    capsuleToolCount: metricsCollector.createHistogram(
      AI_METRIC_NAMES.CAPSULE_TOOL_COUNT,
      "胶囊加载的工具数量",
      { unit: "tools", buckets: [1, 3, 5, 10, 15, 20, 30] },
    ),
  };
}

// ============================================
// 单例导出
// ============================================

/**
 * AI 指标实例
 *
 * 使用惰性初始化，首次访问时创建
 */
let _aiMetrics: AIMetrics | null = null;

/**
 * 获取 AI 指标实例
 */
export function getAIMetrics(): AIMetrics {
  if (!_aiMetrics) {
    _aiMetrics = createAIMetrics();
  }
  return _aiMetrics;
}

/**
 * 重置 AI 指标（用于测试）
 */
export function resetAIMetrics(): void {
  _aiMetrics = null;
}

// ============================================
// 便捷记录函数
// ============================================

/**
 * 记录 Skill 执行
 */
export function recordSkillExecution(
  skillId: string,
  durationMs: number,
  options: {
    success: boolean;
    category?: string;
    tokensUsed?: number;
    errorCode?: string;
  },
): void {
  const metrics = getAIMetrics();
  const labels: Record<string, string> = {
    [AI_METRIC_LABELS.SKILL_ID]: skillId,
    [AI_METRIC_LABELS.STATUS]: options.success ? "success" : "error",
  };

  if (options.category) {
    labels[AI_METRIC_LABELS.SKILL_CATEGORY] = options.category;
  }

  // 记录执行计数
  metrics.skillExecutions.inc(labels);

  // 记录时长
  metrics.skillDuration.record(durationMs, labels);

  // 记录错误（如果有）
  if (!options.success) {
    const errorLabels: Record<string, string> = { ...labels };
    if (options.errorCode) {
      errorLabels[AI_METRIC_LABELS.ERROR_CODE] = options.errorCode;
    }
    metrics.skillErrors.inc(errorLabels);
  }

  // 记录 Token 使用（如果有）
  if (options.tokensUsed !== undefined && options.tokensUsed > 0) {
    metrics.tokensUsed.add(options.tokensUsed, {
      [AI_METRIC_LABELS.SKILL_ID]: skillId,
    });
  }
}

/**
 * 记录路由结果
 */
export function recordRoutingResult(
  durationMs: number,
  options: {
    mode: "atomic" | "orchestration";
    intentType: string;
    success?: boolean;
  },
): void {
  const metrics = getAIMetrics();
  const labels = {
    [AI_METRIC_LABELS.MODE]: options.mode,
    [AI_METRIC_LABELS.INTENT_TYPE]: options.intentType,
    [AI_METRIC_LABELS.STATUS]: options.success !== false ? "success" : "error",
  };

  metrics.routingRequests.inc(labels);
  metrics.routingDuration.record(durationMs, labels);
}

/**
 * 记录编排执行
 */
export function recordOrchestrationExecution(
  skillId: string,
  durationMs: number,
  stepCount: number,
  options: {
    success: boolean;
    errorCode?: string;
  },
): void {
  const metrics = getAIMetrics();
  const labels = {
    [AI_METRIC_LABELS.SKILL_ID]: skillId,
    [AI_METRIC_LABELS.STATUS]: options.success ? "success" : "error",
  };

  metrics.orchestrationDuration.record(durationMs, labels);
  metrics.orchestrationSteps.record(stepCount, labels);
}

/**
 * 创建活跃 Skill 计数器
 *
 * 返回 release 函数，执行完成后调用以减少计数
 */
export function trackActiveSkill(skillId: string): () => void {
  const metrics = getAIMetrics();
  const labels = { [AI_METRIC_LABELS.SKILL_ID]: skillId };

  metrics.activeSkills.inc(1, labels);

  return () => {
    metrics.activeSkills.dec(1, labels);
  };
}

/**
 * 创建活跃编排计数器
 */
export function trackActiveOrchestration(skillId: string): () => void {
  const metrics = getAIMetrics();
  const labels = { [AI_METRIC_LABELS.SKILL_ID]: skillId };

  metrics.activeOrchestrations.inc(1, labels);

  return () => {
    metrics.activeOrchestrations.dec(1, labels);
  };
}

/**
 * 记录缓存访问
 */
export function recordCacheAccess(hit: boolean, cacheType?: string): void {
  const metrics = getAIMetrics();
  const labels: Record<string, string> | undefined = cacheType
    ? { cache_type: cacheType }
    : undefined;

  if (hit) {
    metrics.cacheHits.inc(labels);
  } else {
    metrics.cacheMisses.inc(labels);
  }
}

// ============================================
// L0 路由指标 [V4.0 新增]
// ============================================

/**
 * 记录 L0 路由结果
 *
 * @param hit - 是否命中 L0 规则
 * @param durationMs - 匹配耗时（毫秒）
 * @param options - 额外选项
 */
export function recordL0RouteResult(
  hit: boolean,
  durationMs: number,
  options?: {
    ruleId?: string;
    intentType?: string;
  },
): void {
  const metrics = getAIMetrics();
  const labels: Record<string, string> = {};

  if (options?.ruleId) {
    labels["rule_id"] = options.ruleId;
  }
  if (options?.intentType) {
    labels[AI_METRIC_LABELS.INTENT_TYPE] = options.intentType;
  }

  if (hit) {
    metrics.l0Hits.inc(labels);
  } else {
    metrics.l0Misses.inc(labels);
  }

  metrics.l0Duration.record(durationMs, labels);
}

// ============================================
// 胶囊指标 [V4.0 新增]
// ============================================

/**
 * 记录胶囊工具加载
 *
 * @param capsuleId - 胶囊 ID
 * @param toolCount - 加载的工具数量
 * @param intentType - 意图类型
 */
export function recordCapsuleLoad(
  capsuleId: string,
  toolCount: number,
  intentType?: string,
): void {
  const metrics = getAIMetrics();
  const labels: Record<string, string> = {
    capsule_id: capsuleId,
  };

  if (intentType) {
    labels[AI_METRIC_LABELS.INTENT_TYPE] = intentType;
  }

  metrics.capsuleHits.inc(labels);
  metrics.capsuleToolCount.record(toolCount, labels);
}
