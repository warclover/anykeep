/**
 * Effects 模块导出
 *
 * 提供统一的 Effect 系统，用于适配 Tool 和 Skill 的确认、通知、审计等副作用
 *
 * @module ai-skills/effects
 * @version 2.0.0
 * @since 2025-12-24
 *
 * @example
 * ```typescript
 * // 使用 EffectManager 监听所有副作用
 * import { effectManager } from "@/lib/ai-skills/effects";
 *
 * effectManager.on("confirmation", (effect) => {
 *   console.log("Confirmation requested:", effect);
 * });
 *
 * // 使用确认服务请求用户确认
 * import { confirmationService } from "@/lib/ai-skills/effects";
 *
 * const pending = confirmationService.createConfirmation({
 *   title: "确认删除",
 *   message: "确定要删除这些书签吗？",
 *   options: [
 *     { id: "confirm", label: "确认" },
 *     { id: "cancel", label: "取消" },
 *   ],
 * });
 *
 * const result = await confirmationService.waitForConfirmation(pending.id);
 * ```
 */

// 类型导出
export type {
  EffectContext,
  EffectType,
  Effect,
  ConfirmOption,
  ConfirmationPayload,
  ConfirmationEffect,
  ConfirmationResult,
  ToolConfirmationConfig,
  SkillConfirmationConfig,
  NotificationLevel,
  NotificationPayload,
  NotificationEffect,
  AuditAction,
  AuditPayload,
  AuditEffect,
  UnifiedEffect,
} from "./types";

// 确认适配器
export {
  ConfirmationAdapter,
  createConfirmationAdapter,
  createToolConfirmationAdapter,
  createSkillConfirmationAdapter,
} from "./confirmation-adapter";

// Effect Manager - 核心管理器
export {
  EffectManager,
  createEffectManager,
  effectManager,
  type EffectHandler,
  type EffectStats,
  type EffectManagerConfig,
} from "./effect-manager";

// Services - 业务服务层
export {
  // Confirmation Service
  ConfirmationService,
  createConfirmationService,
  confirmationService,
  type ConfirmationStatus,
  type ConfirmationSource,
  type PendingConfirmation,
  type ConfirmationResponse,
  type ConfirmationRequestOptions,
  type ConfirmationResult as ConfirmationServiceResult,
  type ConfirmationServiceConfig,
  // Notification Service
  NotificationService,
  createNotificationService,
  notificationService,
  type NotificationRequestOptions,
  type NotificationServiceConfig,
  type NotificationRecord,
  // Audit Log Service
  AuditLogService,
  createAuditLogService,
  auditLogService,
  type AuditLogEntry,
  type AuditLogRequestOptions,
  type AuditLogServiceConfig,
  type AuditLogQueryOptions,
} from "./services";
