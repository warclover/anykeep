"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { PlatformStyle } from "@/lib/knowledge-studio/v2/constants";
import type { BlueprintOutline } from "@/lib/knowledge-studio/blueprint/types";
import type { DraftFeedback } from "@/lib/knowledge-studio/iteration";
import type { Ks2TextFn } from "../utils";

interface UseIterationFlowParams {
  generatedContent: string;
  selectedBlueprintId: string | undefined;
  platformStyle: PlatformStyle;
  outline: BlueprintOutline | undefined;
  setGeneratedContent: (content: string) => void;
  setCondensedContent: (content: string) => void;
  k: Ks2TextFn;
}

export function useIterationFlow({
  generatedContent,
  selectedBlueprintId,
  platformStyle,
  outline,
  setGeneratedContent,
  setCondensedContent,
  k,
}: UseIterationFlowParams) {
  const [isIterating, setIsIterating] = useState(false);
  const [iterationProgress, setIterationProgress] = useState(0);
  const iterateAbortRef = useRef<AbortController | null>(null);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isMultiPlatformDialogOpen, setIsMultiPlatformDialogOpen] =
    useState(false);
  const [exportContent, setExportContent] = useState("");

  useEffect(() => {
    return () => {
      if (iterateAbortRef.current) iterateAbortRef.current.abort();
    };
  }, []);

  const handleFeedbackSubmit = useCallback(
    async (feedback: DraftFeedback) => {
      if (!generatedContent || !selectedBlueprintId) return;

      if (iterateAbortRef.current) iterateAbortRef.current.abort();

      setIsIterating(true);
      setIterationProgress(0);
      setIsFeedbackDialogOpen(false);

      try {
        iterateAbortRef.current = new AbortController();

        const response = await fetch("/api/knowledge-studio/v2/iterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalContent: generatedContent,
            feedback,
            blueprintId: selectedBlueprintId,
            platformStyle,
            outlineJson: outline ? JSON.stringify(outline) : undefined,
          }),
          signal: iterateAbortRef.current.signal,
        });

        if (!response.ok) throw new Error(k("iterateFailed"));

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let iteratedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                switch (data.type) {
                  case "progress":
                    setIterationProgress(data.data?.percent || 0);
                    break;
                  case "content":
                    iteratedContent += data.data?.text || "";
                    break;
                  case "done":
                    setIterationProgress(100);
                    setGeneratedContent(iteratedContent);
                    setCondensedContent("");
                    toast.success(k("iterateDone"));
                    await reader.cancel();
                    break;
                  case "error":
                    await reader.cancel();
                    throw new Error(
                      data.data?.message || k("iterateStreamError"),
                    );
                }
              } catch {
                // Skip
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error(err.message || k("optimizeFailed"));
        }
      } finally {
        setIsIterating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatedContent, selectedBlueprintId, platformStyle, outline],
  );

  return {
    isIterating,
    iterationProgress,
    isFeedbackDialogOpen,
    setIsFeedbackDialogOpen,
    isExportDialogOpen,
    setIsExportDialogOpen,
    isMultiPlatformDialogOpen,
    setIsMultiPlatformDialogOpen,
    exportContent,
    setExportContent,
    handleFeedbackSubmit,
  };
}
