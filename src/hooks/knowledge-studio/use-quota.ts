/**
 * useQuota - 配额管理 Hook
 * @module hooks/knowledge-studio
 * @description 查询和管理用户配额
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { API_KNOWLEDGE_STUDIO } from "@/lib/constants/api-paths";

/**
 * 配额信息
 */
export interface QuotaInfo {
  totalQuota: number;
  usedQuota: number;
  pendingQuota: number;
  availableQuota: number;
  membershipType: "free" | "pro" | "enterprise";
  usage: {
    totalConsumed: number;
    totalPending: number;
    totalRefunded: number;
    operationCount: number;
  };
  resetAt: string;
  operationCosts: {
    blueprint_generation: number;
    chat_edit: number;
  };
}

/**
 * Hook 返回值
 */
export interface UseQuotaReturn {
  quota: QuotaInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  canGenerate: boolean;
  canEdit: boolean;
  isUnlimited: boolean;
}

/**
 * useQuota Hook
 */
export function useQuota(): UseQuotaReturn {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_KNOWLEDGE_STUDIO.quota);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "获取配额失败");
      }

      const data = await response.json();
      setQuota(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取配额失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  // 计算派生状态
  const isUnlimited =
    quota?.membershipType === "enterprise" || quota?.totalQuota === -1;

  const canGenerate =
    isUnlimited ||
    (quota !== null &&
      quota.availableQuota >=
        (quota.operationCosts?.blueprint_generation || 1));

  const canEdit =
    isUnlimited ||
    (quota !== null &&
      quota.availableQuota >= (quota.operationCosts?.chat_edit || 1));

  return {
    quota,
    isLoading,
    error,
    refresh: fetchQuota,
    canGenerate,
    canEdit,
    isUnlimited,
  };
}
