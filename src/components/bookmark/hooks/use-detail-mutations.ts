/**
 * Bookmark Detail Mutations Hook
 *
 * 处理收藏详情页的所有 CRUD 操作，支持乐观更新和错误回滚。
 *
 * @version 1.0.0
 * @since 2025-12-24 (Phase 2.3.7)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";

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
  const { fetchWithAbort } = useAbortableFetch();

  // ===== 核心状态 =====
  const [rating, setRating] = useState(initialRating);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [isMarkedForDeletion, setIsMarkedForDeletion] = useState(
    initialIsMarkedForDeletion,
  );
  const [isDeleting, setIsDeleting] = useState(false);

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
  const [isSavingTags, setIsSavingTags] = useState(false);

  // ===== 备注编辑状态 =====
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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
        await fetch(`/api/bookmarks/${bookmarkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
      } catch {
        // 静默失败
      }
    };

    markAsRead();
  }, [bookmarkId, initialIsRead]);

  // ===== 评级变更 =====
  const handleRatingChange = useCallback(
    async (newRating: number) => {
      const previousRating = rating;
      setRating(newRating);

      try {
        const res = await fetchWithAbort(`/api/bookmarks/${bookmarkId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: newRating }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "评级更新失败");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setRating(previousRating);
        toast.error(error instanceof Error ? error.message : "评级更新失败");
      }
    },
    [bookmarkId, fetchWithAbort, rating],
  );

  // ===== 锁定切换 =====
  const handleLockToggle = useCallback(async () => {
    const previousState = isLocked;
    const newLockState = !isLocked;
    setIsLocked(newLockState);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmarkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked: newLockState }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "操作失败");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setIsLocked(previousState);
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  }, [bookmarkId, fetchWithAbort, isLocked]);

  // ===== 删除标记切换 =====
  const handleMarkerToggle = useCallback(async () => {
    const previousState = isMarkedForDeletion;
    const newMarkerState = !isMarkedForDeletion;
    setIsMarkedForDeletion(newMarkerState);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmarkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMarkedForDeletion: newMarkerState }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "操作失败");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setIsMarkedForDeletion(previousState);
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  }, [bookmarkId, fetchWithAbort, isMarkedForDeletion]);

  // ===== 删除 =====
  const handleDelete = useCallback(async () => {
    if (isDeleting) return;

    if (isLocked) {
      toast.error("此收藏已锁定，无法删除");
      return;
    }

    if (!confirm("确定要删除这条收藏吗？删除后无法恢复。")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmarkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "删除失败");
      }

      toast.success("删除成功");
      router.push("/home");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setIsDeleting(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : "删除失败");
      setIsDeleting(false);
    }
  }, [bookmarkId, fetchWithAbort, isDeleting, isLocked, router]);

  // ===== 标签编辑 =====
  const handleEditTags = useCallback(() => {
    setIsEditingTags(true);
    setEditedTags(localUserTags?.join(", ") || "");
  }, [localUserTags]);

  const handleCancelEditTags = useCallback(() => {
    setIsEditingTags(false);
    setEditedTags("");
  }, []);

  const handleSaveTags = useCallback(async () => {
    if (isSavingTags) return;

    setIsSavingTags(true);

    const newTags = editedTags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const previousTags = localUserTags;
    const tagsToSave = newTags.length > 0 ? newTags : null;

    setLocalUserTags(tagsToSave);
    setIsEditingTags(false);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmarkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTags: tagsToSave }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "更新标签失败");
      }

      toast.success("标签更新成功");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setLocalUserTags(previousTags);
      toast.error(error instanceof Error ? error.message : "更新标签失败");
    } finally {
      setIsSavingTags(false);
    }
  }, [bookmarkId, editedTags, fetchWithAbort, isSavingTags, localUserTags]);

  // ===== 备注编辑 =====
  const handleEditNotes = useCallback(() => {
    setIsEditingNotes(true);
    setEditedNotes(localNotes || "");
  }, [localNotes]);

  const handleCancelEditNotes = useCallback(() => {
    setIsEditingNotes(false);
    setEditedNotes("");
  }, []);

  const handleSaveNotes = useCallback(async () => {
    if (isSavingNotes) return;

    setIsSavingNotes(true);

    const previousNotes = localNotes;
    const notesToSave = editedNotes.trim() || null;

    setLocalNotes(notesToSave);
    setIsEditingNotes(false);

    try {
      const res = await fetchWithAbort(`/api/bookmarks/${bookmarkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesToSave }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "更新备注失败");
      }

      toast.success("备注更新成功");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setLocalNotes(previousNotes);
      toast.error(error instanceof Error ? error.message : "更新备注失败");
    } finally {
      setIsSavingNotes(false);
    }
  }, [bookmarkId, editedNotes, fetchWithAbort, isSavingNotes, localNotes]);

  return {
    // 状态
    rating,
    isLocked,
    isMarkedForDeletion,
    localUserTags,
    localNotes,
    localSummary,
    isDeleting,

    // 标签编辑
    isEditingTags,
    editedTags,
    isSavingTags,
    setEditedTags,
    handleEditTags,
    handleCancelEditTags,
    handleSaveTags,

    // 备注编辑
    isEditingNotes,
    editedNotes,
    isSavingNotes,
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
