/**
 * Phase 4: AI Services - 服务层模块导出
 *
 * @module ai-skills/services
 * @version 1.0.0
 * @since 2025-12-25
 */

// =============================================================================
// FeedbackService - 反馈服务
// =============================================================================

export {
  FeedbackService,
  createFeedbackService,
  feedbackService,
} from "./feedback.service";
export type {
  FeedbackRecord,
  FeedbackStats,
  NegativeReasonStats,
  FeedbackServiceResponse,
} from "./feedback.service";

// =============================================================================
// SnapshotManager - 快照管理器
// =============================================================================

export {
  SnapshotManager,
  createSnapshotManager,
  snapshotManager,
} from "./snapshot.manager";
export type {
  OperationType,
  BookmarkState,
  CreateSnapshotRequest,
  SnapshotRecord,
  SnapshotServiceResponse,
} from "./snapshot.manager";

// =============================================================================
// NoteService - 笔记服务
// =============================================================================

export { NoteService, createNoteService, noteService } from "./note.service";
export type {
  NoteSourceType,
  NoteContentFormat,
  NoteRecord,
  NoteListParams,
  NoteServiceResponse,
} from "./note.service";

// =============================================================================
// ContextManager - 上下文管理器
// =============================================================================

export {
  ContextManager,
  createContextManager,
  contextManager,
} from "./context.manager";
export type {
  ContextReferences,
  ResolvedContext,
  ContextSummary,
  ContextServiceResponse,
} from "./context.manager";
