/**
 * Chat-to-Edit Module - 聊天式编辑模块
 * @module knowledge-studio/chat-edit
 */

export { ChatEditEngine, chatEditEngine } from "./chat-edit-engine";
export { buildEditPrompt, buildSuggestionPrompt } from "./prompt-builder";
export { DEFAULT_SLIDING_WINDOW_CONFIG, EDIT_MODE_CONFIG } from "./types";
export type {
  EditMode,
  EditIntent,
  ParagraphInfo,
  ChatEditContext,
  ChatTurn,
  ChatEditRequest,
  EditDiff,
  DiffChange,
  ChatEditResponse,
  EditHistory,
  SlidingWindowConfig,
} from "./types";
