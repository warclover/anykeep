/**
 * 附件管理 Hook
 *
 * 管理附件选择、添加、删除等状态
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ATTACHMENT_LIMITS,
  type AttachmentItem,
} from "@/components/ai/attachment/types";
import { extractFileContent } from "@/lib/ai/attachment/file-extractor";
import type { Bookmark } from "@/types/supabase";

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
  /** 弹出面板是否打开 */
  isPopoverOpen: boolean;
  /** 设置弹出面板状态 */
  setPopoverOpen: (open: boolean) => void;
  /** 添加书签附件 */
  addBookmark: (bookmark: Bookmark) => void;
  /** 移除书签附件 */
  removeBookmark: (id: string) => void;
  /** 切换书签选中状态 */
  toggleBookmark: (bookmark: Bookmark) => void;
  /** 添加文件附件 */
  addFiles: (files: File[]) => Promise<void>;
  /** 移除文件附件 */
  removeFile: (id: string) => void;
  /** 更新附件列表 */
  setAttachments: (items: AttachmentItem[]) => void;
  /** 清空所有附件 */
  clearAll: () => void;
  /** 是否还能添加更多 */
  canAddMore: boolean;
  /** 剩余槽位 */
  remainingSlots: number;
  /** 是否正在处理文件 */
  isProcessingFile: boolean;
}

// =============================================================================
// Hook 实现
// =============================================================================

export function useAttachmentManager({
  maxCount = ATTACHMENT_LIMITS.MAX_COUNT,
  initialItems = [],
}: UseAttachmentManagerOptions = {}): UseAttachmentManagerReturn {
  // 状态
  const [attachments, setAttachments] =
    useState<AttachmentItem[]>(initialItems);
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // 计算派生状态
  const canAddMore = attachments.length < maxCount;
  const remainingSlots = maxCount - attachments.length;

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

  // 添加书签
  const addBookmark = useCallback(
    (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);

      // 检查是否已存在
      if (selectedBookmarkIds.has(bookmarkId)) return;

      // 检查是否超过上限
      if (attachments.length >= maxCount) return;

      const newItem: AttachmentItem = {
        id: bookmarkId,
        type: "bookmark",
        title: bookmark.title,
        url: bookmark.url,
        content: bookmark.ai_summary || bookmark.description || undefined,
        platform: bookmark.platform,
      };

      setAttachments((prev) => [...prev, newItem]);
    },
    [attachments.length, maxCount, selectedBookmarkIds],
  );

  // 移除书签
  const removeBookmark = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 切换书签选中状态
  const toggleBookmark = useCallback(
    (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);

      if (selectedBookmarkIds.has(bookmarkId)) {
        removeBookmark(bookmarkId);
      } else {
        addBookmark(bookmark);
      }
    },
    [selectedBookmarkIds, addBookmark, removeBookmark],
  );

  // 添加文件
  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // 检查剩余槽位
      const slotsToUse = Math.min(files.length, remainingSlots);
      if (slotsToUse === 0) return;

      setIsProcessingFile(true);

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
          };

          newItems.push(fileItem);
        }

        setAttachments((prev) => [...prev, ...newItems]);
      } finally {
        setIsProcessingFile(false);
      }
    },
    [remainingSlots],
  );

  // 移除文件
  const removeFile = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 清空所有
  const clearAll = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    isPopoverOpen,
    setPopoverOpen,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    addFiles,
    removeFile,
    setAttachments,
    clearAll,
    canAddMore,
    remainingSlots,
    isProcessingFile,
  };
}

export default useAttachmentManager;
