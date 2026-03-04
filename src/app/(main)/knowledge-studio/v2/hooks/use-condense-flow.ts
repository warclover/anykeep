"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Ks2TextFn } from "../utils";

interface UseCondenseFlowParams {
  reportId: string | undefined;
  generatedContent: string;
  selectedBlueprintId: string | undefined;
  selectedBlueprintDisplayName: string | undefined;
  router: { push: (url: string) => void };
  k: Ks2TextFn;
}

export function useCondenseFlow({
  reportId,
  generatedContent,
  selectedBlueprintId,
  selectedBlueprintDisplayName,
  router,
  k,
}: UseCondenseFlowParams) {
  const [isCondensing, setIsCondensing] = useState(false);
  const [condensedContent, setCondensedContent] = useState("");
  const [condenseProgress, setCondenseProgress] = useState(0);
  const condenseAbortRef = useRef<AbortController | null>(null);
  const [isSavingCondensed, setIsSavingCondensed] = useState(false);

  useEffect(() => {
    return () => {
      if (condenseAbortRef.current) condenseAbortRef.current.abort();
    };
  }, []);

  const handleCondense = useCallback(
    async (targetWords: number = 1500) => {
      const contentToCondense = condensedContent || generatedContent;
      if (!contentToCondense) return;

      setIsCondensing(true);
      setCondenseProgress(0);
      setCondensedContent("");

      try {
        condenseAbortRef.current = new AbortController();

        const response = await fetch("/api/knowledge-studio/v2/condense", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: contentToCondense,
            targetWords,
            contentType: "article",
          }),
          signal: condenseAbortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(k("condenseFailed"));
        }

        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          if (data.condensedContent) {
            setCondensedContent(data.condensedContent);
            setCondenseProgress(100);
          }
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let contentBuffer = "";

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
                    setCondenseProgress(data.percent || 0);
                    break;
                  case "content":
                    contentBuffer += data.text || "";
                    setCondensedContent(contentBuffer);
                    break;
                  case "done":
                    setCondenseProgress(100);
                    await reader.cancel();
                    break;
                  case "error":
                    await reader.cancel();
                    throw new Error(data.message || k("condenseFailed"));
                }
              } catch {
                // Skip parse errors
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error(err.message || k("condenseFailed"));
        }
      } finally {
        setIsCondensing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatedContent, condensedContent],
  );

  const handleCopyCondensed = useCallback(async () => {
    if (!condensedContent) return;
    try {
      await navigator.clipboard.writeText(condensedContent);
      toast.success(k("condensedCopied"));
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = condensedContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success(k("condensedCopied"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condensedContent]);

  const handleSaveCondensed = useCallback(async () => {
    if (!condensedContent || !reportId) return;

    setIsSavingCondensed(true);
    try {
      const response = await fetch("/api/knowledge-studio/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintType: selectedBlueprintId,
          title: `${selectedBlueprintDisplayName || k("generatedContentTitle")}${k("condenseSuffix")}`,
          content: condensedContent,
          sourceType: "condensed",
          generationMetadata: {
            blueprint_version: "v2",
            blueprint_id: selectedBlueprintId,
            source_report_id: reportId,
            condensed_at: new Date().toISOString(),
            original_words: generatedContent?.length || 0,
            condensed_words: condensedContent.length,
          },
        }),
      });

      if (!response.ok) throw new Error(k("saveFailed"));

      const data = await response.json();
      toast.success(k("condenseSaved"), {
        description: k("condenseSavedDesc"),
        action: {
          label: k("condenseSavedView"),
          onClick: () => router.push(`/synthesis/${data.id}`),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : k("saveFailed"));
    } finally {
      setIsSavingCondensed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    condensedContent,
    reportId,
    selectedBlueprintId,
    selectedBlueprintDisplayName,
    generatedContent?.length,
    router,
  ]);

  return {
    isCondensing,
    condensedContent,
    setCondensedContent,
    condenseProgress,
    isSavingCondensed,
    handleCondense,
    handleCopyCondensed,
    handleSaveCondensed,
  };
}
