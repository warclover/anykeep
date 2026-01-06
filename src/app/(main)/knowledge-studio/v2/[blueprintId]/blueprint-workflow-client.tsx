/**
 * Blueprint Workflow Client - 蓝图工作流客户端组件
 * @module knowledge-studio/v2
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Clock,
  Scissors,
  MessageSquare,
} from "lucide-react";
import {
  SSE_REQUEST_TIMEOUT_MS,
  SSE_PARSE_ERROR_THRESHOLD,
} from "@/lib/knowledge-studio/v2/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BriefingWizard,
  OutlineEditorV2,
  StructuredOutputViewer,
  GenerationEstimatePanel,
  PlatformStyleSelector,
  FeedbackDialog,
  DraftVersionPanel,
  type BlueprintListItem,
  type OutputType,
} from "@/components/knowledge-studio/v2";
import type {
  BriefingQuestion,
  BriefingContext,
  BlueprintOutline,
  MaterialInput,
} from "@/lib/knowledge-studio/blueprint/types";
import type { PlatformStyle } from "@/lib/knowledge-studio/v2/constants";
import {
  DraftVersionManager,
  type DraftFeedback,
  type DraftVersion,
} from "@/lib/knowledge-studio/iteration";
import { useSoundEffect } from "@/hooks/use-sound-effect";

// ============================================================
// Zod Schema for sessionStorage Validation (P1 #5)
// ============================================================

/**
 * MaterialInput schema matching src/lib/knowledge-studio/blueprint/types.ts
 */
const MaterialInputSchema = z.object({
  bookmarkId: z.string().min(1),
  title: z.string(),
  content: z.string(),
  url: z.string().url(),
  platform: z.string().optional(),
});

const StoredMaterialsSchema = z.array(MaterialInputSchema).min(1);

// ============================================================
// Session Storage Keys for Caching
// ============================================================

const CACHE_KEYS = {
  MATERIALS: "ks-v2-materials",
  OUTLINE: "ks-v2-outline",
  CONTENT: "ks-v2-content",
  STRUCTURED_OUTPUT: "ks-v2-structured-output",
  REPORT_ID: "ks-v2-report-id",
  CURRENT_STEP: "ks-v2-current-step",
  BRIEFING_CONTEXT: "ks-v2-briefing-context",
  PLATFORM_STYLE: "ks-v2-platform-style",
} as const;

/**
 * 清理所有缓存数据
 */
function clearAllCache() {
  Object.values(CACHE_KEYS).forEach((key) => {
    sessionStorage.removeItem(key);
  });
}

/**
 * 保存数据到 sessionStorage
 */
function saveToCache(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.info(`Failed to save to cache: ${key}`, err);
  }
}

/**
 * 从 sessionStorage 加载数据
 */
function loadFromCache<T>(key: string): T | null {
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

// ============================================================
// Types
// ============================================================

type WorkflowStep = "briefing" | "outline" | "generating" | "result";

interface GenerationProgress {
  step: string;
  percent: number;
  message?: string;
  /** Phase 2.3: 已生成字数 */
  generatedWords?: number;
}

// ============================================================
// Phase 2.3: Elapsed Time Display Component
// ============================================================

/**
 * 格式化已用时间
 */
function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * 实时显示已用时间的组件
 */
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

// ============================================================
// Component
// ============================================================

interface BlueprintWorkflowClientProps {
  blueprintId: string;
}

export function BlueprintWorkflowClient({
  blueprintId,
}: BlueprintWorkflowClientProps) {
  const router = useRouter();
  const { playSuccess, playError } = useSoundEffect();

  // State
  const [blueprint, setBlueprint] = useState<BlueprintListItem | null>(null);
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [materials, setMaterials] = useState<MaterialInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<WorkflowStep>("briefing");
  const [briefingContext, setBriefingContext] = useState<
    BriefingContext | undefined
  >();
  const [outline, setOutline] = useState<BlueprintOutline | undefined>();
  const [progress, setProgress] = useState<GenerationProgress>({
    step: "",
    percent: 0,
  });
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [structuredOutput, setStructuredOutput] = useState<unknown>(null);
  const [reportId, setReportId] = useState<string | undefined>();
  const [isRegenerating, setIsRegenerating] = useState(false);
  /** Phase 2.3: 生成开始时间戳 */
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null,
  );
  /** Phase 3.1: 平台风格（支持缓存恢复） */
  const [platformStyle, setPlatformStyle] = useState<PlatformStyle>(() => {
    const cached = loadFromCache<PlatformStyle>(CACHE_KEYS.PLATFORM_STYLE);
    return cached ?? "general";
  });

  /** Phase 3.2: 精简功能状态 */
  const [isCondensing, setIsCondensing] = useState(false);
  const [condensedContent, setCondensedContent] = useState<string>("");
  const [condenseProgress, setCondenseProgress] = useState(0);
  const condenseAbortRef = useRef<AbortController | null>(null);

  /** Phase 4: 草稿迭代与反馈驱动优化 */
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [iterationProgress, setIterationProgress] = useState(0);
  const [draftVersions, setDraftVersions] = useState<DraftVersion[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const draftVersionManagerRef = useRef<DraftVersionManager | null>(null);
  const iterateAbortRef = useRef<AbortController | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Phase 3.2: 清理精简请求
      if (condenseAbortRef.current) {
        condenseAbortRef.current.abort();
        condenseAbortRef.current = null;
      }
      // Phase 4: 清理迭代请求
      if (iterateAbortRef.current) {
        iterateAbortRef.current.abort();
        iterateAbortRef.current = null;
      }
    };
  }, []);

  // Load blueprint info and briefing questions
  useEffect(() => {
    async function loadData() {
      try {
        // Load and validate materials from sessionStorage (P1 #5)
        const storedMaterials = sessionStorage.getItem("ks-v2-materials");
        if (!storedMaterials) {
          router.push("/knowledge-studio/v2");
          return;
        }

        // Validate sessionStorage data with Zod schema
        let parsedMaterials: unknown;
        try {
          parsedMaterials = JSON.parse(storedMaterials);
        } catch {
          // Invalid JSON - redirect to material selection
          sessionStorage.removeItem("ks-v2-materials");
          router.push("/knowledge-studio/v2");
          return;
        }

        const validationResult =
          StoredMaterialsSchema.safeParse(parsedMaterials);
        if (!validationResult.success) {
          // Invalid data structure - clear and redirect
          sessionStorage.removeItem("ks-v2-materials");
          router.push("/knowledge-studio/v2");
          return;
        }

        setMaterials(validationResult.data);

        // Get blueprint list to find current blueprint
        const blueprintsRes = await fetch(
          "/api/knowledge-studio/v2/blueprints",
        );
        if (!blueprintsRes.ok) throw new Error("Failed to fetch blueprints");
        const blueprintsData = await blueprintsRes.json();
        const foundBlueprint = blueprintsData.blueprints.find(
          (bp: BlueprintListItem) => bp.blueprintId === blueprintId,
        );

        if (!foundBlueprint) {
          throw new Error("Blueprint not found");
        }
        setBlueprint(foundBlueprint);

        // 尝试恢复缓存的工作流状态
        const cachedStep = loadFromCache<WorkflowStep>(CACHE_KEYS.CURRENT_STEP);
        const cachedOutline = loadFromCache<BlueprintOutline>(
          CACHE_KEYS.OUTLINE,
        );
        const cachedContent = loadFromCache<string>(CACHE_KEYS.CONTENT);
        const cachedStructuredOutput = loadFromCache<unknown>(
          CACHE_KEYS.STRUCTURED_OUTPUT,
        );
        const cachedReportId = loadFromCache<string>(CACHE_KEYS.REPORT_ID);
        const cachedBriefingContext = loadFromCache<
          BriefingContext & { answeredAt: string }
        >(CACHE_KEYS.BRIEFING_CONTEXT);

        // 如果有缓存的结果，恢复到结果页面
        if (cachedStep === "result" && cachedReportId) {
          setOutline(cachedOutline || undefined);
          setGeneratedContent(cachedContent || "");
          setStructuredOutput(cachedStructuredOutput);
          setReportId(cachedReportId);
          if (cachedBriefingContext) {
            setBriefingContext({
              ...cachedBriefingContext,
              answeredAt: new Date(cachedBriefingContext.answeredAt),
            });
          }
          setCurrentStep("result");
          setIsLoading(false);
          return;
        }

        // 如果有缓存的大纲，恢复到大纲编辑页面
        if (cachedOutline && foundBlueprint.supportsOutline) {
          setOutline(cachedOutline);
          if (cachedBriefingContext) {
            setBriefingContext({
              ...cachedBriefingContext,
              answeredAt: new Date(cachedBriefingContext.answeredAt),
            });
          }
          setCurrentStep("outline");
          setIsLoading(false);
          return;
        }

        // Get briefing questions if enabled
        if (foundBlueprint.briefingEnabled) {
          const briefingRes = await fetch("/api/knowledge-studio/v2/briefing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blueprintId }),
          });
          if (briefingRes.ok) {
            const briefingData = await briefingRes.json();
            setQuestions(briefingData.questions);
          }
        } else {
          // Skip briefing, go directly to outline or generation
          setCurrentStep(
            foundBlueprint.supportsOutline ? "outline" : "generating",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [blueprintId, router]);

  /**
   * Generate outline
   */
  const generateOutline = useCallback(
    async (context?: BriefingContext) => {
      // 防止重复请求：如果已有正在进行的请求，先取消它
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setIsRegenerating(true);

      try {
        abortControllerRef.current = new AbortController();

        // P2 #6: Add request timeout
        const timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort();
        }, SSE_REQUEST_TIMEOUT_MS);

        const response = await fetch("/api/knowledge-studio/v2/outline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintId,
            materials,
            briefingContext: context
              ? { ...context, answeredAt: context.answeredAt.toISOString() }
              : undefined,
            targetLength: "medium",
          }),
          signal: abortControllerRef.current.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `大纲生成失败 (${response.status})${errorText ? `: ${errorText}` : ""}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let sseParseErrorCount = 0; // P2 #4: Track SSE parse errors
        let receivedOutline = false; // 追踪是否收到大纲

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              // 分离 JSON 解析和事件处理，避免错误事件被静默吞没
              let data;
              try {
                data = JSON.parse(line.slice(6));
              } catch (parseError) {
                // 仅捕获 JSON 解析错误
                sseParseErrorCount++;
                if (sseParseErrorCount >= SSE_PARSE_ERROR_THRESHOLD) {
                  throw new Error("数据流解析错误过多，请重试");
                }
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("[SSE Parse Error]", line, parseError);
                }
                continue; // 跳过此行，尝试下一行
              }

              // 事件处理在 try-catch 外部，确保错误能正确传播
              if (data.type === "outline" && data.data.outline) {
                setOutline(data.data.outline);
                // 缓存大纲数据
                saveToCache(CACHE_KEYS.OUTLINE, data.data.outline);
                saveToCache(CACHE_KEYS.CURRENT_STEP, "outline");
                receivedOutline = true;
              } else if (data.type === "progress") {
                setProgress({
                  step: data.data.step || "",
                  percent: data.data.percent || 0,
                  message: data.data.message,
                });
              } else if (data.type === "error") {
                // 服务端错误事件 - 立即中止并抛出
                // DEBUG: 确认收到错误事件
                // eslint-disable-next-line no-console
                console.log("[SSE DEBUG] Received error event:", data);
                await reader.cancel();
                throw new Error(data.data.error?.message || "大纲生成错误");
              } else if (data.type === "done") {
                // 显式完成信号 - 取消读取以跳出外层 while 循环
                await reader.cancel();
                break;
              }
            }
          }
        }

        // 兜底检查：如果流正常结束但未收到大纲，说明生成失败
        if (!receivedOutline) {
          throw new Error("大纲生成失败，请重试");
        }
      } catch (err) {
        // DEBUG: 确认错误被捕获
        // eslint-disable-next-line no-console
        console.log("[SSE DEBUG] Error caught in generateOutline:", err);
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            setError("请求超时，请检查网络连接后重试");
          } else {
            setError(err.message);
          }
        }
      } finally {
        setIsRegenerating(false);
      }
    },
    [blueprintId, materials],
  );

  /**
   * Start content generation
   */
  const startGeneration = useCallback(
    async (context?: BriefingContext, outlineData?: BlueprintOutline) => {
      // 防止重复请求：如果已有正在进行的请求，先取消它
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Phase 2.3: 记录开始时间
      setGenerationStartTime(Date.now());
      setProgress({
        step: "preparing",
        percent: 0,
        message: "准备生成...",
        generatedWords: 0,
      });
      setGeneratedContent("");
      setStructuredOutput(null);

      try {
        abortControllerRef.current = new AbortController();

        // P2 #6: Add request timeout
        const timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort();
        }, SSE_REQUEST_TIMEOUT_MS);

        const response = await fetch("/api/knowledge-studio/v2/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintId,
            materials,
            briefingContext: context
              ? { ...context, answeredAt: context.answeredAt.toISOString() }
              : undefined,
            outline: outlineData,
            targetLength: "medium",
            platformStyle, // Phase 3.1: 平台风格
          }),
          signal: abortControllerRef.current.signal,
        });

        clearTimeout(timeoutId);

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
        let sseParseErrorCount = 0; // P2 #4: Track SSE parse errors
        let generationCompleted = false; // 追踪是否收到完成信号

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              // 分离 JSON 解析和事件处理，避免错误事件被静默吞没
              let data;
              try {
                data = JSON.parse(line.slice(6));
              } catch (parseError) {
                // 仅捕获 JSON 解析错误
                sseParseErrorCount++;
                if (sseParseErrorCount >= SSE_PARSE_ERROR_THRESHOLD) {
                  throw new Error("数据流解析错误过多，请重试");
                }
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("[SSE Parse Error]", line, parseError);
                }
                continue; // 跳过此行，尝试下一行
              }

              // 事件处理在 try-catch 外部，确保错误能正确传播
              switch (data.type) {
                case "progress":
                  setProgress({
                    step: data.data.step || "",
                    percent: data.data.percent || 0,
                    message: data.data.message,
                  });
                  break;

                case "content":
                  contentBuffer += data.data.text || "";
                  setGeneratedContent(contentBuffer);
                  // Phase 2.3: 更新已生成字数
                  setProgress((prev) => ({
                    ...prev,
                    generatedWords: contentBuffer.length,
                  }));
                  break;

                case "structured_output":
                  setStructuredOutput(data.data.structuredOutput);
                  // 缓存结构化输出
                  saveToCache(
                    CACHE_KEYS.STRUCTURED_OUTPUT,
                    data.data.structuredOutput,
                  );
                  break;

                case "done":
                  setReportId(data.data.reportId);
                  setCurrentStep("result");
                  generationCompleted = true;
                  // 缓存生成结果
                  saveToCache(CACHE_KEYS.CONTENT, contentBuffer);
                  saveToCache(CACHE_KEYS.REPORT_ID, data.data.reportId);
                  saveToCache(CACHE_KEYS.CURRENT_STEP, "result");

                  // Phase 2: 记录成功使用统计
                  fetch("/api/knowledge-studio/v2/usage/record", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      blueprintId,
                      success: true,
                      platformStyle,
                      lengthMode: "medium",
                    }),
                  }).catch(() => {
                    // Silently ignore usage tracking errors
                  });

                  // Phase 5: 播放生成完成音效
                  playSuccess();

                  // 取消读取以跳出外层 while 循环
                  await reader.cancel();
                  break;

                case "error":
                  // 服务端错误事件 - 立即中止并抛出
                  await reader.cancel();
                  throw new Error(data.data.error?.message || "内容生成错误");
              }
            }
          }
        }

        // 兜底检查：如果流正常结束但未收到完成信号，说明生成失败
        if (!generationCompleted) {
          throw new Error("内容生成未完成，请重试");
        }
      } catch (err) {
        // Phase 2: 记录失败使用统计
        fetch("/api/knowledge-studio/v2/usage/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintId,
            success: false,
            platformStyle,
            lengthMode: "medium",
          }),
        }).catch(() => {
          // Silently ignore usage tracking errors
        });

        // Phase 5: 播放错误音效
        playError();

        if (err instanceof Error) {
          if (err.name === "AbortError") {
            setError("请求超时，请检查网络连接后重试");
          } else {
            setError(err.message);
          }
        }
      }
    },
    [blueprintId, materials, platformStyle, playSuccess, playError],
  );

  /**
   * Handle briefing submission
   */
  const handleBriefingSubmit = useCallback(
    (context: BriefingContext) => {
      setBriefingContext(context);
      // 缓存 briefing 上下文
      saveToCache(CACHE_KEYS.BRIEFING_CONTEXT, {
        ...context,
        answeredAt: context.answeredAt.toISOString(),
      });
      if (blueprint?.supportsOutline) {
        setCurrentStep("outline");
        // Generate outline
        generateOutline(context);
      } else {
        setCurrentStep("generating");
        startGeneration(context);
      }
    },
    [blueprint, generateOutline, startGeneration],
  );

  /**
   * Handle briefing skip
   */
  const handleBriefingSkip = useCallback(() => {
    if (blueprint?.supportsOutline) {
      setCurrentStep("outline");
      generateOutline();
    } else {
      setCurrentStep("generating");
      startGeneration();
    }
  }, [blueprint, generateOutline, startGeneration]);

  /**
   * Handle outline confirmation
   */
  const handleOutlineConfirm = useCallback(
    (confirmedOutline: BlueprintOutline) => {
      setOutline(confirmedOutline);
      setCurrentStep("generating");
      startGeneration(briefingContext, confirmedOutline);
    },
    [briefingContext, startGeneration],
  );

  /**
   * Handle platform style change with cache persistence
   */
  const handlePlatformStyleChange = useCallback((style: PlatformStyle) => {
    setPlatformStyle(style);
    saveToCache(CACHE_KEYS.PLATFORM_STYLE, style);
  }, []);

  /**
   * Handle cancel generation
   */
  const handleCancelGeneration = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCurrentStep("outline");
    setProgress({ step: "", percent: 0 });
    setGeneratedContent("");
    setGenerationStartTime(null);

    // Record cancelled usage for analytics
    try {
      await fetch("/api/knowledge-studio/v2/usage/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId,
          success: false,
          platformStyle,
          lengthMode: "medium",
        }),
      });
    } catch {
      // Silently ignore usage tracking errors
    }
  }, [blueprintId, platformStyle]);

  /**
   * Phase 3.2: Handle content condensation
   * 一键精简内容到目标字数
   */
  const handleCondense = useCallback(
    async (targetWords: number = 1500) => {
      // 获取需要精简的内容
      const contentToCondense = generatedContent || "";
      if (!contentToCondense) {
        return;
      }

      // 防止重复请求
      if (condenseAbortRef.current) {
        condenseAbortRef.current.abort();
      }

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
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || `精简失败 (${response.status})`,
          );
        }

        // 检查是否返回非流式响应（内容已在目标范围内）
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          if (data.condensedContent) {
            setCondensedContent(data.condensedContent);
            setCondenseProgress(100);
          }
          return;
        }

        // 流式响应处理
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
              } catch (parseError) {
                // 跳过解析错误的行
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("[Condense SSE Parse Error]", line, parseError);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsCondensing(false);
      }
    },
    [generatedContent],
  );

  /**
   * Phase 4: Initialize draft version manager when content is generated
   */
  useEffect(() => {
    if (generatedContent && reportId && !draftVersionManagerRef.current) {
      draftVersionManagerRef.current = new DraftVersionManager({
        sessionId: reportId,
      });
      // Save initial version
      const initialVersion = draftVersionManagerRef.current.saveVersion(
        generatedContent,
        "initial",
        "首次生成",
      );
      setDraftVersions([initialVersion]);
      setCurrentVersionIndex(0);
    }
  }, [generatedContent, reportId]);

  /**
   * Phase 4: Handle feedback submission and start iteration
   */
  const handleFeedbackSubmit = useCallback(
    async (feedback: DraftFeedback) => {
      const contentToIterate = generatedContent || "";
      if (!contentToIterate || !blueprintId) {
        return;
      }

      // Abort previous iteration if any
      if (iterateAbortRef.current) {
        iterateAbortRef.current.abort();
      }

      setIsIterating(true);
      setIterationProgress(0);
      setIsFeedbackDialogOpen(false);

      // Add feedback to current version
      if (draftVersionManagerRef.current) {
        draftVersionManagerRef.current.addFeedbackToCurrentVersion(feedback);
        setDraftVersions(draftVersionManagerRef.current.getVersionHistory());
      }

      try {
        iterateAbortRef.current = new AbortController();

        const response = await fetch("/api/knowledge-studio/v2/iterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalContent: contentToIterate,
            feedback,
            blueprintId,
            platformStyle,
            outlineJson: outline ? JSON.stringify(outline) : undefined,
          }),
          signal: iterateAbortRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || `迭代失败 (${response.status})`,
          );
        }

        // Handle SSE stream
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
                    // Update generated content
                    setGeneratedContent(iteratedContent);
                    // Save new version
                    if (draftVersionManagerRef.current) {
                      draftVersionManagerRef.current.saveVersion(
                        iteratedContent,
                        "iteration",
                        `基于反馈优化`,
                        feedback,
                      );
                      setDraftVersions(
                        draftVersionManagerRef.current.getVersionHistory(),
                      );
                      setCurrentVersionIndex(0);
                    }
                    // Clear condensed content
                    setCondensedContent("");
                    await reader.cancel();
                    break;

                  case "error":
                    await reader.cancel();
                    throw new Error(data.data?.message || "迭代失败");
                }
              } catch (parseError) {
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("[Iterate SSE Parse Error]", line, parseError);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsIterating(false);
      }
    },
    [generatedContent, blueprintId, platformStyle, outline],
  );

  /**
   * Phase 4: Handle restoring a previous version
   */
  const handleRestoreVersion = useCallback((versionId: string) => {
    if (!draftVersionManagerRef.current) return;

    const restoredContent =
      draftVersionManagerRef.current.restoreVersion(versionId);
    if (restoredContent) {
      setGeneratedContent(restoredContent);
      setCondensedContent("");
      // Update version list to reflect current index change
      const history = draftVersionManagerRef.current.getVersionHistory();
      const newIndex = history.findIndex((v) => v.id === versionId);
      setDraftVersions(history);
      setCurrentVersionIndex(newIndex >= 0 ? newIndex : 0);
    }
  }, []);

  /**
   * Handle back button
   */
  const handleBack = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 返回时清理缓存（用户主动放弃）
    clearAllCache();
    router.push("/knowledge-studio/v2");
  }, [router]);

  /**
   * View report
   */
  const handleViewReport = useCallback(() => {
    if (reportId) {
      // 查看草稿后清理缓存（工作流完成）
      clearAllCache();
      router.push(`/synthesis/${reportId}`);
    }
  }, [reportId, router]);

  /**
   * Determine output type from structured output
   * Uses type guards instead of type assertions (P3 #11)
   */
  const getOutputType = (): OutputType => {
    if (!structuredOutput) return "markdown";
    if (typeof structuredOutput === "string") return "markdown";
    if (typeof structuredOutput !== "object") return "json";

    // Type-safe property checks using 'in' operator
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

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={handleBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>
    );
  }

  if (!blueprint) {
    return null;
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{blueprint.icon}</span>
          <span className="font-semibold">{blueprint.displayName}</span>
          {blueprint.tier !== "free" && (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600"
            >
              {blueprint.tier.toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Workflow steps */}
      {currentStep === "briefing" && questions.length > 0 && (
        <BriefingWizard
          blueprintName={blueprint.displayName}
          blueprintIcon={blueprint.icon}
          questions={questions}
          onSubmit={handleBriefingSubmit}
          onSkip={handleBriefingSkip}
          onBack={handleBack}
        />
      )}

      {currentStep === "outline" && (
        <>
          {outline ? (
            <div className="space-y-6">
              <OutlineEditorV2
                outline={outline}
                onChange={setOutline}
                onConfirm={handleOutlineConfirm}
                onRegenerate={() => generateOutline(briefingContext)}
                isRegenerating={isRegenerating}
              />
              {/* Phase 3.1: 平台风格选择器（支持缓存） */}
              <PlatformStyleSelector
                value={platformStyle}
                onChange={handlePlatformStyleChange}
              />
              {/* Phase 2.1: 生成预估面板 */}
              <GenerationEstimatePanel
                outline={outline}
                targetLength="medium"
                materialCount={materials.length}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {progress.message || "正在生成大纲..."}
                  </p>
                  <Progress value={progress.percent} className="w-64" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {currentStep === "generating" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  正在生成内容
                </CardTitle>
                <CardDescription>
                  {progress.message || "请稍候..."}
                </CardDescription>
              </div>
              {/* Phase 2: 取消按钮 */}
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

            {/* Phase 2.3: 增强进度信息 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
              {generationStartTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <ElapsedTimeDisplay startTime={generationStartTime} />
                </div>
              )}
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

      {currentStep === "result" && (
        <div className="space-y-6">
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>草稿生成完成</AlertTitle>
            <AlertDescription>
              内容已成功生成并保存。
              {reportId && (
                <Button
                  variant="link"
                  onClick={handleViewReport}
                  className="p-0 h-auto ml-1"
                >
                  查看草稿 →
                </Button>
              )}
            </AlertDescription>
          </Alert>

          {/* Phase 3.2: 精简操作栏 */}
          {generatedContent && !condensedContent && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    当前内容约 {generatedContent.length.toLocaleString()} 字
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCondense(800)}
                      disabled={isCondensing}
                    >
                      <Scissors className="mr-1.5 h-4 w-4" />
                      精简到 800 字
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCondense(1500)}
                      disabled={isCondensing}
                    >
                      <Scissors className="mr-1.5 h-4 w-4" />
                      精简到 1500 字
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCondense(2000)}
                      disabled={isCondensing}
                    >
                      <Scissors className="mr-1.5 h-4 w-4" />
                      精简到 2000 字
                    </Button>
                    {/* Phase 4: 反馈优化按钮 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFeedbackDialogOpen(true)}
                      disabled={isCondensing || isIterating}
                    >
                      <MessageSquare className="mr-1.5 h-4 w-4" />
                      反馈优化
                    </Button>
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
                {/* Phase 4: 迭代进度条 */}
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

          {/* Phase 3.2: 精简后内容展示 */}
          {condensedContent && (
            <Card className="border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-primary" />
                    精简版内容
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {condensedContent.length.toLocaleString()} 字
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCondensedContent("")}
                    >
                      查看原文
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap">{condensedContent}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {structuredOutput ? (
            <StructuredOutputViewer
              type={getOutputType()}
              data={structuredOutput}
              title={`${blueprint.displayName} 输出`}
            />
          ) : generatedContent ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  生成内容
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap">{generatedContent}</pre>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Phase 4: 版本历史面板 */}
          {draftVersions.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <DraftVersionPanel
                  versions={draftVersions}
                  currentIndex={currentVersionIndex}
                  onRestore={handleRestoreVersion}
                  isRestoring={false}
                  collapsible={true}
                  defaultOpen={false}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              返回知识工坊
            </Button>
            <Button onClick={handleViewReport} disabled={!reportId}>
              查看完整草稿
            </Button>
          </div>
        </div>
      )}

      {/* Phase 4: 反馈对话框 */}
      <FeedbackDialog
        open={isFeedbackDialogOpen}
        onOpenChange={setIsFeedbackDialogOpen}
        onSubmit={handleFeedbackSubmit}
        isSubmitting={isIterating}
        wordCount={generatedContent?.length}
      />
    </div>
  );
}
