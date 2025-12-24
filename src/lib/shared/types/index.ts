/**
 * 共享类型统一导出
 *
 * 提供跨模块共享的类型定义
 *
 * @module @/lib/shared/types
 * @version 1.0.0
 * @since 2025-12-25
 *
 * @example
 * ```typescript
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
