/**
 * Knowledge Studio - 增量更新服务
 * @module knowledge-studio/incremental
 * @description P4 实现 - 局部重生成与版本管理
 * @version 1.1.0
 * @since 2026-01-02
 * @updated 2026-01-05 - 集成 AI 服务进行段落更新
 */

import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type {
  IIncrementalUpdater,
  IncrementalUpdateTask,
  UpdateResult,
  ReportImpactAnalysis,
  ImpactLevel,
  ParagraphImpact,
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
  // ============================================================================
  // AI 集成方法
  // ============================================================================

  /**
   * 使用 AI 重生成/更新段落
   *
   * @param paragraphImpact - 段落影响分析
   * @param currentContent - 当前段落内容
   * @param bookmarkContents - 关联书签的内容
   * @returns 重生成的段落内容和消耗的 Token 数
   */
  private async regenerateParagraphWithAI(
    paragraphImpact: ParagraphImpact,
    currentContent: string,
    bookmarkContents: string[],
  ): Promise<{ newContent: string; tokensUsed: number }> {
    const selection = aiProviderRouter.selectProvider({
      taskType: "chat",
      preferredProvider: "deepseek",
    });

    if (!selection) {
      throw new Error("没有可用的 AI 服务");
    }

    const isRegenerate = paragraphImpact.suggestedAction === "regenerate";
    const systemPrompt = this.buildRegenerationSystemPrompt(isRegenerate);
    const userPrompt = this.buildRegenerationUserPrompt(
      paragraphImpact,
      currentContent,
      bookmarkContents,
      isRegenerate,
    );

    logger.debug(
      {
        paragraphIndex: paragraphImpact.paragraphIndex,
        action: paragraphImpact.suggestedAction,
        provider: selection.provider.name,
      },
      "Regenerating paragraph with AI",
    );

    const result = await generateText({
      model: selection.model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 1024,
      temperature: 0.7,
    });

    const newContent = result.text.trim();
    const tokensUsed = result.usage?.totalTokens ?? 500;

    return { newContent, tokensUsed };
  }

  /**
   * 构建重生成系统提示
   */
  private buildRegenerationSystemPrompt(isFullRegenerate: boolean): string {
    if (isFullRegenerate) {
      return `你是一个专业的内容编辑助手。你的任务是根据提供的书签内容，重新生成一个段落。

要求：
1. 保持与原段落相似的风格和长度
2. 准确反映书签内容的核心信息
3. 保持流畅的中文表达
4. 只输出新段落内容，不要添加任何解释`;
    }

    return `你是一个专业的内容编辑助手。你的任务是更新一个段落，整合新的书签信息。

要求：
1. 保持原段落的大部分结构
2. 准确整合变更的书签信息
3. 确保更新后的段落连贯通顺
4. 只输出更新后的段落内容，不要添加任何解释`;
  }

  /**
   * 构建重生成用户提示
   */
  private buildRegenerationUserPrompt(
    paragraphImpact: ParagraphImpact,
    currentContent: string,
    bookmarkContents: string[],
    isFullRegenerate: boolean,
  ): string {
    const bookmarkSection = bookmarkContents
      .map((content, i) => `【书签 ${i + 1}】\n${content}`)
      .join("\n\n");

    if (isFullRegenerate) {
      return `请根据以下书签内容重新生成段落：

${bookmarkSection}

原段落供参考（风格和长度）：
${currentContent}

请生成新段落：`;
    }

    return `请更新以下段落，整合变更的书签信息：

原段落：
${currentContent}

相关书签内容：
${bookmarkSection}

影响级别：${paragraphImpact.impactLevel}

请输出更新后的段落：`;
  }

  /**
   * 获取书签内容
   */
  private async getBookmarkContents(
    bookmarkIds: string[],
  ): Promise<Map<string, string>> {
    if (bookmarkIds.length === 0) {
      return new Map();
    }

    const supabase = await createClient();

    // 将字符串 ID 转换为数字 ID
    const numericIds = bookmarkIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (numericIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, ai_summary, description")
      .in("id", numericIds);

    if (error) {
      logger.warn(
        { error: error.message, bookmarkIds },
        "Failed to fetch bookmark contents",
      );
      return new Map();
    }

    const contentMap = new Map<string, string>();
    for (const bookmark of data || []) {
      const content =
        bookmark.ai_summary || bookmark.description || bookmark.title || "";
      contentMap.set(String(bookmark.id), content);
    }

    return contentMap;
  }
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

      // 执行 AI 驱动的增量更新
      const impactAnalysis =
        typedTask.impact_analysis as unknown as ReportImpactAnalysis;

      // 解析报告内容（假设 content 是 JSON 格式包含 paragraphs 数组）
      let paragraphs: string[] = [];
      try {
        const contentData = typedReport?.content as
          | { paragraphs?: string[] }
          | string
          | null;
        if (typeof contentData === "string") {
          paragraphs = contentData.split("\n\n").filter(Boolean);
        } else if (contentData?.paragraphs) {
          paragraphs = contentData.paragraphs;
        }
      } catch {
        logger.warn(
          { reportId: typedTask.report_id },
          "Failed to parse report content",
        );
      }

      // 收集所有受影响的书签 ID
      const allAffectedBookmarkIds = new Set<string>();
      for (const impact of impactAnalysis.paragraphImpacts) {
        for (const bookmarkId of impact.affectedBookmarkIds) {
          allAffectedBookmarkIds.add(bookmarkId);
        }
      }

      // 批量获取书签内容
      const bookmarkContentMap = await this.getBookmarkContents(
        Array.from(allAffectedBookmarkIds),
      );

      // 处理每个受影响的段落
      let paragraphsUpdated = 0;
      let paragraphsRegenerated = 0;
      let totalTokensUsed = 0;
      const updatedParagraphs = [...paragraphs];

      for (const paragraphImpact of impactAnalysis.paragraphImpacts) {
        // 跳过不需要处理的段落
        if (paragraphImpact.suggestedAction === "keep") {
          continue;
        }

        // 跳过需要删除的段落（标记为空）
        if (paragraphImpact.suggestedAction === "remove") {
          if (paragraphImpact.paragraphIndex < updatedParagraphs.length) {
            updatedParagraphs[paragraphImpact.paragraphIndex] = "";
          }
          continue;
        }

        // 获取当前段落内容
        const currentContent =
          paragraphs[paragraphImpact.paragraphIndex] ||
          paragraphImpact.contentPreview;

        // 获取关联书签内容
        const relatedBookmarkContents = paragraphImpact.affectedBookmarkIds
          .map((id) => bookmarkContentMap.get(id))
          .filter((content): content is string => !!content);

        try {
          // 调用 AI 重生成段落
          const { newContent, tokensUsed } =
            await this.regenerateParagraphWithAI(
              paragraphImpact,
              currentContent,
              relatedBookmarkContents,
            );

          // 更新段落
          if (paragraphImpact.paragraphIndex < updatedParagraphs.length) {
            updatedParagraphs[paragraphImpact.paragraphIndex] = newContent;
          }

          totalTokensUsed += tokensUsed;

          if (paragraphImpact.suggestedAction === "regenerate") {
            paragraphsRegenerated++;
          } else {
            paragraphsUpdated++;
          }

          logger.debug(
            {
              paragraphIndex: paragraphImpact.paragraphIndex,
              action: paragraphImpact.suggestedAction,
              tokensUsed,
            },
            "Paragraph processed",
          );
        } catch (aiError) {
          logger.error(
            {
              paragraphIndex: paragraphImpact.paragraphIndex,
              error:
                aiError instanceof Error ? aiError.message : String(aiError),
            },
            "Failed to regenerate paragraph with AI",
          );
          // 继续处理其他段落，不中断整个任务
        }
      }

      // 过滤空段落并重新组装内容
      const filteredParagraphs = updatedParagraphs.filter(Boolean);
      const updatedContent = { paragraphs: filteredParagraphs };
      const updatedContentString = JSON.stringify(updatedContent);

      // 更新报告内容
      await supabase
        .from("synthesis_reports")
        .update({ content: updatedContentString })
        .eq("id", typedTask.report_id);

      // 创建新版本（使用更新后的内容）
      const metadata = typedReport?.generation_metadata as
        | { source_bookmark_ids?: string[] }
        | undefined;
      const versionInsertData: VersionInsert = {
        report_id: typedTask.report_id,
        user_id: typedTask.user_id,
        version: newVersion,
        content: updatedContent as Json,
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
      const tokensUsed =
        totalTokensUsed ||
        paragraphsUpdated * 200 + paragraphsRegenerated * 500;

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
