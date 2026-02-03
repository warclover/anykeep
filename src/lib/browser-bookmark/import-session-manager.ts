/**
 * 导入会话管理器
 * 协调导入流程、缓存和暂停/恢复功能
 */

import {
  createImportSession,
  createImportBatches,
  getImportSession,
  updateImportSession,
  getPendingSession,
  getPendingBatches,
  getSessionBatches,
  updateBatchStatus,
  deleteImportSession,
  getSessionStats,
  type ImportSession,
  type ImportBatch,
  type ImportSessionStatus,
} from "./import-cache";
import type {
  BrowserBookmarkImportOptions,
  ImportProgress,
  Platform,
} from "./types";
import { BATCH_SIZE } from "./constants";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

/** 导入数据项（扁平化后的书签） */
export interface ImportDataItem {
  title: string;
  url: string;
  platform: Platform;
  folderId?: number;
  addedAt?: string;
}

/** 会话管理器配置 */
export interface SessionManagerConfig {
  /** 用户 ID */
  userId: string;
  /** 批次间延迟（毫秒） */
  batchDelayMs?: number;
  /** 进度回调 */
  onProgress?: (progress: ImportProgress) => void;
  /** 批次完成回调 */
  onBatchComplete?: (batch: ImportBatch, stats: BatchResult) => void;
  /** 会话状态变更回调 */
  onStatusChange?: (status: ImportSessionStatus) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

/** 批次导入结果 */
export interface BatchResult {
  success: number;
  failed: number;
  skipped: number;
  errors?: Array<{ url: string; title: string; reason: string }>;
}

/** 会话导入结果 */
export interface SessionResult {
  sessionId: string;
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
  durationMs: number;
  platformBreakdown: Record<Platform, number>;
  wasResumed: boolean;
}

// ============================================
// 导入会话管理器
// ============================================

export class ImportSessionManager {
  private userId: string;
  private batchDelayMs: number;
  private onProgress?: (progress: ImportProgress) => void;
  private onBatchComplete?: (batch: ImportBatch, stats: BatchResult) => void;
  private onStatusChange?: (status: ImportSessionStatus) => void;
  private onError?: (error: string) => void;

  private currentSession: ImportSession | null = null;
  private isPaused = false;
  private isCancelled = false;
  /** 并发锁：防止多个导入操作同时执行 */
  private isImporting = false;

  constructor(config: SessionManagerConfig) {
    this.userId = config.userId;
    this.batchDelayMs = config.batchDelayMs ?? 500;
    this.onProgress = config.onProgress;
    this.onBatchComplete = config.onBatchComplete;
    this.onStatusChange = config.onStatusChange;
    this.onError = config.onError;
  }

  // ============================================
  // 会话创建
  // ============================================

  /**
   * 创建新的导入会话
   */
  async createSession(params: {
    importData: ImportDataItem[];
    options: BrowserBookmarkImportOptions;
    browserSource: string;
    importBatchId: string;
    targetFolderId?: number;
  }): Promise<string> {
    const {
      importData,
      options,
      browserSource,
      importBatchId,
      targetFolderId,
    } = params;

    // 计算批次数量
    const totalBatches = Math.ceil(importData.length / BATCH_SIZE);

    // 初始进度
    const initialProgress: ImportProgress = {
      totalBookmarks: importData.length,
      totalBatches,
      currentBatch: 0,
      batchProgress: { total: 0, processed: 0 },
      totalSuccess: 0,
      totalFailed: 0,
      totalSkipped: 0,
      status: "idle",
    };

    // 创建会话
    const session = await createImportSession({
      userId: this.userId,
      totalBatches,
      options,
      progress: initialProgress,
      browserSource,
      importBatchId,
      targetFolderId,
    });

    // 将数据分批存储
    const batchesData = [];
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, importData.length);
      batchesData.push({
        batchNumber: i,
        bookmarks: importData.slice(start, end),
      });
    }

    await createImportBatches(session.id, batchesData);
    this.currentSession = session;

    return session.id;
  }

  // ============================================
  // 会话恢复
  // ============================================

  /**
   * 检查是否有待恢复的会话
   */
  async checkPendingSession(): Promise<ImportSession | null> {
    const session = await getPendingSession(this.userId);
    return session ?? null;
  }

  /**
   * 恢复现有会话
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = await getImportSession(sessionId);
    if (!session) {
      throw new Error("会话不存在");
    }

    if (session.userId !== this.userId) {
      throw new Error("无权访问此会话");
    }

    this.currentSession = session;
    this.isPaused = false;
    this.isCancelled = false;
  }

  // ============================================
  // 导入执行
  // ============================================

  /**
   * 开始/继续导入
   * @throws Error 如果已有导入操作正在进行
   */
  async startImport(): Promise<SessionResult> {
    // 并发锁检查
    if (this.isImporting) {
      throw new Error("导入操作正在进行中，请稍后再试");
    }

    if (!this.currentSession) {
      throw new Error("未设置当前会话");
    }

    // 获取锁
    this.isImporting = true;

    try {
      return await this.executeImport();
    } finally {
      // 释放锁
      this.isImporting = false;
    }
  }

  /**
   * 检查是否正在导入
   */
  isCurrentlyImporting(): boolean {
    return this.isImporting;
  }

  /**
   * 执行导入逻辑（内部方法）
   */
  private async executeImport(): Promise<SessionResult> {
    // currentSession 已在 startImport 中检查，此处必定存在
    const session = this.currentSession!;
    const sessionId = session.id;
    const startTime = Date.now();
    const wasResumed = session.status !== "pending";

    // 更新会话状态
    await updateImportSession(sessionId, {
      status: "processing",
      startedAt: session.startedAt ?? Date.now(),
    });
    this.onStatusChange?.("processing");

    // 获取待处理的批次
    const pendingBatches = await getPendingBatches(sessionId);
    const allBatches = await getSessionBatches(sessionId);

    // 统计已完成的批次
    const stats = await getSessionStats(sessionId);
    const platformBreakdown: Record<Platform, number> = {} as Record<
      Platform,
      number
    >;

    // 通知初始进度
    this.notifyProgress({
      totalBookmarks: session.progress.totalBookmarks,
      totalBatches: allBatches.length,
      currentBatch: stats.completedBatches,
      batchProgress: { total: 0, processed: 0 },
      totalSuccess: stats.totalSuccess,
      totalFailed: stats.totalFailed,
      totalSkipped: stats.totalSkipped,
      status: "importing",
    });

    // 处理每个批次
    for (const batch of pendingBatches) {
      // 检查暂停/取消
      if (this.isPaused) {
        await updateImportSession(sessionId, { status: "paused" });
        this.onStatusChange?.("paused");
        break;
      }

      if (this.isCancelled) {
        await this.cancelSession();
        throw new Error("导入已取消");
      }

      // 更新批次状态为处理中
      await updateBatchStatus(batch.id, "processing");

      // 通知进度
      this.notifyProgress({
        totalBookmarks: session.progress.totalBookmarks,
        totalBatches: allBatches.length,
        currentBatch: batch.batchNumber + 1,
        batchProgress: { total: batch.bookmarks.length, processed: 0 },
        totalSuccess: stats.totalSuccess,
        totalFailed: stats.totalFailed,
        totalSkipped: stats.totalSkipped,
        currentItem: batch.bookmarks[0]?.title,
        status: "importing",
      });

      try {
        // 执行批次导入
        const result = await this.executeBatch(batch);

        // 更新批次状态
        await updateBatchStatus(batch.id, "completed", {
          success: result.success,
          failed: result.failed,
          skipped: result.skipped,
        });

        // 更新统计
        stats.totalSuccess += result.success;
        stats.totalFailed += result.failed;
        stats.totalSkipped += result.skipped;
        stats.completedBatches++;

        // 统计平台分布
        for (const bookmark of batch.bookmarks) {
          const platform = bookmark.platform;
          platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + 1;
        }

        // 更新会话进度
        await updateImportSession(sessionId, {
          completedBatches: stats.completedBatches,
          progress: {
            ...session.progress,
            totalSuccess: stats.totalSuccess,
            totalFailed: stats.totalFailed,
            totalSkipped: stats.totalSkipped,
          },
        });

        // 回调
        this.onBatchComplete?.(batch, result);

        // 批次间延迟
        if (batch.batchNumber < allBatches.length - 1 && !this.isPaused) {
          await this.delay(this.batchDelayMs);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await updateBatchStatus(batch.id, "failed", undefined, errorMsg);
        stats.failedBatches++;
        this.onError?.(errorMsg);
      }
    }

    // 检查是否全部完成
    const finalStats = await getSessionStats(sessionId);
    const isComplete =
      finalStats.completedBatches + finalStats.failedBatches ===
      finalStats.totalBatches;

    if (isComplete && !this.isPaused) {
      await updateImportSession(sessionId, {
        status: "completed",
        completedAt: Date.now(),
      });
      this.onStatusChange?.("completed");

      // 通知完成
      this.notifyProgress({
        totalBookmarks: session.progress.totalBookmarks,
        totalBatches: allBatches.length,
        currentBatch: allBatches.length,
        batchProgress: { total: 0, processed: 0 },
        totalSuccess: finalStats.totalSuccess,
        totalFailed: finalStats.totalFailed,
        totalSkipped: finalStats.totalSkipped,
        status: "completed",
      });

      // 自动触发批量分类（如果启用）
      const classificationTransactionId =
        await this.triggerBatchClassification();
      if (classificationTransactionId) {
        clientLogger.info(
          { transactionId: classificationTransactionId },
          "Batch classification started",
        );
      }
    }

    return {
      sessionId,
      totalSuccess: finalStats.totalSuccess,
      totalFailed: finalStats.totalFailed,
      totalSkipped: finalStats.totalSkipped,
      durationMs: Date.now() - startTime,
      platformBreakdown,
      wasResumed,
    };
  }

  /**
   * 触发批量分类
   * 在所有批次导入完成后调用
   * 包含重试机制确保分类任务被正确启动
   */
  async triggerBatchClassification(): Promise<string | null> {
    if (!this.currentSession) {
      clientLogger.info(
        { context: "ImportSessionManager" },
        "No current session for batch classification",
      );
      return null;
    }

    const session = this.currentSession;
    const options = session.options as BrowserBookmarkImportOptions;

    // 检查是否启用 AI 分类
    if (!options.enableAiClassify) {
      return null;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch("/api/batch-classification/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            importSessionId: session.id,
            batchId: session.importBatchId,
            structureMode: options.structureMode || "auto",
            classifyOptions: options.classifyOptions || {
              autoApplyHighConfidence: false,
              preserveOriginalStructure: true,
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMsg = error.message || "未知错误";

          // 4xx 错误不重试（客户端错误）
          if (response.status >= 400 && response.status < 500) {
            clientLogger.error(
              { error, status: response.status },
              "Batch classification failed with client error",
            );
            this.onError?.(`批量分类启动失败: ${errorMsg}`);
            return null;
          }

          // 5xx 错误重试
          if (attempt < MAX_RETRIES) {
            clientLogger.warn(
              { attempt, maxRetries: MAX_RETRIES, status: response.status },
              "Batch classification failed, retrying...",
            );
            await this.delay(RETRY_DELAY_MS * attempt);
            continue;
          }

          clientLogger.error(
            { error, attempts: attempt },
            "Batch classification failed after all retries",
          );
          this.onError?.(
            `批量分类启动失败（已重试${MAX_RETRIES}次）: ${errorMsg}`,
          );
          return null;
        }

        const result = await response.json();
        clientLogger.info(
          { transactionId: result.transactionId, attempt },
          "Batch classification started successfully",
        );
        return result.transactionId || null;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempt < MAX_RETRIES) {
          clientLogger.warn(
            { error: errorMsg, attempt, maxRetries: MAX_RETRIES },
            "Batch classification request failed, retrying...",
          );
          await this.delay(RETRY_DELAY_MS * attempt);
          continue;
        }

        clientLogger.error(
          { error: errorMsg, attempts: attempt },
          "Batch classification trigger failed after all retries",
        );
        this.onError?.(
          `批量分类触发异常（已重试${MAX_RETRIES}次）: ${errorMsg}`,
        );
        return null;
      }
    }

    return null;
  }

  /**
   * 执行单个批次的导入
   */
  private async executeBatch(batch: ImportBatch): Promise<BatchResult> {
    const response = await fetch("/api/bookmarks/batch-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookmarks: batch.bookmarks.map((b) => ({
          title: b.title,
          url: b.url,
          platform: b.platform,
          folder_id: b.folderId,
          created_at: b.addedAt,
          import_source: this.currentSession?.browserSource,
          import_batch_id: this.currentSession?.importBatchId,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "批次导入失败");
    }

    const result = await response.json();
    return {
      success: result.data?.success ?? 0,
      failed: result.data?.failed ?? 0,
      skipped: result.data?.skipped ?? 0,
      errors: result.data?.errors,
    };
  }

  // ============================================
  // 控制操作
  // ============================================

  /**
   * 暂停导入
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 取消导入
   */
  cancel(): void {
    this.isCancelled = true;
  }

  /**
   * 取消并清理会话
   */
  async cancelSession(): Promise<void> {
    if (this.currentSession) {
      await deleteImportSession(this.currentSession.id);
      this.currentSession = null;
    }
    this.onStatusChange?.("failed");
  }

  /**
   * 丢弃待恢复的会话
   */
  async discardSession(sessionId: string): Promise<void> {
    await deleteImportSession(sessionId);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  private notifyProgress(progress: ImportProgress): void {
    this.onProgress?.(progress);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): ImportSession | null {
    return this.currentSession;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建导入会话管理器
 */
export function createImportSessionManager(
  config: SessionManagerConfig,
): ImportSessionManager {
  return new ImportSessionManager(config);
}
