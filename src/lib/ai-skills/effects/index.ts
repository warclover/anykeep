/**
 * Effects 模块导出
 *
 * 提供统一的 Effect 系统，用于适配 Tool 和 Skill 的确认、通知、审计等副作用
 *
 * @module ai-skills/effects
 * @version 1.0.0
 * @since 2025-12-24
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
