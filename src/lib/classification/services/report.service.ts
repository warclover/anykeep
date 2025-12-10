/**
 * Report Service (V4.2)
 * 月度进化报告服务 - 生成用户的 AI 文件夹管理报告
 *
 * 核心功能：
 * - 收集分类统计数据
 * - 生成月度报告
 * - 提供优化建议
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { v42Table } from "@/lib/supabase/v42-types";
import { operationLogService } from "./operation-log.service";
import { logger } from "@/lib/logger";

// ============================================
// Type Definitions
// ============================================

/**
 * Monthly report data
 */
export interface MonthlyReport {
  id: number;
  userId: string;
  reportMonth: string;

  // Classification stats
  totalClassified: number;
  autoClassified: number;
  manualAdjusted: number;

  // Folder changes
  foldersCreated: number;
  foldersSplit: number;
  foldersMerged: number;
  foldersRenamed: number;

  // Quality metrics
  avgConfidence: number | null;
  acceptanceRate: number | null;
  healthScore: number | null;

  // Suggestions
  pendingSuggestions: number;
  suggestions: ReportSuggestion[];

  // Metadata
  generatedAt: string;
  viewedAt: string | null;
}

/**
 * Report suggestion
 */
export interface ReportSuggestion {
  type: "merge" | "split" | "rename" | "cleanup";
  description: string;
  targetFolders: Array<{ id: number; name: string }>;
  priority: "high" | "medium" | "low";
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  forceRegenerate?: boolean;
}

// ============================================
// ReportService Class
// ============================================

export class ReportService {
  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * Generate monthly report for a user
   */
  async generateMonthlyReport(
    userId: string,
    month?: string,
    options: ReportGenerationOptions = {},
  ): Promise<MonthlyReport | null> {
    const supabase = await this.getSupabase();

    // Default to current month
    const reportMonth = month || this.getCurrentMonth();

    // Check if report already exists
    if (!options.forceRegenerate) {
      const existing = await this.getReport(userId, reportMonth);
      if (existing) {
        return existing;
      }
    }

    try {
      // 1. Get classification stats
      const classificationStats = await this.getClassificationStats(
        userId,
        reportMonth,
      );

      // 2. Get folder changes from operation snapshots
      const folderChanges = await this.getFolderChanges(userId, reportMonth);

      // 3. Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(
        userId,
        reportMonth,
      );

      // 4. Generate suggestions
      const suggestions = await this.generateSuggestions(userId);

      // 5. Calculate health score
      const healthScore = this.calculateHealthScore(
        classificationStats,
        qualityMetrics,
        suggestions.length,
      );

      // 6. Save report (V4.2 表)
      const { data: report, error } = await v42Table(supabase)
        .from("evolution_reports")
        .upsert(
          {
            user_id: userId,
            report_month: reportMonth,
            total_classified: classificationStats.total,
            auto_classified: classificationStats.auto,
            manual_adjusted: classificationStats.manual,
            folders_created: folderChanges.created,
            folders_split: folderChanges.split,
            folders_merged: folderChanges.merged,
            folders_renamed: folderChanges.renamed,
            avg_confidence: qualityMetrics.avgConfidence,
            acceptance_rate: qualityMetrics.acceptanceRate,
            health_score: healthScore,
            pending_suggestions: suggestions.length,
            suggestions_data: JSON.stringify(suggestions),
            generated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,report_month",
          },
        )
        .select()
        .single();

      if (error) {
        logger.error(
          { error: error.message },
          "ReportService: Failed to save report",
        );
        return null;
      }

      // 7. Send notification
      await operationLogService.sendEvolutionReport(
        userId,
        reportMonth,
        classificationStats.total,
        folderChanges.created,
        `/settings/ai-reports/${report.id}`,
      );

      return this.mapReportToInterface(report);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ReportService: Failed to generate report",
      );
      return null;
    }
  }

  /**
   * Get existing report
   */
  async getReport(
    userId: string,
    month: string,
  ): Promise<MonthlyReport | null> {
    const supabase = await this.getSupabase();

    // V4.2 表
    const { data, error } = await v42Table(supabase)
      .from("evolution_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("report_month", month)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapReportToInterface(data);
  }

  /**
   * Get all reports for a user
   */
  async getReports(userId: string, limit = 12): Promise<MonthlyReport[]> {
    const supabase = await this.getSupabase();

    // V4.2 表
    const { data, error } = await v42Table(supabase)
      .from("evolution_reports")
      .select("*")
      .eq("user_id", userId)
      .order("report_month", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((r: Record<string, unknown>) => this.mapReportToInterface(r));
  }

  /**
   * Mark report as viewed
   */
  async markReportViewed(userId: string, reportId: number): Promise<void> {
    const supabase = await this.getSupabase();

    // V4.2 表
    await v42Table(supabase)
      .from("evolution_reports")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", reportId)
      .eq("user_id", userId);
  }

  /**
   * Get classification statistics for a month
   */
  private async getClassificationStats(
    userId: string,
    month: string,
  ): Promise<{ total: number; auto: number; manual: number }> {
    const supabase = await this.getSupabase();

    const { year, monthNum } = this.parseMonth(month);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // Get bookmarks classified this month
    const { count: total } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("folder_id", "is", null)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // Get manually adjusted (from classification_metrics, V4.2 表)
    const { data: metrics } = await v42Table(supabase)
      .from("classification_metrics")
      .select("user_feedback")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // 类型断言
    type MetricRow = { user_feedback: string | null };
    const typedMetrics = (metrics || []) as MetricRow[];

    const manual = typedMetrics.filter(
      (m: MetricRow) => m.user_feedback === "modify" || m.user_feedback === "reject",
    ).length;
    const auto = (total || 0) - manual;

    return {
      total: total || 0,
      auto: Math.max(0, auto),
      manual,
    };
  }

  /**
   * Get folder changes from operation snapshots
   */
  private async getFolderChanges(
    userId: string,
    month: string,
  ): Promise<{
    created: number;
    split: number;
    merged: number;
    renamed: number;
  }> {
    const supabase = await this.getSupabase();

    const { year, monthNum } = this.parseMonth(month);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // V4.2 表
    const { data } = await v42Table(supabase)
      .from("operation_snapshots")
      .select("action")
      .eq("user_id", userId)
      .eq("is_undone", false)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // 类型断言
    type OpRow = { action: string };
    const typedOps = (data || []) as OpRow[];

    const counts = {
      created: 0,
      split: 0,
      merged: 0,
      renamed: 0,
    };

    for (const op of typedOps) {
      switch (op.action) {
        case "create":
          counts.created++;
          break;
        case "split":
          counts.split++;
          break;
        case "merge":
          counts.merged++;
          break;
        case "rename":
          counts.renamed++;
          break;
      }
    }

    return counts;
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(
    userId: string,
    month: string,
  ): Promise<{ avgConfidence: number | null; acceptanceRate: number | null }> {
    const supabase = await this.getSupabase();

    const { year, monthNum } = this.parseMonth(month);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // V4.2 表
    const { data } = await v42Table(supabase)
      .from("classification_metrics")
      .select("confidence, user_feedback")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (!data || data.length === 0) {
      return { avgConfidence: null, acceptanceRate: null };
    }

    // 类型断言
    type QualityRow = { confidence: number; user_feedback: string | null };
    const typedData = data as QualityRow[];

    const avgConfidence =
      typedData.reduce((sum: number, d: QualityRow) => sum + d.confidence, 0) / typedData.length;

    const withFeedback = typedData.filter((d: QualityRow) => d.user_feedback !== null);
    const accepted = withFeedback.filter((d: QualityRow) => d.user_feedback === "accept");
    const acceptanceRate =
      withFeedback.length > 0 ? accepted.length / withFeedback.length : null;

    return {
      avgConfidence: Math.round(avgConfidence),
      acceptanceRate:
        acceptanceRate !== null ? Math.round(acceptanceRate * 100) / 100 : null,
    };
  }

  /**
   * Generate optimization suggestions
   */
  private async generateSuggestions(
    userId: string,
  ): Promise<ReportSuggestion[]> {
    const supabase = await this.getSupabase();
    const suggestions: ReportSuggestion[] = [];

    // 1. Check for folders with low internal similarity (split candidates, V4.2 表)
    const { data: splitCandidates } = await v42Table(supabase)
      .from("folder_profiles")
      .select(
        `
        folder_id,
        internal_similarity,
        folders!inner (id, name)
      `,
      )
      .eq("folders.user_id", userId)
      .is("folders.deleted_at", null)
      .lt("internal_similarity", 0.5)
      .gte("bookmark_count", 10)
      .limit(3);

    if (splitCandidates && splitCandidates.length > 0) {
      for (const candidate of splitCandidates) {
        const folder = candidate.folders as unknown as {
          id: number;
          name: string;
        };
        suggestions.push({
          type: "split",
          description: `文件夹「${folder.name}」内容较杂，建议分拆`,
          targetFolders: [{ id: folder.id, name: folder.name }],
          priority: candidate.internal_similarity! < 0.4 ? "high" : "medium",
        });
      }
    }

    // 2. Check for empty or near-empty folders (cleanup candidates)
    const { data: emptyFolders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_system", false)
      .limit(5);

    if (emptyFolders) {
      for (const folder of emptyFolders) {
        const { count } = await supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("folder_id", folder.id)
          .is("deleted_at", null);

        if (count !== null && count < 2) {
          suggestions.push({
            type: "cleanup",
            description: `文件夹「${folder.name}」只有 ${count} 条内容，建议整理`,
            targetFolders: [{ id: folder.id, name: folder.name }],
            priority: "low",
          });
        }
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(
    stats: { total: number; auto: number; manual: number },
    quality: { avgConfidence: number | null; acceptanceRate: number | null },
    pendingSuggestions: number,
  ): number {
    let score = 70; // Base score

    // Auto classification rate bonus (max +15)
    if (stats.total > 0) {
      const autoRate = stats.auto / stats.total;
      score += Math.round(autoRate * 15);
    }

    // Confidence bonus (max +10)
    if (quality.avgConfidence !== null) {
      score += Math.round((quality.avgConfidence / 100) * 10);
    }

    // Acceptance rate bonus (max +10)
    if (quality.acceptanceRate !== null) {
      score += Math.round(quality.acceptanceRate * 10);
    }

    // Pending suggestions penalty (max -15)
    score -= Math.min(pendingSuggestions * 3, 15);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Map database row to interface
   */
  private mapReportToInterface(row: Record<string, unknown>): MonthlyReport {
    let suggestions: ReportSuggestion[] = [];
    try {
      suggestions =
        typeof row.suggestions_data === "string"
          ? JSON.parse(row.suggestions_data)
          : (row.suggestions_data as ReportSuggestion[]) || [];
    } catch {
      suggestions = [];
    }

    return {
      id: row.id as number,
      userId: row.user_id as string,
      reportMonth: row.report_month as string,
      totalClassified: row.total_classified as number,
      autoClassified: row.auto_classified as number,
      manualAdjusted: row.manual_adjusted as number,
      foldersCreated: row.folders_created as number,
      foldersSplit: row.folders_split as number,
      foldersMerged: row.folders_merged as number,
      foldersRenamed: row.folders_renamed as number,
      avgConfidence: row.avg_confidence as number | null,
      acceptanceRate: row.acceptance_rate as number | null,
      healthScore: row.health_score as number | null,
      pendingSuggestions: row.pending_suggestions as number,
      suggestions,
      generatedAt: row.generated_at as string,
      viewedAt: row.viewed_at as string | null,
    };
  }

  /**
   * Get current month string
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  /**
   * Parse month string to year and month number
   */
  private parseMonth(month: string): { year: number; monthNum: number } {
    const [year, monthNum] = month.split("-").map(Number);
    return { year, monthNum };
  }
}

// Export singleton
export const reportService = new ReportService();
