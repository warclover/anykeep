/**
 * AuditLogService - 审计日志服务
 *
 * 记录系统操作审计日志，用于追踪和合规
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { EffectContext, AuditEffect, AuditAction } from "../types";
import type { EffectManager } from "../effect-manager";
import { effectManager } from "../effect-manager";

// ============================================
// 类型定义
// ============================================

/**
 * 审计日志记录
 */
export interface AuditLogEntry {
  /** 日志 ID */
  id: string;
  /** 操作类型 */
  action: AuditAction;
  /** 资源类型 */
  resourceType: string;
  /** 资源 ID 列表 */
  resourceIds: string[];
  /** 变更详情 */
  changes?: Record<string, unknown>;
  /** 操作时间 */
  timestamp: Date;
  /** 用户 ID */
  userId?: string;
  /** 请求 ID */
  requestId?: string;
  /** 来源 */
  source?: "tool" | "skill";
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 审计日志请求选项
 */
export interface AuditLogRequestOptions {
  /** 操作类型 */
  action: AuditAction;
  /** 资源类型 */
  resourceType: string;
  /** 资源 ID 列表 */
  resourceIds: string[];
  /** 变更详情 */
  changes?: Record<string, unknown>;
  /** 用户 ID */
  userId?: string;
  /** 请求 ID */
  requestId?: string;
  /** 来源 */
  source?: "tool" | "skill";
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** Effect 上下文 */
  effectContext?: EffectContext;
}

/**
 * 服务配置
 */
export interface AuditLogServiceConfig {
  /** 最大日志数量 */
  maxLogs: number;
  /** 是否自动发出 Effect */
  emitEffects: boolean;
  /** 是否持久化（未来扩展） */
  persist: boolean;
}

/**
 * 日志查询选项
 */
export interface AuditLogQueryOptions {
  /** 用户 ID */
  userId?: string;
  /** 操作类型 */
  action?: AuditAction;
  /** 资源类型 */
  resourceType?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: AuditLogServiceConfig = {
  maxLogs: 1000,
  emitEffects: true,
  persist: false,
};

// ============================================
// AuditLogService 实现
// ============================================

/**
 * 审计日志服务
 *
 * @example
 * ```typescript
 * const service = new AuditLogService();
 *
 * // 记录删除操作
 * await service.log({
 *   action: 'delete',
 *   resourceType: 'bookmark',
 *   resourceIds: ['bm_1', 'bm_2'],
 *   userId: 'user_123',
 * });
 *
 * // 记录批量移动操作
 * await service.logMove('bookmark', ['bm_1', 'bm_2'], {
 *   from: { folderId: 'folder_1' },
 *   to: { folderId: 'folder_2' },
 * }, 'user_123');
 *
 * // 查询日志
 * const logs = service.query({ userId: 'user_123', action: 'delete' });
 * ```
 */
export class AuditLogService {
  private config: AuditLogServiceConfig;
  private effectManager: EffectManager;
  private logs: Map<string, AuditLogEntry>;

  constructor(
    config: Partial<AuditLogServiceConfig> = {},
    manager?: EffectManager,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.effectManager = manager ?? effectManager;
    this.logs = new Map();
  }

  /**
   * 记录审计日志
   */
  async log(options: AuditLogRequestOptions): Promise<string> {
    const id = this.generateId();
    const now = new Date();

    const entry: AuditLogEntry = {
      id,
      action: options.action,
      resourceType: options.resourceType,
      resourceIds: options.resourceIds,
      changes: options.changes,
      timestamp: now,
      userId: options.userId,
      requestId: options.requestId,
      source: options.source,
      metadata: options.metadata,
    };

    this.logs.set(id, entry);
    this.enforceLimit();

    logger.debug(
      {
        logId: id,
        action: options.action,
        resourceType: options.resourceType,
        resourceCount: options.resourceIds.length,
      },
      "AuditLogService: 记录审计日志",
    );

    // 发出 Effect
    if (this.config.emitEffects) {
      await this.emitAuditEffect(entry, options);
    }

    return id;
  }

  /**
   * 记录创建操作
   */
  async logCreate(
    resourceType: string,
    resourceIds: string[],
    changes?: Record<string, unknown>,
    userId?: string,
  ): Promise<string> {
    return this.log({
      action: "create",
      resourceType,
      resourceIds,
      changes,
      userId,
    });
  }

  /**
   * 记录更新操作
   */
  async logUpdate(
    resourceType: string,
    resourceIds: string[],
    changes?: Record<string, unknown>,
    userId?: string,
  ): Promise<string> {
    return this.log({
      action: "update",
      resourceType,
      resourceIds,
      changes,
      userId,
    });
  }

  /**
   * 记录删除操作
   */
  async logDelete(
    resourceType: string,
    resourceIds: string[],
    changes?: Record<string, unknown>,
    userId?: string,
  ): Promise<string> {
    return this.log({
      action: "delete",
      resourceType,
      resourceIds,
      changes,
      userId,
    });
  }

  /**
   * 记录移动操作
   */
  async logMove(
    resourceType: string,
    resourceIds: string[],
    changes?: Record<string, unknown>,
    userId?: string,
  ): Promise<string> {
    return this.log({
      action: "move",
      resourceType,
      resourceIds,
      changes,
      userId,
    });
  }

  /**
   * 记录导出操作
   */
  async logExport(
    resourceType: string,
    resourceIds: string[],
    changes?: Record<string, unknown>,
    userId?: string,
  ): Promise<string> {
    return this.log({
      action: "export",
      resourceType,
      resourceIds,
      changes,
      userId,
    });
  }

  /**
   * 记录导入操作
   */
  async logImport(
    resourceType: string,
    resourceIds: string[],
    changes?: Record<string, unknown>,
    userId?: string,
  ): Promise<string> {
    return this.log({
      action: "import",
      resourceType,
      resourceIds,
      changes,
      userId,
    });
  }

  /**
   * 获取日志
   */
  getLog(logId: string): AuditLogEntry | undefined {
    return this.logs.get(logId);
  }

  /**
   * 查询日志
   */
  query(options: AuditLogQueryOptions = {}): AuditLogEntry[] {
    let results = Array.from(this.logs.values());

    // 过滤条件
    if (options.userId) {
      results = results.filter((l) => l.userId === options.userId);
    }
    if (options.action) {
      results = results.filter((l) => l.action === options.action);
    }
    if (options.resourceType) {
      results = results.filter((l) => l.resourceType === options.resourceType);
    }
    if (options.startTime) {
      results = results.filter(
        (l) => options.startTime && l.timestamp >= options.startTime,
      );
    }
    if (options.endTime) {
      results = results.filter(
        (l) => options.endTime && l.timestamp <= options.endTime,
      );
    }

    // 排序（最新在前）
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 分页
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 获取用户日志
   */
  getLogsByUser(userId: string, limit?: number): AuditLogEntry[] {
    return this.query({ userId, limit });
  }

  /**
   * 获取资源日志
   */
  getLogsByResource(resourceType: string, resourceId: string): AuditLogEntry[] {
    return Array.from(this.logs.values())
      .filter(
        (l) =>
          l.resourceType === resourceType && l.resourceIds.includes(resourceId),
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byAction: Record<AuditAction, number>;
    byResourceType: Record<string, number>;
  } {
    const stats = {
      total: this.logs.size,
      byAction: {
        create: 0,
        update: 0,
        delete: 0,
        move: 0,
        export: 0,
        import: 0,
      } as Record<AuditAction, number>,
      byResourceType: {} as Record<string, number>,
    };

    for (const log of this.logs.values()) {
      stats.byAction[log.action]++;
      stats.byResourceType[log.resourceType] =
        (stats.byResourceType[log.resourceType] || 0) + 1;
    }

    return stats;
  }

  /**
   * 清除所有日志
   */
  clearAll(): void {
    this.logs.clear();
  }

  /**
   * 清除用户日志
   */
  clearByUser(userId: string): number {
    let cleared = 0;
    for (const [id, log] of this.logs.entries()) {
      if (log.userId === userId) {
        this.logs.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  // ============================================
  // 私有方法
  // ============================================

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `audit_${timestamp}_${random}`;
  }

  private enforceLimit(): void {
    if (this.logs.size > this.config.maxLogs) {
      // 删除最旧的日志
      const sorted = Array.from(this.logs.entries()).sort(
        ([_, a], [__, b]) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      for (const [id] of sorted.slice(
        0,
        this.logs.size - this.config.maxLogs,
      )) {
        this.logs.delete(id);
      }
    }
  }

  private async emitAuditEffect(
    entry: AuditLogEntry,
    options: AuditLogRequestOptions,
  ): Promise<void> {
    const effect: AuditEffect = {
      type: "audit",
      payload: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceIds: entry.resourceIds,
        changes: entry.changes,
        timestamp: entry.timestamp.toISOString(),
      },
      context: options.effectContext ?? {
        requestId: entry.requestId ?? entry.id,
        userId: entry.userId ?? "unknown",
        mode: "atomic",
        source: entry.source ?? "skill",
      },
    };

    await this.effectManager.emitAudit(effect);
  }
}

// ============================================
// 工厂函数和单例
// ============================================

/**
 * 创建审计日志服务
 */
export function createAuditLogService(
  config?: Partial<AuditLogServiceConfig>,
  manager?: EffectManager,
): AuditLogService {
  return new AuditLogService(config, manager);
}

/**
 * 默认审计日志服务实例
 */
export const auditLogService = new AuditLogService();
