/**
 * Knowledge Studio Iteration Module
 * @module knowledge-studio/iteration
 *
 * Phase 4: 草稿迭代与反馈驱动优化
 */

// Types
export {
  MAX_DRAFT_VERSIONS,
  DRAFT_STORAGE_KEY_PREFIX,
  FEEDBACK_TYPES,
  type FeedbackType,
  type DraftFeedback,
  type DraftSource,
  type DraftVersion,
  type DraftVersionState,
  type DraftVersionManagerConfig,
  type IterateRequest,
  type IterateEventType,
  type IterateEvent,
  type DraftVersionDiff,
  type FeedbackDialogState,
  type VersionPanelState,
} from "./types";

// Draft Version Manager
export {
  DraftVersionManager,
  createDraftVersionManager,
  formatDraftVersionTimestamp,
  getDraftSourceLabel,
} from "./draft-version-manager";

// Feedback Collector
export {
  validateFeedback,
  createFeedback,
  generateIterationInstruction,
  getFeedbackTypeInfo,
  getAllFeedbackTypes,
  logFeedback,
  shouldSuggestCondense,
  shouldRegenerate,
} from "./feedback-collector";
