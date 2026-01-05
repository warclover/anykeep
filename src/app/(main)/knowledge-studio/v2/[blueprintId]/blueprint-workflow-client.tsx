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
  type BlueprintListItem,
  type OutputType,
} from "@/components/knowledge-studio/v2";
import type {
  BriefingQuestion,
  BriefingContext,
  BlueprintOutline,
  MaterialInput,
} from "@/lib/knowledge-studio/blueprint/types";

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
// Types
// ============================================================

type WorkflowStep = "briefing" | "outline" | "generating" | "result";

interface GenerationProgress {
  step: string;
  percent: number;
  message?: string;
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

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
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
   * Handle briefing submission
   */
  const handleBriefingSubmit = useCallback(
    (context: BriefingContext) => {
      setBriefingContext(context);
      if (blueprint?.supportsOutline) {
        setCurrentStep("outline");
        // Generate outline
        generateOutline(context);
      } else {
        setCurrentStep("generating");
        startGeneration(context);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blueprint],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint]);

  /**
   * Generate outline
   */
  const generateOutline = useCallback(
    async (context?: BriefingContext) => {
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "outline" && data.data.outline) {
                  setOutline(data.data.outline);
                } else if (data.type === "progress") {
                  setProgress({
                    step: data.data.step || "",
                    percent: data.data.percent || 0,
                    message: data.data.message,
                  });
                } else if (data.type === "error") {
                  // Handle server-sent error events
                  throw new Error(data.data.error?.message || "大纲生成错误");
                }
              } catch (parseError) {
                // P2 #4: Count SSE parse errors and fail if threshold exceeded
                sseParseErrorCount++;
                if (sseParseErrorCount >= SSE_PARSE_ERROR_THRESHOLD) {
                  throw new Error("数据流解析错误过多，请重试");
                }
                // Non-critical SSE parse errors - log only in development
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("[SSE Parse Error]", line, parseError);
                }
              }
            }
          }
        }
      } catch (err) {
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
   * Handle outline confirmation
   */
  const handleOutlineConfirm = useCallback(
    (confirmedOutline: BlueprintOutline) => {
      setOutline(confirmedOutline);
      setCurrentStep("generating");
      startGeneration(briefingContext, confirmedOutline);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [briefingContext],
  );

  /**
   * Start content generation
   */
  const startGeneration = useCallback(
    async (context?: BriefingContext, outlineData?: BlueprintOutline) => {
      setProgress({ step: "preparing", percent: 0, message: "准备生成..." });
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
                    setProgress({
                      step: data.data.step || "",
                      percent: data.data.percent || 0,
                      message: data.data.message,
                    });
                    break;

                  case "content":
                    contentBuffer += data.data.text || "";
                    setGeneratedContent(contentBuffer);
                    break;

                  case "structured_output":
                    setStructuredOutput(data.data.structuredOutput);
                    break;

                  case "done":
                    setReportId(data.data.reportId);
                    setCurrentStep("result");
                    break;

                  case "error":
                    throw new Error(data.data.error?.message || "内容生成错误");
                }
              } catch (parseError) {
                // P2 #4: Count SSE parse errors and fail if threshold exceeded
                sseParseErrorCount++;
                if (sseParseErrorCount >= SSE_PARSE_ERROR_THRESHOLD) {
                  throw new Error("数据流解析错误过多，请重试");
                }
                // Non-critical SSE parse errors - log only in development
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("[SSE Parse Error]", line, parseError);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            setError("请求超时，请检查网络连接后重试");
          } else {
            setError(err.message);
          }
        }
      }
    },
    [blueprintId, materials],
  );

  /**
   * Handle back button
   */
  const handleBack = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.push("/knowledge-studio/v2");
  }, [router]);

  /**
   * View report
   */
  const handleViewReport = useCallback(() => {
    if (reportId) {
      router.push(`/knowledge-studio/reports/${reportId}`);
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
            <OutlineEditorV2
              outline={outline}
              onChange={setOutline}
              onConfirm={handleOutlineConfirm}
              onRegenerate={() => generateOutline(briefingContext)}
              isRegenerating={isRegenerating}
            />
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
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 animate-pulse" />
              正在生成内容
            </CardTitle>
            <CardDescription>{progress.message || "请稍候..."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress.percent} className="h-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{progress.step}</span>
              <span>{progress.percent}%</span>
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
            <AlertTitle>生成完成</AlertTitle>
            <AlertDescription>
              内容已成功生成并保存。
              {reportId && (
                <Button
                  variant="link"
                  onClick={handleViewReport}
                  className="p-0 h-auto ml-1"
                >
                  查看报告 →
                </Button>
              )}
            </AlertDescription>
          </Alert>

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

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              返回知识工坊
            </Button>
            <Button onClick={handleViewReport} disabled={!reportId}>
              查看完整报告
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
