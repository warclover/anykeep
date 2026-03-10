/**
 * 整理对比 Hook
 *
 * 管理整理前后快照的获取和对比逻辑
 *
 * @version 1.1.0
 * @since 2026-01-10
 * @updated 2026-02-01 - 添加 API 响应验证
 */

"use client";

import { useState, useCallback } from "react";
import type { OrganizeSnapshot } from "@/lib/organize/types";
import { API_MISC } from "@/lib/constants/api-paths";

interface UseOrganizeComparisonReturn {
  /** 整理前快照 */
  beforeSnapshot: OrganizeSnapshot | null;
  /** 整理后快照 */
  afterSnapshot: OrganizeSnapshot | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 获取整理前快照 */
  captureBeforeSnapshot: () => Promise<OrganizeSnapshot>;
  /** 获取整理后快照 */
  captureAfterSnapshot: () => Promise<OrganizeSnapshot>;
  /** 重置快照 */
  reset: () => void;
  /** 是否有完整对比数据 */
  hasComparison: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 验证 OrganizeSnapshot 数据结构
 */
function validateSnapshot(data: unknown): OrganizeSnapshot {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid snapshot: expected object");
  }

  const snapshot = data as Record<string, unknown>;

  // 验证必需字段存在且类型正确
  if (typeof snapshot.timestamp !== "string") {
    throw new Error("Invalid snapshot: missing or invalid timestamp");
  }
  if (typeof snapshot.total !== "number" || isNaN(snapshot.total)) {
    throw new Error("Invalid snapshot: missing or invalid total");
  }

  // 返回验证后的快照，使用默认值填充可选字段
  return {
    timestamp: snapshot.timestamp,
    total: snapshot.total,
    uncategorized:
      typeof snapshot.uncategorized === "number" ? snapshot.uncategorized : 0,
    duplicates:
      typeof snapshot.duplicates === "number" ? snapshot.duplicates : 0,
    untagged: typeof snapshot.untagged === "number" ? snapshot.untagged : 0,
    stale: typeof snapshot.stale === "number" ? snapshot.stale : 0,
  };
}

/**
 * 获取收藏统计数据
 */
async function fetchCollectionStats(): Promise<OrganizeSnapshot> {
  const response = await fetch(API_MISC.collectionStats, {
    credentials: "include", // 确保携带认证 cookies
  });
  if (!response.ok) {
    throw new Error("Failed to fetch collection stats");
  }
  const result = await response.json();
  // API 返回格式：{ success: true, data: OrganizeSnapshot }
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Invalid response format");
  }
  // 验证返回数据结构
  return validateSnapshot(result.data);
}

/**
 * 整理对比 Hook
 */
export function useOrganizeComparison(): UseOrganizeComparisonReturn {
  const [beforeSnapshot, setBeforeSnapshot] = useState<OrganizeSnapshot | null>(
    null,
  );
  const [afterSnapshot, setAfterSnapshot] = useState<OrganizeSnapshot | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取整理前快照
   */
  const captureBeforeSnapshot =
    useCallback(async (): Promise<OrganizeSnapshot> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCollectionStats();
        setBeforeSnapshot(data);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取统计失败";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, []);

  /**
   * 获取整理后快照
   */
  const captureAfterSnapshot =
    useCallback(async (): Promise<OrganizeSnapshot> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCollectionStats();
        setAfterSnapshot(data);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取统计失败";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, []);

  /**
   * 重置快照
   */
  const reset = useCallback(() => {
    setBeforeSnapshot(null);
    setAfterSnapshot(null);
    setError(null);
  }, []);

  return {
    beforeSnapshot,
    afterSnapshot,
    isLoading,
    captureBeforeSnapshot,
    captureAfterSnapshot,
    reset,
    hasComparison: beforeSnapshot !== null && afterSnapshot !== null,
    error,
  };
}
