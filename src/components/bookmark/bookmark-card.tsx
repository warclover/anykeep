/**
 * 收藏卡片组件
 *
 * V5.0: 三合一拆分 — 将三个变体提取到独立文件
 *   - bookmark-card-compact.tsx  → compact 视图
 *   - bookmark-card-list.tsx     → list 视图
 *   - bookmark-card-default.tsx  → card（默认）视图
 *
 * 本文件只负责：
 *   1. 状态管理（hooks）
 *   2. 事件处理函数（useCallback）
 *   3. 根据 variant 分派到对应的纯渲染组件
 */

"use client";

import { lazy, Suspense, useState, memo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSnapshotFeature } from "@/components/snapshot";
import { useUiText } from "@/lib/i18n";
import type { Platform } from "@/types/supabase";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { prefetchCustomUsageTags } from "@/hooks/data";
import type {
  BookmarkCardProps,
  BookmarkCardViewProps,
} from "./bookmark-card-types";

// ──────────────────────────────────────────────────────────
// 懒加载变体组件（代码分割，按需加载）
// ──────────────────────────────────────────────────────────

const BookmarkCardCompact = lazy(() =>
  import("./bookmark-card-compact").then((m) => ({
    default: m.BookmarkCardCompact,
  })),
);

const BookmarkCardList = lazy(() =>
  import("./bookmark-card-list").then((m) => ({
    default: m.BookmarkCardList,
  })),
);

const BookmarkCardDefault = lazy(() =>
  import("./bookmark-card-default").then((m) => ({
    default: m.BookmarkCardDefault,
  })),
);

// ──────────────────────────────────────────────────────────
// 自定义比较函数（memo 优化）
// ──────────────────────────────────────────────────────────

function arePropsEqual(
  prevProps: BookmarkCardProps,
  nextProps: BookmarkCardProps,
): boolean {
  const prevBookmark = prevProps.bookmark;
  const nextBookmark = nextProps.bookmark;

  if (
    prevBookmark.id !== nextBookmark.id ||
    prevBookmark.title !== nextBookmark.title ||
    prevBookmark.cover_url !== nextBookmark.cover_url ||
    prevBookmark.platform !== nextBookmark.platform ||
    prevBookmark.is_read !== nextBookmark.is_read ||
    prevBookmark.is_starred !== nextBookmark.is_starred ||
    prevBookmark.is_locked !== nextBookmark.is_locked ||
    prevBookmark.rating !== nextBookmark.rating ||
    prevBookmark.status !== nextBookmark.status ||
    prevBookmark.pending_cluster !== nextBookmark.pending_cluster ||
    prevBookmark.ai_summary !== nextBookmark.ai_summary ||
    prevBookmark.ai_content_type !== nextBookmark.ai_content_type
  ) {
    return false;
  }

  if (
    prevBookmark.ai_tags?.length !== nextBookmark.ai_tags?.length ||
    prevBookmark.user_tags?.length !== nextBookmark.user_tags?.length
  ) {
    return false;
  }

  if (
    prevProps.isSelectionMode !== nextProps.isSelectionMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.variant !== nextProps.variant
  ) {
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────────────────
// 主组件（仅含逻辑 + 分派，无渲染 JSX）
// ──────────────────────────────────────────────────────────

export const BookmarkCard = memo(function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  onMove,
  onToggleRead,
  onToggleStarred,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = "card",
  customUsageTags = [],
}: BookmarkCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useUiText();
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSnapshotEnabled = useSnapshotFeature();

  // ── 判断标题是否正在加载 ──────────────────────────────
  const titleLoading = bookmark.title === t.bookmark.loadingTitle;

  // ── 封面图 ────────────────────────────────────────────
  const placeholderImage = generatePlaceholderImage(
    bookmark.title ?? "",
    bookmark.platform as Platform,
  );
  const coverImage = imageLoadError
    ? placeholderImage
    : getProxiedImageUrl(bookmark.cover_url) || placeholderImage;

  const handleImageError = useCallback(() => {
    setImageLoadError(true);
  }, []);

  // ── 书签详情页 URL ────────────────────────────────────
  const bookmarkHref = `/bookmark/${bookmark.id}`;

  // ── 事件处理函数（全部 useCallback 包裹）────────────────
  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onEdit?.(bookmark.id);
    },
    [onEdit, bookmark.id],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDeleting) return;
      setIsDeleting(true);
      try {
        await onDelete?.(bookmark.id);
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, onDelete, bookmark.id],
  );

  const handleOpenOriginal = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(bookmark.url, "_blank", "noopener,noreferrer");
      if (!bookmark.is_read && onToggleRead) {
        onToggleRead(bookmark.id, true);
      }
    },
    [bookmark.url, bookmark.is_read, bookmark.id, onToggleRead],
  );

  const handleToggleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(bookmark.id);
    },
    [onToggleSelect, bookmark.id],
  );

  const handleToggleRead = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleRead?.(bookmark.id, !bookmark.is_read);
    },
    [onToggleRead, bookmark.id, bookmark.is_read],
  );

  const handleToggleStarred = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleStarred?.(bookmark.id, !bookmark.is_starred);
    },
    [onToggleStarred, bookmark.id, bookmark.is_starred],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onMove?.(bookmark.id);
    },
    [onMove, bookmark.id],
  );

  const handlePrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
    prefetchTimerRef.current = setTimeout(() => {
      router.prefetch(bookmarkHref);
      prefetchCustomUsageTags(queryClient);
    }, 150);
  }, [router, queryClient, bookmarkHref]);

  const handlePrefetchCancel = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  const handleItemClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const closestInteractive = target.closest(
        "button, [data-radix-collection-item]",
      );
      const closestAnchor = target.closest("a");
      if (
        target.tagName === "BUTTON" ||
        closestInteractive ||
        (closestAnchor && closestAnchor !== e.currentTarget)
      ) {
        return;
      }
      e.preventDefault();
      if (isSelectionMode) {
        handleToggleSelect(e);
        return;
      }
      router.push(bookmarkHref);
    },
    [isSelectionMode, handleToggleSelect, router, bookmarkHref],
  );

  // ── ActionMenu 共用 props ─────────────────────────────
  const actionMenuProps = {
    bookmark,
    isSnapshotEnabled,
    isDeleting,
    onOpenOriginal: handleOpenOriginal,
    onToggleRead: onToggleRead ? handleToggleRead : undefined,
    onToggleStarred: onToggleStarred ? handleToggleStarred : undefined,
    onEdit: onEdit ? handleEdit : undefined,
    onMove: onMove ? handleMove : undefined,
    onDelete: onDelete ? handleDelete : undefined,
    t,
  } satisfies BookmarkCardViewProps["actionMenuProps"];

  // ── 共享 View Props ───────────────────────────────────
  const viewProps: BookmarkCardViewProps = {
    bookmark,
    bookmarkHref,
    isDeleting,
    isSelected,
    isSelectionMode,
    titleLoading,
    coverImage,
    handleImageError,
    handleItemClick,
    handlePrefetch,
    handlePrefetchCancel,
    actionMenuProps,
    customUsageTags,
    t,
  };

  // ── 根据 variant 分派到对应变体组件 ──────────────────
  if (variant === "compact") {
    return (
      <Suspense fallback={null}>
        <BookmarkCardCompact {...viewProps} />
      </Suspense>
    );
  }

  if (variant === "list") {
    return (
      <Suspense fallback={null}>
        <BookmarkCardList {...viewProps} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <BookmarkCardDefault {...viewProps} />
    </Suspense>
  );
}, arePropsEqual);
