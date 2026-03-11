/**
 * Operation Log Service (V4.2.1) - 协调器
 * 管理 AI 文件夹操作的快照与撤销功能
 *
 * 核心功能：
 * - 创建操作快照（支持 2 天撤销窗口）
 * - 执行撤销操作
 * - 查询操作历史
 *
 * @version 4.2.1
 * @since 2025-12-25 - Refactored into coordinator pattern
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { OperationDetail } from "@/types/supabase";

// 类型导入（全部从本地 types.ts）
import type {
  OperationSnapshot,
  OperationSnapshotAction,
  Json,
  UndoResult,
  OperationHistoryOptions,
  FolderInfo,
  BookmarkInfo,
  BookmarkMoveInfo,
} from "./types";

// 子模块导入
import {
  createSnapshot as createSnapshotFn,
  getOperationHistory as getOperationHistoryFn,
  getSnapshotById as getSnapshotByIdFn,
  getUndoableCount as getUndoableCountFn,
  cleanupExpiredSnapshots as cleanupExpiredSnapshotsFn,
} from "./persistence";

import { undoOperation as undoOperationFn } from "./undo";

import {
  createFolderCreateSnapshot,
  createRenameSnapshot,
  createSplitSnapshot,
  createMergeSnapshot,
  createFolderWithNotification,
  renameFolderWithNotification,
  splitFolderWithNotification,
  mergeFoldersWithNotification,
  sendEvolutionReport,
} from "./notification";

// 向后兼容导出
export type { UndoResult, OperationHistoryOptions };

// ============================================
// OperationLogService 类
// ============================================

/**
 * 操作日志服务
 */
export class OperationLogService {
  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  // ============================================
  // 快照创建
  // ============================================

  /**
   * 创建操作快照
   */
  async createSnapshot(
    userId: string,
    action: OperationSnapshotAction,
    beforeState: Json,
    afterState: Json,
    options: {
      folderId?: number;
      folderIds?: number[];
      bookmarkIds?: number[];
      reason?: string;
    } = {},
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return createSnapshotFn(
      supabase,
      userId,
      action,
      beforeState,
      afterState,
      options,
    );
  }

  /**
   * 创建文件夹创建操作的快照
   */
  async createFolderCreateSnapshot(
    userId: string,
    folder: FolderInfo,
    bookmarks: BookmarkInfo[],
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return createFolderCreateSnapshot(
      supabase,
      userId,
      folder,
      bookmarks,
      reason,
    );
  }

  /**
   * 创建文件夹重命名操作的快照
   */
  async createRenameSnapshot(
    userId: string,
    folderId: number,
    oldName: string,
    newName: string,
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return createRenameSnapshot(
      supabase,
      userId,
      folderId,
      oldName,
      newName,
      reason,
    );
  }

  /**
   * 创建文件夹分拆操作的快照
   */
  async createSplitSnapshot(
    userId: string,
    originalFolder: FolderInfo,
    newFolders: FolderInfo[],
    bookmarkMoves: BookmarkMoveInfo[],
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return createSplitSnapshot(
      supabase,
      userId,
      originalFolder,
      newFolders,
      bookmarkMoves,
      reason,
    );
  }

  /**
   * 创建文件夹合并操作的快照
   */
  async createMergeSnapshot(
    userId: string,
    sourceFolders: FolderInfo[],
    targetFolder: FolderInfo,
    mergedBookmarks: BookmarkInfo[],
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return createMergeSnapshot(
      supabase,
      userId,
      sourceFolders,
      targetFolder,
      mergedBookmarks,
      reason,
    );
  }

  // ============================================
  // 查询方法
  // ============================================

  /**
   * 获取用户的操作历史
   */
  async getOperationHistory(
    userId: string,
    options: OperationHistoryOptions = {},
  ): Promise<OperationDetail[]> {
    const supabase = await this.getSupabase();
    return getOperationHistoryFn(supabase, userId, options);
  }

  /**
   * 获取单个操作快照详情
   */
  async getSnapshotById(
    userId: string,
    snapshotId: string,
  ): Promise<OperationSnapshot | null> {
    const supabase = await this.getSupabase();
    return getSnapshotByIdFn(supabase, userId, snapshotId);
  }

  /**
   * 获取可撤销操作数量
   */
  async getUndoableCount(userId: string): Promise<number> {
    const supabase = await this.getSupabase();
    return getUndoableCountFn(supabase, userId);
  }

  // ============================================
  // 撤销操作
  // ============================================

  /**
   * 执行撤销操作
   */
  async undoOperation(userId: string, snapshotId: string): Promise<UndoResult> {
    const supabase = await this.getSupabase();
    return undoOperationFn(supabase, userId, snapshotId);
  }

  // ============================================
  // 清理
  // ============================================

  /**
   * 清理过期的操作记录（用于定时任务）
   */
  async cleanupExpiredSnapshots(): Promise<number> {
    const supabase = await this.getSupabase();
    return cleanupExpiredSnapshotsFn(supabase);
  }

  // ============================================
  // 消息通知集成方法 (V4.2)
  // ============================================

  /**
   * 创建文件夹操作并发送通知
   */
  async createFolderWithNotification(
    userId: string,
    folder: FolderInfo,
    bookmarks: BookmarkInfo[],
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return createFolderWithNotification(
      supabase,
      userId,
      folder,
      bookmarks,
      reason,
    );
  }

  /**
   * 重命名文件夹操作并发送通知
   */
  async renameFolderWithNotification(
    userId: string,
    folderId: number,
    oldName: string,
    newName: string,
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return renameFolderWithNotification(
      supabase,
      userId,
      folderId,
      oldName,
      newName,
      reason,
    );
  }

  /**
   * 分拆文件夹操作并发送通知
   */
  async splitFolderWithNotification(
    userId: string,
    originalFolder: FolderInfo,
    newFolders: FolderInfo[],
    bookmarkMoves: BookmarkMoveInfo[],
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return splitFolderWithNotification(
      supabase,
      userId,
      originalFolder,
      newFolders,
      bookmarkMoves,
      reason,
    );
  }

  /**
   * 合并文件夹操作并发送通知
   */
  async mergeFoldersWithNotification(
    userId: string,
    sourceFolders: FolderInfo[],
    targetFolder: FolderInfo,
    mergedBookmarks: BookmarkInfo[],
    reason?: string,
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();
    return mergeFoldersWithNotification(
      supabase,
      userId,
      sourceFolders,
      targetFolder,
      mergedBookmarks,
      reason,
    );
  }

  /**
   * 发送月度进化报告通知
   */
  async sendEvolutionReport(
    userId: string,
    month: string,
    classifiedCount: number,
    createdFolders: number,
    reportUrl?: string,
  ): Promise<void> {
    return sendEvolutionReport(
      userId,
      month,
      classifiedCount,
      createdFolders,
      reportUrl,
    );
  }
}

// 导出单例
export const operationLogService = new OperationLogService();
