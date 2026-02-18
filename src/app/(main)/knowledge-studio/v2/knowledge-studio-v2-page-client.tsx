/**
 * Knowledge Studio v2 - 主页面客户端组件（简化版单页流程）
 * @module knowledge-studio/v2
 *
 * 版本 v2.0.0 (2026-02-17):
 * - 合并双页为单页：消除跨页面跳转
 * - Smart Default：AI 自动推荐蓝图和素材
 * - 渐进披露：核心操作一目了然，高级功能按需展开
 * - 3 次点击生成：选蓝图 → 确认素材 → 生成
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  FileText,
  Clock,
  Scissors,
  MessageSquare,
  Download,
  Volume2,
  Pause,
  Share2,
  Copy,
  BookmarkPlus,
  ChevronDown,
  AlertCircle,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BlueprintSelectorV2,
  MaterialRecommendations,
  OutlineEditorV2,
  StructuredOutputViewer,
  PlatformStyleSelector,
  FeedbackDialog,
  ExportResultDialog,
  MultiPlatformDialog,
  CondenseSlider,
  ScenarioQuickEntry,
  type OutputType,
} from "@/components/knowledge-studio/v2";
import { MaterialSelector } from "@/components/knowledge-studio/material-selector";
import { useBookmarks } from "@/hooks/queries/use-bookmarks";
import { useBlueprints } from "@/hooks/queries/use-blueprints";
import { useSoundEffect } from "@/hooks/use-sound-effect";
import { useUsageTracking, useKSTTSPlayer } from "@/hooks/knowledge-studio";
import {
  MATERIAL_LIMITS,
  SSE_REQUEST_TIMEOUT_MS,
  SSE_PARSE_ERROR_THRESHOLD,
  type PlatformStyle,
} from "@/lib/knowledge-studio/v2/constants";
import type {
  BriefingContext,
  BlueprintOutline,
  MaterialInput,
} from "@/lib/knowledge-studio/blueprint/types";
import type { DraftFeedback } from "@/lib/knowledge-studio/iteration";

// ============================================================
// Types
// ============================================================

type WorkflowStep =
  | "blueprint"
  | "materials"
  | "outline"
  | "generating"
  | "result";

interface GenerationProgress {
  step: string;
  percent: number;
  message?: string;
  generatedWords?: number;
}

// ============================================================
// Constants
// ============================================================

const WAITING_MESSAGES = [
  "正在分析素材内容...",
  "正在构建文章结构...",
  "正在生成精彩内容...",
  "AI 正在思考最佳表达...",
  "即将完成，请稍候...",
] as const;

// ============================================================
// Utility Functions
// ============================================================

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function ElapsedTimeDisplay({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span>已用时 {formatElapsedTime(elapsed)}</span>;
}

type SseJsonValue = unknown;

function createSseJsonLineParser(
  onJson: (value: SseJsonValue) => void,
  onParseError?: () => void,
) {
  let buffer = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("data:")) return;

    const payload = trimmed.slice("data:".length).trimStart();
    if (!payload || payload === "[DONE]") return;

    try {
      onJson(JSON.parse(payload));
    } catch {
      onParseError?.();
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    },
    flush() {
      if (buffer) processLine(buffer);
      buffer = "";
    },
  };
}

// ============================================================
// Main Component
// ============================================================

export function KnowledgeStudioV2PageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    blueprints,
    userTier,
    isLoading: isLoadingBlueprints,
    error: blueprintError,
  } = useBlueprints();
  const { playSuccess, playError } = useSoundEffect();
  const { recordUsage } = useUsageTracking();
  const {
    isLoading: isTTSLoading,
    isPlaying,
    play: playTTS,
    pause: pauseTTS,
  } = useKSTTSPlayer();
  const prefersReducedMotion = useReducedMotion();

  // 步骤状态
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("blueprint");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<
    string | undefined
  >(() => {
    // 支持从 URL query 参数预选蓝图
    if (typeof window !== "undefined") {
      const blueprintParam = searchParams?.get("blueprint");
      if (blueprintParam) {
        return blueprintParam;
      }
    }
    return undefined;
  });
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  /** 从「AI 推荐」添加的素材（ID -> 完整素材），用于与 bookmarks 合并计数与生成 */
  const [materialsFromRecommendations, setMaterialsFromRecommendations] =
    useState<Record<string, MaterialInput>>({});

  // P0-1: 蓝图选择器展开/折叠状态
  const [isBlueprintExpanded, setIsBlueprintExpanded] = useState(true);

  // 素材加载
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(materialSearchQuery, 300);
  // P2-6: 手动选择素材展开/折叠
  const [isManualSelectExpanded, setIsManualSelectExpanded] = useState(false);

  const {
    data: bookmarksData,
    isLoading: isLoadingBookmarks,
    isFetching: isFetchingBookmarks,
  } = useBookmarks({
    limit: debouncedSearchQuery ? 50 : 20,
    platform: platformFilter || undefined,
    search: debouncedSearchQuery || undefined,
  });

  const isSearching =
    materialSearchQuery !== debouncedSearchQuery || isFetchingBookmarks;
  const bookmarks = useMemo(
    () => bookmarksData?.items || [],
    [bookmarksData?.items],
  );

  // 转换为素材格式
  const allMaterialsForSelector = useMemo(
    () =>
      bookmarks.map((b) => ({
        id: String(b.id),
        title: b.title || "无标题",
        url: b.url,
        platform: b.platform || undefined,
        summary: b.aiSummary || undefined,
        createdAt: new Date(b.createdAt),
      })),
    [bookmarks],
  );

  const selectedMaterials = useMemo<MaterialInput[]>(() => {
    const fromBookmarks = bookmarks
      .filter((b) => selectedMaterialIds.includes(String(b.id)))
      .map((b) => ({
        bookmarkId: String(b.id),
        title: b.title || "无标题",
        content: b.aiSummary || b.description || "",
        url: b.url,
        platform: b.platform || undefined,
      }));
    const fromRecommendations = selectedMaterialIds
      .filter((id) => !fromBookmarks.some((m) => m.bookmarkId === id))
      .map((id) => materialsFromRecommendations[id])
      .filter(Boolean) as MaterialInput[];
    return [...fromBookmarks, ...fromRecommendations];
  }, [bookmarks, selectedMaterialIds, materialsFromRecommendations]);

  const selectedBlueprint = blueprints.find(
    (bp) => bp.blueprintId === selectedBlueprintId,
  );

  // 补充说明
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [isRequirementsExpanded, setIsRequirementsExpanded] = useState(false);

  // 高级选项
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [platformStyle, setPlatformStyle] = useState<PlatformStyle>("general");
  const [outline, setOutline] = useState<BlueprintOutline | undefined>();
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [showOutlineEditor, setShowOutlineEditor] = useState(false);

  // 生成进度
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

  // 生成结果
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [structuredOutput, setStructuredOutput] = useState<unknown>(null);
  const [reportId, setReportId] = useState<string | undefined>();

  // 精简功能
  const [isCondensing, setIsCondensing] = useState(false);
  const [condensedContent, setCondensedContent] = useState<string>("");
  const [condenseProgress, setCondenseProgress] = useState(0);
  const condenseAbortRef = useRef<AbortController | null>(null);
  const [isSavingCondensed, setIsSavingCondensed] = useState(false);

  // 反馈优化
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [iterationProgress, setIterationProgress] = useState(0);
  const iterateAbortRef = useRef<AbortController | null>(null);

  // 对话框
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isMultiPlatformDialogOpen, setIsMultiPlatformDialogOpen] =
    useState(false);

  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // Effects
  // ============================================================

  const isGenerating = useMemo(
    () => currentStep === "generating" && progress.percent < 100,
    [currentStep, progress.percent],
  );

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setWaitingMessageIndex((i) => (i + 1) % WAITING_MESSAGES.length);
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setWaitingMessageIndex(0);
    }
  }, [isGenerating]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (condenseAbortRef.current) condenseAbortRef.current.abort();
      if (iterateAbortRef.current) iterateAbortRef.current.abort();
    };
  }, []);

  // ============================================================
  // Event Handlers
  // ============================================================

  const handleBlueprintSelect = useCallback((blueprintId: string) => {
    setSelectedBlueprintId(blueprintId);
    setError(null);
  }, []);

  const handleMaterialsChange = useCallback((selectedIds: string[]) => {
    setSelectedMaterialIds(selectedIds);
  }, []);

  const handleAddMaterial = useCallback(
    (materialId: string, material?: MaterialInput) => {
      if (
        !selectedMaterialIds.includes(materialId) &&
        selectedMaterialIds.length < MATERIAL_LIMITS.HARD_MAX
      ) {
        setSelectedMaterialIds((prev) => [...prev, materialId]);
        if (material) {
          setMaterialsFromRecommendations((prev) => ({
            ...prev,
            [materialId]: material,
          }));
        }
      }
    },
    [selectedMaterialIds],
  );

  // 开始生成（定义在 handleGenerate 之前，避免 TDZ）
  const startGeneration = useCallback(
    async (outlineData?: BlueprintOutline) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      generationAbortReasonRef.current = null;
      generationUsageRecordedRef.current = false;

      if (!selectedBlueprintId || selectedMaterials.length < 2) {
        toast.error("请先选择蓝图和至少 2 个素材");
        return;
      }

      setGenerationStartTime(Date.now());
      setProgress({
        step: "preparing",
        percent: 0,
        message: "准备生成...",
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

        // v2 简化页不做 Briefing 问答流程，但部分蓝图启用了 Briefing：
        // 若 briefingContext 缺失会提前 return（等待问答）导致不调用模型产出内容。
        // 因此这里始终注入一个合法的 briefingContext（为空也可），并用 Record 结构承载补充说明。
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
            errorData.error?.message || `内容生成失败 (${response.status})`,
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
                toast.success("生成完成！🎉", {
                  description: `共 ${totalContentLength.toLocaleString()} 字`,
                  duration: 5000,
                });
                // 若服务端有内容但流式未下发，按 reportId 拉取报告内容填充
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
                throw new Error(data.data?.error?.message || "内容生成错误");
            }
          },
          () => {
            sseParseErrorCount++;
            if (sseParseErrorCount >= SSE_PARSE_ERROR_THRESHOLD) {
              throw new Error("数据流解析错误过多，请重试");
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
          throw new Error("内容生成未完成，请重试");
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            if (generationAbortReasonRef.current === "user_cancel") {
              // 用户主动取消：不报错、不提示超时、不重复记录 usage
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

            setError("请求超时，请检查网络连接后重试");
            toast.error("生成超时", {
              description: "请检查网络连接后重试",
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
            toast.error("生成失败", {
              description: err.message || "请稍后重试",
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
    ],
  );

  const handleGenerate = useCallback(() => {
    if (!selectedBlueprintId || selectedMaterials.length < 2) {
      toast.error("请选择蓝图和至少 2 个素材");
      return;
    }
    setCurrentStep("generating");
    // 启动生成，传入大纲（如果有）
    startGeneration(outline);
  }, [selectedBlueprintId, selectedMaterials.length, outline, startGeneration]);

  const handleUpgrade = useCallback(() => {
    router.push("/pricing");
  }, [router]);

  /**
   * P1-3: 生成大纲
   */
  const handleGenerateOutline = useCallback(async () => {
    if (!selectedBlueprintId || selectedMaterials.length < 2) {
      toast.error("请先选择蓝图和素材");
      return;
    }

    setIsGeneratingOutline(true);
    try {
      // 同上：大纲生成也需要绕过 Briefing 的“等待问答”分支
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
        throw new Error("大纲生成失败");
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
            throw new Error(data?.data?.error?.message || "大纲生成错误");
          }
        },
        () => {
          parseErrors++;
          if (parseErrors >= SSE_PARSE_ERROR_THRESHOLD) {
            throw new Error("数据流解析错误过多，请重试");
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
        toast.success("大纲生成完成");
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message || "大纲生成失败");
      }
    } finally {
      setIsGeneratingOutline(false);
    }
  }, [selectedBlueprintId, selectedMaterials, additionalRequirements]);

  const handleCancelGeneration = useCallback(() => {
    generationAbortReasonRef.current = "user_cancel";
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentStep("materials");
    setProgress({ step: "", percent: 0 });
    setGeneratedContent("");
    setGenerationStartTime(null);
    // 用户取消不计入失败 usage（避免与超时/真实失败混淆），也避免重复记录
  }, []);

  // 精简内容（简化版，完整逻辑保持原样）
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
          throw new Error("精简失败");
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

        // 处理流式响应
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
                    throw new Error(data.message || "精简失败");
                }
              } catch {
                // Skip parse errors
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error(err.message || "精简失败");
        }
      } finally {
        setIsCondensing(false);
      }
    },
    [generatedContent, condensedContent],
  );

  const handleCopyCondensed = useCallback(async () => {
    if (!condensedContent) return;
    try {
      await navigator.clipboard.writeText(condensedContent);
      toast.success("已复制到剪贴板");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = condensedContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("已复制到剪贴板");
    }
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
          title: `${selectedBlueprint?.displayName || "内容"} (精简版)`,
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

      if (!response.ok) throw new Error("保存失败");

      const data = await response.json();
      toast.success("已保存精简版本", {
        description: "可在「我的创作」中查看",
        action: {
          label: "查看",
          onClick: () => router.push(`/synthesis/${data.id}`),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSavingCondensed(false);
    }
  }, [
    condensedContent,
    reportId,
    selectedBlueprintId,
    selectedBlueprint?.displayName,
    generatedContent?.length,
    router,
  ]);

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

        if (!response.ok) throw new Error("迭代失败");

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
                    toast.success("内容已优化完成");
                    await reader.cancel();
                    break;
                  case "error":
                    await reader.cancel();
                    throw new Error(data.data?.message || "迭代失败");
                }
              } catch {
                // Skip
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error(err.message || "优化失败");
        }
      } finally {
        setIsIterating(false);
      }
    },
    [generatedContent, selectedBlueprintId, platformStyle, outline],
  );

  const handleViewReport = useCallback(() => {
    if (reportId) {
      router.push(`/synthesis/${reportId}`);
    }
  }, [reportId, router]);

  const getOutputType = (): OutputType => {
    if (!structuredOutput) return "markdown";
    if (typeof structuredOutput === "string") return "markdown";
    if (typeof structuredOutput !== "object") return "json";

    const output = structuredOutput as object;

    if ("swotAnalysis" in output || "strengths" in output) return "swot";
    if ("featureMatrix" in output || "headers" in output)
      return "feature_matrix";
    if ("scenes" in output) return "script_timeline";
    if ("sections" in output) return "sections";
    if (
      "items" in output &&
      Array.isArray((output as { items: unknown }).items)
    ) {
      return "checklist";
    }

    return "json";
  };

  // ============================================================
  // Render
  // ============================================================

  if (blueprintError) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{blueprintError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setCurrentStep("materials");
          }}
          className="mt-4"
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">知识工坊</h1>
          <Badge variant="secondary" className="text-xs">
            v2.0
          </Badge>
        </div>
        {currentStep !== "result" && (
          <p className="text-sm text-muted-foreground">
            3 步完成：选蓝图 → 选素材 → 生成
          </p>
        )}
      </div>

      {/* 单页流式布局 */}
      <div className="space-y-6">
        {/* ❶ 选择蓝图 */}
        {(currentStep === "blueprint" || currentStep === "materials") && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </span>
                  <CardTitle>选择蓝图</CardTitle>
                  {selectedBlueprint && (
                    <Badge variant="outline" className="ml-2">
                      已选: {selectedBlueprint.icon}{" "}
                      {selectedBlueprint.displayName}
                    </Badge>
                  )}
                </div>
                {currentStep === "materials" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep("blueprint")}
                  >
                    修改
                  </Button>
                )}
              </div>
            </CardHeader>
            {currentStep === "blueprint" && (
              <CardContent className="space-y-4">
                {/* P0-1: 场景快速入口 */}
                <ScenarioQuickEntry
                  onSelect={(blueprintId) => {
                    handleBlueprintSelect(blueprintId);
                    setIsBlueprintExpanded(false);
                  }}
                />

                {/* P0-1: "更多蓝图"折叠展开 */}
                <Collapsible
                  open={isBlueprintExpanded}
                  onOpenChange={setIsBlueprintExpanded}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-center"
                      size="sm"
                    >
                      {isBlueprintExpanded ? (
                        <>
                          收起全部蓝图
                          <ChevronDown className="ml-2 h-4 w-4 rotate-180 transition-transform" />
                        </>
                      ) : (
                        <>
                          查看更多蓝图
                          <ChevronDown className="ml-2 h-4 w-4 transition-transform" />
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <BlueprintSelectorV2
                      blueprints={blueprints}
                      value={selectedBlueprintId}
                      onChange={handleBlueprintSelect}
                      userTier={userTier}
                      onUpgradeClick={handleUpgrade}
                      isLoading={isLoadingBlueprints}
                    />
                  </CollapsibleContent>
                </Collapsible>

                {selectedBlueprintId && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setCurrentStep("materials")}>
                      下一步：选择素材
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* ❷ 选择素材 */}
        {currentStep === "materials" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </span>
                <CardTitle>选择素材</CardTitle>
                <Badge variant="secondary">
                  {selectedMaterialIds.length} / {MATERIAL_LIMITS.HARD_MAX}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* P2-6: AI 推荐优先显示 */}
              <div>
                <h3 className="text-sm font-medium mb-3">AI 推荐素材</h3>
                <MaterialRecommendations
                  selectedMaterialIds={selectedMaterialIds}
                  onAddMaterial={handleAddMaterial}
                  maxSelection={MATERIAL_LIMITS.HARD_MAX}
                />
              </div>

              {/* P2-6: 手动选择折叠 */}
              <Collapsible
                open={isManualSelectExpanded}
                onOpenChange={setIsManualSelectExpanded}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center"
                    size="sm"
                  >
                    {isManualSelectExpanded ? (
                      <>
                        收起手动选择
                        <ChevronDown className="ml-2 h-4 w-4 rotate-180 transition-transform" />
                      </>
                    ) : (
                      <>
                        手动选择更多素材
                        <ChevronDown className="ml-2 h-4 w-4 transition-transform" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="space-y-4">
                    {/* 平台筛选 */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={platformFilter ?? "all"}
                        onValueChange={(v) =>
                          setPlatformFilter(v === "all" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="全部平台" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部平台</SelectItem>
                          <SelectItem value="WECHAT_OFFICIAL_ACCOUNT">
                            微信公众号
                          </SelectItem>
                          <SelectItem value="BILIBILI">B站</SelectItem>
                          <SelectItem value="ZHIHU">知乎</SelectItem>
                          <SelectItem value="XIAOHONGSHU">小红书</SelectItem>
                          <SelectItem value="browser">浏览器书签</SelectItem>
                        </SelectContent>
                      </Select>
                      {platformFilter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPlatformFilter(null)}
                        >
                          清除筛选
                        </Button>
                      )}
                    </div>

                    {isLoadingBookmarks ? (
                      <div className="py-12 text-center text-muted-foreground">
                        加载中...
                      </div>
                    ) : allMaterialsForSelector.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="text-muted-foreground mb-4">
                          暂无收藏内容，请先添加一些收藏
                        </p>
                        <Button asChild variant="outline">
                          <a href="/home">去添加收藏</a>
                        </Button>
                      </div>
                    ) : (
                      <MaterialSelector
                        materials={allMaterialsForSelector}
                        selected={selectedMaterialIds}
                        onChange={handleMaterialsChange}
                        maxSelection={MATERIAL_LIMITS.HARD_MAX}
                        searchQuery={materialSearchQuery}
                        onSearchChange={setMaterialSearchQuery}
                        isSearching={isSearching}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        )}

        {/* ❸ 补充说明（可选折叠） */}
        {currentStep === "materials" && (
          <Collapsible
            open={isRequirementsExpanded}
            onOpenChange={setIsRequirementsExpanded}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-muted-foreground text-muted-foreground text-sm font-bold">
                        3
                      </span>
                      <CardTitle className="text-base">
                        补充说明（可选）
                      </CardTitle>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${isRequirementsExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Textarea
                    placeholder="有什么特别要求吗？例如：需要偏向技术深度、适合新手阅读..."
                    value={additionalRequirements}
                    onChange={(e) => setAdditionalRequirements(e.target.value)}
                    className="min-h-[100px]"
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* ❹ 高级选项（折叠） */}
        {currentStep === "materials" && (
          <Collapsible
            open={isAdvancedExpanded}
            onOpenChange={setIsAdvancedExpanded}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">高级选项</CardTitle>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${isAdvancedExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* 平台风格 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      平台风格
                    </label>
                    <PlatformStyleSelector
                      value={platformStyle}
                      onChange={setPlatformStyle}
                    />
                  </div>

                  {/* P1-3: 大纲编辑 */}
                  {selectedBlueprint?.supportsOutline && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium block">
                          内容大纲（可选）
                        </label>
                        {!showOutlineEditor && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateOutline}
                            disabled={
                              isGeneratingOutline ||
                              selectedMaterials.length < 2
                            }
                          >
                            {isGeneratingOutline ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                生成大纲
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      {showOutlineEditor && outline && (
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <OutlineEditorV2
                            outline={outline}
                            onChange={setOutline}
                            onConfirm={(confirmedOutline) => {
                              setOutline(confirmedOutline);
                              toast.success("大纲已更新");
                            }}
                            isRegenerating={isGeneratingOutline}
                            onRegenerate={handleGenerateOutline}
                          />
                        </div>
                      )}
                      {!showOutlineEditor && (
                        <p className="text-sm text-muted-foreground">
                          点击&quot;生成大纲&quot;创建内容结构，或直接生成让 AI
                          自动规划
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* 生成按钮 */}
        {currentStep === "materials" && (
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!selectedBlueprintId || selectedMaterialIds.length < 2}
              className="px-8"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              一键生成
            </Button>
          </div>
        )}

        {/* ❺ 生成进度 */}
        {currentStep === "generating" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles
                      className={`h-5 w-5 ${prefersReducedMotion ? "" : "animate-pulse"}`}
                    />
                    正在生成内容
                  </CardTitle>
                  <p
                    className={`text-sm text-muted-foreground mt-1 ${prefersReducedMotion ? "" : "animate-pulse"}`}
                  >
                    {WAITING_MESSAGES[waitingMessageIndex]}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelGeneration}
                >
                  取消生成
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress.percent} className="h-2" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{progress.step}</span>
                <span>{progress.percent}%</span>
              </div>

              {generationStartTime && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <ElapsedTimeDisplay startTime={generationStartTime} />
                  </div>
                  {progress.generatedWords !== undefined &&
                    progress.generatedWords > 0 && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        <span>
                          已生成 {progress.generatedWords.toLocaleString()} 字
                        </span>
                      </div>
                    )}
                </div>
              )}

              {generatedContent && (
                <div className="mt-6 p-4 bg-muted rounded-lg max-h-[300px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm">
                    {generatedContent}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ❻ 生成结果 */}
        {currentStep === "result" && (
          <div className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>生成完成</AlertTitle>
              <AlertDescription>
                内容已成功生成并保存。
                {reportId && (
                  <Button
                    variant="link"
                    onClick={handleViewReport}
                    className="p-0 h-auto ml-1"
                  >
                    查看完整草稿 →
                  </Button>
                )}
              </AlertDescription>
            </Alert>

            {/* 操作栏 */}
            {generatedContent && !condensedContent && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      当前内容约 {generatedContent.length.toLocaleString()} 字
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 主操作 */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(generatedContent)
                            .then(() => toast.success("已复制到剪贴板"))
                        }
                      >
                        <Copy className="mr-1.5 h-4 w-4" />
                        复制
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setIsExportDialogOpen(true)}
                      >
                        <Download className="mr-1.5 h-4 w-4" />
                        导出
                      </Button>

                      {/* 更多操作 */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            更多操作
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setIsFeedbackDialogOpen(true)}
                            disabled={isCondensing || isIterating}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            反馈优化
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setIsMultiPlatformDialogOpen(true)}
                            disabled={isCondensing || isIterating}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            一稿多发
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (isPlaying) {
                                pauseTTS();
                              } else {
                                const paragraphs =
                                  generatedContent.split(/\n\n+/);
                                let textToRead = "";
                                for (const p of paragraphs) {
                                  if (textToRead.length + p.length > 500) break;
                                  textToRead += (textToRead ? "\n\n" : "") + p;
                                }
                                if (!textToRead)
                                  textToRead = generatedContent.slice(0, 500);
                                playTTS(textToRead);
                              }
                            }}
                            disabled={isTTSLoading}
                          >
                            {isTTSLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : isPlaying ? (
                              <Pause className="mr-2 h-4 w-4" />
                            ) : (
                              <Volume2 className="mr-2 h-4 w-4" />
                            )}
                            {isPlaying ? "暂停" : "朗读"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <CondenseSlider
                              currentWords={generatedContent.length}
                              onCondense={handleCondense}
                              isCondensing={isCondensing}
                              disabled={isCondensing}
                            />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {isCondensing && (
                    <div className="mt-4 space-y-2">
                      <Progress value={condenseProgress} className="h-2" />
                      <div className="text-sm text-muted-foreground text-center">
                        正在精简内容... {condenseProgress}%
                      </div>
                    </div>
                  )}

                  {isIterating && (
                    <div className="mt-4 space-y-2">
                      <Progress value={iterationProgress} className="h-2" />
                      <div className="text-sm text-muted-foreground text-center">
                        正在优化内容... {iterationProgress}%
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* P2-7: 生成内容 - Tab 切换（原文/精简版） */}
            {structuredOutput ? (
              <StructuredOutputViewer
                type={getOutputType()}
                data={structuredOutput}
                title={`${selectedBlueprint?.displayName} 输出`}
              />
            ) : (
              generatedContent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      生成内容
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {condensedContent ? (
                      <Tabs defaultValue="condensed" className="w-full">
                        <div className="flex items-center justify-between mb-4">
                          <TabsList>
                            <TabsTrigger value="condensed" className="gap-1.5">
                              <Scissors className="h-4 w-4" />
                              精简版
                              <Badge variant="secondary" className="ml-1">
                                {condensedContent.length.toLocaleString()} 字
                              </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="original" className="gap-1.5">
                              <FileText className="h-4 w-4" />
                              原文
                              <Badge variant="secondary" className="ml-1">
                                {generatedContent.length.toLocaleString()} 字
                              </Badge>
                            </TabsTrigger>
                          </TabsList>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleCopyCondensed}
                              title="复制精简内容"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleSaveCondensed}
                              disabled={isSavingCondensed}
                              title="保存为新报告"
                            >
                              {isSavingCondensed ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BookmarkPlus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <TabsContent value="condensed">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap">
                              {condensedContent}
                            </pre>
                          </div>
                        </TabsContent>
                        <TabsContent value="original">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap">
                              {generatedContent}
                            </pre>
                          </div>
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap">
                          {generatedContent}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep("materials");
                  setGeneratedContent("");
                  setStructuredOutput(null);
                  setReportId(undefined);
                  setCondensedContent("");
                  setMaterialsFromRecommendations({});
                }}
              >
                重新生成
              </Button>
              <Button onClick={handleViewReport} disabled={!reportId}>
                查看完整草稿
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 对话框 */}
      <FeedbackDialog
        open={isFeedbackDialogOpen}
        onOpenChange={setIsFeedbackDialogOpen}
        onSubmit={handleFeedbackSubmit}
        isSubmitting={isIterating}
        wordCount={generatedContent?.length}
      />

      <ExportResultDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        content={condensedContent || generatedContent}
        blueprintName={selectedBlueprint?.displayName || "内容"}
      />

      <MultiPlatformDialog
        open={isMultiPlatformDialogOpen}
        onOpenChange={setIsMultiPlatformDialogOpen}
        content={condensedContent || generatedContent}
        currentStyle={platformStyle}
      />
    </div>
  );
}
