"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  createSseJsonLineParser,
  WAITING_MESSAGE_KEYS,
  type WorkflowStep,
  type GenerationProgress,
  type Ks2TextFn,
} from "../utils";
import {
  SSE_REQUEST_TIMEOUT_MS,
  SSE_PARSE_ERROR_THRESHOLD,
  type PlatformStyle,
} from "@/lib/knowledge-studio/v2/constants";
import type {
  BriefingContext,
  BlueprintOutline,
  MaterialInput,
} from "@/lib/knowledge-studio/blueprint/types";
import type { UsageRecordParams } from "@/hooks/knowledge-studio/use-usage-tracking";

interface UseGenerationFlowParams {
  selectedBlueprintId: string | undefined;
  selectedMaterials: MaterialInput[];
  additionalRequirements: string;
  platformStyle: PlatformStyle;
  playSuccess: () => void;
  playError: () => void;
  recordUsage: (
    params: UsageRecordParams,
    options?: { await?: boolean },
  ) => Promise<void> | void;
  k: Ks2TextFn;
}

export function useGenerationFlow({
  selectedBlueprintId,
  selectedMaterials,
  additionalRequirements,
  platformStyle,
  playSuccess,
  playError,
  recordUsage,
  k,
}: UseGenerationFlowParams) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("blueprint");
  const [progress, setProgress] = useState<GenerationProgress>({
    step: "",
    percent: 0,
  });
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null,
  );
  const [waitingMessageIndex, setWaitingMessageIndex] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationAbortReasonRef = useRef<"user_cancel" | "timeout" | null>(
    null,
  );
  const generationUsageRecordedRef = useRef(false);

  const [generatedContent, setGeneratedContent] = useState("");
  const [structuredOutput, setStructuredOutput] = useState<unknown>(null);
  const [reportId, setReportId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const [outline, setOutline] = useState<BlueprintOutline | undefined>();
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [showOutlineEditor, setShowOutlineEditor] = useState(false);

  const isGenerating = useMemo(
    () => currentStep === "generating" && progress.percent < 100,
    [currentStep, progress.percent],
  );

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setWaitingMessageIndex((i) => (i + 1) % WAITING_MESSAGE_KEYS.length);
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setWaitingMessageIndex(0);
    }
  }, [isGenerating]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const startGeneration = useCallback(
    async (outlineData?: BlueprintOutline) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      generationAbortReasonRef.current = null;
      generationUsageRecordedRef.current = false;

      if (!selectedBlueprintId || selectedMaterials.length < 2) {
        toast.error(k("generateValidate"));
        return;
      }

      setGenerationStartTime(Date.now());
      setProgress({
        step: "preparing",
        percent: 0,
        message: k("prepareGenerate"),
        generatedWords: 0,
      });
      setGeneratedContent("");
      setStructuredOutput(null);
      setError(null);

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        abortControllerRef.current = new AbortController();

        timeoutId = setTimeout(() => {
          generationAbortReasonRef.current = "timeout";
          abortControllerRef.current?.abort();
        }, SSE_REQUEST_TIMEOUT_MS);

        const briefingContext: BriefingContext = {
          answers: additionalRequirements
            ? { 补充说明: additionalRequirements }
            : {},
          answeredAt: new Date(),
        };

        const response = await fetch("/api/knowledge-studio/v2/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintId: selectedBlueprintId,
            materials: selectedMaterials,
            briefingContext,
            outline: outlineData,
            targetLength: "medium",
            platformStyle,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message ||
              k("generateDataError", { status: response.status }),
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let contentBuffer = "";
        let sseParseErrorCount = 0;
        let generationCompleted = false;
        const parser = createSseJsonLineParser(
          (data) => {
            switch (data?.type) {
              case "progress":
                setProgress({
                  step: data.data?.step || "",
                  percent: data.data?.percent || 0,
                  message: data.data?.message,
                });
                break;
              case "content":
                contentBuffer += data.data?.text || "";
                setGeneratedContent(contentBuffer);
                setProgress((prev) => ({
                  ...prev,
                  generatedWords: contentBuffer.length,
                }));
                break;
              case "structured_output":
                setStructuredOutput(data.data?.structuredOutput);
                break;
              case "done": {
                const reportIdFromDone = data.data?.reportId;
                const totalContentLength =
                  (data.data?.totalContentLength as number | undefined) ??
                  contentBuffer.length;
                setReportId(reportIdFromDone);
                setCurrentStep("result");
                generationCompleted = true;

                if (!generationUsageRecordedRef.current) {
                  generationUsageRecordedRef.current = true;
                  recordUsage({
                    blueprintId: selectedBlueprintId,
                    success: true,
                    platformStyle,
                    lengthMode: "medium",
                  });
                }

                playSuccess();
                toast.success(k("generateDone"), {
                  description: k("generateDoneDesc", {
                    count: totalContentLength.toLocaleString(),
                  }),
                  duration: 5000,
                });
                if (
                  reportIdFromDone &&
                  totalContentLength > 0 &&
                  contentBuffer.length === 0
                ) {
                  fetch(`/api/knowledge-studio/reports/${reportIdFromDone}`)
                    .then((res) => (res.ok ? res.json() : null))
                    .then((json: { data?: { content?: string } } | null) => {
                      if (json?.data?.content)
                        setGeneratedContent(json.data.content);
                    })
                    .catch(() => {});
                }
                break;
              }
              case "error":
                throw new Error(
                  data.data?.error?.message || k("generateContentError"),
                );
            }
          },
          () => {
            sseParseErrorCount++;
            if (sseParseErrorCount >= SSE_PARSE_ERROR_THRESHOLD) {
              throw new Error(k("generateDataParseError"));
            }
          },
        );

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
          if (generationCompleted) {
            await reader.cancel();
            break;
          }
        }
        parser.flush();

        if (!generationCompleted) {
          throw new Error(k("generateIncomplete"));
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            if (generationAbortReasonRef.current === "user_cancel") {
              return;
            }

            if (!generationUsageRecordedRef.current) {
              generationUsageRecordedRef.current = true;
              recordUsage({
                blueprintId: selectedBlueprintId,
                success: false,
                platformStyle,
                lengthMode: "medium",
              });
            }

            playError();

            setError(k("generateTimeoutError"));
            toast.error(k("generateTimeout"), {
              description: k("generateTimeoutDesc"),
              duration: 5000,
            });
          } else {
            if (!generationUsageRecordedRef.current) {
              generationUsageRecordedRef.current = true;
              recordUsage({
                blueprintId: selectedBlueprintId,
                success: false,
                platformStyle,
                lengthMode: "medium",
              });
            }

            playError();

            setError(err.message);
            toast.error(k("generateFailed"), {
              description: err.message || k("generateRetryDesc"),
              duration: 5000,
            });
          }
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        generationAbortReasonRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [
      selectedBlueprintId,
      selectedMaterials,
      additionalRequirements,
      platformStyle,
      playSuccess,
      playError,
      recordUsage,
      k,
    ],
  );

  const handleGenerate = useCallback(() => {
    if (!selectedBlueprintId || selectedMaterials.length < 2) {
      toast.error(k("generateValidateStep"));
      return;
    }
    setCurrentStep("generating");
    startGeneration(outline);
  }, [
    selectedBlueprintId,
    selectedMaterials.length,
    outline,
    startGeneration,
    k,
  ]);

  const handleCancelGeneration = useCallback(() => {
    generationAbortReasonRef.current = "user_cancel";
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentStep("materials");
    setProgress({ step: "", percent: 0 });
    setGeneratedContent("");
    setGenerationStartTime(null);
  }, []);

  const handleGenerateOutline = useCallback(async () => {
    if (!selectedBlueprintId || selectedMaterials.length < 2) {
      toast.error(k("outlineValidate"));
      return;
    }

    setIsGeneratingOutline(true);
    try {
      const briefingContext: BriefingContext = {
        answers: additionalRequirements
          ? { 补充说明: additionalRequirements }
          : {},
        answeredAt: new Date(),
      };

      const response = await fetch("/api/knowledge-studio/v2/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: selectedBlueprintId,
          materials: selectedMaterials,
          briefingContext,
          targetLength: "medium",
        }),
      });

      if (!response.ok) {
        throw new Error(k("outlineFailed"));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let parseErrors = 0;
      let outlineValue: BlueprintOutline | undefined;
      let received = false;

      const parser = createSseJsonLineParser(
        (data) => {
          if (data?.type === "outline" && data?.data?.outline) {
            outlineValue = data.data.outline as BlueprintOutline;
            received = true;
          } else if (data?.type === "error") {
            throw new Error(
              data?.data?.error?.message || k("outlineStreamError"),
            );
          }
        },
        () => {
          parseErrors++;
          if (parseErrors >= SSE_PARSE_ERROR_THRESHOLD) {
            throw new Error(k("generateDataParseError"));
          }
        },
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
        if (received) {
          await reader.cancel();
          break;
        }
      }
      parser.flush();

      if (outlineValue) {
        setOutline(outlineValue);
        setShowOutlineEditor(true);
        toast.success(k("outlineDone"));
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message || k("outlineError"));
      }
    } finally {
      setIsGeneratingOutline(false);
    }
  }, [selectedBlueprintId, selectedMaterials, additionalRequirements, k]);

  return {
    currentStep,
    setCurrentStep,
    progress,
    generationStartTime,
    waitingMessageIndex,
    generatedContent,
    setGeneratedContent,
    structuredOutput,
    setStructuredOutput,
    reportId,
    setReportId,
    error,
    setError,
    isGenerating,
    handleGenerate,
    handleCancelGeneration,
    handleGenerateOutline,
    isGeneratingOutline,
    outline,
    setOutline,
    showOutlineEditor,
    setShowOutlineEditor,
  };
}
