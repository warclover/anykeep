/**
 * Pending Confirmation Service
 * V4.2 待确认消息服务
 *
 * @description 处理半托管模式下的确认消息逻辑
 * - 创建确认消息
 * - 处理用户响应
 * - 执行过期处理
 * - 与分类系统集成
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import {
  confirmationRepository,
  type ConfirmationQueryFilters,
} from "./confirmation.repository";
import type {
  ConfirmationType,
  ConfirmationStatus,
  ClassificationSuggestion,
  FolderCreateSuggestion,
  FolderMergeSuggestion,
  FolderSplitSuggestion,
  FolderRenameSuggestion,
  UserChoice,
  ClassificationChoice,
  FolderOperationChoice,
  PendingConfirmationRecord,
  ConfirmationMessageDisplay,
} from "@/types/confirmation";
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分类确认创建输入
 */
export interface CreateClassificationConfirmationInput {
  userId: string;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  suggestion: ClassificationSuggestion;
}

/**
 * 文件夹操作确认创建输入
 */
export interface CreateFolderConfirmationInput {
  userId: string;
  folderId?: number;
  suggestion:
    | FolderCreateSuggestion
    | FolderMergeSuggestion
    | FolderSplitSuggestion
    | FolderRenameSuggestion;
  type: Exclude<ConfirmationType, "classification">;
}

/**
 * 响应结果
 */
export interface ConfirmationResponse {
  success: boolean;
  confirmation: PendingConfirmationRecord;
  learningApplied: boolean;
  error?: string;
}

/**
 * 过期处理结果
 */
export interface ExpirationResult {
  processed: number;
  autoExecuted: number;
  movedToInbox: number;
  errors: string[];
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 待确认消息服务
 */
class ConfirmationService {
  // ============================================================================
  // 创建确认消息
  // ============================================================================

  /**
   * 创建分类确认消息
   */
  async createClassificationConfirmation(
    input: CreateClassificationConfirmationInput,
  ): Promise<PendingConfirmationRecord> {
    const { userId, bookmarkId, suggestion } = input;

    // 检查是否已存在该书签的待确认记录
    const existing = await confirmationRepository.findByBookmarkId(
      userId,
      bookmarkId,
    );
    if (existing) {
      logger.warn({ bookmarkId }, "Classification confirmation already exists");
      return existing;
    }

    return confirmationRepository.create({
      userId,
      confirmationType: "classification",
      bookmarkId,
      suggestion,
    });
  }

  /**
   * 创建文件夹操作确认消息
   */
  async createFolderConfirmation(
    input: CreateFolderConfirmationInput,
  ): Promise<PendingConfirmationRecord> {
    const { userId, folderId, suggestion, type } = input;

    return confirmationRepository.create({
      userId,
      confirmationType: type,
      folderId,
      suggestion,
    });
  }

  // ============================================================================
  // 查询确认消息
  // ============================================================================

  /**
   * 获取用户待确认消息
   */
  async getUserConfirmations(
    userId: string,
    filters?: ConfirmationQueryFilters,
  ): Promise<PendingConfirmationRecord[]> {
    return confirmationRepository.findByUser(userId, filters);
  }

  /**
   * 获取待处理数量
   */
  async getPendingCount(userId: string): Promise<number> {
    return confirmationRepository.countPending(userId);
  }

  /**
   * 根据 ID 获取确认消息
   */
  async getById(id: number): Promise<PendingConfirmationRecord | null> {
    return confirmationRepository.findById(id);
  }

  /**
   * 获取确认消息展示数据
   */
  async getDisplayData(
    userId: string,
    filters?: ConfirmationQueryFilters,
  ): Promise<ConfirmationMessageDisplay[]> {
    const records = await this.getUserConfirmations(userId, filters);
    return Promise.all(records.map((r) => this.mapToDisplay(r)));
  }

  // ============================================================================
  // 处理用户响应
  // ============================================================================

  /**
   * 处理分类确认响应
   */
  async respondToClassification(
    confirmationId: number,
    userId: string,
    choice: ClassificationChoice,
  ): Promise<ConfirmationResponse> {
    const confirmation = await confirmationRepository.findById(confirmationId);

    if (!confirmation) {
      return {
        success: false,
        confirmation: null as unknown as PendingConfirmationRecord,
        learningApplied: false,
        error: "Confirmation not found",
      };
    }

    if (confirmation.user_id !== userId) {
      return {
        success: false,
        confirmation,
        learningApplied: false,
        error: "Unauthorized",
      };
    }

    if (confirmation.status !== "pending") {
      return {
        success: false,
        confirmation,
        learningApplied: false,
        error: "Confirmation already processed",
      };
    }

    // 确定响应状态
    const suggestion = confirmation.suggestion as ClassificationSuggestion;
    let status: ConfirmationStatus;

    if (choice.selectedFolderId === suggestion.folderId) {
      status = "confirmed";
    } else if (choice.selectedFolderId === null && !choice.newFolderName) {
      status = "rejected";
    } else {
      status = "modified";
    }

    // 更新记录
    const userChoice: UserChoice = {
      choice,
      timestamp: new Date().toISOString(),
    };

    const updated = await confirmationRepository.updateStatus(
      confirmationId,
      status,
      userChoice,
    );

    // 学习用户偏好
    let learningApplied = false;
    try {
      if (confirmation.bookmark_id && choice.selectedFolderId !== null) {
        const eventType =
          status === "confirmed"
            ? "classification_confirmed"
            : status === "rejected"
              ? "classification_rejected"
              : "classification_modified";

        await preferenceLearner.recordEvent({
          userId,
          eventType,
          bookmarkId: confirmation.bookmark_id,
          originalFolderId: suggestion.folderId || undefined,
          newFolderId: choice.selectedFolderId,
          confidence: suggestion.confidence,
          timestamp: new Date(),
        });
        learningApplied = true;
      }
    } catch (error) {
      logger.error({ error }, "Failed to apply learning from confirmation");
    }

    return {
      success: true,
      confirmation: updated,
      learningApplied,
    };
  }

  /**
   * 处理文件夹操作确认响应
   */
  async respondToFolderOperation(
    confirmationId: number,
    userId: string,
    choice: FolderOperationChoice,
  ): Promise<ConfirmationResponse> {
    const confirmation = await confirmationRepository.findById(confirmationId);

    if (!confirmation) {
      return {
        success: false,
        confirmation: null as unknown as PendingConfirmationRecord,
        learningApplied: false,
        error: "Confirmation not found",
      };
    }

    if (confirmation.user_id !== userId) {
      return {
        success: false,
        confirmation,
        learningApplied: false,
        error: "Unauthorized",
      };
    }

    if (confirmation.status !== "pending") {
      return {
        success: false,
        confirmation,
        learningApplied: false,
        error: "Confirmation already processed",
      };
    }

    // 确定响应状态
    const status: ConfirmationStatus = choice.accepted
      ? choice.modifications
        ? "modified"
        : "confirmed"
      : "rejected";

    // 更新记录
    const userChoice: UserChoice = {
      choice,
      timestamp: new Date().toISOString(),
    };

    const updated = await confirmationRepository.updateStatus(
      confirmationId,
      status,
      userChoice,
    );

    // TODO: 如果接受，执行文件夹操作
    // 这里需要与文件夹服务集成

    return {
      success: true,
      confirmation: updated,
      learningApplied: false,
    };
  }

  // ============================================================================
  // 过期处理
  // ============================================================================

  /**
   * 处理过期确认消息
   * @description 由 Cron 任务调用
   */
  async processExpired(): Promise<ExpirationResult> {
    const result: ExpirationResult = {
      processed: 0,
      autoExecuted: 0,
      movedToInbox: 0,
      errors: [],
    };

    try {
      const expired = await confirmationRepository.findExpired();
      result.processed = expired.length;

      for (const confirmation of expired) {
        try {
          if (confirmation.confirmation_type === "classification") {
            // 分类确认过期后按建议执行
            const suggestion =
              confirmation.suggestion as ClassificationSuggestion;

            if (suggestion.folderId !== null) {
              // TODO: 执行分类操作
              result.autoExecuted++;
            } else {
              result.movedToInbox++;
            }

            await confirmationRepository.updateStatus(
              confirmation.id,
              "expired",
            );
          } else {
            // 文件夹操作过期后标记为过期，不自动执行
            await confirmationRepository.updateStatus(
              confirmation.id,
              "expired",
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`ID ${confirmation.id}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Global error: ${message}`);
    }

    logger.info({ result }, "Processed expired confirmations");
    return result;
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  /**
   * 批量确认（按建议执行）
   */
  async batchConfirm(
    userId: string,
    confirmationIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of confirmationIds) {
      try {
        const confirmation = await confirmationRepository.findById(id);

        if (!confirmation || confirmation.user_id !== userId) {
          failed++;
          continue;
        }

        if (confirmation.confirmation_type === "classification") {
          const suggestion =
            confirmation.suggestion as ClassificationSuggestion;
          await this.respondToClassification(id, userId, {
            selectedFolderId: suggestion.folderId,
          });
        } else {
          await this.respondToFolderOperation(id, userId, {
            accepted: true,
          });
        }
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 批量拒绝（移至待整理）
   */
  async batchReject(
    userId: string,
    confirmationIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of confirmationIds) {
      try {
        const confirmation = await confirmationRepository.findById(id);

        if (!confirmation || confirmation.user_id !== userId) {
          failed++;
          continue;
        }

        if (confirmation.confirmation_type === "classification") {
          await this.respondToClassification(id, userId, {
            selectedFolderId: null,
          });
        } else {
          await this.respondToFolderOperation(id, userId, {
            accepted: false,
          });
        }
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 映射到展示数据
   */
  private async mapToDisplay(
    record: PendingConfirmationRecord,
  ): Promise<ConfirmationMessageDisplay> {
    const now = new Date();
    const expiresAt = new Date(record.expires_at);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let expiresIn: string;
    if (diffMs < 0) {
      expiresIn = "已过期";
    } else if (diffDays === 0) {
      expiresIn = "今天到期";
    } else if (diffDays === 1) {
      expiresIn = "明天到期";
    } else {
      expiresIn = `${diffDays} 天后到期`;
    }

    const base: ConfirmationMessageDisplay = {
      id: record.id,
      type: record.confirmation_type,
      status: record.status,
      title: this.getTitle(record),
      description: this.getDescription(record),
      suggestion: record.suggestion,
      expiresIn,
      createdAt: record.created_at,
    };

    // TODO: 加载关联的书签/文件夹信息
    // 这里需要与书签/文件夹服务集成

    return base;
  }

  /**
   * 获取确认消息标题
   */
  private getTitle(record: PendingConfirmationRecord): string {
    switch (record.confirmation_type) {
      case "classification":
        return "帮我确认一下这篇内容的分类";
      case "folder_create":
        return "建议创建新文件夹";
      case "folder_merge":
        return "建议合并相似文件夹";
      case "folder_split":
        return "建议拆分文件夹";
      case "folder_rename":
        return "建议重命名文件夹";
      default:
        return "待确认操作";
    }
  }

  /**
   * 获取确认消息描述
   */
  private getDescription(record: PendingConfirmationRecord): string {
    const suggestion = record.suggestion;

    switch (record.confirmation_type) {
      case "classification": {
        const s = suggestion as ClassificationSuggestion;
        return s.folderName
          ? `建议放入「${s.folderName}」(${s.confidence}% 匹配)`
          : "无法确定合适的文件夹";
      }
      case "folder_create": {
        const s = suggestion as FolderCreateSuggestion;
        return `建议创建「${s.suggestedName}」来整理 ${s.estimatedCount} 条内容`;
      }
      case "folder_merge": {
        const s = suggestion as FolderMergeSuggestion;
        return `建议将「${s.sourceFolderNames.join("、")}」合并到「${s.targetFolderName}」`;
      }
      case "folder_split": {
        const s = suggestion as FolderSplitSuggestion;
        return `建议将「${s.sourceFolderName}」拆分为 ${s.suggestedSubFolders.length} 个子文件夹`;
      }
      case "folder_rename": {
        const s = suggestion as FolderRenameSuggestion;
        return `建议将「${s.currentName}」重命名为「${s.suggestedName}」`;
      }
      default:
        return "";
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const confirmationService = new ConfirmationService();
