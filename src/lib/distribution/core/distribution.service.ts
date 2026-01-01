/**
 * 分发服务核心
 *
 * @module distribution/core
 * @description 分发服务的核心编排逻辑，统一管理所有分发目标的执行
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DistributionTarget,
  DistributionResult,
  DistributionRecord,
  DistributionBookmark,
  DistributionFilters,
  ValidationResult,
  TestConnectionResult,
  DistributionTargetType,
} from "../types";
import type { DistributionRegistry } from "./distribution.registry";
import {
  TargetNotFoundError,
  TargetDisabledError,
  AdapterNotFoundError,
  PlatformNotSupportedError,
  DistributionInProgressError,
  DistributionTimeoutError,
} from "../errors";

/**
 * 分发服务配置
 */
export interface DistributionServiceConfig {
  /** 分发超时时间（毫秒） */
  timeoutMs?: number;
  /** 是否记录分发记录到数据库 */
  persistRecords?: boolean;
  /** 批量处理大小 */
  batchSize?: number;
}

const DEFAULT_CONFIG: Required<DistributionServiceConfig> = {
  timeoutMs: 30000,
  persistRecords: true,
  batchSize: 100,
};

/**
 * 创建分发目标的输入参数
 */
export interface CreateTargetInput {
  userId: string;
  targetType: DistributionTargetType;
  name: string;
  trigger: {
    mode: "realtime" | "scheduled" | "manual";
    scheduleIntervalMinutes?: number;
  };
  filters?: DistributionFilters;
  targetConfig: Record<string, unknown>;
}

/**
 * 更新分发目标的输入参数
 */
export interface UpdateTargetInput {
  name?: string;
  enabled?: boolean;
  trigger?: {
    mode: "realtime" | "scheduled" | "manual";
    scheduleIntervalMinutes?: number;
  };
  filters?: DistributionFilters;
  targetConfig?: Record<string, unknown>;
}

/**
 * 分发服务
 *
 * 核心编排服务，统一管理所有分发目标的执行
 *
 * @example
 * ```typescript
 * const registry = new DistributionRegistry();
 * registry.register(new ObsidianAdapter());
 *
 * const service = new DistributionService(registry, supabase);
 *
 * // 执行分发
 * const result = await service.distribute('target-id', ['bookmark-1', 'bookmark-2']);
 *
 * // 创建分发目标
 * const target = await service.createTarget({
 *   userId: 'user-1',
 *   targetType: 'obsidian',
 *   name: '我的 Obsidian',
 *   trigger: { mode: 'manual' },
 *   targetConfig: { vaultPath: '/path/to/vault' },
 * });
 * ```
 */
export class DistributionService {
  private readonly config: Required<DistributionServiceConfig>;
  private readonly runningTargets: Set<string> = new Set();

  constructor(
    private readonly registry: DistributionRegistry,
    private readonly supabase: SupabaseClient,
    config: DistributionServiceConfig = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== 分发操作 ====================

  /**
   * 执行分发
   *
   * @param targetId - 分发目标 ID
   * @param bookmarkIds - 书签 ID 列表
   * @param options - 分发选项
   * @returns 分发结果
   */
  async distribute(
    targetId: string,
    bookmarkIds: string[],
    options?: { currentPlatform?: "web" | "mobile" | "desktop" },
  ): Promise<DistributionResult> {
    // 1. 检查是否正在运行
    if (this.runningTargets.has(targetId)) {
      throw new DistributionInProgressError(targetId);
    }

    // 2. 获取目标配置
    const target = await this.getTarget(targetId);
    if (!target) {
      throw new TargetNotFoundError(targetId);
    }

    // 3. 检查目标是否启用
    if (!target.enabled) {
      throw new TargetDisabledError(targetId);
    }

    // 4. 获取适配器
    const adapter = this.registry.tryGet(target.targetType);
    if (!adapter) {
      throw new AdapterNotFoundError(target.targetType);
    }

    // 5. 检查平台支持
    if (options?.currentPlatform) {
      if (!adapter.supportedPlatforms.includes(options.currentPlatform)) {
        throw new PlatformNotSupportedError(
          target.targetType,
          adapter.supportedPlatforms,
        );
      }
    }

    // 6. 如果书签列表为空，直接返回
    if (bookmarkIds.length === 0) {
      return {
        success: true,
        distributedCount: 0,
        failedCount: 0,
        records: [],
      };
    }

    // 7. 获取书签数据
    const bookmarks = await this.getBookmarks(bookmarkIds, target.filters);

    // 8. 标记为运行中
    this.runningTargets.add(targetId);

    // 9. 更新状态为 syncing
    await this.updateTargetStatus(targetId, "syncing");

    try {
      // 10. 执行分发（带超时）
      const result = await this.executeWithTimeout(
        () => adapter.distribute(bookmarks, target),
        this.config.timeoutMs,
        targetId,
      );

      // 11. 记录结果
      if (this.config.persistRecords && result.records.length > 0) {
        await this.saveRecords(result.records);
      }

      // 12. 更新目标状态
      await this.updateTargetStatus(targetId, "idle", {
        lastSyncAt: new Date(),
        syncedCount: target.syncedCount + result.distributedCount,
        lastError: null,
      });

      return result;
    } catch (error) {
      // 13. 错误处理
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await this.updateTargetStatus(targetId, "error", {
        lastError: errorMessage,
      });

      throw error;
    } finally {
      // 14. 清理运行状态
      this.runningTargets.delete(targetId);
    }
  }

  /**
   * 检查目标是否正在分发
   */
  isDistributing(targetId: string): boolean {
    return this.runningTargets.has(targetId);
  }

  // ==================== 目标管理 ====================

  /**
   * 获取分发目标
   */
  async getTarget(targetId: string): Promise<DistributionTarget | null> {
    const { data, error } = await this.supabase
      .from("distribution_targets")
      .select("*")
      .eq("id", targetId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToTarget(data);
  }

  /**
   * 获取用户的所有分发目标
   */
  async getTargets(userId: string): Promise<DistributionTarget[]> {
    const { data, error } = await this.supabase
      .from("distribution_targets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToTarget);
  }

  /**
   * 获取用户的启用的分发目标
   */
  async getEnabledTargets(userId: string): Promise<DistributionTarget[]> {
    const { data, error } = await this.supabase
      .from("distribution_targets")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToTarget);
  }

  /**
   * 创建分发目标
   */
  async createTarget(input: CreateTargetInput): Promise<DistributionTarget> {
    // 验证适配器存在
    const adapter = this.registry.tryGet(input.targetType);
    if (!adapter) {
      throw new AdapterNotFoundError(input.targetType);
    }

    const now = new Date();
    const targetData = {
      user_id: input.userId,
      target_type: input.targetType,
      name: input.name,
      enabled: true,
      trigger_mode: input.trigger.mode,
      schedule_interval_minutes: input.trigger.scheduleIntervalMinutes,
      filter_platforms: input.filters?.platforms,
      filter_folders: input.filters?.folders,
      filter_tags: input.filters?.tags,
      include_ai_summary: input.filters?.includeAiSummary ?? true,
      target_config: input.targetConfig,
      status: "idle",
      synced_count: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data, error } = await this.supabase
      .from("distribution_targets")
      .insert(targetData)
      .select()
      .single();

    if (error) {
      throw new Error(`创建分发目标失败: ${error.message}`);
    }

    return this.mapDbToTarget(data);
  }

  /**
   * 更新分发目标
   */
  async updateTarget(
    targetId: string,
    input: UpdateTargetInput,
  ): Promise<DistributionTarget> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.enabled !== undefined) {
      updateData.enabled = input.enabled;
    }
    if (input.trigger !== undefined) {
      updateData.trigger_mode = input.trigger.mode;
      updateData.schedule_interval_minutes =
        input.trigger.scheduleIntervalMinutes;
    }
    if (input.filters !== undefined) {
      updateData.filter_platforms = input.filters.platforms;
      updateData.filter_folders = input.filters.folders;
      updateData.filter_tags = input.filters.tags;
      updateData.include_ai_summary = input.filters.includeAiSummary;
    }
    if (input.targetConfig !== undefined) {
      updateData.target_config = input.targetConfig;
    }

    const { data, error } = await this.supabase
      .from("distribution_targets")
      .update(updateData)
      .eq("id", targetId)
      .select()
      .single();

    if (error) {
      throw new Error(`更新分发目标失败: ${error.message}`);
    }

    return this.mapDbToTarget(data);
  }

  /**
   * 删除分发目标
   */
  async deleteTarget(targetId: string): Promise<void> {
    // 检查是否正在运行
    if (this.runningTargets.has(targetId)) {
      throw new DistributionInProgressError(targetId);
    }

    const { error } = await this.supabase
      .from("distribution_targets")
      .delete()
      .eq("id", targetId);

    if (error) {
      throw new Error(`删除分发目标失败: ${error.message}`);
    }
  }

  // ==================== 配置验证 ====================

  /**
   * 获取未同步的书签（增量同步用）
   *
   * @param targetId - 分发目标 ID
   * @param userId - 用户 ID
   * @param lastSyncAt - 上次同步时间，不传则获取所有
   * @returns 未同步的书签列表
   */
  async getUnsyncedBookmarks(
    targetId: string,
    userId: string,
    lastSyncAt?: Date,
  ): Promise<DistributionBookmark[]> {
    // 获取目标配置以应用筛选条件
    const target = await this.getTarget(targetId);
    if (!target) {
      return [];
    }

    // 构建查询
    let query = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, platform, description, ai_summary, tags, folder_id, created_at, updated_at",
      )
      .eq("user_id", userId);

    // 只获取上次同步后的新增书签
    if (lastSyncAt) {
      query = query.gt("created_at", lastSyncAt.toISOString());
    }

    // 应用筛选条件
    const filters = target.filters;
    if (filters?.platforms && filters.platforms.length > 0) {
      query = query.in("platform", filters.platforms);
    }
    if (filters?.folders && filters.folders.length > 0) {
      query = query.in("folder_id", filters.folders);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags);
    }

    // 排除已成功同步的书签
    const { data: syncedRecords } = await this.supabase
      .from("distribution_records")
      .select("bookmark_id")
      .eq("target_id", targetId)
      .eq("status", "success");

    const syncedBookmarkIds = (syncedRecords ?? []).map((r) => r.bookmark_id);

    // 执行查询
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error || !data) {
      return [];
    }

    // 过滤掉已同步的书签
    const unsyncedData = data.filter(
      (row) => !syncedBookmarkIds.includes(row.id),
    );

    return unsyncedData.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      platform: row.platform,
      description: row.description,
      aiSummary: filters?.includeAiSummary ? row.ai_summary : undefined,
      tags: row.tags,
      folderId: row.folder_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * 验证目标配置
   */
  async validateConfig(
    targetType: DistributionTargetType,
    targetConfig: Record<string, unknown>,
  ): Promise<ValidationResult> {
    const adapter = this.registry.tryGet(targetType);
    if (!adapter) {
      return {
        valid: false,
        errors: [`未知的分发类型: ${targetType}`],
      };
    }

    const mockTarget: DistributionTarget = {
      id: "validation",
      userId: "validation",
      targetType,
      name: "validation",
      enabled: true,
      trigger: { mode: "manual" },
      targetConfig,
      status: "idle",
      syncedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return adapter.validateConfig(mockTarget);
  }

  /**
   * 测试目标连接
   */
  async testConnection(
    targetType: DistributionTargetType,
    targetConfig: Record<string, unknown>,
  ): Promise<TestConnectionResult> {
    const adapter = this.registry.tryGet(targetType);
    if (!adapter) {
      return {
        success: false,
        error: `未知的分发类型: ${targetType}`,
      };
    }

    const mockTarget: DistributionTarget = {
      id: "test",
      userId: "test",
      targetType,
      name: "test",
      enabled: true,
      trigger: { mode: "manual" },
      targetConfig,
      status: "idle",
      syncedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return adapter.testConnection(mockTarget);
  }

  // ==================== 私有方法 ====================

  /**
   * 获取书签数据
   */
  private async getBookmarks(
    bookmarkIds: string[],
    filters?: DistributionFilters,
  ): Promise<DistributionBookmark[]> {
    let query = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, platform, description, ai_summary, tags, folder_id, created_at, updated_at",
      )
      .in("id", bookmarkIds);

    // 应用筛选条件
    if (filters?.platforms && filters.platforms.length > 0) {
      query = query.in("platform", filters.platforms);
    }
    if (filters?.folders && filters.folders.length > 0) {
      query = query.in("folder_id", filters.folders);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      platform: row.platform,
      description: row.description,
      aiSummary: filters?.includeAiSummary ? row.ai_summary : undefined,
      tags: row.tags,
      folderId: row.folder_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * 更新目标状态
   */
  private async updateTargetStatus(
    targetId: string,
    status: "idle" | "syncing" | "error",
    extra?: {
      lastSyncAt?: Date;
      syncedCount?: number;
      lastError?: string | null;
    },
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (extra?.lastSyncAt) {
      updateData.last_sync_at = extra.lastSyncAt.toISOString();
    }
    if (extra?.syncedCount !== undefined) {
      updateData.synced_count = extra.syncedCount;
    }
    if (extra?.lastError !== undefined) {
      updateData.last_error = extra.lastError;
    }

    await this.supabase
      .from("distribution_targets")
      .update(updateData)
      .eq("id", targetId);
  }

  /**
   * 保存分发记录
   */
  private async saveRecords(records: DistributionRecord[]): Promise<void> {
    const dbRecords = records.map((record) => ({
      id: record.id,
      target_id: record.targetId,
      bookmark_id: record.bookmarkId,
      status: record.status,
      distributed_at: record.distributedAt?.toISOString(),
      external_id: record.externalId,
      error_message: record.errorMessage,
      retry_count: record.retryCount,
      created_at: record.createdAt.toISOString(),
    }));

    // 使用 upsert 处理重复记录
    await this.supabase.from("distribution_records").upsert(dbRecords, {
      onConflict: "target_id,bookmark_id",
      ignoreDuplicates: false,
    });
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    targetId: string,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new DistributionTimeoutError(targetId, timeoutMs)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * 数据库记录转换为 DistributionTarget
   */
  private mapDbToTarget(row: Record<string, unknown>): DistributionTarget {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      targetType: row.target_type as DistributionTargetType,
      name: row.name as string,
      enabled: row.enabled as boolean,
      trigger: {
        mode: row.trigger_mode as "realtime" | "scheduled" | "manual",
        scheduleIntervalMinutes: row.schedule_interval_minutes as
          | number
          | undefined,
      },
      filters: {
        platforms: row.filter_platforms as string[] | undefined,
        folders: row.filter_folders as string[] | undefined,
        tags: row.filter_tags as string[] | undefined,
        includeAiSummary: row.include_ai_summary as boolean | undefined,
      },
      targetConfig: row.target_config as Record<string, unknown>,
      status: row.status as "idle" | "syncing" | "error",
      lastSyncAt: row.last_sync_at
        ? new Date(row.last_sync_at as string)
        : undefined,
      lastError: row.last_error as string | undefined,
      syncedCount: row.synced_count as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
