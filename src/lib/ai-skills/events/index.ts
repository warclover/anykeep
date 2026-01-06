/**
 * AI Skills 事件模块
 *
 * 导出事件发射器和相关工具
 *
 * @version 1.1.0
 * @since 2026-01-06
 * @updated 2026-01-06 添加级联处理器 (P2-4)
 */

export {
  SkillEventEmitter,
  createSkillEventEmitter,
  type SkillEventEmitterConfig,
} from "./skill-event-emitter";

// 级联处理器 (P2-4)
export {
  SkillCascadeHandler,
  skillCascadeHandler,
  createSkillCascadeHandler,
  initSkillCascadeHandler,
  type CascadeRule,
  type DeliverableCascadeRule,
  type CascadeHandlerConfig,
  type CascadeActionType,
} from "./skill-cascade-handler";

// Re-export event types and constants from shared event-bus
export {
  AISkillsEvents,
  type SkillExecutionStartedEvent,
  type SkillExecutionCompletedEvent,
  type SkillStepStartedEvent,
  type SkillStepCompletedEvent,
  type SkillDeliverableCreatedEvent,
  type SkillConfirmationRequestedEvent,
  type SkillConfirmationRespondedEvent,
  type SkillCancelledEvent,
  type AISkillsEventTypes,
} from "@/lib/shared/event-bus/event-types";
