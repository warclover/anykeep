/**
 * 综述详情 - 精简功能 Hook
 */

"use client";

import { useState, useCallback } from "react";
import { API_KNOWLEDGE_STUDIO } from "@/lib/constants/api-paths";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import {
  CONDENSE_PRESETS,
  type CondensePreset,
} from "@/lib/knowledge-studio/refinement";

interface UseSynthesisCondenseOptions {
  content: string;
  wordCount: number;
  onReportUpdate: (newContent: string) => Promise<void>;
}

export function useSynthesisCondense({
  content,
  wordCount,
  onReportUpdate,
}: UseSynthesisCondenseOptions) {
  const [condenseDialogOpen, setCondenseDialogOpen] = useState(false);
  const [isCondensing, setIsCondensing] = useState(false);
  const [condenseProgress, setCondenseProgress] = useState(0);
  const [condensedPreview, setCondensedPreview] = useState<string>("");

  const handleCondense = useCallback(
    async (preset: CondensePreset) => {
      const targetWords = CONDENSE_PRESETS[preset].targetWords;

      if (!content) {
        toast.error("暂无可精简的内容");
        return;
      }

      if (wordCount <= targetWords * 1.1) {
        toast.info("当前内容已低于目标字数，无需精简");
        return;
      }

      setIsCondensing(true);
      setCondenseProgress(0);
      setCondensedPreview("");

      try {
        const res = await fetch(API_KNOWLEDGE_STUDIO.v2Condense, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            targetWords,
            preset,
            contentType: "article",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error?.message || `请求失败: ${res.status}`;
          toast.error(`精简失败: ${msg}`);
          setIsCondensing(false);
          return;
        }

        if (res.headers.get("content-type")?.includes("application/json")) {
          const data = await res.json();
          if (data.condensedContent != null) {
            onReportUpdate(data.condensedContent);
            setCondenseDialogOpen(false);
            toast.success("内容已在目标字数范围内，无需精简");
          }
          setIsCondensing(false);
          return;
        }

        let accumulated = "";
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          toast.error("精简失败: 无法读取响应");
          setIsCondensing(false);
          return;
        }

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as {
                type: string;
                text?: string;
                percent?: number;
                originalWords?: number;
                finalWords?: number;
                compressionRatio?: number;
                message?: string;
              };
              if (payload.type === "content" && payload.text != null) {
                accumulated += payload.text;
                setCondensedPreview(accumulated);
              } else if (
                payload.type === "progress" &&
                payload.percent != null
              ) {
                setCondenseProgress(payload.percent);
              } else if (payload.type === "done") {
                setIsCondensing(false);
                onReportUpdate(accumulated);
                setCondenseDialogOpen(false);
                const ratio = payload.compressionRatio ?? 0;
                toast.success(
                  `已精简至 ${(payload.finalWords ?? 0).toLocaleString()} 字（压缩 ${Math.round((1 - ratio) * 100)}%）`,
                );
                return;
              } else if (payload.type === "error") {
                setIsCondensing(false);
                toast.error(`精简失败: ${payload.message ?? "未知错误"}`);
                return;
              }
            } catch {
              // 忽略非 JSON 行
            }
          }
        }
        setIsCondensing(false);
      } catch (err) {
        clientLogger.error({ err }, "Condense API request failed");
        setIsCondensing(false);
        toast.error(
          `精简失败: ${err instanceof Error ? err.message : "网络错误"}`,
        );
      }
    },
    [content, wordCount, onReportUpdate],
  );

  return {
    condenseDialogOpen,
    setCondenseDialogOpen,
    isCondensing,
    condenseProgress,
    condensedPreview,
    handleCondense,
  };
}
