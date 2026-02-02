/**
 * 统一消息 Facade
 * @description 提供统一的消息发送入口，自动路由到新的 NotificationService
 * 保持与旧 MessageService API 兼容，同时底层使用新系统
 *
 * @version 1.0.0
 * @since 2026-02-02
 */

import { NotificationService } from "@/lib/notifications/notification.service";
import type { NotificationPayload } from "@/lib/notifications/notification.types";
import { MESSAGE_TYPE_TO_NOTIFICATION_CODE } from "./type-mapping";
import { renderMessage } from "./message-templates";
import { getMessageLevel, getLevelConfig } from "./message-levels";
import { logger } from "@/lib/logger";
import type { MessageType, MessageResult, CreateMessageParams } from "./types";

// ============================================================================
// MessageFacade 核心类
// ============================================================================

export class MessageFacade {
  /**
   * 创建单条消息（统一入口）
   * @description 兼容旧 MessageService.create() API，底层使用新 NotificationService
   */
  static async create(params: CreateMessageParams): Promise<MessageResult> {
    const {
      userId,
      type,
      data,
      relatedBookmarkId,
      relatedFolderId,
      relatedImportId,
    } = params;

    // 1. 获取消息等级和配置
    const level = getMessageLevel(type);
    const levelConfig = getLevelConfig(level);

    // 2. 渲染消息内容
    const rendered = renderMessage(type, data);
    if (!rendered) {
      logger.error({ type }, "[MessageFacade] Unknown message type");
      return {
        success: false,
        level,
        shouldShowToast: false,
        shouldShowModal: false,
      };
    }

    const { title, content, actionUrl, actionLabel } = rendered;

    // 3. 映射到新通知类型
    const notificationCode = MESSAGE_TYPE_TO_NOTIFICATION_CODE[type];
    if (!notificationCode) {
      logger.warn(
        { type },
        "[MessageFacade] No notification code mapping, using fallback",
      );
    }

    // 4. 构建通知 Payload
    const payload: NotificationPayload = {
      userId,
      type: notificationCode || type.replace(/_/g, "."),
      title,
      body: content,
      actionUrl: actionUrl ?? undefined,
      actionLabel: actionLabel ?? undefined,
      priority: level as "silent" | "normal" | "important",
      entityType: relatedBookmarkId
        ? "bookmark"
        : relatedFolderId
          ? "folder"
          : relatedImportId
            ? "import"
            : undefined,
      entityId: (
        relatedBookmarkId ||
        relatedFolderId ||
        relatedImportId
      )?.toString(),
      metadata: data,
    };

    try {
      // 5. 发送到新通知系统
      const notification = await NotificationService.send(payload);

      logger.info(
        {
          notificationId: notification.id,
          type,
          notificationCode,
          userId,
        },
        "[MessageFacade] Notification sent via new system",
      );

      return {
        success: true,
        messageId: notification.id,
        level,
        title,
        content: content ?? undefined,
        actionUrl: actionUrl ?? undefined,
        actionLabel: actionLabel ?? undefined,
        shouldShowToast: levelConfig.showToast,
        shouldShowModal: levelConfig.showModal,
      };
    } catch (error) {
      logger.error(
        { error, type, userId },
        "[MessageFacade] Failed to send notification",
      );
      return {
        success: false,
        level,
        shouldShowToast: false,
        shouldShowModal: false,
      };
    }
  }

  /**
   * 批量创建消息
   */
  static async createBatch(
    messages: CreateMessageParams[],
  ): Promise<{ success: boolean; count: number }> {
    if (messages.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const payloads: NotificationPayload[] = messages.map((params) => {
        const level = getMessageLevel(params.type);
        const rendered = renderMessage(params.type, params.data);
        const notificationCode = MESSAGE_TYPE_TO_NOTIFICATION_CODE[params.type];

        return {
          userId: params.userId,
          type: notificationCode || params.type.replace(/_/g, "."),
          title: rendered?.title ?? "",
          body: rendered?.content,
          actionUrl: rendered?.actionUrl ?? undefined,
          actionLabel: rendered?.actionLabel ?? undefined,
          priority: level as "silent" | "normal" | "important",
          entityType: params.relatedBookmarkId
            ? "bookmark"
            : params.relatedFolderId
              ? "folder"
              : params.relatedImportId
                ? "import"
                : undefined,
          entityId: (
            params.relatedBookmarkId ||
            params.relatedFolderId ||
            params.relatedImportId
          )?.toString(),
          metadata: params.data,
        };
      });

      const notifications = await NotificationService.sendBatch(payloads);

      logger.info(
        { count: notifications.length },
        "[MessageFacade] Batch notifications sent",
      );
      return { success: true, count: notifications.length };
    } catch (error) {
      logger.error(
        { error, count: messages.length },
        "[MessageFacade] Failed to send batch notifications",
      );
      return { success: false, count: 0 };
    }
  }

  // ============================================================================
  // 快捷方法 - 分类相关（兼容旧 API）
  // ============================================================================

  /**
   * 分类完成通知
   */
  static async notifyClassificationComplete(
    userId: string,
    bookmarkId: number,
    folderName: string,
    confidence: number,
    isAuto: boolean = true,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: isAuto ? "classification_auto" : "classification_suggest",
      data: { folderName, confidence, bookmarkId },
      relatedBookmarkId: String(bookmarkId),
    });
  }

  /**
   * 批量分类完成通知
   */
  static async notifyBatchClassification(
    userId: string,
    totalCount: number,
    successCount: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "classification_batch",
      data: { totalCount, successCount },
    });
  }

  /**
   * 分类失败通知
   */
  static async notifyClassificationFailed(
    userId: string,
    bookmarkId: number,
    reason: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "classification_failed",
      data: { bookmarkId, reason },
      relatedBookmarkId: String(bookmarkId),
    });
  }

  /**
   * 一键分类完成通知
   */
  static async notifyReclassifyComplete(
    userId: string,
    processed: number,
    movedCount: number,
    suggestionsCreated: number,
    isFullAuto: boolean,
    batchId?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "reclassify_complete",
      data: {
        processed,
        movedCount,
        suggestionsCreated,
        isFullAuto,
        batchId,
      },
    });
  }

  // ============================================================================
  // 快捷方法 - 导入相关
  // ============================================================================

  /**
   * 导入完成通知
   */
  static async notifyImportComplete(
    userId: string,
    importId: number,
    totalCount: number,
    successCount: number,
    failedCount: number,
    folderName?: string,
  ): Promise<MessageResult> {
    let type: MessageType;
    if (failedCount === totalCount) {
      type = "import_failed";
    } else if (failedCount > 0) {
      type = "import_partial";
    } else {
      type = "import_complete";
    }

    return this.create({
      userId,
      type,
      data: { totalCount, successCount, failedCount, folderName },
      relatedImportId: importId,
    });
  }

  // ============================================================================
  // 快捷方法 - 批量操作
  // ============================================================================

  /**
   * 批量移动通知
   */
  static async notifyBatchMove(
    userId: string,
    count: number,
    targetFolder: string,
    folderId: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "batch_move",
      data: { count, targetFolder, folderId },
      relatedFolderId: folderId,
    });
  }

  /**
   * 批量删除通知
   */
  static async notifyBatchDelete(
    userId: string,
    count: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "batch_delete",
      data: { count },
    });
  }

  /**
   * 批量打标签通知
   */
  static async notifyBatchTag(
    userId: string,
    count: number,
    tags: string[],
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "batch_tag",
      data: { count, tags },
    });
  }

  /**
   * 批量恢复通知
   */
  static async notifyBatchRestore(
    userId: string,
    count: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "batch_restore",
      data: { count },
    });
  }

  // ============================================================================
  // 快捷方法 - 文件夹操作
  // ============================================================================

  /**
   * 文件夹创建通知
   */
  static async notifyFolderCreated(
    userId: string,
    folderId: number,
    folderName: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_created",
      data: { folderId, folderName },
      relatedFolderId: folderId,
    });
  }

  /**
   * AI 自动创建文件夹通知
   */
  static async notifyFolderAutoCreated(
    userId: string,
    folderId: number,
    folderName: string,
    bookmarkCount: number,
    reason?: string,
    snapshotId?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_auto_created",
      data: { folderId, folderName, bookmarkCount, reason, snapshotId },
      relatedFolderId: folderId,
    });
  }

  /**
   * AI 自动分拆文件夹通知
   */
  static async notifyFolderAutoSplit(
    userId: string,
    originalName: string,
    newFolders: string[],
    reason?: string,
    snapshotId?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_auto_split",
      data: { originalName, newFolders, reason, snapshotId },
    });
  }

  /**
   * AI 自动合并文件夹通知
   */
  static async notifyFolderAutoMerged(
    userId: string,
    targetFolderId: number,
    targetName: string,
    folderCount: number,
    reason?: string,
    snapshotId?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_auto_merged",
      data: { targetFolderId, targetName, folderCount, reason, snapshotId },
      relatedFolderId: targetFolderId,
    });
  }

  /**
   * AI 自动重命名文件夹通知
   */
  static async notifyFolderAutoRenamed(
    userId: string,
    folderId: number,
    oldName: string,
    newName: string,
    reason?: string,
    snapshotId?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_auto_renamed",
      data: { folderId, oldName, newName, reason, snapshotId },
      relatedFolderId: folderId,
    });
  }

  /**
   * 操作已撤销通知
   */
  static async notifyOperationUndone(
    userId: string,
    actionLabel: string,
    detail?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_operation_undone",
      data: { actionLabel, detail },
    });
  }

  // ============================================================================
  // 快捷方法 - 配额与成本
  // ============================================================================

  /**
   * 配额预警通知
   */
  static async notifyQuotaWarning(
    userId: string,
    usagePercent: number,
  ): Promise<MessageResult> {
    let type: MessageType;
    if (usagePercent >= 100) {
      type = "quota_exceeded";
    } else if (usagePercent >= 95) {
      type = "quota_critical";
    } else {
      type = "quota_warning";
    }

    return this.create({
      userId,
      type,
      data: { usagePercent },
    });
  }

  /**
   * 成本预警通知
   */
  static async notifyCostAlert(
    userId: string,
    period: "daily" | "monthly",
    currentCostCents: number,
    limitCents: number,
  ): Promise<MessageResult> {
    const usagePercent = Math.round((currentCostCents / limitCents) * 100);

    let type: MessageType;
    if (currentCostCents >= limitCents) {
      type = period === "daily" ? "cost_daily_exceeded" : "cost_critical";
    } else if (usagePercent >= 80) {
      type = "cost_warning";
    } else {
      return {
        success: true,
        level: "silent",
        shouldShowToast: false,
        shouldShowModal: false,
      };
    }

    return this.create({
      userId,
      type,
      data: {
        period,
        currentCostCents,
        limitCents,
        usagePercent,
      },
    });
  }

  // ============================================================================
  // 快捷方法 - AI 处理
  // ============================================================================

  /**
   * AI 摘要生成完成
   */
  static async notifyAiSummaryComplete(
    userId: string,
    bookmarkId?: number,
    count?: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "ai_summary_complete",
      data: { bookmarkId, count },
      relatedBookmarkId: bookmarkId,
    });
  }

  /**
   * AI 标签生成完成
   */
  static async notifyAiTagsComplete(
    userId: string,
    bookmarkId?: number,
    count?: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "ai_tags_complete",
      data: { bookmarkId, count },
      relatedBookmarkId: bookmarkId,
    });
  }

  /**
   * AI 处理失败
   */
  static async notifyAiProcessingFailed(
    userId: string,
    reason: string,
    bookmarkId?: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "ai_processing_failed",
      data: { reason, bookmarkId },
      relatedBookmarkId: bookmarkId,
    });
  }

  // ============================================================================
  // 快捷方法 - 系统消息
  // ============================================================================

  /**
   * 系统公告
   */
  static async notifySystemAnnouncement(
    userId: string,
    title: string,
    content: string,
    url?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "system_announcement",
      data: { title, content, url },
    });
  }
}

// ============================================================================
// 导出便捷别名
// ============================================================================

/**
 * @deprecated 使用 MessageFacade 替代
 * 保留此别名以便平滑迁移
 */
export const UnifiedMessageService = MessageFacade;
