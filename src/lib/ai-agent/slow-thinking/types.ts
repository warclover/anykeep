/**
 * 慢思考层类型定义
 *
 * 提供 AI Agent 深度推理能力的类型定义
 *
 * @module ai-agent/slow-thinking
 * @version 1.0.0
 * @since 2025-12-30
 */

// =============================================================================
// 配置类型
// =============================================================================

/**
 * 模型层级类型
 */
export type ModelTier = "fast" | "standard" | "deep";

/**
 * 慢思考服务配置
 */
export interface SlowThinkingConfig {
  /** 是否启用慢思考 */
  enabled: boolean;
  /** 是否向用户展示思考过程 */
  showToUser: boolean;
  /** 最大思考时间（毫秒） */
  maxThinkingTime: number;
  /** 使用的模型层级 */
  modelTier: ModelTier;
  /** 复杂度阈值，超过此值才触发慢思考（0-100） */
  complexityThreshold: number;
  /** 总是触发慢思考的意图类型 */
  alwaysThinkIntents: string[];
}

// =============================================================================
// 推理过程类型
// =============================================================================

/**
 * 推理步骤
 */
export interface ReasoningStep {
  /** 步骤序号 */
  step: number;
  /** 思考内容 */
  thought: string;
  /** 关键词（可选） */
  keywords?: string[];
  /** 置信度（可选，0-100） */
  confidence?: number;
}

/**
 * 执行策略类型
 */
export type StrategyType = "default" | "customized" | "multi_step";

/**
 * 执行策略
 */
export interface ExecutionStrategy {
  /** 策略类型 */
  type: StrategyType;
  /** 策略描述 */
  description: string;
  /** 预处理步骤 */
  preProcessing?: string[];
  /** 后处理步骤 */
  postProcessing?: string[];
  /** 额外上下文注入 */
  additionalContext?: Record<string, unknown>;
}

/**
 * 内心独白（慢思考输出）
 */
export interface InternalMonologue {
  /** 原始用户输入 */
  originalInput: string;
  /** 思考过程文本 */
  thinking: string;
  /** 结构化推理步骤 */
  reasoningSteps: ReasoningStep[];
  /** 推断的真实意图 */
  inferredIntent: string;
  /** 推断的最终目标（可选） */
  inferredGoal?: string;
  /** 建议的执行策略 */
  suggestedStrategy: ExecutionStrategy;
  /** 是否建议修改路由 */
  suggestRouteChange: boolean;
  /** 思考耗时（毫秒） */
  thinkingDurationMs: number;
  /** 总体置信度（0-100） */
  confidence: number;
  /** 结论摘要（可选） */
  conclusion?: string;
}

// =============================================================================
// 流式输出类型
// =============================================================================

/**
 * 思考过程流式数据块
 */
export interface ThinkingChunk {
  /** 数据块类型 */
  type: "thinking";
  /** 数据内容 */
  data: {
    /** 思考过程文本（分段） */
    monologue?: string;
    /** 推理步骤列表 */
    reasoning?: string[];
    /** 推断的意图 */
    inferredIntent?: string;
    /** 置信度 */
    confidence?: number;
    /** 是否完成 */
    isComplete?: boolean;
    /** 思考耗时 */
    durationMs?: number;
  };
}

// =============================================================================
// 服务接口
// =============================================================================

/**
 * 路由结果接口（简化版，用于解耦）
 */
export interface SlowThinkingRouteResult {
  /** 意图信息 */
  intent: {
    type: string;
    subType?: string;
  };
  /** 复杂度信息 */
  complexity: {
    level: "simple" | "medium" | "complex";
    score: number;
  };
  /** 执行模式 */
  mode: string;
}

/**
 * 动态上下文接口（简化版，用于解耦）
 */
export interface SlowThinkingDynamicContext {
  /** 统计数据 */
  stats?: {
    totalBookmarks?: number;
  };
  /** 最近活动 */
  recentActivity?: {
    lastSaved?: {
      title?: string;
    };
  };
  /** 全局洞察 */
  globalInsight?: {
    topicDistribution?: Array<{
      topic: string;
      weight: number;
    }>;
  };
  /** 主动简报 */
  proactiveBriefing?: {
    daysSinceLastVisit?: number;
  };
}

/**
 * 慢思考服务接口
 */
export interface ISlowThinkingService {
  /** 服务配置 */
  readonly config: SlowThinkingConfig;

  /**
   * 生成内心独白
   * @param userMessage - 用户消息
   * @param routeResult - 路由结果
   * @param context - 动态上下文
   * @returns 内心独白或 null（不需要慢思考时）
   */
  generateMonologue(
    userMessage: string,
    routeResult: SlowThinkingRouteResult,
    context: SlowThinkingDynamicContext,
  ): Promise<InternalMonologue | null>;

  /**
   * 判断是否需要慢思考
   * @param routeResult - 路由结果
   * @returns 是否需要
   */
  shouldThink(routeResult: SlowThinkingRouteResult): boolean;
}

// =============================================================================
// 常量
// =============================================================================

/**
 * 默认配置
 */
export const DEFAULT_SLOW_THINKING_CONFIG: SlowThinkingConfig = {
  enabled: true,
  showToUser: true,
  maxThinkingTime: 5000,
  modelTier: "standard",
  complexityThreshold: 40,
  alwaysThinkIntents: ["organize", "analyze", "learn"],
};

/**
 * 日志模块名称
 */
export const LOG_MODULE = "slow-thinking";

/**
 * 错误消息
 */
export const ERROR_MESSAGES = {
  THINKING_FAILED: "Slow thinking generation failed",
  PARSING_FAILED: "Failed to parse LLM output",
  TIMEOUT: "Slow thinking timed out",
} as const;
