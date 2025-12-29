/**
 * 综述生成引导页客户端组件
 *
 * 功能：
 * - 选择来源（文件夹、标签、手动选择）
 * - 选择深度模式（快读、标准、学术）
 * - 预览选中书签
 * - 启动生成并跳转到进度页
 * - 支持 URL 参数预填（sourceType, tag, folderId）
 *
 * @version 1.1.0
 * @since 2025-12-29
 */

"use client";

import { useState, useCallback } from "react";
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
import type { SynthesisSourceType, SynthesisDepthMode } from "@/lib/synthesis";

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
    baseTime: 1, // 基础时间（分钟）
    timePerSource: 0.1, // 每个来源增加的时间
    tokensPerSource: 500, // 每个来源预估 Token
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

  // 最小来源数默认 5
  const effectiveSources = Math.max(sourceCount || 5, 1);

  // 计算时间
  const totalMinutes = mode.baseTime + mode.timePerSource * effectiveSources;
  const time =
    totalMinutes < 1
      ? "< 1 分钟"
      : totalMinutes >= 10
        ? `~${Math.round(totalMinutes)} 分钟`
        : `~${Math.round(totalMinutes)} 分钟`;

  // 计算 Token
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

  // 根据 URL 参数计算初始步骤
  const initialStep = urlSourceType ? 2 : 1;
  const initialSourceType = urlSourceType || null;
  const initialSourceId = urlTag || urlFolderId || null;

  const [step, setStep] = useState<1 | 2 | 3>(initialStep as 1 | 2 | 3);
  const [sourceType, setSourceType] = useState<SynthesisSourceType | null>(
    initialSourceType,
  );

  const [sourceId, _setSourceId] = useState<string | null>(initialSourceId);

  const [selectedBookmarkIds, _setSelectedBookmarkIds] = useState<string[]>([]);
  const [depthMode, setDepthMode] = useState<SynthesisDepthMode>("standard");
  const [isCreating, setIsCreating] = useState(false);

  // 获取来源描述
  const getSourceDescription = useCallback(() => {
    if (sourceType === "tag" && urlTag) {
      return `标签: ${urlTag}`;
    }
    if (sourceType === "folder" && urlFolderId) {
      return `文件夹 ID: ${urlFolderId}`;
    }
    return SOURCE_TYPES.find((t) => t.id === sourceType)?.label || "";
  }, [sourceType, urlTag, urlFolderId]);

  // 处理来源选择
  const handleSourceTypeSelect = useCallback((type: SynthesisSourceType) => {
    setSourceType(type);
    // TODO: 根据类型展示选择器
    setStep(2);
  }, []);

  // 处理创建综述
  const handleCreate = useCallback(async () => {
    if (!sourceType || !depthMode) return;

    setIsCreating(true);

    try {
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceId,
          bookmarkIds:
            selectedBookmarkIds.length > 0 ? selectedBookmarkIds : undefined,
          depthMode,
        }),
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();

      // 跳转到生成页面
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      console.error("Create synthesis error:", error);
      // TODO: 显示错误提示
    } finally {
      setIsCreating(false);
    }
  }, [sourceType, sourceId, selectedBookmarkIds, depthMode, router]);

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
          <p className="text-sm text-muted-foreground">步骤 {step} / 3</p>
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

      {/* 步骤 2: 选择深度模式 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>选择综述深度</CardTitle>
            <CardDescription>不同深度适合不同的阅读场景</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={depthMode}
              onValueChange={(value) =>
                setDepthMode(value as SynthesisDepthMode)
              }
            >
              {DEPTH_MODES.map((mode) => {
                const estimate = estimateTimeAndCost(mode.id, 5); // 默认估算 5 个来源
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

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button onClick={() => setStep(3)}>下一步</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 3: 确认并生成 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>确认生成</CardTitle>
            <CardDescription>检查设置并开始生成综述</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 设置摘要 */}
            {(() => {
              const estimate = estimateTimeAndCost(depthMode, 5); // 默认估算 5 个来源
              const currentMode = DEPTH_MODES.find((m) => m.id === depthMode);
              return (
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">来源类型</span>
                    <span className="font-medium">
                      {getSourceDescription()}
                    </span>
                  </div>
                  {sourceId && (
                    <div className="flex justify-between py-2 border-b items-center">
                      <span className="text-muted-foreground">选择项</span>
                      <Badge variant="secondary">{sourceId}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">综述深度</span>
                    <span className="font-medium">{currentMode?.label}</span>
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
