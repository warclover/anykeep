/**
 * 综述标注 Hook
 *
 * 功能：
 * - 获取报告标注列表
 * - 创建/更新/删除标注
 * - 本地状态管理
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { useState, useCallback, useEffect } from "react";
import type {
  SynthesisHighlight,
  CreateHighlightRequest,
  UpdateHighlightRequest,
  HighlightColor,
  HighlightPosition,
} from "@/lib/synthesis/types/highlight";

interface UseSynthesisHighlightsOptions {
  /** 报告 ID */
  reportId: string;
  /** 是否自动加载 */
  autoLoad?: boolean;
}

interface UseSynthesisHighlightsReturn {
  /** 标注列表 */
  highlights: SynthesisHighlight[];
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 重新加载 */
  refetch: () => Promise<void>;
  /** 创建标注 */
  createHighlight: (
    content: string,
    position: HighlightPosition,
    options?: { note?: string; color?: HighlightColor },
  ) => Promise<SynthesisHighlight | null>;
  /** 更新标注 */
  updateHighlight: (
    highlightId: string,
    updates: UpdateHighlightRequest,
  ) => Promise<SynthesisHighlight | null>;
  /** 删除标注 */
  deleteHighlight: (highlightId: string) => Promise<boolean>;
  /** 按区块获取标注 */
  getHighlightsBySection: (
    section: string,
    itemIndex?: number,
  ) => SynthesisHighlight[];
}

/**
 * 综述标注 Hook
 */
export function useSynthesisHighlights({
  reportId,
  autoLoad = true,
}: UseSynthesisHighlightsOptions): UseSynthesisHighlightsReturn {
  const [highlights, setHighlights] = useState<SynthesisHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载标注列表
   */
  const refetch = useCallback(async () => {
    if (!reportId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/synthesis/${reportId}/highlights`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "加载失败");
      }

      const { data } = await response.json();
      setHighlights(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败";
      setError(message);
      console.error("[useSynthesisHighlights] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  /**
   * 创建标注
   */
  const createHighlight = useCallback(
    async (
      content: string,
      position: HighlightPosition,
      options?: { note?: string; color?: HighlightColor },
    ): Promise<SynthesisHighlight | null> => {
      if (!reportId) return null;

      try {
        const body: CreateHighlightRequest = {
          content,
          position,
          note: options?.note,
          color: options?.color,
        };

        const response = await fetch(`/api/synthesis/${reportId}/highlights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "创建失败");
        }

        const { data } = await response.json();

        // 更新本地状态
        setHighlights((prev) => [...prev, data]);

        return data;
      } catch (err) {
        console.error("[useSynthesisHighlights] Create error:", err);
        return null;
      }
    },
    [reportId],
  );

  /**
   * 更新标注
   */
  const updateHighlight = useCallback(
    async (
      highlightId: string,
      updates: UpdateHighlightRequest,
    ): Promise<SynthesisHighlight | null> => {
      if (!reportId) return null;

      try {
        const response = await fetch(
          `/api/synthesis/${reportId}/highlights/${highlightId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "更新失败");
        }

        const { data } = await response.json();

        // 更新本地状态
        setHighlights((prev) =>
          prev.map((h) => (h.id === highlightId ? data : h)),
        );

        return data;
      } catch (err) {
        console.error("[useSynthesisHighlights] Update error:", err);
        return null;
      }
    },
    [reportId],
  );

  /**
   * 删除标注
   */
  const deleteHighlight = useCallback(
    async (highlightId: string): Promise<boolean> => {
      if (!reportId) return false;

      try {
        const response = await fetch(
          `/api/synthesis/${reportId}/highlights/${highlightId}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "删除失败");
        }

        // 更新本地状态
        setHighlights((prev) => prev.filter((h) => h.id !== highlightId));

        return true;
      } catch (err) {
        console.error("[useSynthesisHighlights] Delete error:", err);
        return false;
      }
    },
    [reportId],
  );

  /**
   * 按区块获取标注
   */
  const getHighlightsBySection = useCallback(
    (section: string, itemIndex?: number): SynthesisHighlight[] => {
      return highlights.filter((h) => {
        if (h.position.section !== section) return false;
        if (itemIndex !== undefined && h.position.itemIndex !== itemIndex)
          return false;
        return true;
      });
    },
    [highlights],
  );

  // 自动加载
  useEffect(() => {
    if (autoLoad && reportId) {
      refetch();
    }
  }, [autoLoad, reportId, refetch]);

  return {
    highlights,
    isLoading,
    error,
    refetch,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getHighlightsBySection,
  };
}
