"use client";

/**
 * Save to Note Hook
 * @description 管理保存到笔记的完整流程：重复检测 → 标题生成 → 保存
 */

import * as React from "react";
import type {
  SaveToNotePayload,
  SavedNoteInfo,
  DuplicateInfo,
  SaveButtonState,
  SaveResult,
} from "@/components/shared/save-to-note/types";
import { extractFallbackTitle } from "@/features/md-collections/lib";

interface UseSaveToNoteOptions {
  /** 保存成功回调 */
  onSuccess?: (noteId: number, noteTitle: string) => void;
  /** 保存失败回调 */
  onError?: (error: Error) => void;
}

interface UseSaveToNoteReturn {
  /** 当前状态 */
  state: SaveButtonState;
  /** 重复信息（检测到重复时） */
  duplicateInfo: DuplicateInfo | null;
  /** 已保存笔记信息 */
  savedNote: SavedNoteInfo | null;
  /** 错误信息 */
  error: Error | null;
  /** 执行保存（会检测重复） */
  save: (payload: SaveToNotePayload) => Promise<SaveResult>;
  /** 强制保存（跳过重复检测） */
  saveAnyway: (
    payload: SaveToNotePayload,
  ) => Promise<{ noteId: number; title: string }>;
  /** 重置状态 */
  reset: () => void;
}

export function useSaveToNote(
  options?: UseSaveToNoteOptions,
): UseSaveToNoteReturn {
  const [state, setState] = React.useState<SaveButtonState>("idle");
  const [duplicateInfo, setDuplicateInfo] =
    React.useState<DuplicateInfo | null>(null);
  const [savedNote, setSavedNote] = React.useState<SavedNoteInfo | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  // 保存选项 ref（避免 useCallback 依赖问题）
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  /**
   * 执行保存流程
   */
  const save = React.useCallback(
    async (payload: SaveToNotePayload): Promise<SaveResult> => {
      try {
        setState("checking");
        setError(null);
        setDuplicateInfo(null);

        // 1. 检查重复（如果未跳过）
        if (!payload.skipDuplicateCheck) {
          const duplicateRes = await fetch(
            "/api/md-collections/check-duplicate",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: payload.content }),
            },
          );

          const duplicateData = await duplicateRes.json();

          // 统一处理响应格式（支持 data 包装和直接返回）
          const isDuplicate =
            duplicateData.isDuplicate || duplicateData.data?.isDuplicate;
          const existingNote =
            duplicateData.existingNote || duplicateData.data?.existingNote;

          if (isDuplicate && existingNote) {
            setDuplicateInfo({
              id: existingNote.id,
              title: existingNote.title,
              savedAt: existingNote.created_at,
            });
            setState("idle");
            return {
              isDuplicate: true,
              duplicateInfo: {
                id: existingNote.id,
                title: existingNote.title,
                savedAt: existingNote.created_at,
              },
            };
          }
        }

        // 2. 生成标题（如果未提供）
        setState("generating");
        let title = payload.customTitle;

        if (!title) {
          const titleRes = await fetch("/api/ai/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: payload.content.slice(0, 2000) }),
          });

          if (!titleRes.ok) {
            // 标题生成失败，使用回退方案
            title = extractFallbackTitle(payload.content);
          } else {
            const titleData = await titleRes.json();
            title = titleData.title || extractFallbackTitle(payload.content);
          }
        }

        // 格式化标题：{AI标题} - 2025.01.08
        const date = new Date()
          .toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
          .replace(/\//g, ".");
        const formattedTitle = `${title} - ${date}`;

        // 3. 保存到 MD 收藏
        setState("saving");
        const saveRes = await fetch("/api/md-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawContent: payload.content,
            title: formattedTitle,
            sourceType: payload.sourceType,
            // source_metadata 通过单独字段传递
          }),
        });

        if (!saveRes.ok) {
          const errorData = await saveRes.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || "保存失败");
        }

        const noteData = await saveRes.json();
        // 支持 data 包装和直接返回
        const noteId = noteData.id || noteData.data?.id;

        if (!noteId) {
          throw new Error("保存返回数据异常");
        }

        // 4. 更新状态
        const savedNoteInfo: SavedNoteInfo = {
          id: noteId,
          title: formattedTitle,
          viewUrl: `/md-collections/${noteId}`,
          folderName: "AI 生成",
        };

        setSavedNote(savedNoteInfo);
        setState("success");
        optionsRef.current?.onSuccess?.(noteId, formattedTitle);

        // 5. 3秒后重置状态
        setTimeout(() => setState("idle"), 3000);

        return { isDuplicate: false, noteId, title: formattedTitle };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("保存失败");
        setError(error);
        setState("error");
        optionsRef.current?.onError?.(error);

        // 3秒后重置状态
        setTimeout(() => setState("idle"), 3000);
        throw error;
      }
    },
    [],
  );

  /**
   * 强制保存（跳过重复检测）
   */
  const saveAnyway = React.useCallback(
    async (payload: SaveToNotePayload) => {
      setDuplicateInfo(null);
      const result = await save({ ...payload, skipDuplicateCheck: true });

      // 安全检查：确保返回值有效
      if (!result.noteId || !result.title) {
        throw new Error("保存返回数据异常");
      }

      return { noteId: result.noteId, title: result.title };
    },
    [save],
  );

  /**
   * 重置状态
   */
  const reset = React.useCallback(() => {
    setState("idle");
    setDuplicateInfo(null);
    setSavedNote(null);
    setError(null);
  }, []);

  return {
    state,
    duplicateInfo,
    savedNote,
    error,
    save,
    saveAnyway,
    reset,
  };
}
