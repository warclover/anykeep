/**
 * 综述标注 Hook
 *
 * 功能：
 * - 获取报告标注列表
 * - 创建/更新/删除标注
 * - 使用 TanStack Query 提供缓存
 *
 * 性能优化：
 * - staleTime 5分钟
 * - 乐观更新本地状态
 *
 * @version 2.0.0
 * @since 2025-12-29
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { synthesisKeys } from "@/hooks/queries/keys";
import type {
  SynthesisHighlight,
  CreateHighlightRequest,
  UpdateHighlightRequest,
  HighlightColor,
  HighlightPosition,
} from "@/lib/synthesis/types/highlight";
import { clientLogger } from "@/lib/client-logger";

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
 * 获取标注列表
 */
async function fetchHighlights(
  reportId: string,
): Promise<SynthesisHighlight[]> {
  const response = await fetch(`/api/synthesis/${reportId}/highlights`);

  if (!response.ok) {
    const data = await response.json();
    clientLogger.error({ data }, "[useSynthesisHighlights] API error details:");
    throw new Error(data.details || data.error || "查询失败");
  }

  const { data } = await response.json();
  return data;
}

/**
 * 综述标注 Hook
 */
export function useSynthesisHighlights({
  reportId,
  autoLoad = true,
}: UseSynthesisHighlightsOptions): UseSynthesisHighlightsReturn {
  const queryClient = useQueryClient();
  const queryKey = synthesisKeys.highlights(reportId);

  // 查询标注列表
  const query = useQuery({
    queryKey,
    queryFn: () => fetchHighlights(reportId),
    enabled: autoLoad && !!reportId,
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 15 * 60 * 1000, // 15 分钟垃圾回收
  });

  // 创建标注 mutation
  const createMutation = useMutation({
    mutationFn: async ({
      content,
      position,
      options,
    }: {
      content: string;
      position: HighlightPosition;
      options?: { note?: string; color?: HighlightColor };
    }) => {
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
      return data as SynthesisHighlight;
    },
    onSuccess: (newHighlight) => {
      // 乐观更新缓存
      queryClient.setQueryData<SynthesisHighlight[]>(queryKey, (old) =>
        old ? [...old, newHighlight] : [newHighlight],
      );
    },
    onError: (err) => {
      clientLogger.error({ err }, "[useSynthesisHighlights] Create error:");
    },
  });

  // 更新标注 mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      highlightId,
      updates,
    }: {
      highlightId: string;
      updates: UpdateHighlightRequest;
    }) => {
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
      return data as SynthesisHighlight;
    },
    onSuccess: (updatedHighlight) => {
      // 乐观更新缓存
      queryClient.setQueryData<SynthesisHighlight[]>(queryKey, (old) =>
        old?.map((h) => (h.id === updatedHighlight.id ? updatedHighlight : h)),
      );
    },
    onError: (err) => {
      clientLogger.error({ err }, "[useSynthesisHighlights] Update error:");
    },
  });

  // 删除标注 mutation
  const deleteMutation = useMutation({
    mutationFn: async (highlightId: string) => {
      const response = await fetch(
        `/api/synthesis/${reportId}/highlights/${highlightId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }

      return highlightId;
    },
    onSuccess: (deletedId) => {
      // 乐观更新缓存
      queryClient.setQueryData<SynthesisHighlight[]>(queryKey, (old) =>
        old?.filter((h) => h.id !== deletedId),
      );
    },
    onError: (err) => {
      clientLogger.error({ err }, "[useSynthesisHighlights] Delete error:");
    },
  });

  // 创建标注
  const createHighlight = useCallback(
    async (
      content: string,
      position: HighlightPosition,
      options?: { note?: string; color?: HighlightColor },
    ): Promise<SynthesisHighlight | null> => {
      if (!reportId) return null;
      try {
        return await createMutation.mutateAsync({ content, position, options });
      } catch {
        return null;
      }
    },
    [reportId, createMutation],
  );

  // 更新标注
  const updateHighlight = useCallback(
    async (
      highlightId: string,
      updates: UpdateHighlightRequest,
    ): Promise<SynthesisHighlight | null> => {
      if (!reportId) return null;
      try {
        return await updateMutation.mutateAsync({ highlightId, updates });
      } catch {
        return null;
      }
    },
    [reportId, updateMutation],
  );

  // 删除标注
  const deleteHighlight = useCallback(
    async (highlightId: string): Promise<boolean> => {
      if (!reportId) return false;
      try {
        await deleteMutation.mutateAsync(highlightId);
        return true;
      } catch {
        return false;
      }
    },
    [reportId, deleteMutation],
  );

  // 按区块获取标注
  const getHighlightsBySection = useCallback(
    (section: string, itemIndex?: number): SynthesisHighlight[] => {
      const highlights = query.data ?? [];
      return highlights.filter((h) => {
        if (h.position.section !== section) return false;
        if (itemIndex !== undefined && h.position.itemIndex !== itemIndex)
          return false;
        return true;
      });
    },
    [query.data],
  );

  return {
    highlights: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: async () => {
      await query.refetch();
    },
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getHighlightsBySection,
  };
}
