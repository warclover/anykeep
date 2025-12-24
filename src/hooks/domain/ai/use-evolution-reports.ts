/**
 * V4.2 Evolution Reports Hook
 * 管理月度 AI 进化报告的获取和生成
 *
 * 注意：此 hook 与 AI 聊天无关，主要用于文件夹分类统计和进化报告。
 * 历史原因放置在 domain/ai/ 目录下，未来版本考虑迁移到 domain/folder/ 或 domain/analytics/。
 *
 * @module hooks/domain/ai/use-evolution-reports
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

// ============================================
// Type Definitions
// ============================================

export interface ReportSuggestion {
  type: "merge" | "split" | "rename" | "cleanup";
  description: string;
  targetFolders: Array<{ id: number; name: string }>;
  priority: "high" | "medium" | "low";
}

export interface MonthlyReport {
  id: number;
  userId: string;
  reportMonth: string;

  // Classification stats
  totalClassified: number;
  autoClassified: number;
  manualAdjusted: number;

  // Folder changes
  foldersCreated: number;
  foldersSplit: number;
  foldersMerged: number;
  foldersRenamed: number;

  // Quality metrics
  avgConfidence: number | null;
  acceptanceRate: number | null;
  healthScore: number | null;

  // Suggestions
  pendingSuggestions: number;
  suggestions: ReportSuggestion[];

  // Metadata
  generatedAt: string;
  viewedAt: string | null;
}

interface UseEvolutionReportsOptions {
  autoFetch?: boolean;
  limit?: number;
}

interface UseEvolutionReportsReturn {
  // Data
  reports: MonthlyReport[];
  currentReport: MonthlyReport | null;
  hasReports: boolean;

  // State
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  fetchReports: () => Promise<void>;
  fetchReport: (month: string) => Promise<MonthlyReport | null>;
  generateReport: (
    month?: string,
    forceRegenerate?: boolean,
  ) => Promise<MonthlyReport | null>;
  selectReport: (report: MonthlyReport | null) => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useEvolutionReports(
  options: UseEvolutionReportsOptions = {},
): UseEvolutionReportsReturn {
  const { autoFetch = true, limit = 12 } = options;

  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [currentReport, setCurrentReport] = useState<MonthlyReport | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all reports
  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        `/api/folder-evolution/reports?limit=${limit}`,
      );

      if (!response.ok) {
        throw new Error("获取报告列表失败");
      }

      const result = await response.json();
      if (result.success) {
        const newReports = result.data?.reports || [];
        setReports(newReports);
        // Auto-select the first report (use functional update to avoid dependency)
        if (newReports.length > 0) {
          setCurrentReport((prev) => prev || newReports[0]);
        }
      } else {
        throw new Error(result.error || "获取报告列表失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取报告列表失败";
      setError(message);
      console.error("[useEvolutionReports] fetchReports error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Fetch specific month's report
  const fetchReport = useCallback(
    async (month: string): Promise<MonthlyReport | null> => {
      try {
        setError(null);
        const response = await fetch(
          `/api/folder-evolution/reports?month=${month}`,
        );

        if (!response.ok) {
          throw new Error("获取报告失败");
        }

        const result = await response.json();
        if (result.success && result.data?.report) {
          setCurrentReport(result.data.report);
          return result.data.report;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取报告失败";
        setError(message);
        console.error("[useEvolutionReports] fetchReport error:", err);
        return null;
      }
    },
    [],
  );

  // Generate new report
  const generateReport = useCallback(
    async (
      month?: string,
      forceRegenerate = false,
    ): Promise<MonthlyReport | null> => {
      setIsGenerating(true);
      try {
        const response = await fetch("/api/folder-evolution/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, forceRegenerate }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "生成报告失败");
        }

        const newReport = result.data?.report;
        if (newReport) {
          setCurrentReport(newReport);
          // Update reports list
          setReports((prev) => {
            const filtered = prev.filter(
              (r) => r.reportMonth !== newReport.reportMonth,
            );
            return [newReport, ...filtered].sort((a, b) =>
              b.reportMonth.localeCompare(a.reportMonth),
            );
          });
          toast.success(result.data?.message || "报告生成成功");
        }

        return newReport;
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成报告失败";
        toast.error(message);
        console.error("[useEvolutionReports] generateReport error:", err);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Select a report
  const selectReport = useCallback((report: MonthlyReport | null) => {
    setCurrentReport(report);
  }, []);

  // Initial fetch - 仅在挂载或关键参数变化时执行
  useEffect(() => {
    if (autoFetch) {
      fetchReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, limit]);

  return {
    // Data
    reports,
    currentReport,
    hasReports: reports.length > 0,

    // State
    isLoading,
    isGenerating,
    error,

    // Actions
    fetchReports,
    fetchReport,
    generateReport,
    selectReport,
  };
}

export default useEvolutionReports;
