"use client";

/**
 * Knowledge Studio - 主页面客户端组件
 * @module app/(main)/knowledge-studio
 * @description 整合素材选择、蓝图选择、报告生成的完整工作流
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Sparkles,
  ChevronRight,
  Settings,
  History,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BlueprintSelector } from "@/components/knowledge-studio/blueprint-selector";
import { MaterialSelector } from "@/components/knowledge-studio/material-selector";
import { GenerationProgress } from "@/components/knowledge-studio/generation-progress";
// 从客户端安全导出导入，避免导入包含服务端代码的主 index.ts
import type { BlueprintType, GenerationStage } from "@/lib/knowledge-studio/client";
import { BLUEPRINT_DISPLAY_CONFIG } from "@/lib/knowledge-studio/client";
import { useBookmarks } from "@/hooks/queries/use-bookmarks";
import { useGeneration } from "@/hooks/domain/knowledge-studio/use-generation";
import { toast } from "sonner";

// 工作流步骤
type WorkflowStep =
  | "materials"
  | "blueprint"
  | "config"
  | "generating"
  | "result";

// 目标长度
type TargetLength = "short" | "medium" | "long";

const LENGTH_OPTIONS: { value: TargetLength; label: string; desc: string }[] = [
  { value: "short", label: "简短", desc: "500-800 字" },
  { value: "medium", label: "中等", desc: "1000-1500 字" },
  { value: "long", label: "详尽", desc: "2000-3000 字" },
];

export function KnowledgeStudioPageClient() {
  const router = useRouter();
  
  // 工作流状态
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("materials");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<
    BlueprintType | undefined
  >();
  const [targetLength, setTargetLength] = useState<TargetLength>("medium");
  const [customPrompt, setCustomPrompt] = useState("");
  
  // 生成的报告 ID
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  // 获取书签数据
  const { data, isLoading } = useBookmarks({ limit: 100 });
  const bookmarks = data?.items || [];

  // 转换书签为素材格式
  const materials = bookmarks.map((b) => ({
    id: String(b.id),
    title: b.title || "无标题",
    url: b.url,
    platform: b.platform || undefined,
    summary: b.aiSummary || undefined,
    createdAt: new Date(b.createdAt),
  }));

  // 使用生成 Hook
  const {
    status: generationStatus,
    progress: generationProgress,
    result: generationResult,
    error: generationError,
    generate: startGeneration,
    reset: resetGeneration,
  } = useGeneration({
    onComplete: (result) => {
      console.log("Generation complete:", result);
      if (result.success && result.reportId) {
        console.log("Setting reportId:", result.reportId);
        setGeneratedReportId(result.reportId);
        setCurrentStep("result");
        toast.success("报告生成完成！");
      } else {
        // 如果成功但没有 reportId，说明保存失败
        if (result.success && !result.reportId) {
          console.error("Generation succeeded but no reportId:", result);
          toast.error("报告生成成功，但保存失败，请重试");
        } else {
          // 生成失败
          console.error("Generation failed:", result.error);
          toast.error(result.error || "生成失败，请重试");
        }
        setCurrentStep("config");
      }
    },
    onError: (error) => {
      console.error("Generation error:", error);
      toast.error(error);
      setCurrentStep("config");
    },
    onProgress: (progress) => {
      // 进度更新已在 GenerationProgress 组件中处理
    },
  });

  // 步骤导航
  const steps = [
    { key: "materials", label: "选择素材", icon: FileText },
    { key: "blueprint", label: "选择蓝图", icon: BookOpen },
    { key: "config", label: "生成配置", icon: Settings },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const canProceed =
    currentStep === "materials"
      ? selectedMaterials.length >= 2
      : currentStep === "blueprint"
        ? !!selectedBlueprint
        : true;

  // 开始生成（需要在 handleNext 之前定义）
  const handleGenerate = useCallback(async () => {
    if (!selectedBlueprint || selectedMaterials.length < 2) {
      toast.error("请选择蓝图和至少 2 个素材");
      return;
    }

    setCurrentStep("generating");
    setGeneratedReportId(null);

    // 准备素材数据
    const selectedBookmarks = bookmarks.filter((b) =>
      selectedMaterials.includes(String(b.id)),
    );

    const materialItems = selectedBookmarks.map((b) => ({
      bookmarkId: String(b.id),
      title: b.title || "无标题",
      content: b.aiSummary || b.description || "",
      url: b.url,
      platform: b.platform || undefined,
    }));

    // 开始生成
    await startGeneration(
      {
        type: selectedBlueprint,
        targetLength,
        tone: undefined,
      },
      materialItems,
    );
  }, [
    selectedBlueprint,
    selectedMaterials,
    targetLength,
    bookmarks,
    startGeneration,
  ]);

  // 下一步
  const handleNext = useCallback(() => {
    if (currentStep === "materials" && selectedMaterials.length >= 2) {
      setCurrentStep("blueprint");
    } else if (currentStep === "blueprint" && selectedBlueprint) {
      setCurrentStep("config");
    } else if (currentStep === "config") {
      handleGenerate();
    }
  }, [currentStep, selectedMaterials, selectedBlueprint, handleGenerate]);

  // 上一步
  const handleBack = useCallback(() => {
    if (currentStep === "blueprint") {
      setCurrentStep("materials");
    } else if (currentStep === "config") {
      setCurrentStep("blueprint");
    }
  }, [currentStep]);

  // 重新开始
  const handleReset = useCallback(() => {
    setCurrentStep("materials");
    setSelectedMaterials([]);
    setSelectedBlueprint(undefined);
    setTargetLength("medium");
    setCustomPrompt("");
    setGeneratedReportId(null);
    resetGeneration();
  }, [resetGeneration]);

  // 查看报告
  const handleViewReport = useCallback(() => {
    console.log("View report clicked, reportId:", generatedReportId);
    if (generatedReportId) {
      console.log("Navigating to:", `/synthesis/${generatedReportId}`);
      router.push(`/synthesis/${generatedReportId}`);
    } else {
      console.error("No reportId available");
      toast.error("报告 ID 不存在，请重新生成");
    }
  }, [generatedReportId, router]);

  return (
    <div className="container mx-auto max-w-5xl py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            知识工坊
          </h1>
          <p className="text-muted-foreground mt-1">
            将收藏内容转化为结构化的知识报告
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/knowledge-studio/templates">
              <FileText className="h-4 w-4 mr-1" />
              模板管理
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/knowledge-studio/learning">
              <History className="h-4 w-4 mr-1" />
              学习统计
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/knowledge-studio/billing">
              <CreditCard className="h-4 w-4 mr-1" />
              配额
            </Link>
          </Button>
        </div>
      </div>

      {/* 步骤导航 */}
      {currentStep !== "generating" && currentStep !== "result" && (
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.key === currentStep;
            const isCompleted = index < currentStepIndex;
            const isDisabled = index > currentStepIndex;

            return (
              <div key={step.key} className="flex items-center">
                <button
                  onClick={() =>
                    !isDisabled && setCurrentStep(step.key as WorkflowStep)
                  }
                  disabled={isDisabled}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {step.label}
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 主内容区 */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: 选择素材 */}
          {currentStep === "materials" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">选择素材</h2>
                  <p className="text-sm text-muted-foreground">
                    从收藏中选择 2-10 个相关内容作为报告素材
                  </p>
                </div>
                {selectedMaterials.length > 0 && (
                  <Badge variant="secondary">
                    已选 {selectedMaterials.length} 个
                  </Badge>
                )}
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  加载中...
                </div>
              ) : materials.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    暂无收藏内容，请先添加一些收藏
                  </p>
                  <Button asChild>
                    <Link href="/home">去添加收藏</Link>
                  </Button>
                </div>
              ) : (
                <MaterialSelector
                  materials={materials}
                  selected={selectedMaterials}
                  onChange={setSelectedMaterials}
                  maxSelection={10}
                />
              )}
            </div>
          )}

          {/* Step 2: 选择蓝图 */}
          {currentStep === "blueprint" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">选择报告蓝图</h2>
                <p className="text-sm text-muted-foreground">
                  选择一种写作风格，AI 将按此风格生成报告
                </p>
              </div>

              <BlueprintSelector
                value={selectedBlueprint}
                onChange={setSelectedBlueprint}
              />
            </div>
          )}

          {/* Step 3: 生成配置 */}
          {currentStep === "config" && selectedBlueprint && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">生成配置</h2>
                <p className="text-sm text-muted-foreground">
                  调整报告参数，自定义生成效果
                </p>
              </div>

              {/* 摘要信息 */}
              <div className="rounded-lg bg-accent/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {BLUEPRINT_DISPLAY_CONFIG[selectedBlueprint].icon}
                  </span>
                  <span className="font-medium">
                    {BLUEPRINT_DISPLAY_CONFIG[selectedBlueprint].name}
                  </span>
                  <Badge variant="outline">
                    {selectedMaterials.length} 个素材
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {BLUEPRINT_DISPLAY_CONFIG[selectedBlueprint].description}
                </p>
              </div>

              {/* 目标长度 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">目标长度</label>
                <Select
                  value={targetLength}
                  onValueChange={(v) => setTargetLength(v as TargetLength)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          {opt.label}
                          <span className="text-muted-foreground text-xs">
                            ({opt.desc})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 自定义指令 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  自定义指令（可选）
                </label>
                <Textarea
                  placeholder="添加额外的写作要求，如特定格式、重点内容等..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              {/* 配额提示 */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-sm">
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  💡 本次生成将消耗 5 配额点数
                </span>
              </div>
            </div>
          )}

          {/* 生成中 */}
          {currentStep === "generating" && (
            <div className="py-8 space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold">正在生成报告</h2>
                <p className="text-sm text-muted-foreground">
                  AI 正在处理素材并生成报告，请稍候...
                </p>
              </div>

              {generationProgress ? (
                <GenerationProgress
                  stage={generationProgress.stage}
                  stageProgress={generationProgress.stageProgress}
                  totalProgress={generationProgress.totalProgress}
                />
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  正在准备生成...
                </div>
              )}
              {generationError && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{generationError}</p>
                </div>
              )}
            </div>
          )}

          {/* 生成结果 */}
          {currentStep === "result" && (
            <div className="py-8 text-center space-y-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <span className="text-3xl">✨</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">报告生成完成！</h2>
                <p className="text-sm text-muted-foreground">
                  您的知识报告已生成，可以查看和编辑
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  生成新报告
                </Button>
                <Button
                  onClick={handleViewReport}
                  disabled={!generatedReportId}
                  title={generatedReportId ? `查看报告 ${generatedReportId}` : "报告 ID 不存在"}
                >
                  查看报告
                  {generatedReportId && (
                    <span className="ml-2 text-xs opacity-70">
                      (ID: {generatedReportId.slice(0, 8)}...)
                    </span>
                  )}
                </Button>
              </div>
              {/* 调试信息 */}
              {process.env.NODE_ENV === "development" && (
                <div className="mt-4 p-2 bg-muted rounded text-xs">
                  <p>Debug: reportId = {generatedReportId || "null"}</p>
                  <p>Debug: generationResult = {JSON.stringify(generationResult?.reportId || "null")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 底部操作栏 */}
      {currentStep !== "generating" && currentStep !== "result" && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === "materials"}
          >
            上一步
          </Button>
          <Button onClick={handleNext} disabled={!canProceed}>
            {currentStep === "config" ? (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                开始生成
              </>
            ) : (
              "下一步"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
