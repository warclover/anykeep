/**
 * AI 快照管理类型定义
 *
 * @module ai-snapshot
 * @version 1.0.0
 * @since 2025-12-26
 */

/**
 * 操作类型
 */
export type OperationType =
  | "organize"
  | "batch_tag"
  | "dedupe"
  | "move"
  | "archive"
  | "delete";

/**
 * 书签状态
 */
export interface BookmarkState {
  id: number;
  folderId: number | null;
  tags: string[];
}

/**
 * 操作记录
 */
export interface OperationRecord {
  type: string;
  target: string;
  count: number;
  description: string;
}

/**
 * 快照记录
 */
export interface Snapshot {
  id: string;
  userId: string;
  operationType: OperationType;
  conversationId?: string;
  skillId?: string;
  bookmarkIds: number[];
  beforeState: BookmarkState[];
  afterState: BookmarkState[];
  operations: OperationRecord[];
  summary?: string;
  isReverted: boolean;
  revertedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * 创建快照参数
 */
export interface CreateSnapshotParams {
  userId: string;
  operationType: OperationType;
  conversationId?: string;
  skillId?: string;
  bookmarkIds: number[];
  summary?: string;
}

/**
 * 可撤销操作
 */
export interface UndoableOperation {
  id: string;
  operationType: OperationType;
  bookmarkCount: number;
  summary?: string;
  createdAt: Date;
  expiresAt: Date;
  timeRemaining: string;
}

/**
 * 撤销结果
 */
export interface UndoResult {
  success: boolean;
  restoredCount: number;
  message: string;
}

/**
 * 服务结果
 */
export interface SnapshotServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
