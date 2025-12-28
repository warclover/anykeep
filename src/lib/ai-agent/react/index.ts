/**
 * ReAct 模块入口
 *
 * 导出 ReAct 循环相关的类型、配置和执行器
 *
 * @module ai-agent/react
 * @version 1.0.0
 */

// 类型导出
export type {
  ReactPhase,
  ReactPhaseDetail,
  ReactToolCall,
  ReactRoundState,
  ReactLoopConfig,
  ReactLoopConfigRequired,
  ReactExecutionResult,
  ReactFinishReason,
  ReactThinkingData,
  ReactLoopStartEvent,
  ReactLoopEndEvent,
  ReactContext,
  ObservationAnalysis,
} from "./types";

// 常量和工具函数导出
export {
  DEFAULT_REACT_CONFIG,
  createReactConfig,
  createInitialRoundState,
  createReactContext,
  toReactToolCall,
} from "./types";

// Prompt 构建器导出
export {
  ReactPromptBuilder,
  buildReactSystemPrompt,
  buildThinkingPrompt,
  buildObservationPrompt,
  analyzeObservation,
} from "./react-prompt-builder";

// 执行器导出
export {
  ReactLoopExecutor,
  createReactLoopExecutor,
  type AtomicExecutor,
  type ReactLoopCallbacks,
} from "./react-loop-executor";
