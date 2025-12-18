/**
 * Classification Statistics API
 * V4.2 分类统计 API
 *
 * GET /api/classification/statistics - 获取分类统计数据
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import type { NextRequest } from "next/server";

// 表名常量
const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;
const SOURCE_PROFILES_TABLE = "source_profiles" as const;

// ============================================================================
// GET - 获取分类统计
// ============================================================================

interface StatisticsQueryParams {
  /** 统计周期：today, week, month, all */
  period?: "today" | "week" | "month" | "all";
}

/**
 * GET /api/classification/statistics
 * 获取当前用户的分类统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const period =
      (searchParams.get("period") as StatisticsQueryParams["period"]) || "all";

    // 计算时间范围
    let startDate: Date | null = null;
    const now = new Date();

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        startDate = null;
    }

    // 获取托管模式统计（从 effectiveConfig 获取）
    const effectiveConfig = await trustModeService.getEffectiveConfig(user.id);
    const trustModeStats = {
      mode: effectiveConfig.mode,
      autoDecisionsToday: effectiveConfig.stats.autoDecisions,
      userCorrections: effectiveConfig.stats.userCorrections,
      pendingConfirmations: effectiveConfig.stats.pendingConfirmations,
      correctionRate: effectiveConfig.stats.correctionRate,
    };

    // 获取待确认统计
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let confirmationQuery = (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("status", { count: "exact" })
      .eq("user_id", user.id);

    if (startDate) {
      confirmationQuery = confirmationQuery.gte(
        "created_at",
        startDate.toISOString(),
      );
    }

    const { data: confirmationData, error: confirmationError } =
      await confirmationQuery;

    // 统计各状态数量
    const confirmationStats = {
      pending: 0,
      confirmed: 0,
      rejected: 0,
      modified: 0,
      expired: 0,
    };

    if (!confirmationError && confirmationData) {
      for (const item of confirmationData) {
        const status = item.status as keyof typeof confirmationStats;
        if (status in confirmationStats) {
          confirmationStats[status]++;
        }
      }
    }

    // 获取来源画像统计
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sourceData, error: sourceError } = await (supabase as any)
      .from(SOURCE_PROFILES_TABLE)
      .select("source_type, sample_count, trust_score")
      .eq("user_id", user.id);

    const sourceStats = {
      totalSources: 0,
      byType: {
        wechat: 0,
        website: 0,
        app: 0,
        unknown: 0,
      },
      totalSamples: 0,
      avgTrustScore: 0,
      highTrustSources: 0, // trust_score > 70
    };

    if (!sourceError && sourceData) {
      sourceStats.totalSources = sourceData.length;
      let totalTrustScore = 0;

      for (const item of sourceData) {
        // 按类型统计
        const sourceType = item.source_type as keyof typeof sourceStats.byType;
        if (sourceType in sourceStats.byType) {
          sourceStats.byType[sourceType]++;
        }

        // 累计样本数
        sourceStats.totalSamples += item.sample_count || 0;

        // 累计可信度
        totalTrustScore += item.trust_score || 0;

        // 高可信度来源
        if (item.trust_score > 70) {
          sourceStats.highTrustSources++;
        }
      }

      // 计算平均可信度
      if (sourceStats.totalSources > 0) {
        sourceStats.avgTrustScore = Math.round(
          totalTrustScore / sourceStats.totalSources,
        );
      }
    }

    // 获取书签分类统计
    // V4.2.8: 修复统计错误 - 使用分离的 count 查询，避免 Supabase 默认 1000 行限制
    // 同时统一口径：排除垃圾箱中的书签，与 bookmarks API 保持一致

    // 查询1：已分类的书签数量（folder_id 不为空）
    let classifiedQuery = supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_in_trash", false) // 排除垃圾箱
      .not("folder_id", "is", null);

    if (startDate) {
      classifiedQuery = classifiedQuery.gte(
        "created_at",
        startDate.toISOString(),
      );
    }

    // 查询2：未分类的书签数量（folder_id 为空）
    let unclassifiedQuery = supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_in_trash", false) // 排除垃圾箱
      .is("folder_id", null);

    if (startDate) {
      unclassifiedQuery = unclassifiedQuery.gte(
        "created_at",
        startDate.toISOString(),
      );
    }

    // 并行执行两个查询
    const [classifiedResult, unclassifiedResult] = await Promise.all([
      classifiedQuery,
      unclassifiedQuery,
    ]);

    const classifiedCount = classifiedResult.count || 0;
    const unclassifiedCount = unclassifiedResult.count || 0;

    const bookmarkStats = {
      total: classifiedCount + unclassifiedCount,
      classified: classifiedCount,
      unclassified: unclassifiedCount,
    };

    // 计算效率指标
    const efficiency = {
      // 自动分类率
      autoClassificationRate:
        bookmarkStats.total > 0
          ? Math.round(
              (trustModeStats.autoDecisionsToday /
                Math.max(bookmarkStats.total, 1)) *
                100,
            )
          : 0,
      // 确认采纳率
      confirmationAcceptRate:
        confirmationStats.confirmed + confirmationStats.rejected > 0
          ? Math.round(
              (confirmationStats.confirmed /
                (confirmationStats.confirmed + confirmationStats.rejected)) *
                100,
            )
          : 0,
      // 快速路径命中率（预留）
      fastPathHitRate: 0,
    };

    return successResponse({
      period,
      trustMode: trustModeStats,
      confirmations: confirmationStats,
      sources: sourceStats,
      bookmarks: bookmarkStats,
      efficiency,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "GET /api/classification/statistics error",
    );
    return internalError("获取分类统计失败");
  }
}
