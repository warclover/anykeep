/**
 * 导入会话管理 Hook
 * 提供 IndexedDB 缓存和暂停/恢复功能
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  createImportSession,
  getImportSession,
  updateImportSession,
  deleteImportSession,
  getPendingSession,
  createImportBatches,
  getSessionBatches,
  updateBatchStatus,
  createImportHistory,
  browserSourceToImportSource,
  type ImportSession,
} from "@/lib/browser-bookmark";
import type {
  ImportProgress,
  BrowserBookmarkImportOptions,
} from "@/lib/browser-bookmark";
import type { Platform } from "@/types/supabase";
import { BATCH_SIZE, BATCH_DELAY_MS } from "@/lib/browser-bookmark";

// ============================================
// 类型定义
// ============================================

/** 导入数据项 */
export interface ImportItem {
  url: string;
  title: string;
  description?: string;
  platform: Platform;
  folderId: number | null;
  originalAddDate?: string;
  importSource: string;
  importBatchId: string;
}

/** Hook 配置 */
export interface UseImportSessionConfig {
  /** 用户 ID */
  userId: string;
  /** 进度更新回调 */
  onProgressUpdate?: (progress: ImportProgress) => void;
  /** 完成回调 */
  onComplete?: (result: ImportResult) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

/** 导入结果 */
export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ url: string; title: string; reason: string }>;
  durationMs: number;
  wasResumed: boolean;
}

/** Hook 返回值 */
export interface UseImportSessionReturn {
  /** 待恢复的会话 */
  pendingSession: ImportSession | null;
  /** 是否正在导入 */
  isImporting: boolean;
  /** 是否已暂停 */
  isPaused: boolean;
  /** 当前进度 */
  progress: ImportProgress;
  /** 开始新的导入 */
  startImport: (
    items: ImportItem[],
    options: BrowserBookmarkImportOptions,
    browserSource: string,
    importBatchId: string,
    targetFolderId?: number,
  ) => Promise<void>;
  /** 恢复导入 */
  resumeImport: (sessionId: string) => Promise<void>;
  /** 暂停导入 */
  pauseImport: () => void;
  /** 继续导入（从暂停状态） */
  continueImport: () => void;
  /** 取消导入 */
  cancelImport: () => void;
  /** 丢弃待恢复的会话 */
  discardSession: (sessionId: string) => Promise<void>;
  /** 刷新待恢复会话状态 */
  refreshPendingSession: () => Promise<void>;
}

// ============================================
// 默认进度
// ============================================

const DEFAULT_PROGRESS: ImportProgress = {
  totalBookmarks: 0,
  totalBatches: 0,
  currentBatch: 0,
  batchProgress: { total: 0, processed: 0 },
  totalSuccess: 0,
  totalFailed: 0,
  totalSkipped: 0,
  status: "idle",
};

// ============================================
// Hook 实现
// ============================================

export function useImportSession(
  config: UseImportSessionConfig,
): UseImportSessionReturn {
  const { userId, onProgressUpdate, onComplete, onError } = config;

  // 状态
  const [pendingSession, setPendingSession] = useState<ImportSession | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>(DEFAULT_PROGRESS);

  // Refs
  const currentSessionRef = useRef<string | null>(null);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  // 检查待恢复会话
  const refreshPendingSession = useCallback(async () => {
    try {
      const session = await getPendingSession(userId);
      setPendingSession(session ?? null);
    } catch (error) {
      console.error("检查待恢复会话失败:", error);
    }
  }, [userId]);

  // 初始化时检查
  useEffect(() => {
    refreshPendingSession();
  }, [refreshPendingSession]);

  // 更新进度的辅助函数
  const updateProgress = useCallback(
    (newProgress: ImportProgress) => {
      setProgress(newProgress);
      onProgressUpdate?.(newProgress);
    },
    [onProgressUpdate],
  );

  // 开始新导入
  const startImport = useCallback(
    async (
      items: ImportItem[],
      options: BrowserBookmarkImportOptions,
      browserSource: string,
      importBatchId: string,
      targetFolderId?: number,
    ) => {
      if (isImporting) return;

      // 重置状态
      pauseRef.current = false;
      cancelRef.current = false;
      setIsImporting(true);
      setIsPaused(false);

      const totalBatches = Math.ceil(items.length / BATCH_SIZE);

      // 创建会话
      try {
        const session = await createImportSession({
          userId,
          totalBatches,
          options,
          progress: {
            ...DEFAULT_PROGRESS,
            totalBookmarks: items.length,
            totalBatches,
            status: "importing",
          },
          browserSource,
          importBatchId,
          targetFolderId,
        });

        currentSessionRef.current = session.id;

        // 创建批次
        const batchesData: Array<{
          batchNumber: number;
          bookmarks: Array<{
            title: string;
            url: string;
            platform: Platform;
            folderId?: number;
            addedAt?: string;
          }>;
        }> = [];
        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, items.length);
          batchesData.push({
            batchNumber: i,
            bookmarks: items.slice(start, end).map((item) => ({
              title: item.title,
              url: item.url,
              platform: item.platform,
              folderId: item.folderId === null ? undefined : item.folderId,
              addedAt: item.originalAddDate,
            })),
          });
        }

        await createImportBatches(session.id, batchesData);

        // 执行导入
        await executeImport(session.id, false);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "创建导入会话失败";
        onError?.(errorMsg);
        setIsImporting(false);
      }
    },
    [userId, isImporting, onError],
  );

  // 恢复导入
  const resumeImport = useCallback(
    async (sessionId: string) => {
      if (isImporting) return;

      pauseRef.current = false;
      cancelRef.current = false;
      setIsImporting(true);
      setIsPaused(false);

      currentSessionRef.current = sessionId;
      await executeImport(sessionId, true);
    },
    [isImporting],
  );

  // 执行导入逻辑
  const executeImport = async (sessionId: string, wasResumed: boolean) => {
    const startTime = Date.now();

    try {
      const session = await getImportSession(sessionId);
      if (!session) {
        throw new Error("会话不存在");
      }

      // 更新会话状态
      await updateImportSession(sessionId, {
        status: "processing",
        startedAt: session.startedAt ?? Date.now(),
      });

      // 获取批次
      const batches = await getSessionBatches(sessionId);
      const pendingBatches = batches.filter((b) => b.status === "pending");

      // 计算已完成的统计
      let totalSuccess = session.progress.totalSuccess;
      let totalFailed = session.progress.totalFailed;
      let totalSkipped = session.progress.totalSkipped;
      const allErrors: Array<{ url: string; title: string; reason: string }> =
        [];

      // 初始化进度
      updateProgress({
        totalBookmarks: session.progress.totalBookmarks,
        totalBatches: batches.length,
        currentBatch: batches.length - pendingBatches.length,
        batchProgress: { total: 0, processed: 0 },
        totalSuccess,
        totalFailed,
        totalSkipped,
        status: "importing",
      });

      // 处理每个批次
      for (const batch of pendingBatches) {
        // 检查暂停
        if (pauseRef.current) {
          await updateImportSession(sessionId, {
            status: "paused",
            progress: {
              ...session.progress,
              totalSuccess,
              totalFailed,
              totalSkipped,
            },
          });
          setIsPaused(true);
          await refreshPendingSession();
          return;
        }

        // 检查取消
        if (cancelRef.current) {
          await deleteImportSession(sessionId);
          updateProgress({ ...DEFAULT_PROGRESS, status: "idle" });
          setIsImporting(false);
          await refreshPendingSession();
          return;
        }

        // 更新批次状态
        await updateBatchStatus(batch.id, "processing");

        // 更新进度
        updateProgress({
          totalBookmarks: session.progress.totalBookmarks,
          totalBatches: batches.length,
          currentBatch: batch.batchNumber + 1,
          batchProgress: { total: batch.bookmarks.length, processed: 0 },
          totalSuccess,
          totalFailed,
          totalSkipped,
          currentItem: batch.bookmarks[0]?.title,
          status: "importing",
        });

        try {
          // 调用 API
          const response = await fetch("/api/bookmarks/batch-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookmarks: batch.bookmarks.map((b) => ({
                url: b.url,
                title: b.title,
                platform: b.platform,
                folderId: b.folderId,
                originalAddDate: b.addedAt,
                importSource: session.browserSource,
                importBatchId: session.importBatchId,
              })),
            }),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(responseData.error?.message || "批次导入失败");
          }

          const batchResult = responseData.data || responseData;

          // 更新统计
          totalSuccess += batchResult.success || 0;
          totalFailed += batchResult.failed || 0;
          totalSkipped += batchResult.skipped || 0;
          if (batchResult.errors) {
            allErrors.push(...batchResult.errors);
          }

          // 更新批次状态
          await updateBatchStatus(batch.id, "completed", {
            success: batchResult.success || 0,
            failed: batchResult.failed || 0,
            skipped: batchResult.skipped || 0,
          });

          // 更新会话进度
          await updateImportSession(sessionId, {
            completedBatches: session.completedBatches + 1,
            progress: {
              ...session.progress,
              totalSuccess,
              totalFailed,
              totalSkipped,
            },
          });

          // 更新进度
          updateProgress({
            totalBookmarks: session.progress.totalBookmarks,
            totalBatches: batches.length,
            currentBatch: batch.batchNumber + 1,
            batchProgress: {
              total: batch.bookmarks.length,
              processed: batch.bookmarks.length,
            },
            totalSuccess,
            totalFailed,
            totalSkipped,
            status: "importing",
          });
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "批次导入失败";
          await updateBatchStatus(batch.id, "failed", undefined, errorMsg);
          totalFailed += batch.bookmarks.length;
          allErrors.push({
            url: `批次 ${batch.batchNumber + 1}`,
            title: `批次 ${batch.batchNumber + 1}`,
            reason: errorMsg,
          });
        }

        // 批次间延迟
        if (!pauseRef.current && !cancelRef.current) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // 完成
      const durationMs = Date.now() - startTime;

      await updateImportSession(sessionId, {
        status: "completed",
        completedAt: Date.now(),
      });

      updateProgress({
        totalBookmarks: session.progress.totalBookmarks,
        totalBatches: batches.length,
        currentBatch: batches.length,
        batchProgress: { total: 0, processed: 0 },
        totalSuccess,
        totalFailed,
        totalSkipped,
        status: "completed",
      });

      // 记录导入历史
      try {
        await createImportHistory({
          importSource: browserSourceToImportSource(session.browserSource),
          importBatchId: session.importBatchId,
          totalCount: session.progress.totalBookmarks,
          successCount: totalSuccess,
          failedCount: totalFailed,
          skippedCount: totalSkipped,
          foldersCreated: 0, // 已知限制：暂不统计创建的文件夹数量
          durationMs,
          errorDetails: allErrors.length > 0 ? allErrors : undefined,
          options: session.options
            ? {
                skipDuplicates: !session.options.overwriteExisting,
                preserveFolderStructure: session.options.keepFolderStructure,
                targetFolderId: session.options.targetFolderId,
              }
            : undefined,
        });
      } catch (historyError) {
        // 历史记录失败不影响主流程
        console.error("记录导入历史失败:", historyError);
      }

      setIsImporting(false);
      currentSessionRef.current = null;

      onComplete?.({
        success: totalSuccess,
        failed: totalFailed,
        skipped: totalSkipped,
        errors: allErrors,
        durationMs,
        wasResumed,
      });

      await refreshPendingSession();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "导入执行失败";
      onError?.(errorMsg);
      setIsImporting(false);
    }
  };

  // 暂停
  const pauseImport = useCallback(() => {
    pauseRef.current = true;
  }, []);

  // 继续
  const continueImport = useCallback(() => {
    if (!currentSessionRef.current || !isPaused) return;

    pauseRef.current = false;
    setIsPaused(false);
    executeImport(currentSessionRef.current, true);
  }, [isPaused]);

  // 取消
  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  // 丢弃会话
  const discardSession = useCallback(
    async (sessionId: string) => {
      await deleteImportSession(sessionId);
      await refreshPendingSession();
    },
    [refreshPendingSession],
  );

  return {
    pendingSession,
    isImporting,
    isPaused,
    progress,
    startImport,
    resumeImport,
    pauseImport,
    continueImport,
    cancelImport,
    discardSession,
    refreshPendingSession,
  };
}
