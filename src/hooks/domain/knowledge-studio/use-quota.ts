"use client";

/**
 * Knowledge Studio - 配额管理 Hook
 * @module hooks/domain/knowledge-studio
 * @description 管理用户配额查询和消耗追踪
 */

import { useCallback, useMemo } from "react";
import useSWR from "swr";

// ============================================================================
// 类型定义
// ============================================================================

export interface QuotaInfo {
  /** 总配额 */
  totalQuota: number;
  /** 已使用配额 */
  usedQuota: number;
  /** 待确认配额 */
  pendingQuota: number;
  /** 可用配额 */
  availableQuota: number;
  /** 会员类型 */
  membershipType: "free" | "pro" | "enterprise";
  /** 配额重置时间 */
  resetAt: string;
}

export interface QuotaUsage {
  /** 总消耗 */
  totalConsumed: number;
  /** 待确认 */
  totalPending: number;
  /** 已退还 */
  totalRefunded: number;
  /** 操作次数 */
  operationCount: number;
}

export interface OperationCosts {
  /** 蓝图生成成本 */
  blueprint_generation: number;
  /** 聊天编辑成本 */
  chat_edit: number;
  /** 素材分析成本 */
  material_analysis?: number;
}

export interface QuotaData {
  /** 配额信息 */
  quota: QuotaInfo;
  /** 使用统计 */
  usage: QuotaUsage;
  /** 操作成本 */
  operationCosts: OperationCosts;
}

export interface UseQuotaReturn {
  /** 配额数据 */
  data: QuotaData | null;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否有足够配额 */
  hasEnoughQuota: (operation: keyof OperationCosts) => boolean;
  /** 检查配额 */
  checkQuota: (cost: number) => boolean;
  /** 刷新配额 */
  refresh: () => Promise<void>;
  /** 配额使用百分比 */
  usagePercent: number;
  /** 是否接近限制 */
  isNearLimit: boolean;
  /** 是否 Pro 用户 */
  isPro: boolean;
  /** 是否无限配额 */
  isUnlimited: boolean;
}

// ============================================================================
// Fetcher
// ============================================================================

async function quotaFetcher(url: string): Promise<QuotaData> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "获取配额失败");
  }

  const result = await response.json();
  const data = result.data;

  return {
    quota: {
      totalQuota: data.totalQuota,
      usedQuota: data.usedQuota,
      pendingQuota: data.pendingQuota,
      availableQuota: data.availableQuota,
      membershipType: data.membershipType,
      resetAt: data.resetAt,
    },
    usage: {
      totalConsumed: data.usage.totalConsumed,
      totalPending: data.usage.totalPending,
      totalRefunded: data.usage.totalRefunded,
      operationCount: data.usage.operationCount,
    },
    operationCosts: data.operationCosts,
  };
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useQuota(): UseQuotaReturn {
  const {
    data,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<QuotaData, Error>("/api/knowledge-studio/quota", quotaFetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 30000, // 30 秒内不重复请求
  });

  // 直接从 SWR 错误派生，避免 useEffect 中 setState
  const error = useMemo(() => swrError?.message ?? null, [swrError]);

  // 检查是否有足够配额执行特定操作
  const hasEnoughQuota = useCallback(
    (operation: keyof OperationCosts): boolean => {
      if (!data) return false;
      if (data.quota.membershipType === "enterprise") return true;

      const cost = data.operationCosts[operation] ?? 1;
      return data.quota.availableQuota >= cost;
    },
    [data],
  );

  // 检查是否有足够的指定配额
  const checkQuota = useCallback(
    (cost: number): boolean => {
      if (!data) return false;
      if (data.quota.membershipType === "enterprise") return true;
      return data.quota.availableQuota >= cost;
    },
    [data],
  );

  // 刷新配额
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // 计算使用百分比
  const usagePercent = data
    ? data.quota.totalQuota > 0
      ? Math.round((data.quota.usedQuota / data.quota.totalQuota) * 100)
      : 0
    : 0;

  // 是否接近限制 (>80%)
  const isNearLimit = usagePercent > 80;

  // 是否 Pro 用户
  const isPro = data?.quota.membershipType === "pro";

  // 是否无限配额
  const isUnlimited =
    data?.quota.membershipType === "enterprise" ||
    data?.quota.totalQuota === -1;

  return {
    data: data ?? null,
    isLoading,
    error,
    hasEnoughQuota,
    checkQuota,
    refresh,
    usagePercent,
    isNearLimit,
    isPro,
    isUnlimited,
  };
}
