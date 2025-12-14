/**
 * V3.0 摘要模式设置卡片组件
 *
 * 允许用户配置智能摘要的模式：
 * - 标准模式：生成摘要和标签
 * - 增强模式：深度分析，提取实体和关键数据
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  FileText,
  Zap,
  Brain,
  Tag,
  Users,
  BarChart3,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SummaryMode } from "@/lib/classification/types/ai-summary";

// ============================================================================
// 类型定义
// ============================================================================

interface SummaryModeInfo {
  label: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

interface SummaryModeApiResponse {
  success: boolean;
  data?: {
    mode: SummaryMode;
    modeInfo: SummaryModeInfo;
    availableModes: Array<{ value: string } & SummaryModeInfo>;
    allowModeSwitch: boolean;
  };
  error?: { message: string };
  message?: string;
}

interface SummaryModeSettingsCardProps {
  className?: string;
}

// ============================================================================
// 模式配置
// ============================================================================

const SUMMARY_MODE_OPTIONS: Array<{
  value: SummaryMode;
  label: string;
  description: string;
  icon: typeof FileText;
  iconColor: string;
  badgeColor: string;
  features: string[];
  recommended?: boolean;
}> = [
  {
    value: "standard",
    label: "标准模式",
    description: "生成摘要和标签，满足基本收藏需求",
    icon: FileText,
    iconColor: "text-blue-500",
    badgeColor:
      "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300",
    features: [
      "智能摘要（TLDR + 要点）",
      "自动标签推荐",
      "情感分析",
      "智能文件夹推荐",
    ],
  },
  {
    value: "enhanced",
    label: "增强模式",
    description: "深度分析内容，提取实体和关键数据，构建知识关联",
    icon: Brain,
    iconColor: "text-purple-500",
    badgeColor:
      "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300",
    features: [
      "全部标准模式功能",
      "实体提取（人名、公司、技术等）",
      "关键数据识别（统计数字、指标等）",
      "内容难度评估",
      "内容类型识别",
      "知识图谱关联",
    ],
    recommended: true,
  },
];

// 功能图标映射
const FEATURE_ICONS: Record<string, typeof FileText> = {
  智能摘要: FileText,
  自动标签: Tag,
  情感分析: Sparkles,
  智能文件夹: Zap,
  实体提取: Users,
  关键数据: BarChart3,
  内容难度: Brain,
  内容类型: FileText,
  知识图谱: Network,
};

function getFeatureIcon(feature: string): typeof FileText {
  for (const [key, icon] of Object.entries(FEATURE_ICONS)) {
    if (feature.includes(key)) return icon;
  }
  return Check;
}

// ============================================================================
// 组件实现
// ============================================================================

export function SummaryModeSettingsCard({
  className,
}: SummaryModeSettingsCardProps) {
  const [currentMode, setCurrentMode] = useState<SummaryMode>("standard");
  const [selectedMode, setSelectedMode] = useState<SummaryMode>("standard");
  const [allowModeSwitch, setAllowModeSwitch] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = currentMode !== selectedMode;

  // 加载设置
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/summary-mode");
      if (!response.ok) throw new Error("Failed to load settings");

      const data: SummaryModeApiResponse = await response.json();

      if (data.success && data.data) {
        setCurrentMode(data.data.mode);
        setSelectedMode(data.data.mode);
        setAllowModeSwitch(data.data.allowModeSwitch);
      }
    } catch (error) {
      console.error("Failed to load summary mode settings:", error);
      toast.error("加载摘要模式设置失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/user/summary-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      const data: SummaryModeApiResponse = await response.json();

      if (data.success) {
        setCurrentMode(selectedMode);
        toast.success(data.message || "摘要模式设置已保存");
      } else {
        throw new Error(data.error?.message || "保存失败");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请重试");
      console.error("Failed to save summary mode settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 重置设置
  const handleReset = () => {
    setSelectedMode(currentMode);
  };

  // 加载状态骨架屏
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // 不允许切换模式时的提示
  if (!allowModeSwitch) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            摘要模式
            <Badge
              variant="outline"
              className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
            >
              V3.0
            </Badge>
          </CardTitle>
          <CardDescription>当前系统配置为固定模式，无法切换</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              当前使用「
              {SUMMARY_MODE_OPTIONS.find((opt) => opt.value === currentMode)
                ?.label || currentMode}
              」模式
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            摘要模式
            <Badge
              variant="outline"
              className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
            >
              V3.0
            </Badge>
          </CardTitle>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                重置
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    保存中
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    保存更改
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          选择 AI 智能摘要的处理模式，增强模式提供更深度的内容分析
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 模式选择 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">选择摘要模式</Label>

          <RadioGroup
            value={selectedMode}
            onValueChange={(value) => setSelectedMode(value as SummaryMode)}
            className="space-y-3"
          >
            {SUMMARY_MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMode === option.value;
              const isCurrent = currentMode === option.value;

              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex flex-col rounded-lg border p-4 transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                  onClick={() => setSelectedMode(option.value)}
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <Label
                        htmlFor={option.value}
                        className="flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Icon className={cn("size-4", option.iconColor)} />
                        {option.label}
                        {option.recommended && (
                          <Badge
                            variant="outline"
                            className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300"
                          >
                            推荐
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className={option.badgeColor}
                          >
                            当前
                          </Badge>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>

                      {/* 功能列表 */}
                      <div className="pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {option.features.map((feature, idx) => {
                            const FeatureIcon = getFeatureIcon(feature);
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                              >
                                <FeatureIcon className="size-3 text-primary/60" />
                                <span>{feature}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 增强模式说明 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {selectedMode === "enhanced" && (
          <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 p-4">
            <div className="flex items-start gap-3">
              <Brain className="size-5 text-purple-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  增强模式特点
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  增强模式会对每篇内容进行深度分析，自动提取关键实体（如人名、公司、技术名词等）和数据指标，
                  并建立内容之间的知识关联。这有助于你发现知识之间的联系，构建个人知识网络。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 模式对比提示 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="flex items-center gap-1">
            <Sparkles className="size-3" />
            <span>
              切换模式后，新收藏的内容将使用新模式处理。已有内容保持不变。
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default SummaryModeSettingsCard;
