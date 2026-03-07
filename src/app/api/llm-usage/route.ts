/**
 * V4.2 LLM 使用量统计 API
 * GET /api/llm-usage?period=daily|monthly
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

export const runtime = "edge";

// 模型定价 (每百万 token, 单位: 分) - 预留用于成本计算功能
const _MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 15, output: 60 }, // $0.15/$0.60 per 1M tokens
  "deepseek-chat": { input: 14, output: 28 }, // ¥0.14/¥0.28 per 1M tokens
  "qwen-turbo": { input: 8, output: 20 }, // ¥0.008/¥0.02 per 1K tokens
  default: { input: 20, output: 50 },
};

interface UsageRecord {
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  created_at: string;
}

interface LLMUsageStats {
  period: string;
  date: string;
  totalCalls: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostCents: number;
  byOperation: {
    classification: { calls: number; tokens: number; costCents: number };
    folderNaming: { calls: number; tokens: number; costCents: number };
    contentAnalysis: { calls: number; tokens: number; costCents: number };
    chat: { calls: number; tokens: number; costCents: number };
  };
  byModel: {
    model: string;
    calls: number;
    tokens: number;
    costCents: number;
  }[];
  quota?: {
    dailyLimit: number;
    used: number;
    remaining: number;
  };
  trends?: { date: string; calls: number; costCents: number }[];
}

export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "daily";

    // 确定日期范围
    const now = new Date();
    let startDate: Date;
    let dateFormat: string;

    if (period === "daily") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFormat = now.toISOString().split("T")[0];
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFormat = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    // 查询使用记录 (使用 RPC 或直接查询)
    // Note: llm_usage_log 表在迁移中创建，类型需要手动处理
    const { data: usageData, error: usageError } = (await supabase
      .from("llm_usage_log" as "profiles") // Type cast for new table
      .select(
        "operation, model, input_tokens, output_tokens, cost_cents, created_at",
      )
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })) as unknown as {
      data: UsageRecord[] | null;
      error: Error | null;
    };

    if (usageError) {
      logger.error({ error: usageError }, "Failed to fetch usage data");
      // 返回空数据而非错误
      return NextResponse.json({
        data: createEmptyStats(period, dateFormat),
      });
    }

    const records = (usageData || []) as UsageRecord[];

    // 计算统计数据
    const stats = calculateStats(records, period, dateFormat);

    // 获取每日配额 (仅日度)
    if (period === "daily") {
      // 类型断言: 手动维护类型文件时需要此断言
      type ProfileMembershipRow = { membership_type: string | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileData } = (await (supabase.from("profiles") as any)
        .select("membership_type")
        .eq("id", userId)
        .single()) as { data: ProfileMembershipRow | null };

      // PRO 用户 500 次，FREE 用户 100 次
      const dailyLimit = profileData?.membership_type === "PRO" ? 500 : 100;
      stats.quota = {
        dailyLimit,
        used: stats.totalCalls,
        remaining: Math.max(0, dailyLimit - stats.totalCalls),
      };
    }

    // 获取趋势数据 (仅月度)
    if (period === "monthly") {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: trendData } = (await supabase
        .from("llm_usage_log" as "profiles")
        .select("created_at, cost_cents")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString())) as unknown as {
        data: { created_at: string; cost_cents: number }[] | null;
        error: Error | null;
      };

      if (trendData) {
        stats.trends = calculateTrends(trendData);
      }
    }

    return NextResponse.json({ data: stats });
  },
);

function createEmptyStats(period: string, date: string): LLMUsageStats {
  return {
    period,
    date,
    totalCalls: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalCostCents: 0,
    byOperation: {
      classification: { calls: 0, tokens: 0, costCents: 0 },
      folderNaming: { calls: 0, tokens: 0, costCents: 0 },
      contentAnalysis: { calls: 0, tokens: 0, costCents: 0 },
      chat: { calls: 0, tokens: 0, costCents: 0 },
    },
    byModel: [],
  };
}

function calculateStats(
  records: UsageRecord[],
  period: string,
  date: string,
): LLMUsageStats {
  const stats = createEmptyStats(period, date);

  const modelMap = new Map<
    string,
    { calls: number; tokens: number; costCents: number }
  >();

  for (const record of records) {
    const tokens = record.input_tokens + record.output_tokens;
    const cost = record.cost_cents;

    stats.totalCalls++;
    stats.totalTokens += tokens;
    stats.inputTokens += record.input_tokens;
    stats.outputTokens += record.output_tokens;
    stats.totalCostCents += cost;

    // 按操作类型统计
    const opKey = mapOperation(record.operation);
    if (opKey in stats.byOperation) {
      const op = stats.byOperation[opKey as keyof typeof stats.byOperation];
      op.calls++;
      op.tokens += tokens;
      op.costCents += cost;
    }

    // 按模型统计
    const existing = modelMap.get(record.model);
    if (existing) {
      existing.calls++;
      existing.tokens += tokens;
      existing.costCents += cost;
    } else {
      modelMap.set(record.model, { calls: 1, tokens, costCents: cost });
    }
  }

  stats.byModel = Array.from(modelMap.entries())
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.costCents - a.costCents);

  return stats;
}

function mapOperation(operation: string): string {
  if (operation.includes("classif")) return "classification";
  if (operation.includes("naming") || operation.includes("folder"))
    return "folderNaming";
  if (operation.includes("content") || operation.includes("analysis"))
    return "contentAnalysis";
  if (operation.includes("chat")) return "chat";
  return "classification";
}

function calculateTrends(
  data: { created_at: string; cost_cents: number }[],
): { date: string; calls: number; costCents: number }[] {
  const dayMap = new Map<string, { calls: number; costCents: number }>();

  for (const record of data) {
    const date = record.created_at.split("T")[0];
    const existing = dayMap.get(date);
    if (existing) {
      existing.calls++;
      existing.costCents += record.cost_cents;
    } else {
      dayMap.set(date, { calls: 1, costCents: record.cost_cents });
    }
  }

  return Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // 最近14天
}
