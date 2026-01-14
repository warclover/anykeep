/**
 * Speculative Execution Types
 *
 * 定义推测执行相关的类型
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { IntentType } from "../router/types";

// ============================================
// 执行策略类型
// ============================================

/**
 * 执行策略类型
 */
export type ExecutionStrategy =
  | "silent_execute" // 高置信度：静默执行
  | "speculative_execute" // 中置信度：先执行再提供撤销
  | "clarify" // 低置信度：请求澄清
  | "confirm_required"; // 高风险：必须确认

/**
 * 风险等级
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 意图风险等级映射
 */
export interface IntentRiskMapping {
  intentKey: string; // 格式: "type:subType"
  riskLevel: RiskLevel;
  description?: string;
}

// ============================================
// 执行结果类型
// ============================================

/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
  /** 是否显示撤销选项 */
  showUndo?: boolean;
  /** 撤销操作 ID */
  undoId?: string;
  /** 撤销按钮标签 */
  undoLabel?: string;
  /** 撤销超时（毫秒） */
  undoTimeout?: number;
  /** 是否需要澄清 */
  requiresClarification?: boolean;
  /** 澄清问题 */
  clarificationQuestion?: string;
  /** 澄清选项 */
  clarificationOptions?: ClarificationOption[];
  /** 澄清超时（毫秒） */
  clarificationTimeout?: number;
  /** 是否需要确认 */
  requiresConfirmation?: boolean;
  /** 确认消息 */
  confirmationMessage?: string;
  /** 影响范围描述 */
  impactDescription?: string;
  /** 执行的数据 */
  data?: unknown;
  /** 影响的资源数量 */
  affectedCount?: number;
}

/**
 * 澄清选项
 */
export interface ClarificationOption {
  /** 显示标签 */
  label: string;
  /** 选项值 */
  value: string;
  /** 选项描述 */
  description?: string;
}

// ============================================
// 撤销操作类型
// ============================================

/**
 * 撤销操作
 */
export interface UndoAction {
  /** 撤销操作 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 意图类型 */
  intentType: IntentType;
  /** 意图子类型 */
  intentSubType?: string;
  /** 操作描述 */
  description: string;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 执行撤销的函数 */
  execute: () => Promise<void>;
  /** 撤销前的状态快照 */
  snapshot?: unknown;
  /** 影响的资源 ID 列表 */
  affectedResourceIds?: string[];
}

/**
 * 撤销结果
 */
export interface UndoResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
}

// ============================================
// 意图相关类型
// ============================================

/**
 * 带槽位的意图（与 HybridIntentMatch 兼容）
 */
export interface IntentWithSlots {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 槽位数据 */
  slots?: Record<string, unknown>;
  /** 缺失的必需槽位 */
  missingRequiredSlots?: string[];
  /** 匹配方法 */
  method?: "rule" | "semantic" | "hybrid" | "llm";
  /** 备选意图 */
  alternatives?: IntentAlternative[];
}

/**
 * 备选意图
 */
export interface IntentAlternative {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 置信度 */
  confidence: number;
}

// ============================================
// 执行上下文类型
// ============================================

/**
 * 执行上下文
 */
export interface ExecutionContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId?: string;
  /** 已选中的书签 ID 列表 */
  selectedBookmarks?: number[];
  /** 当前文件夹 ID */
  currentFolder?: number;
  /** 附加数据 */
  metadata?: Record<string, unknown>;
}

// ============================================
// 配置类型
// ============================================

/**
 * 执行策略配置
 */
export interface ExecutionStrategyConfig {
  /** 高置信度阈值（默认 0.85） */
  highConfidenceThreshold: number;
  /** 中置信度阈值（默认 0.60） */
  mediumConfidenceThreshold: number;
  /** 撤销超时（毫秒，默认 10000） */
  undoTimeoutMs: number;
  /** 澄清超时（毫秒，默认 30000） */
  clarificationTimeoutMs: number;
}

/**
 * SpeculativeExecutor 配置
 */
export interface SpeculativeExecutorConfig {
  /** 执行策略配置 */
  strategy?: Partial<ExecutionStrategyConfig>;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 撤销栈最大容量 */
  maxUndoStackSize?: number;
}
