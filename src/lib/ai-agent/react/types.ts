/**
 * ReAct 循环类型定义
 *
 * ReAct (Reasoning + Acting) 模式实现显式的 Think → Act → Observe 循环，
 * 让 AI 能够观察工具执行结果、反思结果是否满足需求、决定是否继续调用工具。
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { AgentToolCall } from "../core/types";

// ============================================================================
// ReAct 阶段定义
// ============================================================================

/**
 * ReAct 循环阶段
 */
export type ReactPhase = "think" | "act" | "observe";

/**
 * ReAct 阶段详细状态（用于 UI 展示）
 */
export type ReactPhaseDetail =
  | "react_think" // 思考阶段
  | "react_act" // 行动阶段
  | "react_observe" // 观察阶段
  | "react_complete"; // 循环完成

// ============================================================================
// ReAct 轮次状态
// ============================================================================

/**
 * ReAct 单轮循环中的工具调用信息
 */
export interface ReactToolCall {
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  args: Record<string, unknown>;
  /** 执行结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行耗时 (ms) */
  durationMs?: number;
}

/**
 * ReAct 单轮循环状态
 */
export interface ReactRoundState {
  /** 当前轮次 (1-based) */
  round: number;
  /** 当前阶段 */
  phase: ReactPhase;
  /** 思考内容（Think 阶段输出） */
  thinking?: string;
  /** 行动描述（Act 阶段描述） */
  action?: string;
  /** 工具调用列表（Act 阶段） */
  toolCalls?: ReactToolCall[];
  /** 观察结论（Observe 阶段输出） */
  observation?: string;
  /** 是否达成目标 */
  goalAchieved: boolean;
  /** 是否需要继续循环 */
  shouldContinue: boolean;
  /** 本轮开始时间戳 */
  startedAt: number;
  /** 本轮结束时间戳 */
  endedAt?: number;
}

// ============================================================================
// ReAct 配置
// ============================================================================

/**
 * ReAct 循环配置
 */
export interface ReactLoopConfig {
  /** 最大循环轮数 (默认 5) */
  maxRounds?: number;
  /** 是否启用思考过程展示 (默认 true) */
  showThinking?: boolean;
  /** 思考阶段超时毫秒 (默认 5000) */
  thinkingTimeoutMs?: number;
  /** 单轮执行超时毫秒 (默认 30000) */
  roundTimeoutMs?: number;
  /** 总执行超时毫秒 (默认 120000) */
  totalTimeoutMs?: number;
  /** 是否启用观察阶段 (默认 true) */
  enableObservation?: boolean;
  /** 目标达成置信度阈值 (默认 0.8) */
  goalAchievedThreshold?: number;
}

/**
 * ReAct 配置的完整类型（含默认值）
 */
export type ReactLoopConfigRequired = Required<ReactLoopConfig>;

/**
 * ReAct 默认配置
 */
export const DEFAULT_REACT_CONFIG: ReactLoopConfigRequired = {
  maxRounds: 5,
  showThinking: true,
  thinkingTimeoutMs: 5000,
  roundTimeoutMs: 30000,
  totalTimeoutMs: 120000,
  enableObservation: true,
  goalAchievedThreshold: 0.8,
};

// ============================================================================
// ReAct 执行结果
// ============================================================================

/**
 * ReAct 执行结果
 */
export interface ReactExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 最终响应文本 */
  response: string;
  /** 执行的轮次列表 */
  rounds: ReactRoundState[];
  /** 总轮次数 */
  totalRounds: number;
  /** 是否达成目标 */
  goalAchieved: boolean;
  /** 终止原因 */
  finishReason: ReactFinishReason;
  /** 总耗时毫秒 */
  totalDurationMs: number;
  /** Token 使用量 */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * ReAct 循环终止原因
 */
export type ReactFinishReason =
  | "goal_achieved" // 目标达成
  | "max_rounds" // 达到最大轮数
  | "no_tool_calls" // 无工具调用（直接回答）
  | "timeout" // 超时
  | "error" // 错误
  | "cancelled"; // 用户取消

// ============================================================================
// ReAct 流式输出
// ============================================================================

/**
 * ReAct 思考块（用于流式输出）
 */
export interface ReactThinkingData {
  /** 阶段详细状态 */
  phase: ReactPhaseDetail;
  /** 思考/观察内容 */
  content: string;
  /** 当前轮次 */
  round: number;
  /** 时间戳 */
  timestamp: number;
  /** 是否为最终状态 */
  isFinal?: boolean;
}

/**
 * ReAct 循环开始事件
 */
export interface ReactLoopStartEvent {
  /** 最大轮数 */
  maxRounds: number;
  /** 配置信息 */
  config: ReactLoopConfig;
  /** 开始时间戳 */
  startedAt: number;
}

/**
 * ReAct 循环结束事件
 */
export interface ReactLoopEndEvent {
  /** 完成的轮次数 */
  completedRounds: number;
  /** 终止原因 */
  finishReason: ReactFinishReason;
  /** 是否达成目标 */
  goalAchieved: boolean;
  /** 总耗时毫秒 */
  totalDurationMs: number;
}

// ============================================================================
// ReAct 上下文
// ============================================================================

/**
 * ReAct 执行上下文
 */
export interface ReactContext {
  /** 用户原始输入 */
  originalInput: string;
  /** 用户目标（从输入推断） */
  inferredGoal?: string;
  /** 之前轮次的状态 */
  previousRounds: ReactRoundState[];
  /** 累积的工具调用结果 */
  accumulatedResults: Map<string, unknown>;
  /** 当前轮次 */
  currentRound: number;
  /** 开始时间戳 */
  startedAt: number;
}

// ============================================================================
// 观察阶段分析结果
// ============================================================================

/**
 * 观察阶段分析结果
 */
export interface ObservationAnalysis {
  /** 观察总结 */
  summary: string;
  /** 是否达成目标 */
  goalAchieved: boolean;
  /** 目标达成置信度 (0-1) */
  confidence: number;
  /** 缺失的信息 */
  missingInfo?: string[];
  /** 建议的下一步行动 */
  suggestedNextAction?: string;
  /** 是否需要继续 */
  shouldContinue: boolean;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建默认的 ReAct 配置
 */
export function createReactConfig(
  overrides?: Partial<ReactLoopConfig>,
): ReactLoopConfigRequired {
  return {
    ...DEFAULT_REACT_CONFIG,
    ...overrides,
  };
}

/**
 * 创建初始轮次状态
 */
export function createInitialRoundState(round: number): ReactRoundState {
  return {
    round,
    phase: "think",
    goalAchieved: false,
    shouldContinue: true,
    startedAt: Date.now(),
  };
}

/**
 * 创建 ReAct 上下文
 */
export function createReactContext(originalInput: string): ReactContext {
  return {
    originalInput,
    previousRounds: [],
    accumulatedResults: new Map(),
    currentRound: 0,
    startedAt: Date.now(),
  };
}

/**
 * 将 AgentToolCall 转换为 ReactToolCall
 */
export function toReactToolCall(agentToolCall: AgentToolCall): ReactToolCall {
  return {
    name: agentToolCall.toolName,
    args: agentToolCall.args,
    result: agentToolCall.result,
    error: agentToolCall.error,
    durationMs: agentToolCall.durationMs,
  };
}
