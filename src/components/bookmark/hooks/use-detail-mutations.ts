/**
 * Bookmark Detail Mutations Hook
 *
 * 处理收藏详情页的所有 CRUD 操作，支持乐观更新和错误回滚。
 *
 * @version 2.0.0 - 迁移到 TanStack Query useMutation
 * @since 2025-12-24 (Phase 2.3.7)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import { API_PATHS } from "@/lib/constants/api-paths";
import { invalidateBookmarkCaches } from "@/lib/cache/invalidate-caches";
import { bookmarkKeys } from "@/hooks/queries/keys";

// ============================================
// 类型定义
// ============================================

export interface UseDetailMutationsOptions {
  /** 书签 ID */
  bookmarkId: number;
  /** 初始评级 */
  initialRating: number;
  /** 初始锁定状态 */
  initialIsLocked: boolean;
  /** 初始删除标记状态 */
  initialIsMarkedForDeletion: boolean;
  /** 初始用户标签 */
  initialUserTags: string[] | null;
  /** 初始备注 */
  initialNotes: string | null;
  /** 初始 AI 摘要 */
  initialSummary: string | null;
  /** 初始已读状态 */
  initialIsRead: boolean;
}

export interface UseDetailMutationsReturn {
  // 状态
  rating: number;
  isLocked: boolean;
  isMarkedForDeletion: boolean;
  localUserTags: string[] | null;
  localNotes: string | null;
  localSummary: string | null;
  isDeleting: boolean;

  // 标签编辑
  isEditingTags: boolean;
  editedTags: string;
  isSavingTags: boolean;
  setEditedTags: (value: string) => void;
  handleEditTags: () => void;
  handleCancelEditTags: () => void;
  handleSaveTags: () => Promise<void>;

  // 备注编辑
  isEditingNotes: boolean;
  editedNotes: string;
  isSavingNotes: boolean;
  setEditedNotes: (value: string) => void;
  handleEditNotes: () => void;
  handleCancelEditNotes: () => void;
  handleSaveNotes: () => Promise<void>;

  // 操作
  handleRatingChange: (newRating: number) => Promise<void>;
  handleLockToggle: () => Promise<void>;
  handleMarkerToggle: () => Promise<void>;
  handleDelete: () => Promise<void>;
  setLocalUserTags: React.Dispatch<React.SetStateAction<string[] | null>>;
  setLocalSummary: React.Dispatch<React.SetStateAction<string | null>>;
}

// ============================================
// 辅助：通用书签字段更新 mutationFn
// ============================================

async function updateBookmarkField(
  bookmarkId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetchWithAuth(API_PATHS.bookmarks.detail(bookmarkId), {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || "操作失败");
  }
}

// ============================================
// Hook 实现
// ============================================

export function useDetailMutations({
  bookmarkId,
  initialRating,
  initialIsLocked,
  initialIsMarkedForDeletion,
  initialUserTags,
  initialNotes,
  initialSummary,
  initialIsRead,
}: UseDetailMutationsOptions): UseDetailMutationsReturn {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ===== 核心状态 =====
  const [rating, setRating] = useState(initialRating);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [isMarkedForDeletion, setIsMarkedForDeletion] = useState(
    initialIsMarkedForDeletion,
  );

  // 本地状态（乐观更新）
  const [localUserTags, setLocalUserTags] = useState<string[] | null>(
    initialUserTags,
  );
  const [localNotes, setLocalNotes] = useState<string | null>(initialNotes);
  const [localSummary, setLocalSummary] = useState<string | null>(
    initialSummary,
  );

  // ===== 标签编辑状态 =====
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState("");

  // ===== 备注编辑状态 =====
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");

  // 防止重复调用标记已读 API
  const hasMarkedAsRead = useRef(false);

  // 访问详情页时自动标记已读
  useEffect(() => {
    const markAsRead = async () => {
      if (initialIsRead || hasMarkedAsRead.current) {
        return;
      }

      hasMarkedAsRead.current = true;

      try {
        await fetchWithAuth(API_PATHS.bookmarks.detail(bookmarkId), {
          method: "PATCH",
          body: JSON.stringify({ isRead: true }),
        });
      } catch {
        // 静默失败
      }
    };

    markAsRead();
  }, [bookmarkId, initialIsRead]);

  // ===== 评级变更 =====
  const ratingMutation = useMutation({
    mutationFn: (newRating: number) =>
      updateBookmarkField(bookmarkId, { rating: newRating }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.detail(bookmarkId),
      });
    },
  });

  const handleRatingChange = useCallback(
    async (newRating: number) => {
      const previousRating = rating;
      setRating(newRating);

      try {
        await ratingMutation.mutateAsync(newRating);
      } catch (error) {
        setRating(previousRating);
        toast.error(error instanceof Error ? error.message : "评级更新失败");
      }
    },
    [ratingMutation, rating],
  );

  // ===== 锁定切换 =====
  const lockMutation = useMutation({
    mutationFn: (newLockState: boolean) =>
      updateBookmarkField(bookmarkId, { isLocked: newLockState }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.detail(bookmarkId),
      });
    },
  });

  const handleLockToggle = useCallback(async () => {
    const previousState = isLocked;
    const newLockState = !isLocked;
    setIsLocked(newLockState);

    try {
      await lockMutation.mutateAsync(newLockState);
    } catch (error) {
      setIsLocked(previousState);
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  }, [lockMutation, isLocked]);

  // ===== 删除标记切换 =====
  const markerMutation = useMutation({
    mutationFn: (newMarkerState: boolean) =>
      updateBookmarkField(bookmarkId, { isMarkedForDeletion: newMarkerState }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.detail(bookmarkId),
      });
    },
  });

  const handleMarkerToggle = useCallback(async () => {
    const previousState = isMarkedForDeletion;
    const newMarkerState = !isMarkedForDeletion;
    setIsMarkedForDeletion(newMarkerState);

    try {
      await markerMutation.mutateAsync(newMarkerState);
    } catch (error) {
      setIsMarkedForDeletion(previousState);
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  }, [markerMutation, isMarkedForDeletion]);

  // ===== 删除 =====
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth(
        API_PATHS.bookmarks.detail(bookmarkId),
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "删除失败");
      }
    },
    onSuccess: () => {
      toast.success("删除成功");
      invalidateBookmarkCaches(queryClient);
      router.push("/home");
    },
  });

  const handleDelete = useCallback(async () => {
    if (deleteMutation.isPending) return;

    if (isLocked) {
      toast.error("此收藏已锁定，无法删除");
      return;
    }

    if (!confirm("确定要删除这条收藏吗？删除后无法恢复。")) {
      return;
    }

    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }, [deleteMutation, isLocked]);

  // ===== 标签编辑 =====
  const tagsMutation = useMutation({
    mutationFn: (tagsToSave: string[] | null) =>
      updateBookmarkField(bookmarkId, { userTags: tagsToSave }),
    onSuccess: () => {
      toast.success("标签更新成功");
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.detail(bookmarkId),
      });
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.userTags(),
      });
    },
  });

  const handleEditTags = useCallback(() => {
    setIsEditingTags(true);
    setEditedTags(localUserTags?.join(", ") || "");
  }, [localUserTags]);

  const handleCancelEditTags = useCallback(() => {
    setIsEditingTags(false);
    setEditedTags("");
  }, []);

  const handleSaveTags = useCallback(async () => {
    if (tagsMutation.isPending) return;

    const newTags = editedTags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const previousTags = localUserTags;
    const tagsToSave = newTags.length > 0 ? newTags : null;

    setLocalUserTags(tagsToSave);
    setIsEditingTags(false);

    try {
      await tagsMutation.mutateAsync(tagsToSave);
    } catch (error) {
      setLocalUserTags(previousTags);
      toast.error(error instanceof Error ? error.message : "更新标签失败");
    }
  }, [editedTags, tagsMutation, localUserTags]);

  // ===== 备注编辑 =====
  const notesMutation = useMutation({
    mutationFn: (notesToSave: string | null) =>
      updateBookmarkField(bookmarkId, { notes: notesToSave }),
    onSuccess: () => {
      toast.success("备注更新成功");
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.detail(bookmarkId),
      });
    },
  });

  const handleEditNotes = useCallback(() => {
    setIsEditingNotes(true);
    setEditedNotes(localNotes || "");
  }, [localNotes]);

  const handleCancelEditNotes = useCallback(() => {
    setIsEditingNotes(false);
    setEditedNotes("");
  }, []);

  const handleSaveNotes = useCallback(async () => {
    if (notesMutation.isPending) return;

    const previousNotes = localNotes;
    const notesToSave = editedNotes.trim() || null;

    setLocalNotes(notesToSave);
    setIsEditingNotes(false);

    try {
      await notesMutation.mutateAsync(notesToSave);
    } catch (error) {
      setLocalNotes(previousNotes);
      toast.error(error instanceof Error ? error.message : "更新备注失败");
    }
  }, [editedNotes, notesMutation, localNotes]);

  return {
    // 状态
    rating,
    isLocked,
    isMarkedForDeletion,
    localUserTags,
    localNotes,
    localSummary,
    isDeleting: deleteMutation.isPending,

    // 标签编辑
    isEditingTags,
    editedTags,
    isSavingTags: tagsMutation.isPending,
    setEditedTags,
    handleEditTags,
    handleCancelEditTags,
    handleSaveTags,

    // 备注编辑
    isEditingNotes,
    editedNotes,
    isSavingNotes: notesMutation.isPending,
    setEditedNotes,
    handleEditNotes,
    handleCancelEditNotes,
    handleSaveNotes,

    // 操作
    handleRatingChange,
    handleLockToggle,
    handleMarkerToggle,
    handleDelete,
    setLocalUserTags,
    setLocalSummary,
  };
}
