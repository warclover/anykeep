/**
 * useBlueprints - TanStack Query Hook for Knowledge Studio Blueprints
 *
 * 提供蓝图列表的查询，支持缓存和自动刷新
 *
 * 性能优化：
 * - staleTime 10分钟（蓝图数据很少变化）
 * - 缓存后二次访问秒开
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { blueprintKeys } from "./keys";
import type { BlueprintTier } from "@/lib/knowledge-studio/blueprint/types";

// ============================================
// Types
// ============================================

/**
 * Blueprint list item with access info
 */
export interface BlueprintListItem {
  blueprintId: string;
  displayName: string;
  description: string;
  icon: string;
  tier: BlueprintTier;
  category: string;
  isNew?: boolean;
  tags?: string[];
  canAccess: boolean;
  upgradeMessage?: string;
  creditsCost: number;
  briefingEnabled: boolean;
  supportsOutline: boolean;
}

/**
 * Blueprint list response
 */
interface BlueprintListResponse {
  blueprints: BlueprintListItem[];
  userTier: BlueprintTier;
}

// ============================================
// API Fetcher
// ============================================

/**
 * 获取蓝图列表
 */
async function fetchBlueprints(): Promise<BlueprintListResponse> {
  const response = await fetch("/api/knowledge-studio/v2/blueprints");

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || "获取蓝图列表失败");
  }

  return response.json();
}

// ============================================
// Query Hook
// ============================================

/**
 * 蓝图列表查询
 *
 * @example
 * ```tsx
 * const { blueprints, userTier, isLoading, error } = useBlueprints();
 * ```
 */
export function useBlueprints() {
  const query = useQuery({
    queryKey: blueprintKeys.list(),
    queryFn: fetchBlueprints,
    staleTime: 10 * 60 * 1000, // 10 分钟（蓝图数据很少变化）
    gcTime: 30 * 60 * 1000, // 30 分钟垃圾回收
  });

  return {
    blueprints: query.data?.blueprints ?? [],
    userTier: query.data?.userTier ?? "free",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
