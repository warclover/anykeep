/**
 * 共享类型统一导出
 *
 * 提供跨模块共享的类型定义
 *
 * @module @/lib/shared/types
 * @version 2.0.0
 * @since 2025-12-25
 * @updated 2026-01-11 添加 AI 核心类型统一
 *
 * @example
 * ```typescript
 * // 导入 AI 核心类型
 * import type { IntentType, ComplexityLevel, ExecutionMode } from "@/lib/shared/types";
 * import type { MessageRole, AgentType } from "@/lib/shared/types";
 * import { CONFIDENCE_THRESHOLDS, getConfidenceLevel } from "@/lib/shared/types";
 *
 * // 导入确认相关类型
 * import type { ConfirmationResult, ConfirmOption } from "@/lib/shared/types";
 *
 * // 导入上下文类型
 * import type { ToolExecutionContext, EffectContext } from "@/lib/shared/types";
 *
 * // 导入通用类型
 * import type { OperationResult, PaginatedResult } from "@/lib/shared/types";
 * ```
 */

// ============================================
// 确认类型
// ============================================

export type {
  // 基础类型
  ConfirmOptionVariant,
  ConfirmOption,
  ConfirmationStatus,
  ConfirmationResult,
  ConfirmationSource,
  ConfirmationMode,
  ConfirmationResponse,
  // 请求类型
  ConfirmationRequestBase,
  ToolConfirmationRequest,
  SkillConfirmationRequest,
} from "./confirmation";

// ============================================
// 上下文类型
// ============================================

export type {
  BaseExecutionContext,
  ToolExecutionContext,
  SkillExecutionContext,
  EffectContext,
  ApiRequestContext,
} from "./context";

// ============================================
// 通用类型
// ============================================

export type {
  // 结果类型
  OperationResult,
  PaginatedResult,
  // 时间类型
  TimeRange,
  TimestampedEntity,
  // ID 类型
  EntityId,
  UUID,
  GeneratedId,
  // 回调类型
  ProgressCallback,
  ErrorCallback,
  CompleteCallback,
  // 工具类型
  DeepPartial,
  RequiredFields,
  OmitFields,
  ValueOf,
} from "./common";

// ============================================
// AI 核心类型
// ============================================

export type {
  // Agent 类型
  AgentType,
  AgentStatus,
  // 消息角色
  MessageRole,
  BasicMessageRole,
} from "./core";

// ============================================
// 意图类型
// ============================================

export type {
  // 意图类型
  IntentType,
  // 复杂度级别
  ComplexityLevel,
  // 执行模式
  ExecutionMode,
  // 分类来源
  ClassificationSource,
} from "./intent";

export {
  // 常量对象
  INTENT_TYPES,
  COMPLEXITY_LEVELS,
  EXECUTION_MODES,
} from "./intent";

// ============================================
// 置信度类型
// ============================================

export type {
  // 置信度级别
  ConfidenceLevel,
  // 风险级别
  RiskLevel,
  // 执行策略
  ExecutionStrategy,
} from "./confidence";

export {
  // 阈值常量
  CONFIDENCE_THRESHOLDS,
  RISK_OPERATIONS,
  BATCH_CONFIRMATION_THRESHOLD,
  // 工具函数
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
  getSuggestedStrategy,
} from "./confidence";

// ============================================
// 流响应类型
// ============================================

export type {
  // 流块类型
  UnifiedStreamChunkType,
  UnifiedStreamChunk,
  StreamChunkData,
  // 工具调用信息
  ToolCallInfo,
  // 确认信息
  ConfirmationInfo,
  // 最终结果
  FinalResult,
  // 错误块
  ErrorChunk,
} from "./stream";

export { createErrorChunk } from "./stream";

// ============================================
// 文件夹 ID 类型
// ============================================

export type {
  // 基础类型
  FolderId,
  NullableFolderId,
  FolderIdList,
  // 接口
  WithFolderId,
  WithNullableFolderId,
} from "./folder";

export {
  // 类型守卫
  isValidFolderId,
  isValidNullableFolderId,
  // 转换工具
  parseFolderId,
  parseNullableFolderId,
} from "./folder";
