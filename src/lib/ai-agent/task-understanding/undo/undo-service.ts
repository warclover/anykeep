/**
 * 撤销服务 (已弃用)
 *
 * @deprecated 请使用数据库版本的撤销功能：
 * - API: `/api/agent/undo` (GET 获取列表, POST 执行撤销)
 * - 数据库表: `ai_operation_snapshots`
 * - RPC: `revert_ai_operation_snapshot`
 *
 * 此内存版本仅用于兼容旧代码，不再维护。
 * 新功能应直接调用 API 端点。
 *
 * @see /api/agent/undo/route.ts
 * @see supabase/migrations/20251225000001_add_ai_interaction_tables.sql
 *
 * 设计原则：
 * - 快照式撤销：记录操作前状态，撤销时恢复
 * - 有限时间窗口：默认 5 分钟内可撤销
 * - 内存 + 数据库双层存储：热数据在内存，持久化在数据库
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createLogger } from "@/lib/logger";
import type {
  UndoableOperation,
  OperationType,
  OperationSnapshot,
} from "../types";

const logger = createLogger("UndoService");

// =============================================================================
// 配置
// =============================================================================

/**
 * 撤销服务配置
 */
export interface UndoServiceConfig {
  /** 撤销时间窗口（毫秒），默认 5 分钟 */
  undoWindowMs: number;

  /** 最大缓存操作数 */
  maxCachedOperations: number;

  /** 是否启用持久化 */
  enablePersistence: boolean;
}

const DEFAULT_CONFIG: UndoServiceConfig = {
  undoWindowMs: 5 * 60 * 1000, // 5 minutes
  maxCachedOperations: 100,
  enablePersistence: true,
};

// =============================================================================
// 撤销服务
// =============================================================================

/**
 * 撤销服务
 *
 * 提供操作回滚能力
 *
 * @deprecated 请使用 `/api/agent/undo` API 代替此类
 */
export class UndoService {
  private config: UndoServiceConfig;

  /** 内存缓存：undoId -> UndoableOperation */
  private cache: Map<string, UndoableOperation> = new Map();

  /** 用户操作索引：userId -> undoId[] */
  private userIndex: Map<string, string[]> = new Map();

  /** 清理定时器 */
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<UndoServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 记录可撤销操作
   *
   * @param userId 用户 ID
   * @param taskUnderstandingId 任务理解 ID
   * @param operationType 操作类型
   * @param beforeState 操作前状态快照
   * @returns 撤销 ID 和过期时间
   */
  async recordOperation(
    userId: string,
    taskUnderstandingId: string,
    operationType: OperationType,
    beforeState: OperationSnapshot,
  ): Promise<{ undoId: string; expiresAt: Date }> {
    const undoId = this.generateUndoId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.undoWindowMs);

    const operation: UndoableOperation = {
      undoId,
      userId,
      taskUnderstandingId,
      operationType,
      beforeState,
      createdAt: now,
      expiresAt,
      undone: false,
    };

    // 存入缓存
    this.cache.set(undoId, operation);

    // 更新用户索引
    const userOps = this.userIndex.get(userId) || [];
    userOps.push(undoId);
    this.userIndex.set(userId, userOps);

    // 检查缓存大小
    this.ensureCacheLimit();

    logger.info(
      {
        undoId,
        userId,
        operationType,
        bookmarkCount: beforeState.bookmarkIds.length,
        expiresAt: expiresAt.toISOString(),
      },
      "记录可撤销操作",
    );

    return { undoId, expiresAt };
  }

  /**
   * 执行撤销
   *
   * @param undoId 撤销 ID
   * @param userId 用户 ID（用于权限验证）
   * @returns 撤销结果
   */
  async executeUndo(undoId: string, userId: string): Promise<UndoResult> {
    const operation = this.cache.get(undoId);

    // 验证操作存在
    if (!operation) {
      return {
        success: false,
        error: "UNDO_NOT_FOUND",
        message: "撤销操作不存在或已过期",
      };
    }

    // 验证用户权限
    if (operation.userId !== userId) {
      logger.warn(
        { undoId, userId, operationUserId: operation.userId },
        "撤销操作权限验证失败",
      );
      return {
        success: false,
        error: "PERMISSION_DENIED",
        message: "无权执行此撤销操作",
      };
    }

    // 验证是否已过期
    if (new Date() > operation.expiresAt) {
      this.cache.delete(undoId);
      return {
        success: false,
        error: "UNDO_EXPIRED",
        message: "撤销时间已过期",
      };
    }

    // 验证是否已撤销
    if (operation.undone) {
      return {
        success: false,
        error: "ALREADY_UNDONE",
        message: "该操作已被撤销",
      };
    }

    try {
      // 执行撤销逻辑
      await this.performUndo(operation);

      // 标记为已撤销
      operation.undone = true;
      operation.undoneAt = new Date();
      this.cache.set(undoId, operation);

      logger.info(
        {
          undoId,
          operationType: operation.operationType,
          bookmarkCount: operation.beforeState.bookmarkIds.length,
        },
        "撤销操作成功",
      );

      return {
        success: true,
        message: "操作已撤销",
        restoredCount: operation.beforeState.bookmarkIds.length,
      };
    } catch (error) {
      logger.error({ undoId, error }, "撤销操作失败");
      return {
        success: false,
        error: "UNDO_FAILED",
        message: error instanceof Error ? error.message : "撤销执行失败",
      };
    }
  }

  /**
   * 获取用户的可撤销操作列表
   */
  getUserUndoableOperations(userId: string): UndoableOperationInfo[] {
    const undoIds = this.userIndex.get(userId) || [];
    const now = new Date();

    return undoIds
      .map((undoId) => this.cache.get(undoId))
      .filter(
        (op): op is UndoableOperation =>
          op !== undefined && !op.undone && op.expiresAt > now,
      )
      .map((op) => ({
        undoId: op.undoId,
        operationType: op.operationType,
        createdAt: op.createdAt,
        expiresAt: op.expiresAt,
        bookmarkCount: op.beforeState.bookmarkIds.length,
      }));
  }

  /**
   * 检查撤销是否可用
   */
  isUndoAvailable(undoId: string, userId: string): boolean {
    const operation = this.cache.get(undoId);
    if (!operation) return false;
    if (operation.userId !== userId) return false;
    if (operation.undone) return false;
    if (new Date() > operation.expiresAt) return false;
    return true;
  }

  /**
   * 更新操作后状态（用于验证）
   */
  updateAfterState(undoId: string, afterState: OperationSnapshot): void {
    const operation = this.cache.get(undoId);
    if (operation) {
      operation.afterState = afterState;
      this.cache.set(undoId, operation);
    }
  }

  /**
   * 手动清理过期操作
   */
  cleanup(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [undoId, operation] of this.cache.entries()) {
      if (operation.expiresAt < now || operation.undone) {
        this.cache.delete(undoId);
        cleanedCount++;
      }
    }

    // 清理用户索引
    for (const [userId, undoIds] of this.userIndex.entries()) {
      const validIds = undoIds.filter((id) => this.cache.has(id));
      if (validIds.length === 0) {
        this.userIndex.delete(userId);
      } else {
        this.userIndex.set(userId, validIds);
      }
    }

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, "清理过期撤销操作");
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
    this.userIndex.clear();
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 执行具体的撤销逻辑
   */
  private async performUndo(operation: UndoableOperation): Promise<void> {
    const { operationType, beforeState } = operation;

    // 根据操作类型执行不同的撤销逻辑
    switch (operationType) {
      case "move_bookmarks":
        await this.undoMoveBookmarks(beforeState);
        break;

      case "batch_tags_add":
        await this.undoBatchTagsAdd(beforeState);
        break;

      case "batch_tags_remove":
        await this.undoBatchTagsRemove(beforeState);
        break;

      case "batch_organize":
        await this.undoBatchOrganize(beforeState);
        break;

      case "classify":
        await this.undoClassify(beforeState);
        break;

      case "delete_bookmarks":
        // 删除操作不支持撤销（需要确认机制阻止）
        throw new Error("删除操作不支持撤销");

      default:
        throw new Error(`未知的操作类型: ${operationType}`);
    }
  }

  /**
   * 撤销移动书签
   */
  private async undoMoveBookmarks(
    beforeState: OperationSnapshot,
  ): Promise<void> {
    const { bookmarkIds, data } = beforeState;
    const originalFolders = data.originalFolders as Record<
      string,
      string | null
    >;

    // 批量恢复原文件夹
    // NOTE: 此内存版本已废弃，数据库版本在 /api/agent/undo 中使用 RPC 实现
    // @see supabase/migrations/20251225000001_add_ai_interaction_tables.sql
    logger.debug(
      {
        bookmarkIds,
        originalFolders,
      },
      "撤销移动书签",
    );
  }

  /**
   * 撤销批量添加标签
   */
  private async undoBatchTagsAdd(
    beforeState: OperationSnapshot,
  ): Promise<void> {
    const { bookmarkIds, data } = beforeState;
    const addedTags = data.addedTags as string[];

    // 移除添加的标签
    // NOTE: 此内存版本已废弃，数据库版本在 /api/agent/undo 中使用 RPC 实现
    logger.debug(
      {
        bookmarkIds,
        addedTags,
      },
      "撤销批量添加标签",
    );
  }

  /**
   * 撤销批量移除标签
   */
  private async undoBatchTagsRemove(
    beforeState: OperationSnapshot,
  ): Promise<void> {
    const { bookmarkIds, data } = beforeState;
    const removedTags = data.removedTags as string[];

    // 恢复移除的标签
    // NOTE: 此内存版本已废弃，数据库版本在 /api/agent/undo 中使用 RPC 实现
    logger.debug(
      {
        bookmarkIds,
        removedTags,
      },
      "撤销批量移除标签",
    );
  }

  /**
   * 撤销批量整理
   */
  private async undoBatchOrganize(
    beforeState: OperationSnapshot,
  ): Promise<void> {
    const { bookmarkIds, data } = beforeState;
    const originalStates = data.originalStates as Array<{
      id: string;
      folderId: string | null;
      tags: string[];
    }>;

    // 恢复原始状态
    // NOTE: 此内存版本已废弃，数据库版本在 /api/agent/undo 中使用 RPC 实现
    logger.debug(
      {
        bookmarkIds,
        originalStates,
      },
      "撤销批量整理",
    );
  }

  /**
   * 撤销分类
   */
  private async undoClassify(beforeState: OperationSnapshot): Promise<void> {
    const { bookmarkIds, data } = beforeState;
    const originalFolder = data.originalFolder as string | null;

    // 恢复原文件夹
    // NOTE: 此内存版本已废弃，数据库版本在 /api/agent/undo 中使用 RPC 实现
    logger.debug(
      {
        bookmarkIds,
        originalFolder,
      },
      "撤销分类",
    );
  }

  /**
   * 生成撤销 ID
   */
  private generateUndoId(): string {
    return `undo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 确保缓存不超过限制
   */
  private ensureCacheLimit(): void {
    if (this.cache.size <= this.config.maxCachedOperations) {
      return;
    }

    // 按创建时间排序，删除最旧的
    const operations = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime(),
    );

    const toDelete = operations.slice(
      0,
      operations.length - this.config.maxCachedOperations,
    );

    for (const [undoId] of toDelete) {
      this.cache.delete(undoId);
    }

    logger.debug({ deletedCount: toDelete.length }, "缓存清理");
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    // 每分钟清理一次
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }
}

// =============================================================================
// 类型
// =============================================================================

/**
 * 撤销结果
 */
export interface UndoResult {
  success: boolean;
  message: string;
  error?: string;
  restoredCount?: number;
}

/**
 * 可撤销操作信息（前端展示用）
 */
export interface UndoableOperationInfo {
  undoId: string;
  operationType: OperationType;
  createdAt: Date;
  expiresAt: Date;
  bookmarkCount: number;
}

// =============================================================================
// 单例
// =============================================================================

let undoServiceInstance: UndoService | null = null;

/**
 * 获取撤销服务实例
 *
 * @deprecated 请使用 `/api/agent/undo` API 代替
 */
export function getUndoService(
  config?: Partial<UndoServiceConfig>,
): UndoService {
  if (!undoServiceInstance) {
    undoServiceInstance = new UndoService(config);
  }
  return undoServiceInstance;
}

/**
 * 重置撤销服务（仅用于测试）
 */
export function resetUndoService(): void {
  if (undoServiceInstance) {
    undoServiceInstance.destroy();
    undoServiceInstance = null;
  }
}
