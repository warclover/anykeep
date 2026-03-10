"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import { createBookmarkSchema } from "@/lib/validation";
import {
  handleClassificationNotification,
  acceptClassificationSuggestion,
  rejectClassificationSuggestion,
  type ClassificationResponse,
} from "@/components/classification/classification-notification";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import type { UseCreateBookmarkFormReturn } from "./use-create-bookmark-form";
import { API_AI } from "@/lib/constants/api-paths";

export interface BookmarkCreatedData {
  id: number;
  title: string;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
}

interface UseBookmarkSubmitParams {
  form: UseCreateBookmarkFormReturn;
  resetAll: () => void;
  abortAll: () => void;
  onSuccess?: (bookmark: BookmarkCreatedData) => void;
  onOpenChange: (open: boolean) => void;
}

export function useBookmarkSubmit(params: UseBookmarkSubmitParams) {
  const { form, resetAll, abortAll, onSuccess, onOpenChange } = params;
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [folderSelectOpen, setFolderSelectOpen] = useState(false);
  const [pendingBookmarkId, setPendingBookmarkId] = useState<number | null>(
    null,
  );
  const [pendingSuggestionId, setPendingSuggestionId] = useState<number | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    form.setErrors({});
    abortAll();

    try {
      const inputTags = form.tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const finalTags = Array.from(
        new Set([
          ...form.selectedUsageTags,
          ...form.userAddedTags,
          ...inputTags,
        ]),
      );
      const userTags = finalTags.length > 0 ? finalTags : undefined;

      const validation = createBookmarkSchema.safeParse({
        url: form.url,
        title: form.title,
        description: form.description || undefined,
        folderId: form.folderId ? parseInt(form.folderId) : undefined,
        userTags,
        notes: form.notes || undefined,
        coverUrl: form.coverUrl || undefined,
        sourceName: form.sourceName || undefined,
        author: form.author || undefined,
        publishTime: form.publishTime || undefined,
        wordCount: form.wordCount || undefined,
        imageCount: form.imageCount || undefined,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.issues.forEach((err) => {
          const field = err.path[0] as string;
          fieldErrors[field] = err.message;
        });
        form.setErrors(fieldErrors);
        return;
      }

      const res = await fetchWithAbort("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "创建收藏失败");

      toast.success("收藏创建成功！");

      if (form.enableVisionAnalysis && data.data?.id) {
        fetch(API_AI.visionAnalyze, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkId: data.data.id, maxImages: 3 }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              toast.success("视觉分析完成", {
                description: "已提取图片内容和视觉标签",
              });
            }
          })
          .catch(() => {});

        toast.info("正在进行视觉分析...", {
          description: "分析完成后将自动更新",
        });
      }

      if (data.data?.classification) {
        const classification = data.data
          .classification as ClassificationResponse;

        const handleUndoAutoClassification = async () => {
          await fetchWithAbort(`/api/bookmarks/${data.data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: null }),
          });
          router.refresh();
        };

        const handleAcceptSuggestion = async (suggestionId: number) => {
          await acceptClassificationSuggestion(suggestionId);
          router.refresh();
        };

        const handleRejectSuggestion = async (suggestionId: number) => {
          await rejectClassificationSuggestion(suggestionId);
        };

        const handleChangeFolder = (
          bookmarkId: number,
          suggestionId: number,
        ) => {
          setPendingBookmarkId(bookmarkId);
          setPendingSuggestionId(suggestionId);
          setFolderSelectOpen(true);
        };

        await handleClassificationNotification(
          classification,
          data.data.id,
          handleAcceptSuggestion,
          handleRejectSuggestion,
          handleUndoAutoClassification,
          handleChangeFolder,
        );
      }

      if (onSuccess && data.data) {
        onSuccess({
          id: data.data.id,
          title: data.data.title,
          ai_summary: data.data.ai_summary,
          ai_tags: data.data.ai_tags,
        });
      }

      resetAll();
      onOpenChange(false);

      if (data.data) {
        uiEventBus.emit(UIEvents.BOOKMARK_CREATED, { bookmark: data.data });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "创建收藏失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFolderSelected = async (folderId: number, folderName: string) => {
    if (!pendingBookmarkId) return;

    const res = await fetchWithAbort(`/api/bookmarks/${pendingBookmarkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });

    if (!res.ok) throw new Error("移动失败");

    if (pendingSuggestionId) {
      try {
        await rejectClassificationSuggestion(pendingSuggestionId);
      } catch {
        // 静默失败
      }
    }

    toast.success(`已移动到「${folderName}」`);
    router.refresh();

    setPendingBookmarkId(null);
    setPendingSuggestionId(null);
  };

  return {
    isSubmitting,
    handleSubmit,
    folderSelectOpen,
    setFolderSelectOpen,
    pendingBookmarkId,
    handleFolderSelected,
  };
}

export type UseBookmarkSubmitReturn = ReturnType<typeof useBookmarkSubmit>;
