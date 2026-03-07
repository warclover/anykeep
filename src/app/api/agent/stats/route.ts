/**
 * AI Skills Statistics API
 * GET /api/agent/stats - 获取 AI Skills 使用统计
 *
 * @version 1.0.1
 * @since 2025-12-22
 */

import { createClient } from "@/lib/supabase/server";
import { successResponse, internalError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * Skills 统计类型
 */
interface SkillStats {
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokensUsed: number;
}

interface SkillUsage {
  skillId: string;
  executionCount: number;
  successRate: number;
  avgLatencyMs: number;
}

interface StatsResponse {
  overall: SkillStats;
  bySkill: SkillUsage[];
  recentExecutions: Array<{
    id: string;
    skillId: string;
    status: string;
    latencyMs: number | null;
    createdAt: string;
  }>;
  period: {
    start: string;
    end: string;
    days: number;
  };
}

/**
 * GET /api/agent/stats
 * 获取 AI Skills 使用统计
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  // 1. 解析查询参数
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 2. 获取总体统计
  const supabase = await createClient();
  // 类型断言: 手动维护类型文件时需要此断言
  type SkillExecution = {
    id: string;
    skill_id: string;
    status: string;
    latency_ms: number | null;
    tokens_used: number | null;
    created_at: string;
  };
  const { data: executions, error: execError } = (await supabase
    .from("ai_skill_executions")
    .select("id, skill_id, status, latency_ms, tokens_used, created_at")
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false })) as unknown as {
    data: SkillExecution[] | null;
    error: { message: string; code?: string } | null;
  };

  if (execError) {
    // 如果表不存在，返回空统计
    if (
      execError.message?.includes("does not exist") ||
      execError.code === "42P01"
    ) {
      return successResponse({
        overall: {
          totalExecutions: 0,
          successCount: 0,
          errorCount: 0,
          successRate: 0,
          avgLatencyMs: 0,
          totalTokensUsed: 0,
        },
        bySkill: [],
        recentExecutions: [],
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          days,
        },
        message: "AI Skills 功能尚未启用",
      });
    }

    logger.error({ error: execError }, "Failed to fetch skill executions");
    return internalError("获取统计数据失败");
  }

  const allExecutions = executions || [];

  // 3. 计算总体统计
  const totalExecutions = allExecutions.length;
  const successCount = allExecutions.filter(
    (e) => e.status === "success",
  ).length;
  const errorCount = allExecutions.filter(
    (e) => e.status === "error" || e.status === "timeout",
  ).length;
  const successRate =
    totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

  const latencies = allExecutions
    .filter((e) => e.latency_ms != null)
    .map((e) => e.latency_ms as number);
  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

  const totalTokensUsed = allExecutions.reduce(
    (sum, e) => sum + (e.tokens_used || 0),
    0,
  );

  // 4. 按 Skill 分组统计
  const skillGroups = new Map<
    string,
    { total: number; success: number; latencies: number[] }
  >();

  allExecutions.forEach((exec) => {
    const group = skillGroups.get(exec.skill_id) || {
      total: 0,
      success: 0,
      latencies: [],
    };
    group.total++;
    if (exec.status === "success") {
      group.success++;
    }
    if (exec.latency_ms != null) {
      group.latencies.push(exec.latency_ms);
    }
    skillGroups.set(exec.skill_id, group);
  });

  const bySkill: SkillUsage[] = Array.from(skillGroups.entries())
    .map(([skillId, data]) => ({
      skillId,
      executionCount: data.total,
      successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
      avgLatencyMs:
        data.latencies.length > 0
          ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length
          : 0,
    }))
    .sort((a, b) => b.executionCount - a.executionCount);

  // 5. 最近执行记录
  const recentExecutions = allExecutions.slice(0, 10).map((exec) => ({
    id: exec.id,
    skillId: exec.skill_id,
    status: exec.status,
    latencyMs: exec.latency_ms,
    createdAt: exec.created_at,
  }));

  // 6. 构建响应
  const stats: StatsResponse = {
    overall: {
      totalExecutions,
      successCount,
      errorCount,
      successRate: Math.round(successRate * 100) / 100,
      avgLatencyMs: Math.round(avgLatencyMs),
      totalTokensUsed,
    },
    bySkill,
    recentExecutions,
    period: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
      days,
    },
  };

  logger.debug(
    {
      userId,
      totalExecutions,
      successRate: stats.overall.successRate,
    },
    "AI Skills stats fetched",
  );

  return successResponse(stats);
});
