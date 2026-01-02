"use client";

/**
 * Knowledge Studio - Brain-Sync 整合 Hook
 * @module hooks/domain/knowledge-studio
 * @description 连接 KS 合成报告与 Brain-Sync 复习系统
 */

import { useState, useCallback } from "react";
import type { SynthesisReport } from "@/lib/knowledge-studio";
import type { FlashcardInsert, GeneratedFlashcardV2 } from "@/types/brain-sync";

// ============================================================================
// 类型定义
// ============================================================================

export type BrainSyncStatus =
  | "idle"
  | "generating"
  | "creating"
  | "completed"
  | "error";

export interface GenerateFlashcardsRequest {
  /** 报告 ID */
  reportId: string;
  /** 报告内容 */
  content: string;
  /** 引用的书签 ID 列表 */
  bookmarkIds: string[];
  /** 每段最大 Flashcard 数 */
  maxPerParagraph?: number;
}

export interface GenerateFlashcardsResult {
  /** 是否成功 */
  success: boolean;
  /** 生成的 Flashcard 数量 */
  count: number;
  /** Flashcard ID 列表 */
  flashcardIds?: number[];
  /** 错误信息 */
  error?: string;
}

export interface UseBrainSyncIntegrationOptions {
  /** 生成完成回调 */
  onComplete?: (result: GenerateFlashcardsResult) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

export interface UseBrainSyncIntegrationReturn {
  /** 当前状态 */
  status: BrainSyncStatus;
  /** 生成的 Flashcard 预览 */
  flashcardPreviews: GeneratedFlashcardV2[];
  /** 生成结果 */
  result: GenerateFlashcardsResult | null;
  /** 错误信息 */
  error: string | null;
  /** 从报告生成 Flashcard */
  generateFromReport: (report: SynthesisReport) => Promise<void>;
  /** 确认创建 Flashcard */
  confirmCreate: (selectedIndices?: number[]) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useBrainSyncIntegration(
  options: UseBrainSyncIntegrationOptions = {},
): UseBrainSyncIntegrationReturn {
  const { onComplete, onError } = options;

  // 状态管理
  const [status, setStatus] = useState<BrainSyncStatus>("idle");
  const [flashcardPreviews, setFlashcardPreviews] = useState<
    GeneratedFlashcardV2[]
  >([]);
  const [result, setResult] = useState<GenerateFlashcardsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 当前请求数据
  const [currentRequest, setCurrentRequest] =
    useState<GenerateFlashcardsRequest | null>(null);

  // 重置状态
  const reset = useCallback(() => {
    setStatus("idle");
    setFlashcardPreviews([]);
    setResult(null);
    setError(null);
    setCurrentRequest(null);
  }, []);

  // 从报告生成 Flashcard 预览
  const generateFromReport = useCallback(
    async (report: SynthesisReport) => {
      reset();
      setStatus("generating");

      try {
        const response = await fetch("/api/brain-sync/generate-from-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: report.id,
            content: report.content,
            bookmarkIds: report.citations.map((c) => c.bookmarkId),
            maxPerParagraph: 3,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "生成失败");
        }

        const data = await response.json();

        if (data.success && data.flashcards) {
          setFlashcardPreviews(data.flashcards);
          setCurrentRequest({
            reportId: report.id,
            content: report.content,
            bookmarkIds: report.citations.map((c) => c.bookmarkId),
          });
          setStatus("idle");
        } else {
          throw new Error(data.error?.message || "未生成任何 Flashcard");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "生成失败";
        setError(errorMessage);
        setStatus("error");
        onError?.(errorMessage);
      }
    },
    [reset, onError],
  );

  // 确认创建选中的 Flashcard
  const confirmCreate = useCallback(
    async (selectedIndices?: number[]) => {
      if (!currentRequest || flashcardPreviews.length === 0) {
        setError("没有可创建的 Flashcard");
        return;
      }

      setStatus("creating");

      try {
        // 过滤选中的 Flashcard
        const cardsToCreate =
          selectedIndices !== undefined
            ? flashcardPreviews.filter((_, i) => selectedIndices.includes(i))
            : flashcardPreviews;

        if (cardsToCreate.length === 0) {
          throw new Error("请至少选择一个 Flashcard");
        }

        // 转换为 FlashcardInsert 格式
        const flashcards: FlashcardInsert[] = cardsToCreate.map((card) => ({
          user_id: "", // 由 API 填充
          bookmark_id: parseInt(currentRequest.bookmarkIds[0] || "0", 10),
          question: card.question,
          answer: card.keyPoints.join("\n"),
          source_paragraph: card.sourceParagraph,
          question_depth: card.questionDepth,
          thinking_hint: card.thinkingHint,
          key_points: card.keyPoints,
        }));

        const response = await fetch("/api/brain-sync/flashcards/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flashcards }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "创建失败");
        }

        const data = await response.json();

        const createResult: GenerateFlashcardsResult = {
          success: true,
          count: data.insertedCount || cardsToCreate.length,
          flashcardIds: data.flashcardIds,
        };

        setResult(createResult);
        setStatus("completed");
        onComplete?.(createResult);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "创建失败";
        setError(errorMessage);
        setStatus("error");
        onError?.(errorMessage);
      }
    },
    [currentRequest, flashcardPreviews, onComplete, onError],
  );

  return {
    status,
    flashcardPreviews,
    result,
    error,
    generateFromReport,
    confirmCreate,
    reset,
  };
}
