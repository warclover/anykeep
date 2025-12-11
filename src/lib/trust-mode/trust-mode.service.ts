/**
 * Trust Mode Service
 * V4.2 托管模式服务层
 *
 * @description 提供托管模式的业务逻辑
 * - 获取用户有效配置（基础配置 + 覆盖）
 * - 模式切换与验证
 * - 决策辅助方法
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { BaseSupabaseService } from "@/lib/classification/services/base-supabase.service";
import { TrustModeRepository } from "./trust-mode.repository";
import {
  getTrustModeConfig,
  mergeWithOverrides,
  requiresConfirmation,
  shouldAutoClassify,
  shouldAutoCreateFolder,
  getLowConfidenceAction,
  CONFIDENCE_THRESHOLDS,
} from "./config";
import type {
  TrustMode,
  TrustModeConfig,
  UserTrustModeRecord,
} from "@/types/trust-mode";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户有效配置（合并后的完整配置）
 */
export interface EffectiveTrustModeConfig {
  /** 当前模式 */
  mode: TrustMode;
  /** 合并后的配置 */
  config: TrustModeConfig;
  /** 统计信息 */
  stats: {
    autoDecisions: number;
    userCorrections: number;
    pendingConfirmations: number;
    correctionRate: number;
  };
}

/**
 * 分类决策上下文
 */
export interface ClassificationDecisionContext {
  /** 用户 ID */
  userId: string;
  /** 置信度 */
  confidence: number;
  /** 是否为新文件夹 */
  isNewFolder?: boolean;
  /** 是否为低置信度 */
  isLowConfidence?: boolean;
}

/**
 * 分类决策结果
 */
export interface ClassificationDecision {
  /** 是否应该自动执行 */
  shouldAutoExecute: boolean;
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  /** 低置信度处理策略 */
  lowConfidenceAction: TrustModeConfig["classification"]["lowConfidenceAction"];
  /** 是否应该发送通知 */
  shouldNotify: boolean;
  /** 决策理由 */
  reason: string;
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 托管模式服务
 */
export class TrustModeService extends BaseSupabaseService {
  private repository: TrustModeRepository | null = null;

  /**
   * 获取 Repository 实例
   */
  private async getRepository(): Promise<TrustModeRepository> {
    if (!this.repository) {
      const supabase = await this.getSupabase();
      this.repository = new TrustModeRepository(supabase);
    }
    return this.repository;
  }

  // ============================================================================
  // 公开方法
  // ============================================================================

  /**
   * 获取用户托管模式
   */
  async getUserTrustMode(userId: string): Promise<TrustMode> {
    const repo = await this.getRepository();
    const record = await repo.findByUserId(userId);
    return record?.trust_mode || "full_auto";
  }

  /**
   * 获取用户有效配置（合并覆盖后的完整配置）
   */
  async getEffectiveConfig(userId: string): Promise<EffectiveTrustModeConfig> {
    const repo = await this.getRepository();
    const record = await repo.getOrCreate(userId);

    const baseConfig = getTrustModeConfig(record.trust_mode);
    const effectiveConfig = mergeWithOverrides(baseConfig, record.overrides);

    const totalDecisions =
      record.auto_decisions_count + record.user_corrections_count;
    const correctionRate =
      totalDecisions > 0
        ? record.user_corrections_count / totalDecisions
        : 0;

    return {
      mode: record.trust_mode,
      config: effectiveConfig,
      stats: {
        autoDecisions: record.auto_decisions_count,
        userCorrections: record.user_corrections_count,
        pendingConfirmations: record.pending_confirmations_count,
        correctionRate,
      },
    };
  }

  /**
   * 更新用户托管模式
   */
  async updateTrustMode(
    userId: string,
    newMode: TrustMode,
    reason?: string,
  ): Promise<UserTrustModeRecord> {
    const repo = await this.getRepository();
    return repo.update({
      userId,
      trustMode: newMode,
      reason,
    });
  }

  /**
   * 更新用户配置覆盖
   */
  async updateOverrides(
    userId: string,
    overrides: Partial<TrustModeConfig>,
  ): Promise<UserTrustModeRecord> {
    const repo = await this.getRepository();
    return repo.updateOverrides(userId, overrides);
  }

  /**
   * 获取分类决策
   * @description 根据用户托管模式和置信度，决定如何处理分类结果
   */
  async getClassificationDecision(
    context: ClassificationDecisionContext,
  ): Promise<ClassificationDecision> {
    const { userId, confidence, isNewFolder = false } = context;

    const effectiveConfig = await this.getEffectiveConfig(userId);
    const { mode, config } = effectiveConfig;

    // Manual 模式：不自动分类
    if (mode === "manual") {
      return {
        shouldAutoExecute: false,
        requiresConfirmation: false,
        lowConfidenceAction: "direct_inbox",
        shouldNotify: false,
        reason: "Manual mode - classification disabled",
      };
    }

    const isLowConfidence = confidence < CONFIDENCE_THRESHOLDS.MEDIUM;
    const needsConfirmation = requiresConfirmation(mode, confidence);

    // Full Auto 模式：始终自动执行
    if (mode === "full_auto") {
      return {
        shouldAutoExecute: true,
        requiresConfirmation: false,
        lowConfidenceAction: config.classification.lowConfidenceAction,
        shouldNotify:
          isNewFolder && config.notification.onFolderCreate === true,
        reason: isLowConfidence
          ? "Full auto mode - low confidence, will use inbox clustering"
          : "Full auto mode - auto execute",
      };
    }

    // Semi Auto 模式：根据置信度决定
    if (mode === "semi_auto") {
      if (needsConfirmation) {
        return {
          shouldAutoExecute: false,
          requiresConfirmation: true,
          lowConfidenceAction: "pending_with_message",
          shouldNotify: true,
          reason: `Semi-auto mode - confidence ${confidence}% below threshold, requires confirmation`,
        };
      }

      return {
        shouldAutoExecute: true,
        requiresConfirmation: false,
        lowConfidenceAction: config.classification.lowConfidenceAction,
        shouldNotify: isNewFolder && config.notification.onFolderSuggestion === true,
        reason: `Semi-auto mode - confidence ${confidence}% above threshold, auto execute`,
      };
    }

    // 默认情况（不应该到达）
    return {
      shouldAutoExecute: false,
      requiresConfirmation: false,
      lowConfidenceAction: "direct_inbox",
      shouldNotify: false,
      reason: "Unknown mode - defaulting to safe behavior",
    };
  }

  /**
   * 获取文件夹操作决策
   */
  async getFolderOperationDecision(
    userId: string,
    operationType: "create" | "merge" | "split" | "rename",
  ): Promise<{
    shouldAutoExecute: boolean;
    requiresConfirmation: boolean;
    shouldNotify: boolean;
  }> {
    const effectiveConfig = await this.getEffectiveConfig(userId);
    const { mode, config } = effectiveConfig;

    // Manual 模式：所有操作都手动
    if (mode === "manual") {
      return {
        shouldAutoExecute: false,
        requiresConfirmation: false,
        shouldNotify: false,
      };
    }

    // Full Auto 模式：自动执行
    if (mode === "full_auto") {
      const operationMap = {
        create: config.folderManagement.autoCreate,
        merge: config.folderManagement.autoMerge,
        split: config.folderManagement.autoSplit,
        rename: config.folderManagement.autoRename,
      };

      return {
        shouldAutoExecute: operationMap[operationType],
        requiresConfirmation: false,
        shouldNotify:
          operationType === "create"
            ? config.notification.onFolderCreate === true
            : config.notification.onMajorReorganization === true,
      };
    }

    // Semi Auto 模式：需要确认
    return {
      shouldAutoExecute: false,
      requiresConfirmation: true,
      shouldNotify: true,
    };
  }

  /**
   * 记录自动决策
   */
  async recordAutoDecision(userId: string): Promise<void> {
    const repo = await this.getRepository();
    await repo.incrementStats({
      userId,
      autoDecisions: 1,
    });
  }

  /**
   * 记录用户纠正
   */
  async recordUserCorrection(userId: string): Promise<void> {
    const repo = await this.getRepository();
    await repo.incrementStats({
      userId,
      userCorrections: 1,
    });
  }

  /**
   * 增加待确认计数
   */
  async incrementPendingCount(userId: string): Promise<void> {
    const repo = await this.getRepository();
    await repo.incrementStats({
      userId,
      pendingConfirmations: 1,
    });
  }

  /**
   * 减少待确认计数
   */
  async decrementPendingCount(userId: string): Promise<void> {
    const repo = await this.getRepository();
    await repo.incrementStats({
      userId,
      pendingConfirmations: -1,
    });
  }

  /**
   * 获取模式切换历史
   */
  async getModeHistory(userId: string) {
    const repo = await this.getRepository();
    return repo.getModeHistory(userId);
  }

  /**
   * 检查是否应该启用学习
   */
  async shouldLearn(
    userId: string,
    learningType: "manual_move" | "deletion",
  ): Promise<boolean> {
    const effectiveConfig = await this.getEffectiveConfig(userId);
    const { config } = effectiveConfig;

    if (learningType === "manual_move") {
      return config.learning.learnFromManualMoves;
    }

    if (learningType === "deletion") {
      return config.learning.learnFromDeletions;
    }

    return false;
  }

  // ============================================================================
  // 便捷静态方法（不需要数据库访问）
  // ============================================================================

  /**
   * 检查置信度是否需要确认
   */
  static checkRequiresConfirmation(
    mode: TrustMode,
    confidence: number,
  ): boolean {
    return requiresConfirmation(mode, confidence);
  }

  /**
   * 检查是否应该自动分类
   */
  static checkShouldAutoClassify(mode: TrustMode): boolean {
    return shouldAutoClassify(mode);
  }

  /**
   * 检查是否应该自动创建文件夹
   */
  static checkShouldAutoCreateFolder(mode: TrustMode): boolean {
    return shouldAutoCreateFolder(mode);
  }

  /**
   * 获取低置信度处理策略
   */
  static getLowConfidenceAction(mode: TrustMode) {
    return getLowConfidenceAction(mode);
  }
}

// ============================================================================
// 单例导出
// ============================================================================

/**
 * 托管模式服务单例
 */
export const trustModeService = new TrustModeService();
