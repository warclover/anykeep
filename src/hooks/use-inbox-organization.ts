/**
 * 待整理文件夹智能整理 Hook
 * 管理待整理文件夹的分析和建议处理
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { OrganizationAnalysis } from "@/lib/classification";

interface UseInboxOrganizationResult {
  /** 分析结果 */
  analysis: OrganizationAnalysis | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新分析 */
  refresh: () => Promise<void>;
  /** 应用建议 */
  applySuggestion: (suggestionId: number) => Promise<boolean>;
  /** 拒绝建议 */
  rejectSuggestion: (suggestionId: number) => Promise<boolean>;
  /** 待处理建议数量 */
  pendingCount: number;
}

export function useInboxOrganization(): UseInboxOrganizationResult {
  const [analysis, setAnalysis] = useState<OrganizationAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取分析结果
   */
  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/classification/inbox");

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "获取整理建议失败");
      }

      const data = await response.json();
      setAnalysis(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取整理建议失败";
      setError(message);
      console.error("Failed to fetch inbox analysis:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 刷新分析
   */
  const refresh = useCallback(async () => {
    await fetchAnalysis();
  }, [fetchAnalysis]);

  /**
   * 应用建议
   */
  const applySuggestion = useCallback(
    async (suggestionId: number): Promise<boolean> => {
      setIsProcessing(true);

      try {
        const response = await fetch("/api/classification/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "应用建议失败");
        }

        // 从列表中移除已应用的建议
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                suggestions: prev.suggestions.filter(
                  (s) => s.id !== suggestionId,
                ),
              }
            : null,
        );

        toast.success("建议已应用");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "应用建议失败";
        toast.error(message);
        console.error("Failed to apply suggestion:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  /**
   * 拒绝建议
   */
  const rejectSuggestion = useCallback(
    async (suggestionId: number): Promise<boolean> => {
      setIsProcessing(true);

      try {
        const response = await fetch("/api/classification/inbox", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "忽略建议失败");
        }

        // 从列表中移除已拒绝的建议
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                suggestions: prev.suggestions.filter(
                  (s) => s.id !== suggestionId,
                ),
              }
            : null,
        );

        toast.success("已忽略该建议");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "忽略建议失败";
        toast.error(message);
        console.error("Failed to reject suggestion:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  // 初始加载
  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // 计算待处理建议数量
  const pendingCount = analysis?.suggestions.length ?? 0;

  return {
    analysis,
    isLoading,
    isProcessing,
    error,
    refresh,
    applySuggestion,
    rejectSuggestion,
    pendingCount,
  };
}

export default useInboxOrganization;
