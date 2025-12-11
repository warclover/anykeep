/**
 * 消息服务
 * @description 提供消息创建、查询等核心功能，实现业务模块与消息系统的解耦
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";
import type { CreateMessageParams, MessageResult, MessageType } from "./types";
import {
  getMessageLevel,
  getLevelConfig,
  getDefaultPriority,
} from "./message-levels";
import { renderMessage } from "./message-templates";

// ============================================
// MessageService 核心类
// ============================================

export class MessageService {
  /**
   * 创建单条消息
   * @description 根据消息类型自动确定等级，渲染模板，写入数据库
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

    // 1. 获取消息等级
    const level = getMessageLevel(type);
    const levelConfig = getLevelConfig(level);

    // 2. 渲染消息内容
    const rendered = renderMessage(type, data);
    if (!rendered) {
      logger.error({ type }, "Unknown message type");
      return {
        success: false,
        level,
        shouldShowToast: false,
        shouldShowModal: false,
      };
    }

    const { title, content, actionUrl, actionLabel, defaultPriority } =
      rendered;

    try {
      // 3. 写入数据库
      const supabase = await createClient();
      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          user_id: userId,
          type,
          level,
          title,
          content,
          action_url: actionUrl,
          action_label: actionLabel,
          related_bookmark_id: relatedBookmarkId,
          related_folder_id: relatedFolderId,
          related_import_id: relatedImportId,
          metadata: data as Json,
          priority: defaultPriority,
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error, type, userId }, "Failed to create message");
        return {
          success: false,
          level,
          shouldShowToast: false,
          shouldShowModal: false,
        };
      }

      logger.info(
        { messageId: message.id, type, level, userId },
        "Message created",
      );

      return {
        success: true,
        messageId: message.id,
        level,
        title,
        content: content ?? undefined,
        actionUrl: actionUrl ?? undefined,
        actionLabel: actionLabel ?? undefined,
        shouldShowToast: levelConfig.showToast,
        shouldShowModal: levelConfig.showModal,
      };
    } catch (error) {
      logger.error({ error, type, userId }, "Failed to create message");
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
      const supabase = await createClient();

      const records = messages.map((params) => {
        const level = getMessageLevel(params.type);
        const rendered = renderMessage(params.type, params.data);

        return {
          user_id: params.userId,
          type: params.type,
          level,
          title: rendered?.title ?? "",
          content: rendered?.content,
          action_url: rendered?.actionUrl,
          action_label: rendered?.actionLabel,
          related_bookmark_id: params.relatedBookmarkId,
          related_folder_id: params.relatedFolderId,
          related_import_id: params.relatedImportId,
          metadata: params.data as Json,
          priority: rendered?.defaultPriority ?? getDefaultPriority(level),
        };
      });

      const { error, data } = await supabase
        .from("messages")
        .insert(records)
        .select("id");

      if (error) {
        logger.error(
          { error, count: messages.length },
          "Failed to create batch messages",
        );
        return { success: false, count: 0 };
      }

      logger.info({ count: data.length }, "Batch messages created");
      return { success: true, count: data.length };
    } catch (error) {
      logger.error(
        { error, count: messages.length },
        "Failed to create batch messages",
      );
      return { success: false, count: 0 };
    }
  }

  // ============================================
  // 快捷方法 - 分类相关
  // ============================================

  /**
   * 分类完成通知
   *
   * @param isAuto - true: 自动分类（高置信度），false: 需要确认（中等置信度）
   *
   * @deprecated isAuto=false 的用法在 V4.2 中已弃用
   * 中等置信度分类现在使用 confirmationService.createClassificationConfirmation()
   * 创建待确认记录，而不是发送 classification_suggest 消息
   * @see src/lib/confirmation/confirmation.service.ts
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
      relatedBookmarkId: bookmarkId,
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
      relatedBookmarkId: bookmarkId,
    });
  }

  // ============================================
  // 快捷方法 - 导入相关
  // ============================================

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

  // ============================================
  // 快捷方法 - 批量操作
  // ============================================

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

  // ============================================
  // 快捷方法 - 书签状态
  // ============================================

  /**
   * 书签保存通知
   */
  static async notifyBookmarkSaved(
    userId: string,
    bookmarkId: number,
    title: string,
    folderName?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "bookmark_saved",
      data: { bookmarkId, title, folderName },
      relatedBookmarkId: bookmarkId,
    });
  }

  /**
   * 失效链接检测通知
   */
  static async notifyInvalidBookmarks(
    userId: string,
    count: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "bookmark_invalid",
      data: { count },
    });
  }

  // ============================================
  // 快捷方法 - 配额相关
  // ============================================

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

  // ============================================
  // 快捷方法 - 系统消息
  // ============================================

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

  /**
   * 系统维护通知
   */
  static async notifySystemMaintenance(
    userId: string,
    content: string,
    url?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "system_maintenance",
      data: { content, url },
    });
  }

  /**
   * 版本更新通知
   */
  static async notifySystemUpdate(
    userId: string,
    content: string,
    url?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "system_update",
      data: { content, url },
    });
  }

  // ============================================
  // 快捷方法 - AI 处理
  // ============================================

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

  // ============================================
  // 快捷方法 - 文件夹操作
  // ============================================

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
   * 文件夹合并通知
   */
  static async notifyFolderMerged(
    userId: string,
    targetFolder: string,
    folderId: number,
    count: number,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "folder_merged",
      data: { targetFolder, folderId, count },
      relatedFolderId: folderId,
    });
  }

  // ============================================
  // 快捷方法 - 用户反馈
  // ============================================

  /**
   * 反馈已收到
   */
  static async notifyFeedbackReceived(userId: string): Promise<MessageResult> {
    return this.create({
      userId,
      type: "feedback_received",
      data: {},
    });
  }

  /**
   * 反馈回复
   */
  static async notifyFeedbackResponse(
    userId: string,
    response: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "feedback_response",
      data: { response },
    });
  }

  // ============================================
  // 快捷方法 - V4.2 AI 文件夹进化
  // ============================================

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

  /**
   * AI 月度进化报告
   */
  static async notifyEvolutionReport(
    userId: string,
    month: string,
    classifiedCount: number,
    createdFolders: number,
    reportUrl?: string,
  ): Promise<MessageResult> {
    return this.create({
      userId,
      type: "ai_evolution_report",
      data: { month, classifiedCount, createdFolders, reportUrl },
    });
  }

  // ============================================
  // 快捷方法 - V4.2 成本监控
  // ============================================

  /**
   * 成本预警通知
   * @param period - 'daily' | 'monthly'
   * @param currentCostCents - 当前费用（分）
   * @param limitCents - 限额（分）
   */
  static async notifyCostAlert(
    userId: string,
    period: "daily" | "monthly",
    currentCostCents: number,
    limitCents: number,
  ): Promise<MessageResult> {
    const usagePercent = Math.round((currentCostCents / limitCents) * 100);

    // 根据使用率选择消息类型
    let type: MessageType;
    if (currentCostCents >= limitCents) {
      type = period === "daily" ? "cost_daily_exceeded" : "cost_critical";
    } else if (usagePercent >= 80) {
      type = "cost_warning";
    } else {
      // 不需要发送通知
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

  /**
   * 每日成本超限通知
   */
  static async notifyDailyCostExceeded(
    userId: string,
    currentCostCents: number,
    limitCents: number,
  ): Promise<MessageResult> {
    return this.notifyCostAlert(userId, "daily", currentCostCents, limitCents);
  }

  /**
   * 每月成本超限通知
   */
  static async notifyMonthlyCostExceeded(
    userId: string,
    currentCostCents: number,
    limitCents: number,
  ): Promise<MessageResult> {
    return this.notifyCostAlert(
      userId,
      "monthly",
      currentCostCents,
      limitCents,
    );
  }
}
