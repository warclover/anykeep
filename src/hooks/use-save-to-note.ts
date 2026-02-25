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

// =============================================================================
// 辅助函数：将 JSON 对象转换为 Markdown
// =============================================================================

/**
 * 将对象格式化为可读的 Markdown 文本
 * @param obj - 要格式化的对象
 * @param indent - 缩进级别
 */
function formatObjectToMarkdown(obj: unknown, indent = 0): string {
  if (obj === null || obj === undefined) {
    return "";
  }

  const spaces = "  ".repeat(indent);

  // 数组处理
  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${spaces}- (空列表)\n`;
    return obj
      .map((item) => {
        if (typeof item === "string") {
          return `${spaces}- ${item}`;
        } else if (typeof item === "object" && item !== null) {
          // 尝试提取常见字段
          const itemObj = item as Record<string, unknown>;
          const title = itemObj.title || itemObj.name || itemObj.label;
          const desc =
            itemObj.description ||
            itemObj.summary ||
            itemObj.reason ||
            itemObj.content;

          if (title) {
            const mainText = String(title);
            return `${spaces}- **${mainText}**${desc ? `: ${String(desc)}` : ""}`;
          }
          // 没有标题字段，递归处理
          return `${spaces}- ${formatObjectToMarkdown(item, indent + 1)}`;
        }
        return `${spaces}- ${String(item)}`;
      })
      .join("\n");
  }

  // 对象处理
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) {
      return `${spaces}(空对象)`;
    }

    return entries
      .map(([key, value]) => {
        const label = formatKeyToLabel(key);

        if (value === null || value === undefined) {
          return `${spaces}- **${label}**: (无)`;
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            return `${spaces}- **${label}**: (空列表)`;
          }
          // 对于简单数组，直接显示
          if (value.every((v) => typeof v !== "object")) {
            const items = value.join("、");
            return `${spaces}- **${label}**: ${items}`;
          }
          // 复杂数组，换行显示
          return `${spaces}- **${label}**:\n${formatObjectToMarkdown(value, indent + 1)}`;
        }

        if (typeof value === "object") {
          return `${spaces}- **${label}**:\n${formatObjectToMarkdown(value, indent + 1)}`;
        }

        // 布尔值特殊处理
        if (typeof value === "boolean") {
          return `${spaces}- **${label}**: ${value ? "是" : "否"}`;
        }

        // 数字直接显示
        if (typeof value === "number") {
          return `${spaces}- **${label}**: ${value}`;
        }

        return `${spaces}- **${label}**: ${String(value)}`;
      })
      .join("\n");
  }

  return String(obj);
}

/**
 * 将 camelCase/snake_case 键转换为可读标签
 */
function formatKeyToLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\s/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// =============================================================================
// Hook 定义
// =============================================================================

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
   * 将可能是 JSON 的内容转换为 Markdown
   * 如果内容是 JSON 字符串或对象，尝试转换为可读的 Markdown 格式
   */
  const normalizeContentToMarkdown = React.useCallback(
    (content: string): string => {
      // 如果内容看起来像 JSON，尝试解析并格式化
      const trimmed = content.trim();

      // 检测是否为 JSON 数组或对象
      if (
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"))
      ) {
        try {
          const parsed = JSON.parse(trimmed);

          // 如果解析成功，转换为可读格式
          if (typeof parsed === "object" && parsed !== null) {
            return formatObjectToMarkdown(parsed);
          }
        } catch {
          // JSON 解析失败，保持原样
        }
      }

      return content;
    },
    [],
  );

  /**
   * 执行保存流程
   */
  const save = React.useCallback(
    async (payload: SaveToNotePayload): Promise<SaveResult> => {
      try {
        setState("checking");
        setError(null);
        setDuplicateInfo(null);

        // 预处理内容：将 JSON 格式转换为 Markdown
        const normalizedContent = normalizeContentToMarkdown(payload.content);

        // 1. 检查重复（如果未跳过）
        if (!payload.skipDuplicateCheck) {
          const duplicateRes = await fetch(
            "/api/md-collections/check-duplicate",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // 使用原始内容检测重复（避免格式转换影响）
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
        // 使用规范化后的内容生成标题和保存
        setState("generating");
        let title = payload.customTitle;

        if (!title) {
          const titleRes = await fetch("/api/ai/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: normalizedContent.slice(0, 2000) }),
          });

          if (!titleRes.ok) {
            // 标题生成失败，使用回退方案
            title = extractFallbackTitle(normalizedContent);
          } else {
            const titleData = await titleRes.json();
            title = titleData.title || extractFallbackTitle(normalizedContent);
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
            rawContent: normalizedContent, // 使用规范化后的内容
            title: formattedTitle,
            sourceType: payload.sourceType,
            // source_metadata 通过单独字段传递
          }),
        });

        if (!saveRes.ok) {
          const errorData = await saveRes.json().catch(() => ({}));
          // 支持多种错误格式：
          // 1. { error: { message: string } } - 标准格式
          // 2. { error: string } - 简单格式
          // 3. { message: string } - 备用格式
          const errorMessage =
            (typeof errorData.error === "object"
              ? errorData.error?.message
              : errorData.error) ||
            errorData.message ||
            "保存失败";
          throw new Error(errorMessage);
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
    [normalizeContentToMarkdown],
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
