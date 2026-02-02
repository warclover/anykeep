/**
 * Message Trigger Service
 * V4.2 消息触发服务
 *
 * @description 根据事件触发相应的消息通知
 * - 半托管模式下的确认消息触发
 * - 分类事件消息触发
 * - 文件夹操作消息触发
 * - 批量处理托管模式逻辑
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { MessageFacade as MessageService } from "./message-facade";
import type { MessageResult } from "./types";
import type { TrustMode } from "@/types/trust-mode";
import type {
  ClassificationSuggestion,
  FolderCreateSuggestion,
  FolderMergeSuggestion,
  FolderSplitSuggestion,
  FolderRenameSuggestion,
} from "@/types/confirmation";
import {
  confirmationService,
  type CreateClassificationConfirmationInput,
  type CreateFolderConfirmationInput,
} from "@/lib/confirmation";
import { folderExecutorService } from "@/lib/folder";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分类事件输入
 */
export interface ClassificationEvent {
  userId: string;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  reason: string;
  alternatives?: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
  }>;
  matchSource?: "embedding" | "source" | "tag" | "rule";
}

/**
 * 文件夹创建事件输入
 */
export interface FolderCreateEvent {
  userId: string;
  suggestedName: string;
  reason: string;
  bookmarkIds: number[];
  estimatedCount: number;
  suggestedTags?: string[];
}

/**
 * 文件夹合并事件输入
 */
export interface FolderMergeEvent {
  userId: string;
  targetFolderId: number;
  targetFolderName: string;
  sourceFolderIds: number[];
  sourceFolderNames: string[];
  reason: string;
  affectedBookmarks: number;
  similarityScore: number;
}

/**
 * 文件夹拆分事件输入
 */
export interface FolderSplitEvent {
  userId: string;
  sourceFolderId: number;
  sourceFolderName: string;
  suggestedSubFolders: Array<{
    name: string;
    bookmarkIds: number[];
    reason: string;
  }>;
  reason: string;
  affectedBookmarks: number;
}

/**
 * 文件夹重命名事件输入
 */
export interface FolderRenameEvent {
  userId: string;
  folderId: number;
  currentName: string;
  suggestedName: string;
  reason: string;
  alternatives?: string[];
}

/**
 * 触发结果
 */
export interface TriggerResult {
  action: "auto_executed" | "confirmation_created" | "skipped";
  messageResult?: MessageResult;
  confirmationId?: number;
  reason?: string;
}

// ============================================================================
// 阈值配置
// ============================================================================

/**
 * 置信度阈值配置
 */
const CONFIDENCE_THRESHOLDS = {
  /** 全自动模式下自动执行的最低置信度 */
  FULL_AUTO_EXECUTE: 0, // 全自动模式下总是执行
  /** 半托管模式下自动执行的最低置信度 */
  SEMI_AUTO_EXECUTE: 60,
  /** 半托管模式下需要确认的置信度上限 */
  SEMI_AUTO_CONFIRM: 80,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 消息触发服务
 */
class MessageTriggerService {
  // ============================================================================
  // 分类事件处理
  // ============================================================================

  /**
   * 处理分类事件
   * @description 根据托管模式和置信度决定是否触发确认消息
   */
  async handleClassificationEvent(
    event: ClassificationEvent,
    trustMode: TrustMode,
    confirmationThreshold: number = CONFIDENCE_THRESHOLDS.SEMI_AUTO_CONFIRM,
  ): Promise<TriggerResult> {
    const {
      userId,
      bookmarkId,
      bookmarkTitle,
      bookmarkUrl,
      folderId,
      folderName,
      confidence,
      reason,
      alternatives,
      matchSource,
    } = event;

    // 手动模式：不自动分类
    if (trustMode === "manual") {
      return {
        action: "skipped",
        reason: "Manual mode - no auto classification",
      };
    }

    // 全自动模式：直接执行，发送静默通知
    if (trustMode === "full_auto") {
      const messageResult = await MessageService.notifyClassificationComplete(
        userId,
        bookmarkId,
        folderName || "待整理",
        confidence,
        true,
      );

      return {
        action: "auto_executed",
        messageResult,
      };
    }

    // 半托管模式：根据置信度决定
    if (trustMode === "semi_auto") {
      // 高置信度：自动执行
      if (confidence >= confirmationThreshold) {
        const messageResult = await MessageService.notifyClassificationComplete(
          userId,
          bookmarkId,
          folderName || "待整理",
          confidence,
          true,
        );

        return {
          action: "auto_executed",
          messageResult,
        };
      }

      // 低置信度：创建确认消息
      const suggestion: ClassificationSuggestion = {
        folderId,
        folderName,
        confidence,
        reason,
        alternatives: alternatives || [],
        matchSource,
      };

      const input: CreateClassificationConfirmationInput = {
        userId,
        bookmarkId,
        bookmarkTitle,
        bookmarkUrl,
        suggestion,
      };

      try {
        const confirmation =
          await confirmationService.createClassificationConfirmation(input);

        return {
          action: "confirmation_created",
          confirmationId: confirmation.id,
        };
      } catch (error) {
        logger.error(
          { error, bookmarkId },
          "Failed to create classification confirmation",
        );
        return {
          action: "skipped",
          reason: "Failed to create confirmation",
        };
      }
    }

    return {
      action: "skipped",
      reason: "Unknown trust mode",
    };
  }

  // ============================================================================
  // 文件夹操作事件处理
  // ============================================================================

  /**
   * 处理文件夹创建事件
   */
  async handleFolderCreateEvent(
    event: FolderCreateEvent,
    trustMode: TrustMode,
  ): Promise<TriggerResult> {
    const {
      userId,
      suggestedName,
      reason,
      bookmarkIds,
      estimatedCount,
      suggestedTags,
    } = event;

    // 手动模式：不自动创建
    if (trustMode === "manual") {
      return {
        action: "skipped",
        reason: "Manual mode - no auto folder creation",
      };
    }

    // 全自动模式：直接创建，发送普通通知
    if (trustMode === "full_auto") {
      // 执行文件夹创建
      const createResult = await folderExecutorService.executeCreate({
        userId,
        name: suggestedName,
        bookmarkIds,
        reason,
        tags: suggestedTags,
      });

      if (!createResult.success || !createResult.folderId) {
        logger.warn(
          { error: createResult.message },
          "MessageTrigger: Auto folder creation failed",
        );
        return {
          action: "skipped",
          reason: createResult.message,
        };
      }

      const messageResult = await MessageService.notifyFolderAutoCreated(
        userId,
        createResult.folderId,
        suggestedName,
        estimatedCount,
        reason,
      );

      return {
        action: "auto_executed",
        messageResult,
      };
    }

    // 半托管模式：创建确认消息
    if (trustMode === "semi_auto") {
      const suggestion: FolderCreateSuggestion = {
        suggestedName,
        reason,
        bookmarkIds,
        estimatedCount,
        suggestedTags,
      };

      const input: CreateFolderConfirmationInput = {
        userId,
        suggestion,
        type: "folder_create",
      };

      try {
        const confirmation =
          await confirmationService.createFolderConfirmation(input);

        return {
          action: "confirmation_created",
          confirmationId: confirmation.id,
        };
      } catch (error) {
        logger.error(
          { error },
          "Failed to create folder creation confirmation",
        );
        return {
          action: "skipped",
          reason: "Failed to create confirmation",
        };
      }
    }

    return {
      action: "skipped",
      reason: "Unknown trust mode",
    };
  }

  /**
   * 处理文件夹合并事件
   */
  async handleFolderMergeEvent(
    event: FolderMergeEvent,
    trustMode: TrustMode,
  ): Promise<TriggerResult> {
    const {
      userId,
      targetFolderId,
      targetFolderName,
      sourceFolderIds,
      sourceFolderNames,
      reason,
      affectedBookmarks,
      similarityScore,
    } = event;

    // 手动模式：不自动合并
    if (trustMode === "manual") {
      return {
        action: "skipped",
        reason: "Manual mode - no auto folder merge",
      };
    }

    // 全自动模式：直接合并，发送普通通知
    if (trustMode === "full_auto") {
      // 执行文件夹合并
      const mergeResult = await folderExecutorService.executeMerge({
        userId,
        targetFolderId,
        sourceFolderIds,
        reason,
      });

      if (!mergeResult.success) {
        logger.warn(
          { error: mergeResult.message },
          "MessageTrigger: Auto folder merge failed",
        );
        return {
          action: "skipped",
          reason: mergeResult.message,
        };
      }

      const messageResult = await MessageService.notifyFolderAutoMerged(
        userId,
        targetFolderId,
        targetFolderName,
        sourceFolderIds.length,
        reason,
      );

      return {
        action: "auto_executed",
        messageResult,
      };
    }

    // 半托管模式：创建确认消息
    if (trustMode === "semi_auto") {
      const suggestion: FolderMergeSuggestion = {
        targetFolderId,
        targetFolderName,
        sourceFolderIds,
        sourceFolderNames,
        reason,
        affectedBookmarks,
        similarityScore,
      };

      const input: CreateFolderConfirmationInput = {
        userId,
        folderId: targetFolderId,
        suggestion,
        type: "folder_merge",
      };

      try {
        const confirmation =
          await confirmationService.createFolderConfirmation(input);

        return {
          action: "confirmation_created",
          confirmationId: confirmation.id,
        };
      } catch (error) {
        logger.error({ error }, "Failed to create folder merge confirmation");
        return {
          action: "skipped",
          reason: "Failed to create confirmation",
        };
      }
    }

    return {
      action: "skipped",
      reason: "Unknown trust mode",
    };
  }

  /**
   * 处理文件夹拆分事件
   */
  async handleFolderSplitEvent(
    event: FolderSplitEvent,
    trustMode: TrustMode,
  ): Promise<TriggerResult> {
    const {
      userId,
      sourceFolderId,
      sourceFolderName,
      suggestedSubFolders,
      reason,
      affectedBookmarks,
    } = event;

    // 手动模式：不自动拆分
    if (trustMode === "manual") {
      return {
        action: "skipped",
        reason: "Manual mode - no auto folder split",
      };
    }

    // 全自动模式：直接拆分，发送普通通知
    if (trustMode === "full_auto") {
      // 执行文件夹拆分
      const splitResult = await folderExecutorService.executeSplit({
        userId,
        sourceFolderId,
        subFolders: suggestedSubFolders.map((f) => ({
          name: f.name,
          bookmarkIds: f.bookmarkIds,
        })),
        reason,
      });

      if (!splitResult.success) {
        logger.warn(
          { error: splitResult.message },
          "MessageTrigger: Auto folder split failed",
        );
        return {
          action: "skipped",
          reason: splitResult.message,
        };
      }

      const newFolderNames =
        splitResult.newFolders?.map((f) => f.name) ||
        suggestedSubFolders.map((f) => f.name);
      const messageResult = await MessageService.notifyFolderAutoSplit(
        userId,
        sourceFolderName,
        newFolderNames,
        reason,
      );

      return {
        action: "auto_executed",
        messageResult,
      };
    }

    // 半托管模式：创建确认消息
    if (trustMode === "semi_auto") {
      const suggestion: FolderSplitSuggestion = {
        sourceFolderId,
        sourceFolderName,
        suggestedSubFolders,
        reason,
        affectedBookmarks,
      };

      const input: CreateFolderConfirmationInput = {
        userId,
        folderId: sourceFolderId,
        suggestion,
        type: "folder_split",
      };

      try {
        const confirmation =
          await confirmationService.createFolderConfirmation(input);

        return {
          action: "confirmation_created",
          confirmationId: confirmation.id,
        };
      } catch (error) {
        logger.error({ error }, "Failed to create folder split confirmation");
        return {
          action: "skipped",
          reason: "Failed to create confirmation",
        };
      }
    }

    return {
      action: "skipped",
      reason: "Unknown trust mode",
    };
  }

  /**
   * 处理文件夹重命名事件
   */
  async handleFolderRenameEvent(
    event: FolderRenameEvent,
    trustMode: TrustMode,
  ): Promise<TriggerResult> {
    const {
      userId,
      folderId,
      currentName,
      suggestedName,
      reason,
      alternatives,
    } = event;

    // 手动模式：不自动重命名
    if (trustMode === "manual") {
      return {
        action: "skipped",
        reason: "Manual mode - no auto folder rename",
      };
    }

    // 全自动模式：直接重命名，发送普通通知
    if (trustMode === "full_auto") {
      // 执行文件夹重命名
      const renameResult = await folderExecutorService.executeRename({
        userId,
        folderId,
        newName: suggestedName,
        reason,
      });

      if (!renameResult.success) {
        logger.warn(
          { error: renameResult.message },
          "MessageTrigger: Auto folder rename failed",
        );
        return {
          action: "skipped",
          reason: renameResult.message,
        };
      }

      const messageResult = await MessageService.notifyFolderAutoRenamed(
        userId,
        folderId,
        currentName,
        suggestedName,
        reason,
      );

      return {
        action: "auto_executed",
        messageResult,
      };
    }

    // 半托管模式：创建确认消息
    if (trustMode === "semi_auto") {
      const suggestion: FolderRenameSuggestion = {
        folderId,
        currentName,
        suggestedName,
        reason,
        alternatives,
      };

      const input: CreateFolderConfirmationInput = {
        userId,
        folderId,
        suggestion,
        type: "folder_rename",
      };

      try {
        const confirmation =
          await confirmationService.createFolderConfirmation(input);

        return {
          action: "confirmation_created",
          confirmationId: confirmation.id,
        };
      } catch (error) {
        logger.error({ error }, "Failed to create folder rename confirmation");
        return {
          action: "skipped",
          reason: "Failed to create confirmation",
        };
      }
    }

    return {
      action: "skipped",
      reason: "Unknown trust mode",
    };
  }

  // ============================================================================
  // 批量处理
  // ============================================================================

  /**
   * 批量处理分类事件
   */
  async handleBatchClassificationEvents(
    events: ClassificationEvent[],
    trustMode: TrustMode,
    confirmationThreshold: number = CONFIDENCE_THRESHOLDS.SEMI_AUTO_CONFIRM,
  ): Promise<{
    autoExecuted: number;
    confirmationsCreated: number;
    skipped: number;
    results: TriggerResult[];
  }> {
    let autoExecuted = 0;
    let confirmationsCreated = 0;
    let skipped = 0;
    const results: TriggerResult[] = [];

    for (const event of events) {
      const result = await this.handleClassificationEvent(
        event,
        trustMode,
        confirmationThreshold,
      );
      results.push(result);

      switch (result.action) {
        case "auto_executed":
          autoExecuted++;
          break;
        case "confirmation_created":
          confirmationsCreated++;
          break;
        case "skipped":
          skipped++;
          break;
      }
    }

    // 批量分类完成通知（静默）
    if (autoExecuted > 0 && events.length > 0) {
      await MessageService.notifyBatchClassification(
        events[0].userId,
        events.length,
        autoExecuted,
      );
    }

    return {
      autoExecuted,
      confirmationsCreated,
      skipped,
      results,
    };
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const messageTriggerService = new MessageTriggerService();
