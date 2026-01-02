/**
 * Knowledge Studio Usage Tracker - 使用统计追踪器
 * @module knowledge-studio/analytics
 * @description 追踪和统计用户在知识工坊的使用情况
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type { BlueprintType, QuotaOperationType } from "../types";
import type {
  KSUsageStats,
  KSAnalyticsConfig,
  OperationStat,
  BlueprintTypeStat,
  DailyUsageTrend,
} from "./types";
import { DEFAULT_KS_ANALYTICS_CONFIG } from "./types";

const logger = createLogger("ks-usage-tracker");

// ============================================================================
// 数据库记录类型
// ============================================================================

interface QuotaOperationRow {
  id: string;
  operation_type: QuotaOperationType;
  status: "pending" | "confirmed" | "refunded";
  cost: number;
  created_at: string;
}

interface SynthesisReportRow {
  id: string;
  blueprint_type: BlueprintType;
  generation_metadata: {
    durationMs?: number;
    tokens?: {
      total?: number;
    };
  };
  created_at: string;
}

// ============================================================================
// UsageTracker 类
// ============================================================================

/**
 * 使用统计追踪器
 */
export class UsageTracker {
  private supabase: SupabaseClient;
  private userId: string;
  private config: KSAnalyticsConfig;

  constructor(
    supabase: SupabaseClient,
    userId: string,
    config: Partial<KSAnalyticsConfig> = {},
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.config = { ...DEFAULT_KS_ANALYTICS_CONFIG, ...config };
  }

  /**
   * 获取完整使用统计
   */
  async getUsageStats(): Promise<KSUsageStats> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    logger.info(
      { userId: this.userId, periodDays: this.config.periodDays },
      "Fetching KS usage stats",
    );

    // 并行获取数据
    const [operations, reports] = await Promise.all([
      this.fetchQuotaOperations(periodStart),
      this.config.includeBlueprintStats
        ? this.fetchSynthesisReports(periodStart)
        : Promise.resolve([]),
    ]);

    // 计算各项统计
    const byOperation = this.calculateOperationStats(operations);
    const summary = this.calculateSummary(operations, reports.length);
    const byBlueprint = this.config.includeBlueprintStats
      ? this.calculateBlueprintStats(reports)
      : [];
    const dailyTrend = this.config.includeDailyTrend
      ? this.calculateDailyTrend(operations)
      : [];

    return {
      periodDays: this.config.periodDays,
      periodStart,
      periodEnd,
      summary,
      byOperation,
      byBlueprint,
      dailyTrend,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // 数据获取方法
  // ==========================================================================

  private async fetchQuotaOperations(
    periodStart: string,
  ): Promise<QuotaOperationRow[]> {
    const { data, error } = await this.supabase
      .from("quota_operations")
      .select("id, operation_type, status, cost, created_at")
      .eq("user_id", this.userId)
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to fetch quota operations",
      );
      throw new Error(`Failed to fetch quota operations: ${error.message}`);
    }

    return (data || []) as QuotaOperationRow[];
  }

  private async fetchSynthesisReports(
    periodStart: string,
  ): Promise<SynthesisReportRow[]> {
    const { data, error } = await this.supabase
      .from("synthesis_reports")
      .select("id, blueprint_type, generation_metadata, created_at")
      .eq("user_id", this.userId)
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to fetch synthesis reports",
      );
      // 不抛错，返回空数组
      return [];
    }

    return (data || []) as SynthesisReportRow[];
  }

  // ==========================================================================
  // 统计计算方法
  // ==========================================================================

  private calculateSummary(
    operations: QuotaOperationRow[],
    reportsCount: number,
  ): KSUsageStats["summary"] {
    const confirmed = operations.filter((o) => o.status === "confirmed");
    const refunded = operations.filter((o) => o.status === "refunded");

    const totalCostConsumed = confirmed.reduce((sum, o) => sum + o.cost, 0);
    const totalCostRefunded = refunded.reduce((sum, o) => sum + o.cost, 0);

    const successRate =
      operations.length > 0
        ? Math.round((confirmed.length / operations.length) * 100)
        : 0;

    const avgDailyOperations =
      this.config.periodDays > 0
        ? Math.round((operations.length / this.config.periodDays) * 10) / 10
        : 0;

    return {
      totalOperations: operations.length,
      totalCostConsumed,
      totalCostRefunded,
      successRate,
      reportsGenerated: reportsCount,
      avgDailyOperations,
    };
  }

  private calculateOperationStats(
    operations: QuotaOperationRow[],
  ): OperationStat[] {
    const operationTypes: QuotaOperationType[] = [
      "blueprint_generation",
      "chat_edit",
      "material_analysis",
    ];

    return operationTypes.map((operationType) => {
      const typeOps = operations.filter(
        (o) => o.operation_type === operationType,
      );
      const confirmed = typeOps.filter((o) => o.status === "confirmed");
      const refunded = typeOps.filter((o) => o.status === "refunded");
      const pending = typeOps.filter((o) => o.status === "pending");

      return {
        operationType,
        totalCount: typeOps.length,
        successCount: confirmed.length,
        refundedCount: refunded.length,
        pendingCount: pending.length,
        totalCost: typeOps.reduce((sum, o) => sum + o.cost, 0),
        confirmedCost: confirmed.reduce((sum, o) => sum + o.cost, 0),
      };
    });
  }

  private calculateBlueprintStats(
    reports: SynthesisReportRow[],
  ): BlueprintTypeStat[] {
    const blueprintTypes: BlueprintType[] = [
      "debater",
      "blogger",
      "thread",
      "tutorial",
      "feynman",
    ];

    return blueprintTypes
      .map((blueprintType) => {
        const typeReports = reports.filter(
          (r) => r.blueprint_type === blueprintType,
        );

        if (typeReports.length === 0) {
          return null;
        }

        const durations = typeReports
          .map((r) => r.generation_metadata?.durationMs)
          .filter((d): d is number => typeof d === "number" && d > 0);

        const tokens = typeReports
          .map((r) => r.generation_metadata?.tokens?.total)
          .filter((t): t is number => typeof t === "number" && t > 0);

        return {
          blueprintType,
          count: typeReports.length,
          avgDurationMs:
            durations.length > 0
              ? Math.round(
                  durations.reduce((a, b) => a + b, 0) / durations.length,
                )
              : 0,
          avgTokens:
            tokens.length > 0
              ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)
              : 0,
        };
      })
      .filter((stat): stat is BlueprintTypeStat => stat !== null);
  }

  private calculateDailyTrend(
    operations: QuotaOperationRow[],
  ): DailyUsageTrend[] {
    const trendMap = new Map<
      string,
      {
        blueprintCount: number;
        chatEditCount: number;
        materialAnalysisCount: number;
        totalCost: number;
      }
    >();

    // 初始化所有日期
    for (let i = this.config.periodDays - 1; i >= 0; i--) {
      const date = this.formatDate(this.getDaysAgo(i));
      trendMap.set(date, {
        blueprintCount: 0,
        chatEditCount: 0,
        materialAnalysisCount: 0,
        totalCost: 0,
      });
    }

    // 统计每日数据
    operations.forEach((op) => {
      const date = this.formatDate(new Date(op.created_at));
      const entry = trendMap.get(date);

      if (entry) {
        entry.totalCost += op.cost;

        switch (op.operation_type) {
          case "blueprint_generation":
            entry.blueprintCount++;
            break;
          case "chat_edit":
            entry.chatEditCount++;
            break;
          case "material_analysis":
            entry.materialAnalysisCount++;
            break;
        }
      }
    });

    return Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  // ==========================================================================
  // 工具方法
  // ==========================================================================

  private getPeriodStart(): string {
    const date = this.getDaysAgo(this.config.periodDays);
    return date.toISOString();
  }

  private getDaysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建使用统计追踪器
 */
export function createUsageTracker(
  supabase: SupabaseClient,
  userId: string,
  config?: Partial<KSAnalyticsConfig>,
): UsageTracker {
  return new UsageTracker(supabase, userId, config);
}
