/**
 * 附件管理 Hook - 增强版
 *
 * 核心改进：
 * 1. 选择附件时立即抓取内容
 * 2. 内容状态追踪（loading/ready/error/empty）
 * 3. 错误处理与重试
 * 4. 状态统计（就绪数/加载数/错误数）
 *
 * @version 2.0.0
 * @since 2025-12-26
 * @updated 2026-01-08 - 异步内容抓取和状态追踪
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { API_PATHS } from "@/lib/constants/api-paths";
import {
  ATTACHMENT_LIMITS,
  type AttachmentItem,
  type AttachmentContentStatus,
  type AttachmentContentSource,
  type AttachmentSelectionUpdater,
} from "@/components/ai/attachment/types";
import { extractFileContent } from "@/lib/ai/attachment/file-extractor";
import type { Bookmark } from "@/types/supabase";
import { clientLogger } from "@/lib/client-logger";

// =============================================================================
// 内容抓取服务
// =============================================================================

/**
 * 内容抓取结果
 */
interface ContentFetchResult {
  content: string | null;
  source: AttachmentContentSource;
  error?: string;
}

/**
 * 抓取书签内容
 *
 * 优先级：ai_summary > description > raw_content > 实时抓取
 */
async function fetchBookmarkContent(
  bookmark: Bookmark,
): Promise<ContentFetchResult> {
  // 1. 优先使用现有 AI 摘要
  if (bookmark.ai_summary && bookmark.ai_summary.trim()) {
    return {
      content: bookmark.ai_summary,
      source: "ai_summary",
    };
  }

  // 2. 使用描述
  if (bookmark.description && bookmark.description.trim()) {
    return {
      content: bookmark.description,
      source: "description",
    };
  }

  // 3. 实时抓取（如果有 URL）
  if (bookmark.url) {
    try {
      const response = await fetch(API_PATHS.bookmarks.fetchContent, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarkId: bookmark.id,
          url: bookmark.url,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.content) {
          return {
            content: data.content,
            source: "fetched",
          };
        }
      } else if (response.status === 429) {
        // 频率限制
        return {
          content: null,
          source: "none",
          error: "请求过于频繁，请稍后重试",
        };
      }
    } catch (error) {
      clientLogger.warn(
        { bookmarkId: bookmark.id, error },
        "Failed to fetch bookmark content",
      );
      return {
        content: null,
        source: "none",
        error: "内容抓取失败",
      };
    }
  }

  // 5. 无内容
  return {
    content: null,
    source: "none",
  };
}

// =============================================================================
// 类型定义
// =============================================================================

export interface UseAttachmentManagerOptions {
  /** 最大附件数量 */
  maxCount?: number;
  /** 初始附件列表 */
  initialItems?: AttachmentItem[];
}

export interface UseAttachmentManagerReturn {
  /** 附件列表 */
  attachments: AttachmentItem[];
  /** 已选书签 ID 集合 */
  selectedBookmarkIds: Set<string>;
  /** 弹出面板是否打开 */
  isPopoverOpen: boolean;
  /** 设置弹出面板状态 */
  setPopoverOpen: (open: boolean) => void;
  /** 添加书签附件（异步，会触发内容抓取） */
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  /** 移除书签附件 */
  removeBookmark: (id: string) => void;
  /** 切换书签选中状态 */
  toggleBookmark: (bookmark: Bookmark) => Promise<void>;
  /** 添加文件附件 */
  addFiles: (files: File[]) => Promise<void>;
  /** 移除文件附件 */
  removeFile: (id: string) => void;
  /** 重试抓取内容 */
  retryFetchContent: (id: string) => Promise<void>;
  /** 更新附件列表（支持函数式更新，避免闭包陷阱） */
  setAttachments: (updater: AttachmentSelectionUpdater) => void;
  /** 清空所有附件 */
  clearAll: () => void;
  /** 是否还能添加更多 */
  canAddMore: boolean;
  /** 剩余槽位 */
  remainingSlots: number;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** @deprecated 使用 isProcessing 替代 */
  isProcessingFile: boolean;
  /** 就绪的附件数量 */
  readyCount: number;
  /** 加载中的附件数量 */
  loadingCount: number;
  /** 错误的附件数量 */
  errorCount: number;
  /** 空内容的附件数量 */
  emptyCount: number;
  /** 是否所有附件都就绪（ready 或 empty） */
  allReady: boolean;
}

// =============================================================================
// Hook 实现
// =============================================================================

export function useAttachmentManager({
  maxCount = ATTACHMENT_LIMITS.MAX_COUNT,
  initialItems = [],
}: UseAttachmentManagerOptions = {}): UseAttachmentManagerReturn {
  // 状态
  const [attachments, setAttachmentsInternal] =
    useState<AttachmentItem[]>(initialItems);
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 包装 setAttachments 以支持 AttachmentSelectionUpdater 类型
  // 这样可以接受直接数组或函数式更新
  const setAttachments = useCallback((updater: AttachmentSelectionUpdater) => {
    if (typeof updater === "function") {
      setAttachmentsInternal(updater);
    } else {
      setAttachmentsInternal(updater);
    }
  }, []);

  // 计算派生状态
  const canAddMore = attachments.length < maxCount;
  const remainingSlots = maxCount - attachments.length;

  // 状态统计
  const readyCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "ready").length,
    [attachments],
  );
  const loadingCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "loading").length,
    [attachments],
  );
  const errorCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "error").length,
    [attachments],
  );
  const emptyCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "empty").length,
    [attachments],
  );
  const allReady = useMemo(
    () =>
      attachments.length > 0 &&
      attachments.every(
        (a) => a.contentStatus === "ready" || a.contentStatus === "empty",
      ),
    [attachments],
  );

  // 已选书签 ID 集合
  const selectedBookmarkIds = useMemo(
    () =>
      new Set(
        attachments
          .filter((item) => item.type === "bookmark")
          .map((item) => item.id),
      ),
    [attachments],
  );

  // 更新单个附件
  const updateAttachment = useCallback(
    (id: string, updates: Partial<AttachmentItem>) => {
      setAttachmentsInternal((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // 添加书签（异步，立即抓取内容）
  const addBookmark = useCallback(
    async (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);

      // 检查是否已存在
      if (selectedBookmarkIds.has(bookmarkId)) return;

      // 检查是否超过上限
      if (attachments.length >= maxCount) return;

      setIsProcessing(true);

      // 1. 先添加占位项（loading 状态）
      const newItem: AttachmentItem = {
        id: bookmarkId,
        type: "bookmark",
        title: bookmark.title ?? "",
        url: bookmark.url ?? undefined,
        content: undefined,
        platform: bookmark.platform ?? undefined,
        bookmarkId: bookmark.id,
        contentStatus: "loading",
        contentSource: "none",
        addedAt: new Date(),
      };

      setAttachmentsInternal((prev) => [...prev, newItem]);

      // 2. 异步抓取内容
      try {
        const result = await fetchBookmarkContent(bookmark);

        // 3. 更新内容状态
        const contentStatus: AttachmentContentStatus = result.content
          ? "ready"
          : result.error
            ? "error"
            : "empty";

        updateAttachment(bookmarkId, {
          content: result.content ?? undefined,
          contentStatus,
          contentSource: result.source,
          contentLength: result.content?.length,
          errorMessage: result.error,
        });

        clientLogger.info(
          {
            bookmarkId: bookmark.id,
            contentStatus,
            contentSource: result.source,
            contentLength: result.content?.length ?? 0,
          },
          "Bookmark attachment added",
        );
      } catch (error) {
        updateAttachment(bookmarkId, {
          contentStatus: "error",
          errorMessage: error instanceof Error ? error.message : "内容加载失败",
        });

        clientLogger.error(
          { bookmarkId: bookmark.id, error },
          "Failed to add bookmark attachment",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [attachments.length, maxCount, selectedBookmarkIds, updateAttachment],
  );

  // 移除书签
  const removeBookmark = useCallback((id: string) => {
    setAttachmentsInternal((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 切换书签选中状态
  const toggleBookmark = useCallback(
    async (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);

      if (selectedBookmarkIds.has(bookmarkId)) {
        removeBookmark(bookmarkId);
      } else {
        await addBookmark(bookmark);
      }
    },
    [selectedBookmarkIds, addBookmark, removeBookmark],
  );

  // 重试抓取内容
  const retryFetchContent = useCallback(
    async (id: string) => {
      const attachment = attachments.find((a) => a.id === id);
      if (
        !attachment ||
        attachment.type !== "bookmark" ||
        !attachment.bookmarkId
      ) {
        return;
      }

      setIsProcessing(true);
      updateAttachment(id, {
        contentStatus: "loading",
        errorMessage: undefined,
      });

      try {
        // 重新获取书签信息并抓取内容
        const response = await fetch(
          API_PATHS.bookmarks.detail(attachment.bookmarkId),
        );
        if (!response.ok) throw new Error("Failed to fetch bookmark");

        const { data: bookmark } = await response.json();
        const result = await fetchBookmarkContent(bookmark);

        const contentStatus: AttachmentContentStatus = result.content
          ? "ready"
          : result.error
            ? "error"
            : "empty";

        updateAttachment(id, {
          content: result.content ?? undefined,
          contentStatus,
          contentSource: result.source,
          contentLength: result.content?.length,
          errorMessage: result.error,
        });

        clientLogger.info(
          { attachmentId: id, contentStatus },
          "Attachment content retry successful",
        );
      } catch (error) {
        updateAttachment(id, {
          contentStatus: "error",
          errorMessage: error instanceof Error ? error.message : "重试失败",
        });

        clientLogger.error(
          { attachmentId: id, error },
          "Attachment content retry failed",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [attachments, updateAttachment],
  );

  // 添加文件
  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const slotsToUse = Math.min(files.length, remainingSlots);
      if (slotsToUse === 0) return;

      setIsProcessing(true);

      try {
        const filesToProcess = files.slice(0, slotsToUse);
        const newItems: AttachmentItem[] = [];

        for (const file of filesToProcess) {
          // 提取文件内容
          const extracted = await extractFileContent(file);

          const fileItem: AttachmentItem = {
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "file",
            title: file.name,
            content: extracted.text,
            fileData: file,
            mimeType: file.type,
            size: file.size,
            truncated: extracted.truncated,
            contentStatus: extracted.text ? "ready" : "empty",
            contentSource: "file_extracted",
            contentLength: extracted.text?.length,
            addedAt: new Date(),
          };

          newItems.push(fileItem);
        }

        setAttachmentsInternal((prev) => [...prev, ...newItems]);

        clientLogger.info(
          { fileCount: newItems.length },
          "File attachments added",
        );
      } catch (error) {
        clientLogger.error({ error }, "Failed to add file attachments");
      } finally {
        setIsProcessing(false);
      }
    },
    [remainingSlots],
  );

  // 移除文件
  const removeFile = useCallback((id: string) => {
    setAttachmentsInternal((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 清空所有
  const clearAll = useCallback(() => {
    setAttachments([]);
  }, [setAttachments]);

  return {
    attachments,
    selectedBookmarkIds,
    isPopoverOpen,
    setPopoverOpen,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    addFiles,
    removeFile,
    retryFetchContent,
    setAttachments,
    clearAll,
    canAddMore,
    remainingSlots,
    isProcessing,
    isProcessingFile: isProcessing, // 兼容别名
    readyCount,
    loadingCount,
    errorCount,
    emptyCount,
    allReady,
  };
}

export default useAttachmentManager;
