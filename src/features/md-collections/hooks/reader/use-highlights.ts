/**
 * MD 阅读器高亮管理 Hook
 * Spec: md-reader-upgrade / REQ-10
 *
 * 功能：
 * - 加载/创建/更新/删除高亮（Supabase）
 * - 监听文字选择事件
 * - 乐观更新 + 回滚
 * - TanStack Query 模式缓存
 *
 * @version 2.0.0 - 迁移到 TanStack Query
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { highlightKeys } from "@/hooks/queries/keys";
import {
  getRangeOffset,
  clearSelection as clearSelectionUtil,
  hasSelection,
  getSelectionRect,
} from "../../lib/reader/highlight-utils";
import type {
  TextHighlight,
  HighlightColor,
  UseHighlightsOptions,
  UseHighlightsResult,
  HighlightToolbarPosition,
} from "../../types/reader";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 常量配置
// ============================================

/** SWR 缓存 Key 前缀 */
const SWR_KEY_PREFIX = "md-collection-highlights";

/** 去重间隔：1 分钟 */
const DEDUPING_INTERVAL = 60000;

/** 选区防抖延迟 */
const SELECTION_DEBOUNCE_MS = 300;

/** 数据库表名 */
const TABLE_NAME = "md_collection_highlights";

// ============================================
// 类型定义
// ============================================

/**
 * 数据库高亮记录类型（与数据库 schema 对应）
 */
interface DbHighlight {
  id: string;
  collection_id: number;
  user_id: string;
  start_offset: number;
  end_offset: number;
  anchor_text: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Supabase 客户端
// ============================================

const supabase = createClient();

// ============================================
// Fetcher 函数
// ============================================

/**
 * 高亮列表 Fetcher
 */
async function highlightsFetcher(key: string): Promise<TextHighlight[]> {
  // 从 key 解析 collectionId
  const parts = key.split(":");
  const collectionId = parseInt(parts[1], 10);

  if (isNaN(collectionId)) {
    return [];
  }

  // 使用类型断言绕过 Supabase 类型检查（表尚未生成类型）
  const { data, error } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: number,
          ) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => Promise<{
              data: DbHighlight[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from(TABLE_NAME)
    .select("*")
    .eq("collection_id", collectionId)
    .order("start_offset", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  // 转换为 TextHighlight 类型
  return (data || []).map((row) => ({
    ...row,
    color: row.color as HighlightColor,
  }));
}

// ============================================
// Hook 实现
// ============================================

/**
 * useHighlights Hook
 *
 * 管理 MD 文档的文字高亮功能。
 *
 * @example
 * ```tsx
 * function ReaderContent({ collectionId }) {
 *   const contentRef = useRef<HTMLDivElement>(null);
 *
 *   const {
 *     highlights,
 *     isLoading,
 *     createHighlight,
 *     deleteHighlight,
 *     selectedRange,
 *   } = useHighlights({
 *     collectionId,
 *     contentRef,
 *   });
 *
 *   return (
 *     <div ref={contentRef}>
 *       {content}
 *     </div>
 *   );
 * }
 * ```
 */
export function useHighlights(
  options: UseHighlightsOptions,
): UseHighlightsResult {
  const { collectionId, contentRef } = options;
  const queryClient = useQueryClient();

  // V2.0.0: 使用 TanStack Query 获取高亮数据
  const { data: highlights = [], isLoading } = useQuery<TextHighlight[]>({
    queryKey: highlightKeys.byCollection(collectionId),
    queryFn: () => highlightsFetcher(`${SWR_KEY_PREFIX}:${collectionId}`),
    enabled: !!collectionId,
    staleTime: DEDUPING_INTERVAL,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 3000,
  });

  // 选区状态
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const [toolbarPosition, setToolbarPosition] =
    useState<HighlightToolbarPosition | null>(null);

  // 防抖计时器
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 快照用于回滚
  const snapshotRef = useRef<TextHighlight[] | null>(null);

  // ============================================
  // 选区监听
  // ============================================

  /**
   * 处理选区变化
   */
  const handleSelectionChange = useCallback(() => {
    // 清除之前的防抖计时器
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
    }

    // 防抖处理
    selectionTimerRef.current = setTimeout(() => {
      const container = contentRef.current;
      if (!container) {
        setSelectedRange(null);
        setToolbarPosition(null);
        return;
      }

      // 检查是否有有效选区
      if (!hasSelection()) {
        setSelectedRange(null);
        setToolbarPosition(null);
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedRange(null);
        setToolbarPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);

      // 检查选区是否在内容容器内
      if (!container.contains(range.commonAncestorContainer)) {
        setSelectedRange(null);
        setToolbarPosition(null);
        return;
      }

      // 检查选区是否有内容
      const selectedText = range.toString().trim();
      if (selectedText.length === 0) {
        setSelectedRange(null);
        setToolbarPosition(null);
        return;
      }

      // 保存选区
      setSelectedRange(range.cloneRange());

      // 计算工具栏位置（选区上方）
      const rect = getSelectionRect();
      if (rect) {
        setToolbarPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 8, // 8px 间距
        });
      }
    }, SELECTION_DEBOUNCE_MS);
  }, [contentRef]);

  /**
   * 清除选区
   */
  const clearSelection = useCallback(() => {
    clearSelectionUtil();
    setSelectedRange(null);
    setToolbarPosition(null);
  }, []);

  // 监听 selectionchange 事件
  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
      }
    };
  }, [handleSelectionChange]);

  // ============================================
  // CRUD 操作
  // ============================================

  /**
   * 创建高亮
   */
  const createHighlight = useCallback(
    async (range: Range, color: HighlightColor): Promise<void> => {
      const container = contentRef.current;
      if (!container) {
        throw new Error("Content container not found");
      }

      // 计算偏移
      const offset = getRangeOffset(container, range);
      if (!offset) {
        // 提供更详细的调试信息
        if (process.env.NODE_ENV === "development") {
          clientLogger.error(
            {
              rangeText: range.toString(),
              startContainer: range.startContainer,
              startOffset: range.startOffset,
              endContainer: range.endContainer,
              endOffset: range.endOffset,
              containerContainsStart: container.contains(range.startContainer),
              containerContainsEnd: container.contains(range.endContainer),
            },
            "[useHighlights] Failed to calculate offset:",
          );
        }
        // 尝试清除选区并提示用户重新选择
        clearSelection();
        throw new Error("无法处理当前选区，请重新选择文本");
      }

      // 创建快照用于回滚
      snapshotRef.current = [...highlights];

      // 创建临时高亮（乐观更新）
      const tempId = `temp-${Date.now()}`;
      const tempHighlight: TextHighlight = {
        id: tempId,
        collection_id: collectionId,
        user_id: "", // 由服务端填充
        start_offset: offset.startOffset,
        end_offset: offset.endOffset,
        anchor_text: offset.anchorText,
        color,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 乐观更新 UI
      queryClient.setQueryData<TextHighlight[]>(
        highlightKeys.byCollection(collectionId),
        [...highlights, tempHighlight].sort(
          (a, b) => a.start_offset - b.start_offset,
        ),
      );

      try {
        // 使用类型断言绕过 Supabase 类型检查
        const { data, error } = await (
          supabase as unknown as {
            from: (table: string) => {
              insert: (values: Record<string, unknown>) => {
                select: () => {
                  single: () => Promise<{
                    data: DbHighlight | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          }
        )
          .from(TABLE_NAME)
          .insert({
            collection_id: collectionId,
            start_offset: offset.startOffset,
            end_offset: offset.endOffset,
            anchor_text: offset.anchorText,
            color,
          })
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          throw new Error("Failed to create highlight");
        }

        // 用真实数据替换临时数据
        const newHighlight: TextHighlight = {
          ...data,
          color: data.color as HighlightColor,
        };

        queryClient.setQueryData<TextHighlight[]>(
          highlightKeys.byCollection(collectionId),
          [...highlights.filter((h) => h.id !== tempId), newHighlight].sort(
            (a, b) => a.start_offset - b.start_offset,
          ),
        );

        // 清除选区
        clearSelection();
      } catch (err) {
        // 回滚到快照
        if (snapshotRef.current) {
          queryClient.setQueryData<TextHighlight[]>(
            highlightKeys.byCollection(collectionId),
            snapshotRef.current,
          );
        }
        throw err;
      } finally {
        snapshotRef.current = null;
      }
    },
    [collectionId, contentRef, highlights, queryClient, clearSelection],
  );

  /**
   * 更新高亮颜色
   */
  const updateHighlight = useCallback(
    async (id: string, color: HighlightColor): Promise<void> => {
      // 创建快照
      snapshotRef.current = [...highlights];

      // 乐观更新
      const updatedHighlights = highlights.map((h) =>
        h.id === id ? { ...h, color, updated_at: new Date().toISOString() } : h,
      );
      queryClient.setQueryData<TextHighlight[]>(
        highlightKeys.byCollection(collectionId),
        updatedHighlights,
      );

      try {
        // 使用类型断言绕过 Supabase 类型检查
        const { error } = await (
          supabase as unknown as {
            from: (table: string) => {
              update: (values: Record<string, unknown>) => {
                eq: (
                  column: string,
                  value: string,
                ) => Promise<{
                  error: { message: string } | null;
                }>;
              };
            };
          }
        )
          .from(TABLE_NAME)
          .update({ color })
          .eq("id", id);

        if (error) {
          throw new Error(error.message);
        }
      } catch (err) {
        // 回滚
        if (snapshotRef.current) {
          queryClient.setQueryData<TextHighlight[]>(
            highlightKeys.byCollection(collectionId),
            snapshotRef.current,
          );
        }
        throw err;
      } finally {
        snapshotRef.current = null;
      }
    },
    [collectionId, highlights, queryClient],
  );

  /**
   * 删除高亮
   */
  const deleteHighlight = useCallback(
    async (id: string): Promise<void> => {
      // 创建快照
      snapshotRef.current = [...highlights];

      // 乐观更新
      queryClient.setQueryData<TextHighlight[]>(
        highlightKeys.byCollection(collectionId),
        highlights.filter((h) => h.id !== id),
      );

      try {
        // 使用类型断言绕过 Supabase 类型检查
        const { error } = await (
          supabase as unknown as {
            from: (table: string) => {
              delete: () => {
                eq: (
                  column: string,
                  value: string,
                ) => Promise<{
                  error: { message: string } | null;
                }>;
              };
            };
          }
        )
          .from(TABLE_NAME)
          .delete()
          .eq("id", id);

        if (error) {
          throw new Error(error.message);
        }
      } catch (err) {
        // 回滚
        if (snapshotRef.current) {
          queryClient.setQueryData<TextHighlight[]>(
            highlightKeys.byCollection(collectionId),
            snapshotRef.current,
          );
        }
        throw err;
      } finally {
        snapshotRef.current = null;
      }
    },
    [collectionId, highlights, queryClient],
  );

  // ============================================
  // 返回值
  // ============================================

  return {
    highlights,
    isLoading,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    selectedRange,
    clearSelection,
    // 额外提供工具栏位置（供 HighlightProvider 使用）
    _toolbarPosition: toolbarPosition,
    _setToolbarPosition: setToolbarPosition,
  } as UseHighlightsResult & {
    _toolbarPosition: HighlightToolbarPosition | null;
    _setToolbarPosition: (pos: HighlightToolbarPosition | null) => void;
  };
}

export default useHighlights;
