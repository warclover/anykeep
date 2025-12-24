/**
 * ConfirmationService - 统一确认服务
 *
 * 合并 Tool 确认和 Skill 确认两套系统，提供统一的确认处理
 *
 * 职责：
 * - 创建和管理确认请求
 * - 处理确认响应
 * - 管理确认超时和过期
 * - 与 EffectManager 集成
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { ConfirmOption } from "../../output/types";
import type { EffectContext, ConfirmationEffect } from "../types";
import type { EffectManager } from "../effect-manager";
import { effectManager } from "../effect-manager";

// ============================================
// 类型定义
// ============================================

/**
 * 确认状态
 */
export type ConfirmationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "cancelled";

/**
 * 确认来源
 */
export type ConfirmationSource = "tool" | "skill";

/**
 * 待确认操作
 */
export interface PendingConfirmation {
  /** 确认 ID */
  id: string;
  /** 确认来源 */
  source: ConfirmationSource;
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项 */
  options: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 当前状态 */
  status: ConfirmationStatus;
  /** 用户响应 */
  response?: ConfirmationResponse;
  /** 上下文数据 */
  contextData?: Record<string, unknown>;
  /** 关联的 Tool 名称（Tool 确认） */
  toolName?: string;
  /** 关联的 Skill ID（Skill 确认） */
  skillId?: string;
  /** 关联的步骤索引（Skill 确认） */
  stepIndex?: number;
  /** 关联的用户 ID */
  userId?: string;
  /** Effect 上下文 */
  effectContext?: EffectContext;
}

/**
 * 确认响应
 */
export interface ConfirmationResponse {
  /** 确认 ID */
  id: string;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 额外数据 */
  data?: unknown;
  /** 响应时间 */
  respondedAt: Date;
}

/**
 * 确认请求选项
 */
export interface ConfirmationRequestOptions {
  /** 确认来源 */
  source: ConfirmationSource;
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项 */
  options?: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 上下文数据 */
  contextData?: Record<string, unknown>;
  /** Tool 名称（Tool 确认） */
  toolName?: string;
  /** Tool 参数（Tool 确认） */
  toolParams?: unknown;
  /** Skill ID（Skill 确认） */
  skillId?: string;
  /** 步骤索引（Skill 确认） */
  stepIndex?: number;
  /** 用户 ID */
  userId?: string;
  /** Effect 上下文 */
  effectContext?: EffectContext;
}

/**
 * 确认结果
 */
export interface ConfirmationResult {
  /** 是否已确认 */
  confirmed: boolean;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 确认状态 */
  status: ConfirmationStatus;
  /** 额外数据 */
  data?: unknown;
  /** 上下文数据 */
  contextData?: Record<string, unknown>;
}

/**
 * 服务配置
 */
export interface ConfirmationServiceConfig {
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs: number;
  /** 最大待确认数量 */
  maxPendingConfirmations: number;
  /** 清理间隔（毫秒） */
  cleanupIntervalMs: number;
  /** 是否自动发出 Effect */
  emitEffects: boolean;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: ConfirmationServiceConfig = {
  defaultTimeoutMs: 5 * 60 * 1000, // 5 分钟
  maxPendingConfirmations: 100,
  cleanupIntervalMs: 60 * 1000, // 1 分钟
  emitEffects: true,
};

const DEFAULT_OPTIONS: ConfirmOption[] = [
  { id: "confirm", label: "确认", primary: true },
  { id: "cancel", label: "取消" },
];

// ============================================
// ConfirmationService 实现
// ============================================

/**
 * 统一确认服务
 *
 * @example
 * ```typescript
 * const service = new ConfirmationService();
 *
 * // 创建 Tool 确认
 * const confirmation = service.createConfirmation({
 *   source: 'tool',
 *   toolName: 'delete_bookmark',
 *   title: '删除书签',
 *   message: '确定要删除这条书签吗？',
 * });
 *
 * // 等待确认
 * const result = await service.waitForConfirmation(confirmation.id);
 *
 * // 创建 Skill 确认
 * const skillConfirm = service.createConfirmation({
 *   source: 'skill',
 *   skillId: 'batch_organize',
 *   stepIndex: 2,
 *   title: '批量整理',
 *   message: '确认执行整理操作？',
 * });
 * ```
 */
export class ConfirmationService {
  private config: ConfirmationServiceConfig;
  private effectManager: EffectManager;
  private pendingConfirmations: Map<string, PendingConfirmation>;
  private confirmationPromises: Map<
    string,
    {
      resolve: (result: ConfirmationResult) => void;
      reject: (error: Error) => void;
      timeoutId?: NodeJS.Timeout;
    }
  >;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    config: Partial<ConfirmationServiceConfig> = {},
    manager?: EffectManager,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.effectManager = manager ?? effectManager;
    this.pendingConfirmations = new Map();
    this.confirmationPromises = new Map();

    this.startCleanupTimer();
  }

  /**
   * 创建确认请求
   */
  createConfirmation(options: ConfirmationRequestOptions): PendingConfirmation {
    // 检查数量限制
    this.enforceLimit();

    const id = this.generateId();
    const now = new Date();
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;

    const confirmation: PendingConfirmation = {
      id,
      source: options.source,
      title: options.title,
      message: options.message,
      options: options.options ?? DEFAULT_OPTIONS,
      preview: options.preview,
      createdAt: now,
      expiresAt: new Date(now.getTime() + timeoutMs),
      status: "pending",
      contextData: options.contextData,
      toolName: options.toolName,
      skillId: options.skillId,
      stepIndex: options.stepIndex,
      userId: options.userId,
      effectContext: options.effectContext,
    };

    this.pendingConfirmations.set(id, confirmation);

    logger.debug(
      {
        confirmationId: id,
        source: options.source,
        title: options.title,
        toolName: options.toolName,
        skillId: options.skillId,
      },
      "ConfirmationService: 创建确认请求",
    );

    // 发出 Effect
    if (this.config.emitEffects) {
      this.emitConfirmationEffect(confirmation);
    }

    return confirmation;
  }

  /**
   * 等待确认
   */
  waitForConfirmation(
    confirmationId: string,
    timeoutMs?: number,
  ): Promise<ConfirmationResult> {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      return Promise.reject(new Error(`确认请求不存在: ${confirmationId}`));
    }

    if (confirmation.status !== "pending") {
      return Promise.resolve(this.getResultFromConfirmation(confirmation));
    }

    // 检查是否已过期
    if (new Date() > confirmation.expiresAt) {
      confirmation.status = "expired";
      return Promise.resolve({
        confirmed: false,
        selectedOption: "",
        status: "expired",
      });
    }

    return new Promise((resolve, reject) => {
      const effectiveTimeout =
        timeoutMs ?? confirmation.expiresAt.getTime() - Date.now();

      const timeoutId = setTimeout(
        () => {
          this.handleTimeout(confirmationId);
        },
        Math.max(effectiveTimeout, 0),
      );

      this.confirmationPromises.set(confirmationId, {
        resolve,
        reject,
        timeoutId,
      });
    });
  }

  /**
   * 响应确认请求
   */
  respondToConfirmation(
    confirmationId: string,
    selectedOption: string,
    data?: unknown,
  ): boolean {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation) {
      logger.warn({ confirmationId }, "ConfirmationService: 确认请求不存在");
      return false;
    }

    if (confirmation.status !== "pending") {
      logger.warn(
        { confirmationId, status: confirmation.status },
        "ConfirmationService: 确认请求已处理",
      );
      return false;
    }

    // 检查是否已过期
    if (new Date() > confirmation.expiresAt) {
      confirmation.status = "expired";
      this.resolvePromise(confirmationId, {
        confirmed: false,
        selectedOption: "",
        status: "expired",
      });
      return false;
    }

    // 更新状态
    const isConfirmed = selectedOption !== "cancel";
    confirmation.status = isConfirmed ? "confirmed" : "cancelled";
    confirmation.response = {
      id: confirmationId,
      selectedOption,
      data,
      respondedAt: new Date(),
    };

    logger.debug(
      {
        confirmationId,
        selectedOption,
        isConfirmed,
        source: confirmation.source,
      },
      "ConfirmationService: 处理确认响应",
    );

    // 解析 Promise
    this.resolvePromise(confirmationId, {
      confirmed: isConfirmed,
      selectedOption,
      status: confirmation.status,
      data,
      contextData: confirmation.contextData,
    });

    return true;
  }

  /**
   * 取消确认请求
   */
  cancelConfirmation(confirmationId: string, reason?: string): void {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (!confirmation || confirmation.status !== "pending") {
      return;
    }

    confirmation.status = "cancelled";

    logger.debug(
      { confirmationId, reason },
      "ConfirmationService: 取消确认请求",
    );

    this.resolvePromise(confirmationId, {
      confirmed: false,
      selectedOption: "cancel",
      status: "cancelled",
    });
  }

  /**
   * 获取确认请求
   */
  getConfirmation(confirmationId: string): PendingConfirmation | undefined {
    return this.pendingConfirmations.get(confirmationId);
  }

  /**
   * 获取用户的待确认请求
   */
  getPendingByUser(userId: string): PendingConfirmation[] {
    return Array.from(this.pendingConfirmations.values())
      .filter((c) => c.userId === userId && c.status === "pending")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * 获取 Tool 的待确认请求
   */
  getPendingByTool(toolName: string): PendingConfirmation[] {
    return Array.from(this.pendingConfirmations.values())
      .filter(
        (c) =>
          c.source === "tool" &&
          c.toolName === toolName &&
          c.status === "pending",
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * 获取 Skill 的待确认请求
   */
  getPendingBySkill(skillId: string): PendingConfirmation[] {
    return Array.from(this.pendingConfirmations.values())
      .filter(
        (c) =>
          c.source === "skill" &&
          c.skillId === skillId &&
          c.status === "pending",
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    pending: number;
    bySource: Record<ConfirmationSource, number>;
    byStatus: Record<ConfirmationStatus, number>;
  } {
    const stats = {
      total: this.pendingConfirmations.size,
      pending: 0,
      bySource: { tool: 0, skill: 0 } as Record<ConfirmationSource, number>,
      byStatus: {
        pending: 0,
        confirmed: 0,
        rejected: 0,
        expired: 0,
        cancelled: 0,
      } as Record<ConfirmationStatus, number>,
    };

    for (const confirmation of this.pendingConfirmations.values()) {
      stats.bySource[confirmation.source]++;
      stats.byStatus[confirmation.status]++;

      if (confirmation.status === "pending") {
        stats.pending++;
      }
    }

    return stats;
  }

  /**
   * 清理过期确认
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, confirmation] of this.pendingConfirmations.entries()) {
      if (confirmation.status === "pending" && now > confirmation.expiresAt) {
        confirmation.status = "expired";
        this.resolvePromise(id, {
          confirmed: false,
          selectedOption: "",
          status: "expired",
        });
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, "ConfirmationService: 清理过期确认请求");
    }

    return cleanedCount;
  }

  /**
   * 停止服务
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 取消所有待处理的确认
    for (const [id, promiseData] of this.confirmationPromises.entries()) {
      if (promiseData.timeoutId) {
        clearTimeout(promiseData.timeoutId);
      }
      promiseData.reject(new Error("ConfirmationService 已关闭"));
      this.confirmationPromises.delete(id);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `confirm_${timestamp}_${random}`;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupIntervalMs);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private enforceLimit(): void {
    if (this.pendingConfirmations.size >= this.config.maxPendingConfirmations) {
      this.cleanupExpired();

      if (
        this.pendingConfirmations.size >= this.config.maxPendingConfirmations
      ) {
        // 删除最旧的
        const oldest = this.findOldestPending();
        if (oldest) {
          this.cancelConfirmation(oldest, "达到最大待确认数量限制");
        }
      }
    }
  }

  private findOldestPending(): string | undefined {
    let oldestId: string | undefined;
    let oldestTime = Infinity;

    for (const [id, confirmation] of this.pendingConfirmations.entries()) {
      if (
        confirmation.status === "pending" &&
        confirmation.createdAt.getTime() < oldestTime
      ) {
        oldestId = id;
        oldestTime = confirmation.createdAt.getTime();
      }
    }

    return oldestId;
  }

  private handleTimeout(confirmationId: string): void {
    const confirmation = this.pendingConfirmations.get(confirmationId);

    if (confirmation && confirmation.status === "pending") {
      confirmation.status = "expired";
      this.resolvePromise(confirmationId, {
        confirmed: false,
        selectedOption: "",
        status: "expired",
      });
    }
  }

  private resolvePromise(
    confirmationId: string,
    result: ConfirmationResult,
  ): void {
    const promiseData = this.confirmationPromises.get(confirmationId);

    if (promiseData) {
      if (promiseData.timeoutId) {
        clearTimeout(promiseData.timeoutId);
      }
      promiseData.resolve(result);
      this.confirmationPromises.delete(confirmationId);
    }
  }

  private getResultFromConfirmation(
    confirmation: PendingConfirmation,
  ): ConfirmationResult {
    return {
      confirmed: confirmation.status === "confirmed",
      selectedOption: confirmation.response?.selectedOption ?? "",
      status: confirmation.status,
      data: confirmation.response?.data,
      contextData: confirmation.contextData,
    };
  }

  private async emitConfirmationEffect(
    confirmation: PendingConfirmation,
  ): Promise<void> {
    const effect: ConfirmationEffect = {
      type: "confirmation",
      payload: {
        id: confirmation.id,
        title: confirmation.title,
        message: confirmation.message,
        options: confirmation.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          variant: opt.danger
            ? "destructive"
            : opt.primary
              ? "default"
              : "outline",
          isDefault: opt.primary,
          description: opt.description,
        })),
        preview: confirmation.preview,
        timeout:
          confirmation.expiresAt.getTime() - confirmation.createdAt.getTime(),
        metadata: {
          source: confirmation.source,
          toolName: confirmation.toolName,
          skillId: confirmation.skillId,
          stepIndex: confirmation.stepIndex,
        },
      },
      context: confirmation.effectContext ?? {
        requestId: confirmation.id,
        userId: confirmation.userId ?? "unknown",
        mode: confirmation.source === "tool" ? "atomic" : "orchestration",
        source: confirmation.source,
      },
    };

    await this.effectManager.emitConfirmation(effect);
  }
}

// ============================================
// 工厂函数和单例
// ============================================

/**
 * 创建确认服务
 */
export function createConfirmationService(
  config?: Partial<ConfirmationServiceConfig>,
  manager?: EffectManager,
): ConfirmationService {
  return new ConfirmationService(config, manager);
}

/**
 * 默认确认服务实例
 */
export const confirmationService = new ConfirmationService();
