/**
 * 慢思考模块
 *
 * 提供 AI Agent 深度推理能力
 *
 * @module ai-agent/slow-thinking
 * @version 1.0.0
 * @since 2025-12-30
 */

// 类型导出
export type {
  SlowThinkingConfig,
  ModelTier,
  ReasoningStep,
  StrategyType,
  ExecutionStrategy,
  InternalMonologue,
  ThinkingChunk,
  SlowThinkingRouteResult,
  SlowThinkingDynamicContext,
  ISlowThinkingService,
} from "./types";

// 常量导出
export {
  DEFAULT_SLOW_THINKING_CONFIG,
  LOG_MODULE,
  ERROR_MESSAGES,
} from "./types";

// 服务导出
export {
  SlowThinkingService,
  createSlowThinkingService,
} from "./slow-thinking-service";

// 工具函数导出
export {
  buildThinkingPrompt,
  buildQuickThinkingPrompt,
} from "./prompt-builder";
export {
  extractTag,
  parseReasoningSteps,
  parseStrategy,
  parseMonologue,
  validateMonologue,
  createDefaultMonologue,
} from "./output-parser";
