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
// 数据库行类型
// ============================================================================

interface TaskRow {
  id: string;
  report_id: string;
  user_id: string;
  change_set_id: string;
  impact_analysis: ReportImpactAnalysis;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  error: string | null;
  new_version: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface UpdateResultRow {
  id: string;
  task_id: string;
  report_id: string;
  success: boolean;
  new_version: number;
  paragraphs_updated: number;
  paragraphs_regenerated: number;
  processing_time_ms: number;
  tokens_used: number;
  change_summary: string | null;
  created_at: string;
}

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

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToTask(row: TaskRow): IncrementalUpdateTask {
  return {
    id: row.id,
    reportId: row.report_id,
    changeSetId: row.change_set_id,
    impactAnalysis: row.impact_analysis,
    status: row.status === "cancelled" ? "failed" : row.status,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    error: row.error ?? undefined,
    newVersion: row.new_version ?? undefined,
  };
}

function _rowToUpdateResult(row: UpdateResultRow): UpdateResult {
  return {
    success: row.success,
    reportId: row.report_id,
    newVersion: row.new_version,
    paragraphsUpdated: row.paragraphs_updated,
    paragraphsRegenerated: row.paragraphs_regenerated,
    processingTimeMs: row.processing_time_ms,
    tokensUsed: row.tokens_used,
    changeSummary: row.change_summary ?? "",
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
    type ChangeSetRow =
      Database["public"]["Tables"]["ks_report_change_sets"]["Row"];
    const { data: changeSet, error: changeSetError } = await (
      supabase.from("ks_report_change_sets") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: ChangeSetRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .select("*")
      .eq("id", changeSetId)
      .single();

    if (changeSetError) {
      throw new Error(`变更集不存在: ${changeSetError.message}`);
    }

    // 构建影响分析
    const impactAnalysis: ReportImpactAnalysis = {
      reportId,
      changeSetId,
      overallImpact: (changeSet?.impact_level ?? "low") as ImpactLevel,
      paragraphImpacts: [],
      paragraphsToUpdate: 0,
      paragraphsToRegenerate: 0,
      estimatedProcessingTime: 10,
      estimatedTokens: 500,
    };

    // 调用 RPC 创建任务
    type CreateIncrementalUpdateTaskParams = {
      p_report_id: string;
      p_change_set_id: string;
      p_impact_analysis: Json;
    };
    const { data: taskId, error } = await (
      supabase.rpc as {
        (
          fnName: "create_incremental_update_task",
          params: CreateIncrementalUpdateTaskParams,
        ): Promise<{
          data: string | null;
          error: { message: string } | null;
        }>;
      }
    )("create_incremental_update_task", {
      p_report_id: reportId,
      p_change_set_id: changeSetId,
      p_impact_analysis: impactAnalysis as Json,
    });

    if (error) {
      logger.error(
        { error: error.message, reportId, changeSetId },
        "Failed to create update task",
      );
      throw new Error(`创建更新任务失败: ${error.message}`);
    }

    // 获取创建的任务
    type TaskRow =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Row"];
    const { data: task, error: fetchError } = await (
      supabase.from("ks_incremental_update_tasks") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: TaskRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      throw new Error(`获取任务失败: ${fetchError?.message}`);
    }

    logger.info(
      { taskId, reportId, changeSetId },
      "Incremental update task created",
    );

    return rowToTask(task);
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
    type TaskRow =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Row"];
    const { data: task, error: taskError } = await (
      supabase.from("ks_incremental_update_tasks") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: TaskRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      throw new Error(`任务不存在: ${taskError?.message}`);
    }

    // 更新任务状态为处理中
    type TaskUpdate =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Update"];
    const updateData: TaskUpdate = {
      status: "processing",
      started_at: new Date().toISOString(),
    };

    await (
      supabase.from("ks_incremental_update_tasks") as {
        update: (values: TaskUpdate) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .update(updateData)
      .eq("id", taskId);

    try {
      // 获取报告当前版本
      type VersionRow =
        Database["public"]["Tables"]["ks_report_versions"]["Row"];
      const { data: versions } = await (
        supabase.from("ks_report_versions") as {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => {
                limit: (count: number) => Promise<{
                  data: Pick<VersionRow, "version">[] | null;
                }>;
              };
            };
          };
        }
      )
        .select("version")
        .eq("report_id", task.report_id)
        .order("version", { ascending: false })
        .limit(1);

      const currentVersion = versions?.[0]?.version ?? 0;
      const newVersion = currentVersion + 1;

      // 获取报告内容
      // 注意：这里使用的是 synthesis_reports 表，不是 ks_reports
      type SynthesisReportRow =
        Database["public"]["Tables"]["synthesis_reports"]["Row"];
      const { data: report } = await (
        supabase.from("synthesis_reports") as {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              single: () => Promise<{
                data: Pick<
                  SynthesisReportRow,
                  "content" | "generation_metadata"
                > | null;
              }>;
            };
          };
        }
      )
        .select("content, generation_metadata")
        .eq("id", task.report_id)
        .single();

      // 模拟增量更新处理（实际需要调用 AI 服务）
      // TODO: 集成 AI 服务进行实际的段落更新和重生成
      const impactAnalysis = task.impact_analysis as ReportImpactAnalysis;
      const paragraphsUpdated = impactAnalysis.paragraphsToUpdate;
      const paragraphsRegenerated = impactAnalysis.paragraphsToRegenerate;

      // 创建新版本
      type VersionInsert =
        Database["public"]["Tables"]["ks_report_versions"]["Insert"];
      const metadata = report?.generation_metadata as
        | { source_bookmark_ids?: string[] }
        | undefined;
      const versionInsertData: VersionInsert = {
        report_id: task.report_id,
        user_id: task.user_id,
        version: newVersion,
        content: (report?.content ?? {}) as Json,
        bookmark_ids: metadata?.source_bookmark_ids ?? [],
        change_summary: `增量更新: 更新 ${paragraphsUpdated} 段，重生成 ${paragraphsRegenerated} 段`,
        source: "incremental",
      };

      const { error: versionError } = await (
        supabase.from("ks_report_versions") as {
          insert: (values: VersionInsert) => Promise<{
            error: { message: string } | null;
          }>;
        }
      ).insert(versionInsertData);

      if (versionError) {
        throw new Error(`创建版本失败: ${versionError.message}`);
      }

      const processingTimeMs = Date.now() - startTime;
      const tokensUsed = paragraphsUpdated * 200 + paragraphsRegenerated * 500;

      // 记录更新结果
      type UpdateResultInsert =
        Database["public"]["Tables"]["ks_update_results"]["Insert"];
      const resultInsertData: UpdateResultInsert = {
        task_id: taskId,
        report_id: task.report_id,
        user_id: task.user_id,
        success: true,
        new_version: newVersion,
        paragraphs_updated: paragraphsUpdated,
        paragraphs_regenerated: paragraphsRegenerated,
        processing_time_ms: processingTimeMs,
        tokens_used: tokensUsed,
        change_summary: `增量更新完成`,
      };

      const { error: resultError } = await (
        supabase.from("ks_update_results") as {
          insert: (values: UpdateResultInsert) => Promise<{
            error: { message: string } | null;
          }>;
        }
      ).insert(resultInsertData);

      if (resultError) {
        logger.warn(
          { error: resultError.message },
          "Failed to save update result",
        );
      }

      // 更新任务状态
      type TaskUpdate =
        Database["public"]["Tables"]["ks_incremental_update_tasks"]["Update"];
      const taskUpdateData: TaskUpdate = {
        status: "completed",
        completed_at: new Date().toISOString(),
        new_version: newVersion,
      };

      await (
        supabase.from("ks_incremental_update_tasks") as {
          update: (values: TaskUpdate) => {
            eq: (
              column: string,
              value: string,
            ) => Promise<{
              error: { message: string } | null;
            }>;
          };
        }
      )
        .update(taskUpdateData)
        .eq("id", taskId);

      // 标记变更集已处理
      type ChangeSetUpdate =
        Database["public"]["Tables"]["ks_report_change_sets"]["Update"];
      const changeSetUpdateData: ChangeSetUpdate = {
        processed: true,
        processed_at: new Date().toISOString(),
      };

      await (
        supabase.from("ks_report_change_sets") as {
          update: (values: ChangeSetUpdate) => {
            eq: (
              column: string,
              value: string,
            ) => Promise<{
              error: { message: string } | null;
            }>;
          };
        }
      )
        .update(changeSetUpdateData)
        .eq("id", task.change_set_id);

      logger.info(
        { taskId, reportId: task.report_id, newVersion, processingTimeMs },
        "Incremental update task completed",
      );

      return {
        success: true,
        reportId: task.report_id,
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
      type TaskUpdate =
        Database["public"]["Tables"]["ks_incremental_update_tasks"]["Update"];
      const taskUpdateData: TaskUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error: errorMessage,
      };

      await (
        supabase.from("ks_incremental_update_tasks") as {
          update: (values: TaskUpdate) => {
            eq: (
              column: string,
              value: string,
            ) => Promise<{
              error: { message: string } | null;
            }>;
          };
        }
      )
        .update(taskUpdateData)
        .eq("id", taskId);

      logger.error(
        { taskId, error: errorMessage },
        "Incremental update task failed",
      );

      return {
        success: false,
        reportId: task.report_id,
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

    type TaskRow =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Row"];
    const { data, error } = await (
      supabase.from("ks_incremental_update_tasks") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: TaskRow | null;
              error: { code?: string; message: string } | null;
            }>;
          };
        };
      }
    )
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

    return data ? rowToTask(data) : null;
  }

  /**
   * 取消更新任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const supabase = await createClient();

    // 只能取消待处理的任务
    type TaskRow =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Row"];
    const { data: task } = await (
      supabase.from("ks_incremental_update_tasks") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: Pick<TaskRow, "status"> | null;
            }>;
          };
        };
      }
    )
      .select("status")
      .eq("id", taskId)
      .single();

    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status !== "pending") {
      throw new Error(`只能取消待处理的任务，当前状态: ${task.status}`);
    }

    type TaskUpdate =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Update"];
    const taskUpdateData: TaskUpdate = {
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error: "用户取消",
    };

    const { error } = await (
      supabase.from("ks_incremental_update_tasks") as {
        update: (values: TaskUpdate) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
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
    type GetReportUpdateHistoryParams = {
      p_report_id: string;
      p_limit: number;
    };
    type UpdateHistoryRow = {
      id: string;
      version: number;
      source: string;
      change_summary: string | null;
      paragraphs_updated: number;
      paragraphs_regenerated: number;
      tokens_used: number;
      created_at: string;
    };
    const { data, error } = await (
      supabase.rpc as {
        (
          fnName: "get_report_update_history",
          params: GetReportUpdateHistoryParams,
        ): Promise<{
          data: UpdateHistoryRow[] | null;
          error: { message: string } | null;
        }>;
      }
    )("get_report_update_history", {
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

    const results = (data ?? []).map((row: UpdateHistoryRow) => {
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
    type RollbackReportToVersionParams = {
      p_report_id: string;
      p_target_version: number;
    };
    type RollbackResult = {
      success: boolean;
      newVersion: number;
      rolledBackFrom: number;
      rolledBackTo: number;
    };
    const { data, error } = await (
      supabase.rpc as {
        (
          fnName: "rollback_report_to_version",
          params: RollbackReportToVersionParams,
        ): Promise<{
          data: Json | null;
          error: { message: string } | null;
        }>;
      }
    )("rollback_report_to_version", {
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

    const result = data as RollbackResult;

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

    type TaskRow =
      Database["public"]["Tables"]["ks_incremental_update_tasks"]["Row"];
    const { data, error } = await (
      supabase.from("ks_incremental_update_tasks") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            in: (
              column: string,
              values: string[],
            ) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => Promise<{
                data: TaskRow[] | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
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

    return (data ?? []).map((row) => rowToTask(row));
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
