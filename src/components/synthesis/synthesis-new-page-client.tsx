/**
 * 综述生成引导页客户端组件
 *
 * 功能：
 * - 选择来源（文件夹、标签、手动选择）
 * - 选择具体来源（文件夹选择器、标签选择器、书签选择器）
 * - 预览和筛选书签
 * - 选择深度模式（快读、标准、学术）
 * - 选择输出风格（概要、叙事、对比、批判）
 * - 启动生成并跳转到进度页
 * - 支持 URL 参数预填（sourceType, tag, folderId）
 *
 * @version 2.1.0
 * @since 2025-12-29
 * @updated 2026-01-01 - 集成来源选择器组件 [E1]
 * @updated 2026-01-01 - 添加输出风格选择 [S1]
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Folder,
  Tag,
  CheckSquare,
  Zap,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  SynthesisSourceType,
  SynthesisDepthMode,
  SynthesisOutputStyle,
} from "@/lib/synthesis";
import { SYNTHESIS_STYLE_CONFIGS } from "@/lib/synthesis";
import {
  FolderPicker,
  TagPicker,
  ManualSelector,
  type SourceSelection,
  type ContentStats,
} from "./source-selector";
import { BookmarkPreviewList } from "./bookmark-preview-list";
import { StyleSelector } from "./style-selector";
import {
  ContentQualityCard,
  calculateQualityAssessment,
} from "./content-quality-card";

// 来源类型配置
const SOURCE_TYPES = [
  {
    id: "folder" as SynthesisSourceType,
    label: "从文件夹",
    description: "选择一个文件夹中的所有书签",
    icon: Folder,
  },
  {
    id: "tag" as SynthesisSourceType,
    label: "从标签",
    description: "选择一个标签下的所有书签",
    icon: Tag,
  },
  {
    id: "selection" as SynthesisSourceType,
    label: "手动选择",
    description: "从书签列表中手动选择",
    icon: CheckSquare,
  },
];

// 深度模式配置
const DEPTH_MODES = [
  {
    id: "quick" as SynthesisDepthMode,
    label: "快读模式",
    description: "3-5 句概要，快速了解主题",
    icon: Zap,
    baseTime: 1,
    timePerSource: 0.1,
    tokensPerSource: 500,
    cost: "免费",
    color: "text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-200 dark:border-yellow-900",
  },
  {
    id: "standard" as SynthesisDepthMode,
    label: "标准模式",
    description: "完整四维输出（共识/分歧/盲区）",
    icon: BookOpen,
    baseTime: 3,
    timePerSource: 0.3,
    tokensPerSource: 1500,
    cost: "免费",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-900",
  },
  {
    id: "academic" as SynthesisDepthMode,
    label: "学术模式",
    description: "深度分析，详细论证和引用",
    icon: GraduationCap,
    baseTime: 5,
    timePerSource: 0.5,
    tokensPerSource: 3000,
    cost: "会员",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-900",
  },
];

// 步骤定义
type Step = 1 | 1.5 | 2 | 3 | 4;

/**
 * 估算生成时间和成本
 */
function estimateTimeAndCost(
  depthMode: SynthesisDepthMode,
  sourceCount: number,
): { time: string; tokens: number; cost: string } {
  const mode = DEPTH_MODES.find((m) => m.id === depthMode);
  if (!mode) {
    return { time: "未知", tokens: 0, cost: "未知" };
  }

  const effectiveSources = Math.max(sourceCount || 5, 1);
  const totalMinutes = mode.baseTime + mode.timePerSource * effectiveSources;
  const time =
    totalMinutes < 1 ? "< 1 分钟" : `~${Math.round(totalMinutes)} 分钟`;

  const tokens = mode.tokensPerSource * effectiveSources;

  return { time, tokens, cost: mode.cost };
}

/**
 * 综述生成引导页客户端组件
 */
export function SynthesisNewPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 参数读取预设值
  const urlSourceType = searchParams?.get(
    "sourceType",
  ) as SynthesisSourceType | null;
  const urlTag = searchParams?.get("tag");
  const urlFolderId = searchParams?.get("folderId");

  // 步骤状态
  const [step, setStep] = useState<Step>(urlSourceType ? 2 : 1);

  // 来源选择状态
  const [sourceType, setSourceType] = useState<SynthesisSourceType | null>(
    urlSourceType,
  );
  const [sourceSelection, setSourceSelection] =
    useState<SourceSelection | null>(null);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);

  // 深度模式和创建状态
  const [depthMode, setDepthMode] = useState<SynthesisDepthMode>("standard");
  const [outputStyle, setOutputStyle] =
    useState<SynthesisOutputStyle>("narrative");
  const [isCreating, setIsCreating] = useState(false);

  // 计算有效书签数量
  const effectiveBookmarkCount = useMemo(() => {
    if (sourceSelection?.sourceType === "selection") {
      return sourceSelection.bookmarkIds.length - excludedIds.length;
    }
    return (contentStats?.totalCount || 0) - excludedIds.length;
  }, [sourceSelection, contentStats, excludedIds]);

  // [E2] 计算质量评估
  const qualityAssessment = useMemo(() => {
    if (!contentStats) return null;
    return calculateQualityAssessment(contentStats, excludedIds.length);
  }, [contentStats, excludedIds.length]);

  // 获取步骤显示
  const getStepDisplay = useCallback(() => {
    if (step === 1) return "1 / 4";
    if (step === 1.5) return "2 / 4";
    if (step === 2) return "3 / 4";
    if (step === 3) return "3 / 4";
    return "4 / 4";
  }, [step]);

  // 处理来源类型选择
  const handleSourceTypeSelect = useCallback((type: SynthesisSourceType) => {
    setSourceType(type);
    setSourceSelection(null);
    setExcludedIds([]);
    setContentStats(null);
    setStep(1.5);
  }, []);

  // 处理来源选择完成
  const handleSourceSelect = useCallback((selection: SourceSelection) => {
    setSourceSelection(selection);
    setContentStats(selection.contentStats);
    setStep(2);
  }, []);

  // 处理来源选择取消
  const handleSourceCancel = useCallback(() => {
    setStep(1);
    setSourceType(null);
  }, []);

  // 获取来源描述
  const getSourceDescription = useCallback(() => {
    if (sourceSelection) {
      return sourceSelection.sourceName;
    }
    if (sourceType === "tag" && urlTag) {
      return `#${urlTag}`;
    }
    if (sourceType === "folder" && urlFolderId) {
      return `文件夹 ID: ${urlFolderId}`;
    }
    return SOURCE_TYPES.find((t) => t.id === sourceType)?.label || "";
  }, [sourceSelection, sourceType, urlTag, urlFolderId]);

  // 处理创建综述
  const handleCreate = useCallback(async () => {
    if (!sourceType || !depthMode) return;

    setIsCreating(true);

    try {
      // 构建请求参数
      const requestBody: Record<string, unknown> = {
        sourceType,
        depthMode,
        outputStyle, // [S1] 添加输出风格
      };

      if (sourceSelection) {
        if (sourceSelection.sourceId) {
          requestBody.sourceId = sourceSelection.sourceId;
        }
        if (sourceSelection.sourceType === "selection") {
          // 排除已排除的书签
          const effectiveIds = sourceSelection.bookmarkIds.filter(
            (id) => !excludedIds.includes(id),
          );
          requestBody.bookmarkIds = effectiveIds;
        }
      }

      // 如果有排除的书签，需要传递有效的书签 ID 列表
      if (excludedIds.length > 0 && sourceType !== "selection") {
        requestBody.excludedBookmarkIds = excludedIds;
      }

      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      console.error("Create synthesis error:", error);
    } finally {
      setIsCreating(false);
    }
  }, [
    sourceType,
    sourceSelection,
    excludedIds,
    depthMode,
    outputStyle,
    router,
  ]);

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/synthesis">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">创建综述</h1>
          <p className="text-sm text-muted-foreground">
            步骤 {getStepDisplay()}
          </p>
        </div>
      </div>

      {/* 步骤 1: 选择来源类型 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>选择书签来源</CardTitle>
            <CardDescription>选择要合成的书签来源</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SOURCE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleSourceTypeSelect(type.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg border transition-colors",
                  "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary",
                  sourceType === type.id && "border-primary bg-primary/5",
                )}
              >
                <div className="rounded-lg bg-muted p-2">
                  <type.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{type.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {type.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 步骤 1.5: 选择具体来源 */}
      {step === 1.5 && sourceType && (
        <Card>
          <CardHeader>
            <CardTitle>
              {sourceType === "folder" && "选择文件夹"}
              {sourceType === "tag" && "选择标签"}
              {sourceType === "selection" && "选择书签"}
            </CardTitle>
            <CardDescription>
              {sourceType === "folder" && "选择包含待综述书签的文件夹"}
              {sourceType === "tag" && "选择用于筛选书签的标签"}
              {sourceType === "selection" && "从列表中选择要综述的书签"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sourceType === "folder" && (
              <FolderPicker
                onSelect={handleSourceSelect}
                onCancel={handleSourceCancel}
                initialFolderId={urlFolderId || undefined}
              />
            )}
            {sourceType === "tag" && (
              <TagPicker
                onSelect={handleSourceSelect}
                onCancel={handleSourceCancel}
                initialTag={urlTag || undefined}
              />
            )}
            {sourceType === "selection" && (
              <ManualSelector
                onSelect={handleSourceSelect}
                onCancel={handleSourceCancel}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 预览书签并选择深度 */}
      {step === 2 && sourceSelection && (
        <Card>
          <CardHeader>
            <CardTitle>预览与设置</CardTitle>
            <CardDescription>
              预览书签列表，排除不需要的内容，选择综述深度
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 书签预览列表 */}
            <BookmarkPreviewList
              sourceType={sourceSelection.sourceType}
              sourceId={sourceSelection.sourceId}
              bookmarkIds={
                sourceSelection.sourceType === "selection"
                  ? sourceSelection.bookmarkIds
                  : undefined
              }
              excludedIds={excludedIds}
              onExcludedChange={setExcludedIds}
              onStatsChange={setContentStats}
              maxHeight={200}
            />

            {/* [E2] 内容质量评估卡片 */}
            <ContentQualityCard
              stats={contentStats}
              excludedCount={excludedIds.length}
            />

            {/* 深度选择 */}
            <div className="space-y-3">
              <div className="text-sm font-medium">选择综述深度</div>
              <RadioGroup
                value={depthMode}
                onValueChange={(value) =>
                  setDepthMode(value as SynthesisDepthMode)
                }
              >
                {DEPTH_MODES.map((mode) => {
                  const estimate = estimateTimeAndCost(
                    mode.id,
                    effectiveBookmarkCount,
                  );
                  return (
                    <label
                      key={mode.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
                        mode.bgColor,
                        mode.borderColor,
                        depthMode === mode.id && "ring-2 ring-primary",
                      )}
                    >
                      <RadioGroupItem value={mode.id} />
                      <div className={cn("rounded-lg p-2", mode.bgColor)}>
                        <mode.icon className={cn("h-5 w-5", mode.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{mode.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {mode.description}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">{estimate.time}</p>
                        <p
                          className={
                            mode.cost === "会员"
                              ? "text-purple-500"
                              : "text-green-500"
                          }
                        >
                          {mode.cost}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* 风格选择 [S1] */}
            <StyleSelector value={outputStyle} onChange={setOutputStyle} />

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1.5)}>
                上一步
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!qualityAssessment?.canGenerate}
              >
                下一步
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 3: 确认并生成 */}
      {step === 3 && sourceSelection && (
        <Card>
          <CardHeader>
            <CardTitle>确认生成</CardTitle>
            <CardDescription>检查设置并开始生成综述</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const estimate = estimateTimeAndCost(
                depthMode,
                effectiveBookmarkCount,
              );
              const currentMode = DEPTH_MODES.find((m) => m.id === depthMode);
              const currentStyle = SYNTHESIS_STYLE_CONFIGS[outputStyle];
              return (
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">来源</span>
                    <span className="font-medium">
                      {getSourceDescription()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b items-center">
                    <span className="text-muted-foreground">书签数量</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {effectiveBookmarkCount} 篇
                      </Badge>
                      {excludedIds.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          (已排除 {excludedIds.length})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">综述深度</span>
                    <span className="font-medium">{currentMode?.label}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">输出风格</span>
                    <span className="font-medium">
                      {currentStyle.icon} {currentStyle.name}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">预计时间</span>
                    <span className="font-medium">{estimate.time}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">预计消耗</span>
                    <span className="font-medium text-muted-foreground">
                      ~{estimate.tokens.toLocaleString()} Tokens
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">费用</span>
                    <span
                      className={
                        currentMode?.cost === "会员"
                          ? "font-medium text-purple-500"
                          : "font-medium text-green-500"
                      }
                    >
                      {estimate.cost}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                上一步
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "开始生成"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
