/**
 * Saga Orchestrator - 事务编排器
 *
 * 为整理操作提供 Saga Pattern 支持：
 * - 步骤管理：按顺序执行步骤
 * - 快照创建：每步骤前创建快照
 * - 补偿机制：失败时自动回滚
 * - 撤销支持：支持显式撤销操作
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import {
  SnapshotManager,
  type OrganizeSnapshotAction,
  type BookmarkStateSnapshot,
  type OrganizeOperationSnapshot,
  type UndoResult,
} from "../snapshot-manager";

// ============================================
// 类型定义
// ============================================

/**
 * Saga 步骤定义
 */
export interface SagaStep<TContext, TResult> {
  /** 步骤名称 */
  name: string;
  /** 快照动作类型 */
  snapshotAction: OrganizeSnapshotAction | null;
  /** 执行函数 */
  execute: (context: TContext) => Promise<TResult>;
  /** 补偿函数（可选，默认使用快照恢复） */
  compensate?: (context: TContext, result: TResult) => Promise<void>;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否可跳过 */
  skippable?: boolean;
}

/**
 * Saga 执行上下文
 */
export interface SagaContext {
  /** 用户 ID */
  userId: string;
  /** 书签 ID 列表 */
  bookmarkIds: number[];
  /** 快照 ID 列表（用于回滚） */
  snapshotIds: string[];
  /** 步骤结果 */
  stepResults: Map<string, unknown>;
  /** 是否已取消 */
  cancelled: boolean;
}

/**
 * Saga 执行结果
 */
export interface SagaResult {
  /** 是否成功 */
  success: boolean;
  /** 完成的步骤数 */
  completedSteps: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 快照 ID 列表 */
  snapshotIds: string[];
  /** 错误信息 */
  error?: string;
  /** 步骤结果 */
  results: Record<string, unknown>;
}

/**
 * 进度回调
 */
export type ProgressCallback = (
  step: string,
  percent: number,
  message: string,
) => void;

// ============================================
// SagaOrchestrator 类
// ============================================

/**
 * Saga 编排器
 *
 * 使用示例：
 * ```typescript
 * const saga = new SagaOrchestrator()
 *   .addStep({
 *     name: 'categorize',
 *     snapshotAction: 'batch_categorize',
 *     execute: async (ctx) => { ... },
 *   })
 *   .addStep({
 *     name: 'tag',
 *     snapshotAction: 'batch_tag',
 *     execute: async (ctx) => { ... },
 *   });
 *
 * const result = await saga.execute({
 *   userId: 'user-123',
 *   bookmarkIds: [1, 2, 3],
 * });
 * ```
 */
export class SagaOrchestrator {
  private steps: SagaStep<SagaContext, unknown>[] = [];
  private snapshotManager: SnapshotManager;
  private onProgress: ProgressCallback | null = null;

  constructor(snapshotManager?: SnapshotManager) {
    this.snapshotManager = snapshotManager || new SnapshotManager();
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: ProgressCallback): this {
    this.onProgress = callback;
    return this;
  }

  /**
   * 添加步骤
   */
  addStep<TResult>(step: SagaStep<SagaContext, TResult>): this {
    this.steps.push(step as SagaStep<SagaContext, unknown>);
    return this;
  }

  /**
   * 清除所有步骤
   */
  clearSteps(): this {
    this.steps = [];
    return this;
  }

  /**
   * 执行 Saga
   */
  async execute(
    userId: string,
    bookmarkIds: number[],
    options: { skipSnapshot?: boolean } = {},
  ): Promise<SagaResult> {
    const context: SagaContext = {
      userId,
      bookmarkIds,
      snapshotIds: [],
      stepResults: new Map(),
      cancelled: false,
    };

    const completedSteps: Array<{
      step: SagaStep<SagaContext, unknown>;
      result: unknown;
      snapshotId?: string;
    }> = [];

    try {
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];

        if (context.cancelled) {
          logger.info(
            { step: step.name },
            "[SagaOrchestrator] Saga cancelled, stopping execution",
          );
          break;
        }

        // 报告进度
        const percent = Math.round(((i + 0.5) / this.steps.length) * 100);
        this.reportProgress(step.name, percent, `正在执行: ${step.name}`);

        try {
          // 创建快照（如果需要）
          let snapshotId: string | undefined;
          if (step.snapshotAction && !options.skipSnapshot) {
            snapshotId = await this.createStepSnapshot(
              context,
              step.snapshotAction,
              step.name,
            );
            context.snapshotIds.push(snapshotId);
          }

          // 执行步骤
          const result = await this.executeWithRetry(step, context);
          completedSteps.push({ step, result, snapshotId });
          context.stepResults.set(step.name, result);

          // 更新快照的 afterState
          if (snapshotId) {
            await this.updateStepSnapshot(context, snapshotId, step.name);
          }

          logger.debug(
            { step: step.name, snapshotId },
            "[SagaOrchestrator] Step completed",
          );
        } catch (stepError) {
          // 步骤失败，执行补偿
          logger.error(
            {
              step: step.name,
              error:
                stepError instanceof Error
                  ? stepError.message
                  : String(stepError),
            },
            "[SagaOrchestrator] Step failed, starting compensation",
          );

          // 如果步骤可跳过，继续执行
          if (step.skippable) {
            logger.info(
              { step: step.name },
              "[SagaOrchestrator] Skipping failed step",
            );
            continue;
          }

          // 执行补偿（逆序）
          await this.compensate(context, completedSteps);

          return {
            success: false,
            completedSteps: completedSteps.length,
            totalSteps: this.steps.length,
            snapshotIds: context.snapshotIds,
            error:
              stepError instanceof Error
                ? stepError.message
                : String(stepError),
            results: Object.fromEntries(context.stepResults),
          };
        }
      }

      // 完成
      this.reportProgress("完成", 100, "所有步骤执行完成");

      return {
        success: true,
        completedSteps: completedSteps.length,
        totalSteps: this.steps.length,
        snapshotIds: context.snapshotIds,
        results: Object.fromEntries(context.stepResults),
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "[SagaOrchestrator] Unexpected error",
      );

      // 执行补偿
      await this.compensate(context, completedSteps);

      return {
        success: false,
        completedSteps: completedSteps.length,
        totalSteps: this.steps.length,
        snapshotIds: context.snapshotIds,
        error: error instanceof Error ? error.message : String(error),
        results: Object.fromEntries(context.stepResults),
      };
    }
  }

  /**
   * 撤销 Saga（通过快照 ID）
   */
  async undo(snapshotId: string, userId: string): Promise<UndoResult> {
    return this.snapshotManager.undoSnapshot(snapshotId, userId);
  }

  /**
   * 撤销所有操作
   */
  async undoAll(snapshotIds: string[], userId: string): Promise<UndoResult[]> {
    const results: UndoResult[] = [];

    // 逆序撤销
    for (const snapshotId of [...snapshotIds].reverse()) {
      const result = await this.snapshotManager.undoSnapshot(
        snapshotId,
        userId,
      );
      results.push(result);

      if (!result.success) {
        logger.warn(
          { snapshotId, error: result.error },
          "[SagaOrchestrator] Failed to undo snapshot",
        );
      }
    }

    return results;
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 带重试的步骤执行
   */
  private async executeWithRetry(
    step: SagaStep<SagaContext, unknown>,
    context: SagaContext,
  ): Promise<unknown> {
    const maxRetries = step.maxRetries ?? 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (step.timeout) {
          return await this.executeWithTimeout(step, context, step.timeout);
        }
        return await step.execute(context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          logger.warn(
            { step: step.name, attempt: attempt + 1, maxRetries },
            "[SagaOrchestrator] Step failed, retrying",
          );
          // 简单的指数退避
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout(
    step: SagaStep<SagaContext, unknown>,
    context: SagaContext,
    timeout: number,
  ): Promise<unknown> {
    return Promise.race([
      step.execute(context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`步骤 ${step.name} 超时`)), timeout),
      ),
    ]);
  }

  /**
   * 创建步骤快照
   */
  private async createStepSnapshot(
    context: SagaContext,
    action: OrganizeSnapshotAction,
    stepName: string,
  ): Promise<string> {
    // 获取书签当前状态
    const beforeStates = await this.snapshotManager.captureBookmarkStates(
      context.bookmarkIds,
      context.userId,
    );

    // 构建快照数据
    const snapshotData = this.buildSnapshotData(action, beforeStates);

    // 创建快照
    const snapshot = await this.snapshotManager.createSnapshot({
      userId: context.userId,
      action,
      beforeState: snapshotData,
      bookmarkIds: context.bookmarkIds,
      reason: `整理步骤: ${stepName}`,
    });

    return snapshot.id;
  }

  /**
   * 更新步骤快照（添加 afterState）
   */
  private async updateStepSnapshot(
    context: SagaContext,
    snapshotId: string,
    stepName: string,
  ): Promise<void> {
    try {
      // 获取书签更新后的状态
      const afterStates = await this.snapshotManager.captureBookmarkStates(
        context.bookmarkIds,
        context.userId,
      );

      const snapshot = await this.snapshotManager.getSnapshot(
        snapshotId,
        context.userId,
      );
      if (!snapshot) return;

      const afterData = this.buildSnapshotData(snapshot.action, afterStates);

      await this.snapshotManager.updateSnapshot(snapshotId, {
        afterState: afterData,
      });
    } catch (error) {
      logger.warn(
        {
          snapshotId,
          stepName,
          error: error instanceof Error ? error.message : String(error),
        },
        "[SagaOrchestrator] Failed to update snapshot afterState",
      );
    }
  }

  /**
   * 构建快照数据
   */
  private buildSnapshotData(
    action: OrganizeSnapshotAction,
    states: BookmarkStateSnapshot[],
  ): OrganizeOperationSnapshot {
    switch (action) {
      case "batch_categorize":
        return {
          action: "batch_categorize",
          beforeStates: states,
          afterStates: [],
          createdFolders: [],
        };
      case "batch_tag":
        return {
          action: "batch_tag",
          beforeStates: states,
          afterStates: [],
        };
      case "batch_dedupe":
        return {
          action: "batch_dedupe",
          deletedBookmarks: [],
          keptBookmarkIds: [],
        };
      case "batch_archive":
        return {
          action: "batch_archive",
          archivedBookmarks: states,
        };
      case "batch_delete":
        return {
          action: "batch_delete",
          deletedBookmarks: states,
        };
    }
  }

  /**
   * 执行补偿操作
   */
  private async compensate(
    context: SagaContext,
    completedSteps: Array<{
      step: SagaStep<SagaContext, unknown>;
      result: unknown;
      snapshotId?: string;
    }>,
  ): Promise<void> {
    logger.info(
      { stepCount: completedSteps.length },
      "[SagaOrchestrator] Starting compensation",
    );

    // 逆序执行补偿
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const { step, result, snapshotId } = completedSteps[i];

      try {
        if (step.compensate) {
          // 使用自定义补偿函数
          await step.compensate(context, result);
          logger.debug(
            { step: step.name },
            "[SagaOrchestrator] Custom compensation completed",
          );
        } else if (snapshotId) {
          // 使用快照恢复
          const undoResult = await this.snapshotManager.undoSnapshot(
            snapshotId,
            context.userId,
          );
          logger.debug(
            { step: step.name, snapshotId, success: undoResult.success },
            "[SagaOrchestrator] Snapshot compensation completed",
          );
        }
      } catch (compensateError) {
        logger.error(
          {
            step: step.name,
            error:
              compensateError instanceof Error
                ? compensateError.message
                : String(compensateError),
          },
          "[SagaOrchestrator] Compensation failed",
        );
        // 继续执行其他补偿，不中断
      }
    }

    logger.info("[SagaOrchestrator] Compensation completed");
  }

  /**
   * 报告进度
   */
  private reportProgress(step: string, percent: number, message: string): void {
    if (this.onProgress) {
      this.onProgress(step, percent, message);
    }
  }
}

// 导出工厂函数
export function createSagaOrchestrator(
  snapshotManager?: SnapshotManager,
): SagaOrchestrator {
  return new SagaOrchestrator(snapshotManager);
}
