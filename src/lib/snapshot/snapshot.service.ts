/**
 * Snapshot Service (V4.2.1)
 * 网页快照服务 - 独立模块，不依赖分类模块
 *
 * 核心功能：
 * - 创建快照任务
 * - 查询快照详情/内容
 * - 配额管理
 * - 批量操作
 *
 * ⚠️ 类型说明：
 * 此服务使用的 RPC 函数和表（bookmark_snapshots）需要在执行迁移后
 * 运行 `npm run supabase:gen:types` 以生成完整的 TypeScript 类型。
 * 在类型生成前，部分操作使用 `any` 类型断言。
 */

import {
  createServerSupabaseClient,
  createServiceClient,
} from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  fromBookmarkSnapshots,
  rpcGetUserSnapshotQuota,
  rpcCanCreateSnapshot,
  rpcAtomicCreateSnapshot,
  rpcAtomicBatchCreateSnapshots,
} from "@/lib/supabase/typed-queries";
import type {
  SnapshotType,
  SnapshotStatus,
  BookmarkSnapshotRow,
  BookmarkSnapshotUpdate,
  SnapshotQuota,
  SnapshotSummary,
} from "./snapshot.types";

// 临时类型辅助：在迁移执行并重新生成类型前使用
type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// 使用 typed-queries 中的 fromBookmarkSnapshots 替代本地 getSnapshotsTable
const getSnapshotsTable = (supabase: SupabaseClient) =>
  fromBookmarkSnapshots(supabase);

// 本地查询结果类型定义
interface SnapshotListRow {
  id: number;
  bookmark_id: number;
  snapshot_type: string;
  status: string;
  readable_title: string | null;
  readable_excerpt: string | null;
  captured_at: string | null;
  screenshot_storage_path: string | null;
}

interface SnapshotIdRow {
  id: number;
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 创建快照选项
 */
export interface CreateSnapshotOptions {
  snapshotType?: SnapshotType;
  priority?: "low" | "normal" | "high";
  // P2-010: 触发来源
  source?: "manual" | "auto-tag" | "batch" | "scheduled" | "api";
  triggerTag?: string;
}

/**
 * 创建快照结果
 */
export interface CreateSnapshotResult {
  snapshotId: number;
  jobId: string;
  status: "pending";
  estimatedWaitTime: number;
}

/**
 * 快照查询选项
 */
export interface SnapshotQueryOptions {
  status?: SnapshotStatus | SnapshotStatus[];
  snapshotType?: SnapshotType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 快照服务类
 */
export class SnapshotService {
  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  // ==========================================================================
  // 配额管理
  // ==========================================================================

  /**
   * 获取用户快照配额
   * Note: RPC types will be available after running migration
   */
  async getUserQuota(userId: string): Promise<SnapshotQuota> {
    const supabase = await this.getSupabase();

    const { data, error } = await rpcGetUserSnapshotQuota(supabase, {
      p_user_id: userId,
    });

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[SnapshotService] Failed to get quota",
      );
      throw new Error(`获取配额失败: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      // 返回默认免费配额
      return {
        usedBytes: 0,
        quotaBytes: 52428800, // 50MB
        usedCount: 0,
        maxCount: 100,
        membership: "FREE",
        usedPercentage: 0,
        canCreate: true,
        allowedTypes: this.getAllowedSnapshotTypes("FREE"),
        expirationDays: 30,
      };
    }

    const membership = row.membership || "FREE";
    const usedPercentage =
      row.quota_bytes > 0
        ? Math.round((row.used_bytes / row.quota_bytes) * 100)
        : 0;

    return {
      usedBytes: row.used_bytes,
      quotaBytes: row.quota_bytes,
      usedCount: row.used_count,
      maxCount: row.max_count,
      membership,
      usedPercentage,
      canCreate:
        row.used_bytes < row.quota_bytes && row.used_count < row.max_count,
      allowedTypes: this.getAllowedSnapshotTypes(membership),
      expirationDays: membership === "PRO" ? null : 30,
    };
  }

  /**
   * 检查是否可以创建快照
   * Note: RPC types will be available after running migration
   */
  async canCreateSnapshot(
    userId: string,
    estimatedSize: number = 102400,
  ): Promise<boolean> {
    const supabase = await this.getSupabase();

    const { data, error } = await rpcCanCreateSnapshot(supabase, {
      p_user_id: userId,
      p_estimated_size: estimatedSize,
    });

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[SnapshotService] Failed to check quota",
      );
      return false;
    }

    return data === true;
  }

  /**
   * 获取会员等级允许的快照类型
   * - FREE: 仅 basic
   * - PRO: basic, standard, full
   */
  getAllowedSnapshotTypes(membership: string): SnapshotType[] {
    if (membership === "PRO") {
      return ["basic", "standard", "full"];
    }
    // 免费用户仅能使用 basic
    return ["basic"];
  }

  // ==========================================================================
  // 快照创建
  // ==========================================================================

  /**
   * 创建快照任务
   * V4.2.16: 使用原子化 RPC 函数，避免竞态条件
   */
  async createSnapshot(
    userId: string,
    bookmarkId: number,
    options: CreateSnapshotOptions = {},
  ): Promise<CreateSnapshotResult> {
    const supabase = await this.getSupabase();

    const snapshotType = options.snapshotType || "basic";
    const priority = options.priority || "normal";
    const priorityValue = priority === "high" ? 1 : priority === "low" ? -1 : 0;

    // V4.2.16: 使用原子化函数，在单个事务中完成配额检查和记录创建
    const { data, error } = await rpcAtomicCreateSnapshot(supabase, {
      p_user_id: userId,
      p_bookmark_id: bookmarkId,
      p_snapshot_type: snapshotType,
      p_estimated_size: 102400, // 预估 100KB
      p_trigger_source: options.source || "manual",
      p_trigger_tag:
        options.source === "auto-tag" ? (options.triggerTag ?? null) : null,
      p_priority: priorityValue,
    });

    if (error) {
      logger.error(
        { error: error.message, bookmarkId },
        "[SnapshotService] Failed to create snapshot atomically",
      );
      throw new Error(`创建快照失败: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      const errorCode = result?.error_code || "UNKNOWN_ERROR";
      const errorMessage = result?.error_message || "未知错误";
      throw new Error(`${errorCode}: ${errorMessage}`);
    }

    // 估算等待时间
    const pendingCount = await this.getPendingCount();
    const estimatedWaitTime = Math.max(5, pendingCount * 3);

    logger.info(
      { snapshotId: result.snapshot_id, jobId: result.job_id, bookmarkId },
      "[SnapshotService] Snapshot task created atomically",
    );

    return {
      snapshotId: result.snapshot_id ?? 0,
      jobId: result.job_id ?? "",
      status: "pending",
      estimatedWaitTime,
    };
  }

  /**
   * 批量创建快照
   * V4.2.16: 使用原子化批量 RPC 函数，提高效率并避免竞态条件
   */
  async batchCreateSnapshots(
    userId: string,
    bookmarkIds: number[],
    options: CreateSnapshotOptions = {},
  ): Promise<{
    created: number;
    skipped: number;
    failed: number;
    details: Array<{
      bookmarkId: number;
      snapshotId?: number;
      jobId?: string;
      error?: string;
    }>;
  }> {
    const supabase = await this.getSupabase();
    const snapshotType = options.snapshotType || "basic";

    // V4.2.16: 使用原子化批量函数
    const { data, error } = await rpcAtomicBatchCreateSnapshots(supabase, {
      p_user_id: userId,
      p_bookmark_ids: bookmarkIds,
      p_snapshot_type: snapshotType,
      p_trigger_source: options.source || "batch",
      p_max_batch_size: 50,
    });

    if (error) {
      logger.error(
        { error: error.message, count: bookmarkIds.length },
        "[SnapshotService] Failed to batch create snapshots atomically",
      );
      throw new Error(`批量创建快照失败: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;

    logger.info(
      {
        requested: result?.total_requested,
        created: result?.total_created,
        skipped: result?.total_skipped,
      },
      "[SnapshotService] Batch snapshots created atomically",
    );

    // 注意：原子函数返回的是 snapshot_ids，无法直接映射回 bookmark_ids
    // 这里简化处理，只返回总计数
    return {
      created: result?.total_created || 0,
      skipped: result?.total_skipped || 0,
      failed:
        (result?.total_requested || 0) -
        (result?.total_created || 0) -
        (result?.total_skipped || 0),
      details: [], // 原子函数不返回每条详情
    };
  }

  // ==========================================================================
  // 快照查询
  // ==========================================================================

  /**
   * 获取快照详情
   */
  async getSnapshotById(
    userId: string,
    snapshotId: number,
  ): Promise<BookmarkSnapshotRow | null> {
    const supabase = await this.getSupabase();

    const { data, error } = await getSnapshotsTable(supabase)
      .select("*")
      .eq("id", snapshotId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error(
        { error: error.message, snapshotId },
        "[SnapshotService] Failed to get snapshot",
      );
      throw new Error(`获取快照失败: ${error.message}`);
    }

    return data as BookmarkSnapshotRow;
  }

  /**
   * 获取书签的有效快照
   */
  async getBookmarkSnapshot(
    userId: string,
    bookmarkId: number,
  ): Promise<BookmarkSnapshotRow | null> {
    const supabase = await this.getSupabase();

    const { data, error } = await getSnapshotsTable(supabase)
      .select("*")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .not("status", "in", '("failed","expired")')
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error(
        { error: error.message, bookmarkId },
        "[SnapshotService] Failed to get bookmark snapshot",
      );
      return null;
    }

    return data as BookmarkSnapshotRow;
  }

  /**
   * 获取活跃的快照（pending 或 processing 或 completed）
   */
  async getActiveSnapshot(
    userId: string,
    bookmarkId: number,
  ): Promise<BookmarkSnapshotRow | null> {
    const supabase = await this.getSupabase();

    const { data, error } = await getSnapshotsTable(supabase)
      .select("*")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", userId)
      .in("status", ["pending", "processing", "completed"])
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      return null;
    }

    return data as BookmarkSnapshotRow;
  }

  /**
   * 获取用户的快照列表
   */
  async getUserSnapshots(
    userId: string,
    options: SnapshotQueryOptions = {},
  ): Promise<SnapshotSummary[]> {
    const supabase = await this.getSupabase();
    const { status, snapshotType, limit = 50, offset = 0 } = options;

    let query = getSnapshotsTable(supabase)
      .select(
        `
        id,
        bookmark_id,
        snapshot_type,
        status,
        readable_title,
        readable_excerpt,
        captured_at,
        screenshot_storage_path
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      if (Array.isArray(status)) {
        query = query.in("status", status);
      } else {
        query = query.eq("status", status);
      }
    }

    if (snapshotType) {
      query = query.eq("snapshot_type", snapshotType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[SnapshotService] Failed to get user snapshots",
      );
      throw new Error(`获取快照列表失败: ${error.message}`);
    }

    return (data || []).map((row: SnapshotListRow) => ({
      id: row.id,
      bookmarkId: row.bookmark_id,
      snapshotType: row.snapshot_type as SnapshotType,
      status: row.status as SnapshotStatus,
      readableTitle: row.readable_title || undefined,
      readableExcerpt: row.readable_excerpt || undefined,
      capturedAt: row.captured_at || undefined,
      hasScreenshot: !!row.screenshot_storage_path,
    }));
  }

  /**
   * 获取快照内容（Readability 正文 + 截图/HTML URL）
   */
  async getSnapshotContent(
    userId: string,
    snapshotId: number,
  ): Promise<{
    readableTitle: string;
    readableContent: string;
    readableTextContent: string;
    readableByline?: string;
    readableWordCount: number;
    snapshotType?: string;
    screenshotUrl?: string;
    htmlUrl?: string;
    capturedAt?: string;
    finalUrl?: string;
  } | null> {
    const supabase = await this.getSupabase();

    const { data, error } = await getSnapshotsTable(supabase)
      .select(
        `
        readable_title,
        readable_content,
        readable_text_content,
        readable_byline,
        readable_word_count,
        status,
        snapshot_type,
        screenshot_storage_path,
        html_storage_path,
        captured_at,
        final_url
      `,
      )
      .eq("id", snapshotId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    if (data.status !== "completed") {
      throw new Error("NOT_COMPLETED: 快照尚未完成");
    }

    // 生成 Storage 公开 URL
    let screenshotUrl: string | undefined;
    let htmlUrl: string | undefined;

    if (data.screenshot_storage_path) {
      const { data: urlData } = supabase.storage
        .from("snapshots")
        .getPublicUrl(data.screenshot_storage_path);
      screenshotUrl = urlData?.publicUrl;
    }

    if (
      data.html_storage_path &&
      !data.html_storage_path.startsWith("inline:")
    ) {
      const { data: urlData } = supabase.storage
        .from("snapshots")
        .getPublicUrl(data.html_storage_path);
      htmlUrl = urlData?.publicUrl;
    }

    return {
      readableTitle: data.readable_title || "",
      readableContent: data.readable_content || "",
      readableTextContent: data.readable_text_content || "",
      readableByline: data.readable_byline || undefined,
      readableWordCount: data.readable_word_count || 0,
      snapshotType: data.snapshot_type || undefined,
      screenshotUrl,
      htmlUrl,
      capturedAt: data.captured_at || undefined,
      finalUrl: data.final_url || undefined,
    };
  }

  // ==========================================================================
  // 快照删除
  // ==========================================================================

  /**
   * 删除快照
   * 同时清理 Supabase Storage 中的关联文件
   */
  async deleteSnapshot(userId: string, snapshotId: number): Promise<boolean> {
    const supabase = await this.getSupabase();

    // 先获取快照信息以便清理存储
    const snapshot = await this.getSnapshotById(userId, snapshotId);
    if (!snapshot) {
      return false;
    }

    // 收集需要删除的存储文件路径
    const pathsToDelete: string[] = [];

    if (snapshot.screenshot_storage_path) {
      pathsToDelete.push(snapshot.screenshot_storage_path);
    }

    if (
      snapshot.html_storage_path &&
      !snapshot.html_storage_path.startsWith("inline:")
    ) {
      pathsToDelete.push(snapshot.html_storage_path);
    }

    if (
      snapshot.mhtml_storage_path &&
      !snapshot.mhtml_storage_path.startsWith("inline:")
    ) {
      pathsToDelete.push(snapshot.mhtml_storage_path);
    }

    // 清理 Storage 文件（失败不阻塞记录删除）
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("snapshots")
        .remove(pathsToDelete);

      if (storageError) {
        logger.warn(
          {
            error: storageError.message,
            snapshotId,
            paths: pathsToDelete,
          },
          "[SnapshotService] Failed to delete storage files, continuing with record deletion",
        );
        // 继续删除记录，即使存储清理失败
      } else {
        logger.debug(
          { snapshotId, cleanedFiles: pathsToDelete.length },
          "[SnapshotService] Storage files cleaned",
        );
      }
    }

    // 删除数据库记录
    const { error } = await getSnapshotsTable(supabase)
      .delete()
      .eq("id", snapshotId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error: error.message, snapshotId },
        "[SnapshotService] Failed to delete snapshot",
      );
      return false;
    }

    logger.info(
      { snapshotId, cleanedFiles: pathsToDelete.length },
      "[SnapshotService] Snapshot deleted",
    );
    return true;
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  /**
   * 获取待处理的快照任务数量
   */
  private async getPendingCount(): Promise<number> {
    const supabase = await this.getSupabase();

    const { count, error } = await supabase
      .from("job_queue")
      .select("*", { count: "exact", head: true })
      .in("type", [
        "create_snapshot_basic",
        "create_snapshot_standard",
        "create_snapshot_full",
      ])
      .eq("status", "pending");

    if (error) {
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 更新快照状态（供 Worker 使用）
   * 注意：此方法使用 service client 绕过 RLS，因为后台任务没有用户会话
   */
  async updateSnapshot(
    snapshotId: number,
    update: BookmarkSnapshotUpdate,
  ): Promise<boolean> {
    // 使用 service client 绕过 RLS（后台任务没有用户会话）
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from("bookmark_snapshots")
      .update(update)
      .eq("id", snapshotId)
      .select("id", { count: "exact" });

    if (error) {
      logger.error(
        { error: error.message, snapshotId },
        "[SnapshotService] Failed to update snapshot",
      );
      return false;
    }

    // 检查是否实际更新了行
    if (count === 0) {
      logger.warn(
        { snapshotId },
        "[SnapshotService] No rows updated - snapshot may not exist",
      );
      return false;
    }

    logger.debug(
      { snapshotId, updatedFields: Object.keys(update) },
      "[SnapshotService] Snapshot updated successfully",
    );
    return true;
  }

  /**
   * 获取过期快照（供清理任务使用）
   */
  async getExpiredSnapshots(limit: number = 100): Promise<number[]> {
    const supabase = await this.getSupabase();

    const { data, error } = await getSnapshotsTable(supabase)
      .select("id")
      .eq("status", "completed")
      .lt("expires_at", new Date().toISOString())
      .limit(limit);

    if (error) {
      return [];
    }

    return (data || []).map((row: SnapshotIdRow) => row.id);
  }

  /**
   * 标记快照为过期
   */
  async markAsExpired(snapshotIds: number[]): Promise<number> {
    if (snapshotIds.length === 0) return 0;

    const supabase = await this.getSupabase();

    const { data, error } = await getSnapshotsTable(supabase)
      .update({ status: "expired" })
      .in("id", snapshotIds)
      .select("id");

    if (error) {
      logger.error(
        { error: error.message },
        "[SnapshotService] Failed to mark expired",
      );
      return 0;
    }

    return data?.length ?? 0;
  }
}

// 导出单例
export const snapshotService = new SnapshotService();
