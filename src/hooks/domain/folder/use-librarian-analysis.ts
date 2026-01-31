/**
 * V3.0 整理大师 (AI Librarian) React Hook
 *
 * 用于获取和管理文件夹结构分析数据
 *
 * @version 3.1.0
 * @updated 2026-01-31
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义（从统一类型文件重新导出）
// ============================================================================

export type {
  LibrarianFolder as Folder,
  DuplicateFolderGroup,
  OversizedFolder,
  PoorlyNamedFolder,
  MissingCategory,
  LibrarianAnalysis,
} from "@/types/librarian.types";

import type { LibrarianAnalysis } from "@/types/librarian.types";

/**
 * Hook 返回类型
 */
export interface UseLibrarianAnalysisReturn {
  /** 分析结果 */
  analysis: LibrarianAnalysis | null;

  /** 是否正在加载 */
  isLoading: boolean;

  /** 是否正在分析 */
  isAnalyzing: boolean;

  /** 错误信息 */
  error: string | null;

  /** 执行分析 */
  runAnalysis: () => Promise<void>;

  /** 刷新（获取最近的分析结果） */
  refresh: () => Promise<void>;

  /** 清除错误 */
  clearError: () => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 整理大师分析 Hook
 */
export function useLibrarianAnalysis(): UseLibrarianAnalysisReturn {
  const [analysis, setAnalysis] = useState<LibrarianAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取最近的分析结果
   */
  const fetchRecent = useCallback(async () => {
    try {
      const response = await fetchWithRetry(
        "/api/librarian/analysis",
        {},
        { requestId: "librarian-analysis-fetch" },
      );

      if (!response.ok) {
        if (response.status === 404) {
          // 没有历史分析，这是正常��
          setAnalysis(null);
          return;
        }
        throw new Error("获取分析结果失败");
      }

      const data = await response.json();
      if (data.data) {
        setAnalysis({
          ...data.data,
          analyzedAt: new Date(data.data.analyzedAt),
        });
      }
    } catch (err) {
      clientLogger.error({ error: err }, "Failed to fetch librarian analysis");
      setError(err instanceof Error ? err.message : "获取分析结果失败");
    }
  }, []);

  /**
   * 执行新的分析
   */
  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetchWithRetry(
        "/api/librarian/analysis",
        { method: "POST" },
        { requestId: "librarian-analysis-run" },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "分析失败");
      }

      const data = await response.json();
      if (data.data) {
        setAnalysis({
          ...data.data,
          analyzedAt: new Date(data.data.analyzedAt),
        });
      }
    } catch (err) {
      clientLogger.error({ error: err }, "Failed to run librarian analysis");
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await fetchRecent();
    setIsLoading(false);
  }, [fetchRecent]);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 初始加载
  useEffect(() => {
    setIsLoading(true);
    fetchRecent().finally(() => setIsLoading(false));
  }, [fetchRecent]);

  return {
    analysis,
    isLoading,
    isAnalyzing,
    error,
    runAnalysis,
    refresh,
    clearError,
  };
}

export default useLibrarianAnalysis;
