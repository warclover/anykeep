/**
 * Knowledge Studio - 增量更新服务
 * @module knowledge-studio/incremental
 * @description P4 实现 - 局部重生成与版本管理
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IIncrementalUpdater,
  IncrementalUpdateTask,
  UpdateResult,
  ReportImpactAnalysis,
  ImpactLevel,
} from "./types";
import type { Database, Json } from "@/types/supabase";

// ============================================================================
// 数据库类型别名（使用 Database 类型）
// ============================================================================

type TaskRow =
  Database["public"]["Tables"]["ks_incremental_update_tasks"]["Row"];
type TaskUpdate =
  Database["public"]["Tables"]["ks_incremental_update_tasks"]["Update"];
type VersionRow = Database["public"]["Tables"]["ks_report_versions"]["Row"];
type VersionInsert =
  Database["public"]["Tables"]["ks_report_versions"]["Insert"];
type ChangeSetRow =
  Database["public"]["Tables"]["ks_report_change_sets"]["Row"];
type ChangeSetUpdate =
  Database["public"]["Tables"]["ks_report_change_sets"]["Update"];
type UpdateResultInsert =
  Database["public"]["Tables"]["ks_update_results"]["Insert"];
type SynthesisReportRow =
  Database["public"]["Tables"]["synthesis_reports"]["Row"];

// 自定义类型（RPC 返回值和内部使用）
interface UpdateHistoryRow {
  id: string;
  version: number;
  source: string;
  change_summary: string | null;
  paragraphs_updated: number;
  paragraphs_regenerated: number;
  tokens_used: number;
  created_at: string;
}

interface RollbackResult {
  success: boolean;
  newVersion: number;
  rolledBackFrom: number;
  rolledBackTo: number;
}

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToTask(row: TaskRow): IncrementalUpdateTask {
  // Map database status to domain status
  type TaskStatus = "pending" | "processing" | "completed" | "failed";
  const statusMap: Record<string, TaskStatus> = {
    pending: "pending",
    processing: "processing",
    completed: "completed",
    failed: "failed",
    cancelled: "failed", // Map cancelled to failed
  };
  const mappedStatus = statusMap[row.status] ?? "pending";

  return {
    id: row.id,
    reportId: row.report_id,
    changeSetId: row.change_set_id,
    impactAnalysis: row.impact_analysis as unknown as ReportImpactAnalysis,
    status: mappedStatus,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    error: row.error ?? undefined,
    newVersion: row.new_version ?? undefined,
  };
}

function historyRowToUpdateResult(row: UpdateHistoryRow): UpdateResult {
  return {
    success: true,
    reportId: "", // 历史记录不包含 report_id，由调用方设置
    newVersion: row.version,
    paragraphsUpdated: row.paragraphs_updated ?? 0,
    paragraphsRegenerated: row.paragraphs_regenerated ?? 0,
    processingTimeMs: 0,
    tokensUsed: row.tokens_used ?? 0,
    changeSummary: row.change_summary ?? `[${row.source}] 版本 ${row.version}`,
  };
}

// ============================================================================
// 增量更新服务实现
// ============================================================================

/**
 * 增量更新服务
 *
 * @example
 * ```typescript
 * const updater = new IncrementalUpdater();
 *
 * // 创建更新任务
 * const task = await updater.createTask('report-123', 'changeset-456');
 *
 * // 执行任务
 * const result = await updater.executeTask(task.id);
 * console.log(`更新了 ${result.paragraphsUpdated} 个段落`);
 * ```
 */
export class IncrementalUpdater implements IIncrementalUpdater {
  /**
   * 创建更新任务
   *
   * 使用 RPC 函数创建任务
   */
  async createTask(
    reportId: string,
    changeSetId: string,
  ): Promise<IncrementalUpdateTask> {
    const supabase = await createClient();

    // 先分析影响（简单版本）
    const { data: changeSet, error: changeSetError } = await supabase
      .from("ks_report_change_sets")
      .select("*")
      .eq("id", changeSetId)
      .single();

    if (changeSetError) {
      throw new Error(`变更集不存在: ${changeSetError.message}`);
    }

    const typedChangeSet = changeSet as ChangeSetRow;

    // 构建影响分析
    const impactAnalysis: ReportImpactAnalysis = {
      reportId,
      changeSetId,
      overallImpact: (typedChangeSet?.impact_level ?? "low") as ImpactLevel,
      paragraphImpacts: [],
      paragraphsToUpdate: 0,
      paragraphsToRegenerate: 0,
      estimatedProcessingTime: 10,
      estimatedTokens: 500,
    };

    // 调用 RPC 创建任务
    const { data: taskId, error } = await supabase.rpc(
      "create_incremental_update_task",
      {
        p_report_id: reportId,
        p_change_set_id: changeSetId,
        p_impact_analysis: impactAnalysis as unknown as Json,
      },
    );

    if (error) {
      logger.error(
        { error: error.message, reportId, changeSetId },
        "Failed to create update task",
      );
      throw new Error(`创建更新任务失败: ${error.message}`);
    }

    // 获取创建的任务
    const { data: task, error: fetchError } = await supabase
      .from("ks_incremental_update_tasks")
      .select("*")
      .eq("id", taskId as string)
      .single();

    if (fetchError || !task) {
      throw new Error(`获取任务失败: ${fetchError?.message}`);
    }

    logger.info(
      { taskId, reportId, changeSetId },
      "Incremental update task created",
    );

    return rowToTask(task as TaskRow);
  }

  /**
   * 执行更新任务
   *
   * 执行增量更新并记录结果
   */
  async executeTask(taskId: string): Promise<UpdateResult> {
    const supabase = await createClient();
    const startTime = Date.now();

    // 获取任务信息
    const { data: task, error: taskError } = await supabase
      .from("ks_incremental_update_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      throw new Error(`任务不存在: ${taskError?.message}`);
    }

    const typedTask = task as TaskRow;

    // 更新任务状态为处理中
    const updateData: TaskUpdate = {
      status: "processing",
      started_at: new Date().toISOString(),
    };

    await supabase
      .from("ks_incremental_update_tasks")
      .update(updateData)
      .eq("id", taskId);

    try {
      // 获取报告当前版本
      const { data: versions } = await supabase
        .from("ks_report_versions")
        .select("version")
        .eq("report_id", typedTask.report_id)
        .order("version", { ascending: false })
        .limit(1);

      type VersionPick = Pick<VersionRow, "version">;
      const typedVersions = versions as VersionPick[] | null;
      const currentVersion = typedVersions?.[0]?.version ?? 0;
      const newVersion = currentVersion + 1;

      // 获取报告内容
      const { data: report } = await supabase
        .from("synthesis_reports")
        .select("content, generation_metadata")
        .eq("id", typedTask.report_id)
        .single();

      const typedReport = report as Pick<
        SynthesisReportRow,
        "content" | "generation_metadata"
      > | null;

      // 模拟增量更新处理（实际需要调用 AI 服务）
      // TODO: 集成 AI 服务进行实际的段落更新和重生成
      const impactAnalysis =
        typedTask.impact_analysis as unknown as ReportImpactAnalysis;
      const paragraphsUpdated = impactAnalysis.paragraphsToUpdate;
      const paragraphsRegenerated = impactAnalysis.paragraphsToRegenerate;

      // 创建新版本
      const metadata = typedReport?.generation_metadata as
        | { source_bookmark_ids?: string[] }
        | undefined;
      const versionInsertData: VersionInsert = {
        report_id: typedTask.report_id,
        user_id: typedTask.user_id,
        version: newVersion,
        content: (typedReport?.content ?? {}) as unknown as Json,
        bookmark_ids: metadata?.source_bookmark_ids ?? [],
        change_summary: `增量更新: 更新 ${paragraphsUpdated} 段，重生成 ${paragraphsRegenerated} 段`,
        source: "incremental",
      };

      const { error: versionError } = await supabase
        .from("ks_report_versions")
        .insert(versionInsertData);

      if (versionError) {
        throw new Error(`创建版本失败: ${versionError.message}`);
      }

      const processingTimeMs = Date.now() - startTime;
      const tokensUsed = paragraphsUpdated * 200 + paragraphsRegenerated * 500;

      // 记录更新结果
      const resultInsertData: UpdateResultInsert = {
        task_id: taskId,
        report_id: typedTask.report_id,
        user_id: typedTask.user_id,
        success: true,
        new_version: newVersion,
        paragraphs_updated: paragraphsUpdated,
        paragraphs_regenerated: paragraphsRegenerated,
        processing_time_ms: processingTimeMs,
        tokens_used: tokensUsed,
        change_summary: `增量更新完成`,
      };

      const { error: resultError } = await supabase
        .from("ks_update_results")
        .insert(resultInsertData);

      if (resultError) {
        logger.warn(
          { error: resultError.message },
          "Failed to save update result",
        );
      }

      // 更新任务状态
      const taskUpdateData: TaskUpdate = {
        status: "completed",
        completed_at: new Date().toISOString(),
        new_version: newVersion,
      };

      await supabase
        .from("ks_incremental_update_tasks")
        .update(taskUpdateData)
        .eq("id", taskId);

      // 标记变更集已处理
      const changeSetUpdateData: ChangeSetUpdate = {
        processed: true,
        processed_at: new Date().toISOString(),
      };

      await supabase
        .from("ks_report_change_sets")
        .update(changeSetUpdateData)
        .eq("id", typedTask.change_set_id);

      logger.info(
        { taskId, reportId: typedTask.report_id, newVersion, processingTimeMs },
        "Incremental update task completed",
      );

      return {
        success: true,
        reportId: typedTask.report_id,
        newVersion,
        paragraphsUpdated,
        paragraphsRegenerated,
        processingTimeMs,
        tokensUsed,
        changeSummary: `增量更新完成: 更新 ${paragraphsUpdated} 段，重生成 ${paragraphsRegenerated} 段`,
      };
    } catch (error) {
      // 更新任务状态为失败
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const taskUpdateData: TaskUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error: errorMessage,
      };

      await supabase
        .from("ks_incremental_update_tasks")
        .update(taskUpdateData)
        .eq("id", taskId);

      logger.error(
        { taskId, error: errorMessage },
        "Incremental update task failed",
      );

      return {
        success: false,
        reportId: typedTask.report_id,
        newVersion: 0,
        paragraphsUpdated: 0,
        paragraphsRegenerated: 0,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        changeSummary: `更新失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<IncrementalUpdateTask | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_incremental_update_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error(
        { error: error.message, taskId },
        "Failed to get task status",
      );
      throw new Error(`获取任务状态失败: ${error.message}`);
    }

    return data ? rowToTask(data as TaskRow) : null;
  }

  /**
   * 取消更新任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const supabase = await createClient();

    // 只能取消待处理的任务
    const { data: task } = await supabase
      .from("ks_incremental_update_tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    type TaskStatus = Pick<TaskRow, "status">;
    const typedTask = task as TaskStatus | null;

    if (!typedTask) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (typedTask.status !== "pending") {
      throw new Error(`只能取消待处理的任务，当前状态: ${typedTask.status}`);
    }

    const taskUpdateData: TaskUpdate = {
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error: "用户取消",
    };

    const { error } = await supabase
      .from("ks_incremental_update_tasks")
      .update(taskUpdateData)
      .eq("id", taskId);

    if (error) {
      logger.error({ error: error.message, taskId }, "Failed to cancel task");
      throw new Error(`取消任务失败: ${error.message}`);
    }

    logger.info({ taskId }, "Incremental update task cancelled");
  }

  /**
   * 获取报告更新历史
   *
   * 使用 RPC 函数获取版本历史
   */
  async getUpdateHistory(reportId: string): Promise<UpdateResult[]> {
    const supabase = await createClient();

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc("get_report_update_history", {
      p_report_id: reportId,
      p_limit: 20,
    });

    if (error) {
      logger.error(
        { error: error.message, reportId },
        "Failed to get update history",
      );
      throw new Error(`获取更新历史失败: ${error.message}`);
    }

    const typedData = data as UpdateHistoryRow[] | null;
    const results = (typedData ?? []).map((row: UpdateHistoryRow) => {
      const result = historyRowToUpdateResult(row);
      result.reportId = reportId;
      return result;
    });

    logger.info(
      { reportId, count: results.length },
      "Update history retrieved",
    );

    return results;
  }

  /**
   * 回滚到指定版本
   *
   * 使用 RPC 函数执行回滚
   */
  async rollback(reportId: string, version: number): Promise<UpdateResult> {
    const supabase = await createClient();

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc("rollback_report_to_version", {
      p_report_id: reportId,
      p_target_version: version,
    });

    if (error) {
      logger.error(
        { error: error.message, reportId, version },
        "Failed to rollback report",
      );
      throw new Error(`回滚失败: ${error.message}`);
    }

    const result = data as unknown as RollbackResult;

    logger.info(
      {
        reportId,
        fromVersion: result.rolledBackFrom,
        toVersion: result.rolledBackTo,
        newVersion: result.newVersion,
      },
      "Report rolled back",
    );

    return {
      success: result.success,
      reportId,
      newVersion: result.newVersion,
      paragraphsUpdated: 0,
      paragraphsRegenerated: 0,
      processingTimeMs: 0,
      tokensUsed: 0,
      changeSummary: `回滚到版本 ${result.rolledBackTo}（从版本 ${result.rolledBackFrom}）`,
    };
  }

  /**
   * 获取用户待处理任务
   */
  async getPendingTasks(userId: string): Promise<IncrementalUpdateTask[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_incremental_update_tasks")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false });

    if (error) {
      logger.error(
        { error: error.message, userId },
        "Failed to get pending tasks",
      );
      throw new Error(`获取待处理任务失败: ${error.message}`);
    }

    const typedData = data as TaskRow[] | null;
    return (typedData ?? []).map((row) => rowToTask(row));
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建增量更新服务实例
 */
export function createIncrementalUpdater(): IIncrementalUpdater {
  return new IncrementalUpdater();
}

// 保留旧名称以兼容
export { IncrementalUpdater as IncrementalUpdaterStub };
