/**
 * Knowledge Studio - 变更检测服务
 * @module knowledge-studio/incremental
 * @description P4 实现 - 书签变更检测与影响分析
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IChangeDetector,
  BookmarkChange,
  ReportChangeSet,
  ReportImpactAnalysis,
  ParagraphImpact,
  ImpactLevel,
} from "./types";
import type { Database } from "@/types/supabase";

// ============================================================================
// 数据库类型别名（保留用于类型安全参考，暂未使用）
// ============================================================================

type _ChangeSetRow =
  Database["public"]["Tables"]["ks_report_change_sets"]["Row"];
void _ChangeSetRow; // suppress unused warning - reserved for future type-safe refactoring
type ChangeSetInsert =
  Database["public"]["Tables"]["ks_report_change_sets"]["Insert"];
type ChangeSetUpdate =
  Database["public"]["Tables"]["ks_report_change_sets"]["Update"];
type SynthesisReportRow =
  Database["public"]["Tables"]["synthesis_reports"]["Row"];

// ============================================================================
// 内部接口（用于 RPC 返回和行映射）
// ============================================================================

interface ChangeSetRowInternal {
  id: string;
  report_id: string;
  user_id: string;
  changes: BookmarkChange[];
  impact_level: ImpactLevel;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

interface PendingChangeSetRpcResult {
  id: string;
  report_id: string;
  changes: Json;
  impact_level: string;
  created_at: string;
}

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToChangeSet(row: ChangeSetRowInternal): ReportChangeSet {
  return {
    id: row.id,
    reportId: row.report_id,
    changes: row.changes ?? [],
    createdAt: new Date(row.created_at),
    impactLevel: row.impact_level,
    processed: row.processed,
    processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
  };
}

function pendingRpcToChangeSet(
  row: PendingChangeSetRpcResult,
): ReportChangeSet {
  return {
    id: row.id,
    reportId: row.report_id,
    changes: (row.changes as unknown as BookmarkChange[]) ?? [],
    createdAt: new Date(row.created_at),
    impactLevel: row.impact_level as ImpactLevel,
    processed: false,
  };
}

// ============================================================================
// 影响级别计算
// ============================================================================

/**
 * 根据变更计算影响级别
 */
function calculateImpactLevel(changes: BookmarkChange[]): ImpactLevel {
  if (changes.length === 0) return "none";

  const addedCount = changes.filter((c) => c.type === "added").length;
  const removedCount = changes.filter((c) => c.type === "removed").length;
  const modifiedCount = changes.filter((c) => c.type === "modified").length;
  const reorderedCount = changes.filter((c) => c.type === "reordered").length;

  // 重大影响：删除多于 3 个书签，或修改多于 5 个
  if (removedCount > 3 || modifiedCount > 5) {
    return "major";
  }

  // 中等影响：删除 1-3 个书签，或修改 2-5 个
  if (removedCount > 0 || modifiedCount > 1) {
    return "moderate";
  }

  // 轻微影响：新增书签或重排序
  if (addedCount > 0 || reorderedCount > 0 || modifiedCount === 1) {
    return "minor";
  }

  return "none";
}

/**
 * 估算处理时间（秒）
 */
function estimateProcessingTime(
  paragraphsToUpdate: number,
  paragraphsToRegenerate: number,
): number {
  // 更新每段约 2 秒，重生成每段约 5 秒
  return paragraphsToUpdate * 2 + paragraphsToRegenerate * 5;
}

/**
 * 估算 Token 消耗
 */
function estimateTokens(
  paragraphsToUpdate: number,
  paragraphsToRegenerate: number,
): number {
  // 更新每段约 200 tokens，重生成每段约 500 tokens
  return paragraphsToUpdate * 200 + paragraphsToRegenerate * 500;
}

// ============================================================================
// 变更检测服务实现
// ============================================================================

/**
 * 变更检测服务
 *
 * @example
 * ```typescript
 * const detector = new ChangeDetector();
 *
 * // 检测变更
 * const changes = await detector.detectChanges('report-123');
 * if (changes) {
 *   // 分析影响
 *   const impact = await detector.analyzeImpact(changes);
 *   console.log(`影响级别: ${impact.overallImpact}`);
 * }
 * ```
 */
export class ChangeDetector implements IChangeDetector {
  /**
   * 检测报告的书签变更
   *
   * 检查报告关联的书签是否有未处理的变更
   */
  async detectChanges(reportId: string): Promise<ReportChangeSet | null> {
    const supabase = await createClient();

    // 查询未处理的变更集
    const { data, error } = await supabase
      .from("ks_report_change_sets")
      .select("*")
      .eq("report_id", reportId)
      .eq("processed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // 没有找到记录
        logger.debug({ reportId }, "No pending changes found for report");
        return null;
      }
      // 表不存在
      if (error.code === "42P01") {
        logger.warn({ reportId }, "ks_report_change_sets table not found");
        return null;
      }
      logger.error(
        { error: error.message, reportId },
        "Failed to detect changes",
      );
      throw new Error(`检测变更失败: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const typedData = data as unknown as ChangeSetRowInternal;

    logger.info(
      {
        reportId,
        changeSetId: typedData.id,
        changesCount: typedData.changes?.length ?? 0,
      },
      "Changes detected for report",
    );

    return rowToChangeSet(typedData);
  }

  /**
   * 分析变更影响
   *
   * 评估变更对报告各段落的影响程度
   */
  async analyzeImpact(
    changeSet: ReportChangeSet,
  ): Promise<ReportImpactAnalysis> {
    const supabase = await createClient();

    // 获取报告内容以分析段落影响
    const { data: report, error: reportError } = await supabase
      .from("synthesis_reports")
      .select("content, generation_metadata")
      .eq("id", changeSet.reportId)
      .single();

    const paragraphImpacts: ParagraphImpact[] = [];
    let paragraphsToUpdate = 0;
    let paragraphsToRegenerate = 0;

    const typedReport = report as Pick<
      SynthesisReportRow,
      "content" | "generation_metadata"
    > | null;

    if (!reportError && typedReport) {
      // 解析报告内容，分析每个段落
      const content = (typedReport.content as string) || "";
      const paragraphs = content
        .split(/\n\n+/)
        .filter((p: string) => p.trim().length > 0);
      const metadata = typedReport.generation_metadata as
        | { source_bookmark_ids?: string[] }
        | undefined;
      const sourceBookmarkIds = metadata?.source_bookmark_ids || [];

      // 分析每个变更对段落的影响
      for (let i = 0; i < paragraphs.length; i++) {
        const affectedBookmarkIds: string[] = [];

        // 检查变更的书签是否影响此段落
        for (const change of changeSet.changes) {
          if (sourceBookmarkIds.includes(change.bookmarkId)) {
            affectedBookmarkIds.push(change.bookmarkId);
          }
        }

        if (affectedBookmarkIds.length > 0) {
          // 确定段落影响级别和建议操作
          const hasRemoved = changeSet.changes.some(
            (c) =>
              c.type === "removed" &&
              affectedBookmarkIds.includes(c.bookmarkId),
          );
          const hasModified = changeSet.changes.some(
            (c) =>
              c.type === "modified" &&
              affectedBookmarkIds.includes(c.bookmarkId),
          );

          let impactLevel: ImpactLevel;
          let suggestedAction: "keep" | "update" | "regenerate" | "remove";

          if (hasRemoved) {
            impactLevel = "major";
            suggestedAction = "regenerate";
            paragraphsToRegenerate++;
          } else if (hasModified) {
            impactLevel = "moderate";
            suggestedAction = "update";
            paragraphsToUpdate++;
          } else {
            impactLevel = "minor";
            suggestedAction = "update";
            paragraphsToUpdate++;
          }

          paragraphImpacts.push({
            paragraphIndex: i,
            contentPreview: paragraphs[i].substring(0, 100),
            impactLevel,
            affectedBookmarkIds,
            suggestedAction,
          });
        }
      }
    }

    const overallImpact = calculateImpactLevel(changeSet.changes);

    const analysis: ReportImpactAnalysis = {
      reportId: changeSet.reportId,
      changeSetId: changeSet.id,
      overallImpact,
      paragraphImpacts,
      paragraphsToUpdate,
      paragraphsToRegenerate,
      estimatedProcessingTime: estimateProcessingTime(
        paragraphsToUpdate,
        paragraphsToRegenerate,
      ),
      estimatedTokens: estimateTokens(
        paragraphsToUpdate,
        paragraphsToRegenerate,
      ),
    };

    logger.info(
      {
        reportId: changeSet.reportId,
        changeSetId: changeSet.id,
        overallImpact,
        paragraphsToUpdate,
        paragraphsToRegenerate,
      },
      "Impact analysis completed",
    );

    return analysis;
  }

  /**
   * 获取待处理变更
   *
   * 使用 RPC 函数获取用户所有未处理的变更集
   */
  async getPendingChanges(userId: string): Promise<ReportChangeSet[]> {
    const supabase = await createClient();

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc("get_pending_change_sets", {
      p_user_id: userId,
      p_limit: 50,
    });

    if (error) {
      logger.error(
        { error: error.message, userId },
        "Failed to get pending changes",
      );
      throw new Error(`获取待处理变更失败: ${error.message}`);
    }

    const rpcData = data as unknown as PendingChangeSetRpcResult[] | null;
    const changeSets = (rpcData ?? []).map((row) => pendingRpcToChangeSet(row));

    logger.info(
      { userId, count: changeSets.length },
      "Pending changes retrieved",
    );

    return changeSets;
  }

  /**
   * 标记变更已处理
   */
  async markProcessed(changeSetId: string): Promise<void> {
    const supabase = await createClient();

    const updateData: ChangeSetUpdate = {
      processed: true,
      processed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("ks_report_change_sets")
      .update(updateData)
      .eq("id", changeSetId);

    if (error) {
      logger.error(
        { error: error.message, changeSetId },
        "Failed to mark change set as processed",
      );
      throw new Error(`标记变更已处理失败: ${error.message}`);
    }

    logger.info({ changeSetId }, "Change set marked as processed");
  }

  /**
   * 创建变更集
   *
   * 辅助方法：记录书签变更
   */
  async createChangeSet(
    reportId: string,
    userId: string,
    changes: BookmarkChange[],
  ): Promise<ReportChangeSet> {
    const supabase = await createClient();

    const impactLevel = calculateImpactLevel(changes);

    const insertData: ChangeSetInsert = {
      report_id: reportId,
      user_id: userId,
      changes: changes as unknown as Json,
      impact_level: impactLevel,
    };

    const { data, error } = await supabase
      .from("ks_report_change_sets")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error.message, reportId },
        "Failed to create change set",
      );
      throw new Error(`创建变更集失败: ${error.message}`);
    }

    if (!data) {
      throw new Error(`创建变更集失败: 未返回数据`);
    }

    const typedData = data as unknown as ChangeSetRowInternal;

    logger.info(
      {
        reportId,
        changeSetId: typedData.id,
        changesCount: changes.length,
        impactLevel,
      },
      "Change set created",
    );

    return rowToChangeSet(typedData);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建变更检测服务实例
 */
export function createChangeDetector(): IChangeDetector {
  return new ChangeDetector();
}

// 保留旧名称以兼容
export { ChangeDetector as ChangeDetectorStub };
