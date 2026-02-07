/**
 * AI 成本统计 Hook
 *
 * 获取用户 AI 使用的成本和配额统计信息
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 每日成本数据
 */
export interface DailyCostData {
  /** 今日成本（元） */
  today: number;
  /** 本月成本（元） */
  month: number;
  /** 每日明细 */
  daily: Array<{
    date: string;
    cost: number;
    tokens: number;
  }>;
}

/**
 * 对话统计
 */
export interface ChatStats {
  /** 今日对话次数 */
  today: number;
  /** 本月对话次数 */
  month: number;
  /** 总对话次数 */
  total: number;
}

/**
 * 配额统计
 */
export interface QuotaStats {
  /** 已使用 Token */
  used: number;
  /** 总配额 */
  total: number;
  /** 配额类型 */
  quotaType: string;
  /** 重置时间 */
  resetAt: string | null;
}

/**
 * 会员权益
 */
export interface Entitlement {
  /** 会员等级 */
  tier: string;
  /** 每月 Token 配额 */
  monthlyQuota: number;
  /** 已使用比例 */
  usedPercentage: number;
}

/**
 * 成本明细项
 */
export interface CostBreakdownItem {
  /** 操作类型 */
  operation: string;
  /** 操作名称 */
  operationLabel: string;
  /** 调用次数 */
  callCount: number;
  /** 消耗 Token */
  tokens: number;
  /** 费用（元） */
  cost: number;
}

/**
 * Hook 返回值
 */
export interface UseAiCostStatsReturn {
  /** 今日成本（元） */
  dailyCost: number;
  /** 本月成本（元） */
  monthlyCost: number;
  /** 对话统计 */
  chatStats: ChatStats;
  /** 配额统计 */
  quotaStats: QuotaStats;
  /** 会员权益 */
  entitlement: Entitlement | null;
  /** 成本明细 */
  breakdown: CostBreakdownItem[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================================================
// 常量
// ============================================================================

const QUERY_KEY = ["ai-cost-stats"] as const;

const OPERATION_LABELS: Record<string, string> = {
  classification: "智能分类",
  folder_naming: "文件夹命名",
  content_analysis: "内容分析",
  chat: "AI 对话",
  summary: "智能摘要",
  embedding: "向量嵌入",
  search: "语义搜索",
  synthesis: "主题合成",
};

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * AI 成本统计 Hook
 *
 * @example
 * ```tsx
 * const { dailyCost, monthlyCost, quotaStats } = useAiCostStats();
 * ```
 */
export function useAiCostStats(): UseAiCostStatsReturn {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const supabase = createClient();

      // 并行获取所有统计数据
      const [
        dailyCostResult,
        chatStatsResult,
        quotaStatsResult,
        entitlementResult,
      ] = await Promise.all([
        // 获取每日 LLM 成本
        supabase.rpc("get_user_daily_llm_cost", { p_days: 30 }),
        // 获取对话统计
        supabase.rpc("get_user_chat_stats"),
        // 获取配额统计
        supabase.rpc("get_unified_quota_stats"),
        // 获取用户权益
        supabase.rpc("get_user_entitlement"),
      ]);

      // 处理错误
      if (dailyCostResult.error) {
        clientLogger.warn(
          { error: dailyCostResult.error },
          "[useAiCostStats] Failed to get daily cost",
        );
      }
      if (chatStatsResult.error) {
        clientLogger.warn(
          { error: chatStatsResult.error },
          "[useAiCostStats] Failed to get chat stats",
        );
      }
      if (quotaStatsResult.error) {
        clientLogger.warn(
          { error: quotaStatsResult.error },
          "[useAiCostStats] Failed to get quota stats",
        );
      }

      // 解析每日成本数据
      const dailyCostData = dailyCostResult.data;
      let todayCost = 0;
      let monthCost = 0;
      const breakdown: CostBreakdownItem[] = [];

      if (Array.isArray(dailyCostData)) {
        // 使用本地时间计算今日和本月
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);

        // 按日期聚合
        const operationMap = new Map<
          string,
          { callCount: number; tokens: number; cost: number }
        >();

        for (const item of dailyCostData) {
          const itemDate = item.date || item.usage_date;
          const costCents = item.total_cost_cents || item.cost_cents || 0;
          const tokens = item.total_tokens || 0;
          const operation = item.operation || "unknown";

          // 今日成本
          if (itemDate === todayStr) {
            todayCost += costCents / 100;
          }

          // 本月成本
          const itemDateObj = new Date(itemDate);
          if (itemDateObj >= monthStart) {
            monthCost += costCents / 100;
          }

          // 操作类型聚合
          const existing = operationMap.get(operation) || {
            callCount: 0,
            tokens: 0,
            cost: 0,
          };
          operationMap.set(operation, {
            callCount: existing.callCount + (item.call_count || 1),
            tokens: existing.tokens + tokens,
            cost: existing.cost + costCents / 100,
          });
        }

        // 转换为明细数组
        for (const [operation, data] of operationMap.entries()) {
          breakdown.push({
            operation,
            operationLabel: OPERATION_LABELS[operation] || operation,
            callCount: data.callCount,
            tokens: data.tokens,
            cost: data.cost,
          });
        }

        // 按成本排序
        breakdown.sort((a, b) => b.cost - a.cost);
      }

      // ���析对话统计
      const chatData = chatStatsResult.data;
      const chatStats: ChatStats = {
        today: chatData?.today_count ?? chatData?.today ?? 0,
        month: chatData?.month_count ?? chatData?.month ?? 0,
        total: chatData?.total_count ?? chatData?.total ?? 0,
      };

      // 解析配额统计
      const quotaData = quotaStatsResult.data;
      const quotaStats: QuotaStats = {
        used: quotaData?.used_tokens ?? quotaData?.used ?? 0,
        total: quotaData?.total_tokens ?? quotaData?.total ?? 100000,
        quotaType: quotaData?.quota_type ?? "monthly",
        resetAt: quotaData?.reset_at ?? null,
      };

      // 解析会员权益
      const entitlementData = entitlementResult.data;
      const entitlement: Entitlement | null = entitlementData
        ? {
            tier: entitlementData.tier ?? "free",
            monthlyQuota: entitlementData.monthly_quota ?? 100000,
            usedPercentage: (quotaStats.used / quotaStats.total) * 100 || 0,
          }
        : null;

      return {
        dailyCost: todayCost,
        monthlyCost: monthCost,
        chatStats,
        quotaStats,
        entitlement,
        breakdown,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
    refetchOnWindowFocus: false,
  });

  // ==================== 刷新函数 ====================
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  // ==================== 返回值 ====================
  return {
    dailyCost: data?.dailyCost ?? 0,
    monthlyCost: data?.monthlyCost ?? 0,
    chatStats: data?.chatStats ?? { today: 0, month: 0, total: 0 },
    quotaStats: data?.quotaStats ?? {
      used: 0,
      total: 100000,
      quotaType: "monthly",
      resetAt: null,
    },
    entitlement: data?.entitlement ?? null,
    breakdown: data?.breakdown ?? [],
    isLoading,
    error: queryError?.message ?? null,
    refresh,
  };
}
