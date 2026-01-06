/**
 * AI Agent 工具事件模块
 *
 * 导出工具事件发射器和相关工具
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

export {
  ToolEventEmitter,
  toolEventEmitter,
  createToolEventEmitter,
  type ToolEventEmitterConfig,
  type ToolCallStartParams,
  type ToolCallCompleteParams,
  type ToolCallRetryParams,
  type ToolConfirmationRequestParams,
  type ToolConfirmationResponseParams,
} from "./tool-event-emitter";

// Re-export event types and constants from shared event-bus
export {
  AIAgentToolEvents,
  type ToolCallStartedEvent,
  type ToolCallCompletedEvent,
  type ToolCallRetryEvent,
  type ToolConfirmationRequestedEvent,
  type ToolConfirmationRespondedEvent,
  type AIAgentToolEventTypes,
} from "@/lib/shared/event-bus/event-types";
