"use client";

/**
 * V4.2 AI 文件夹演化设置卡片
 *
 * 允许用户配置 AI 文件夹维护相关的选项：
 * - 自动分拆/合并开关
 * - 内聚度/相似度阈值
 * - 分析频率
 * - 通知偏好
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scissors,
  Merge,
  RefreshCw,
  Check,
  Loader2,
  HelpCircle,
  Bell,
  Calendar,
  FolderTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// 类型定义
// ============================================================================

export interface AIFolderSettings {
  /** 启用自动分拆建议 */
  autoSplitEnabled: boolean;
  /** 分拆通知 */
  splitNotify: boolean;
  /** 低内聚度阈值 (0.1-0.5) */
  lowCohesionThreshold: number;

  /** 启用自动合并建议 */
  autoMergeEnabled: boolean;
  /** 合并通知 */
  mergeNotify: boolean;
  /** 高相似度阈值 (0.6-0.9) */
  highSimilarityThreshold: number;

  /** 分析频率 */
  analysisFrequency: "daily" | "weekly" | "monthly";
  /** 最小文件夹书签数 (触发分拆分析) */
  minBookmarksForAnalysis: number;
}

const DEFAULT_SETTINGS: AIFolderSettings = {
  autoSplitEnabled: true,
  splitNotify: true,
  lowCohesionThreshold: 0.3,
  autoMergeEnabled: true,
  mergeNotify: true,
  highSimilarityThreshold: 0.7,
  analysisFrequency: "weekly",
  minBookmarksForAnalysis: 10,
};

interface AIFolderSettingsCardProps {
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function AIFolderSettingsCard({ className }: AIFolderSettingsCardProps) {
  const [settings, setSettings] = useState<AIFolderSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<AIFolderSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载设置
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/ai-folder");
      if (!response.ok) throw new Error("Failed to load settings");

      const data = await response.json();
      const loadedSettings: AIFolderSettings = {
        ...DEFAULT_SETTINGS,
        ...(data.data || {}),
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to load AI folder settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载 - 仅在组件挂载时执行一次
  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 检查是否有变化
  const checkChanges = useCallback(
    (newSettings: AIFolderSettings) => {
      const changed =
        JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    },
    [originalSettings],
  );

  // 更新设置
  const updateSetting = <K extends keyof AIFolderSettings>(
    key: K,
    value: AIFolderSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    checkChanges(newSettings);
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/ai-folder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      setOriginalSettings({ ...settings });
      setHasChanges(false);
      toast.success("文件夹演化设置已保存");
    } catch (error) {
      toast.error("保存失败，请重试");
      console.error("Failed to save AI folder settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 重置设置
  const handleReset = () => {
    setSettings({ ...originalSettings });
    setHasChanges(false);
  };

  // 恢复默认值
  const handleRestoreDefaults = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    checkChanges(DEFAULT_SETTINGS);
  };

  // 加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="size-5 text-purple-500" />
            文件夹智能演化
            <Badge
              variant="outline"
              className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
            >
              V4.2
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
          AI 自动分析文件夹健康度，提供分拆和合并建议
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 分拆建议设置 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Scissors className="size-4 text-amber-500" />
            分拆建议
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="auto-split-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                启用分拆建议
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        当文件夹内容过于分散（低内聚度）时，AI
                        会建议将其分拆为多个专注的文件夹
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                检测内容分散的文件夹并建议分拆
              </p>
            </div>
            <Switch
              id="auto-split-enabled"
              checked={settings.autoSplitEnabled}
              onCheckedChange={(value) =>
                updateSetting("autoSplitEnabled", value)
              }
            />
          </div>

          {/* 分拆通知 */}
          <div
            className={cn(
              "flex items-center justify-between pl-4 transition-opacity",
              !settings.autoSplitEnabled && "opacity-50",
            )}
          >
            <div className="flex-1 pr-4">
              <Label
                htmlFor="split-notify"
                className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="size-3.5" />
                分拆建议通知
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                发现可分拆文件夹时通知
              </p>
            </div>
            <Switch
              id="split-notify"
              checked={settings.splitNotify}
              disabled={!settings.autoSplitEnabled}
              onCheckedChange={(value) => updateSetting("splitNotify", value)}
            />
          </div>

          {/* 内聚度阈值 */}
          <div
            className={cn(
              "space-y-2 pl-4 transition-opacity",
              !settings.autoSplitEnabled && "opacity-50",
            )}
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                低内聚度阈值
                <span className="ml-2 text-muted-foreground">
                  {Math.round(settings.lowCohesionThreshold * 100)}%
                </span>
              </Label>
            </div>
            <Slider
              value={[settings.lowCohesionThreshold * 100]}
              min={10}
              max={50}
              step={5}
              disabled={!settings.autoSplitEnabled}
              onValueChange={([value]) =>
                updateSetting("lowCohesionThreshold", value / 100)
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              内聚度低于此值时建议分拆（更低 = 更敏感）
            </p>
          </div>
        </div>

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 合并建议设置 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Merge className="size-4 text-blue-500" />
            合并建议
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="auto-merge-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                启用合并建议
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        当两个文件夹内容高度相似时，AI
                        会建议将它们合并以减少重复
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                检测相似文件夹并建议合并
              </p>
            </div>
            <Switch
              id="auto-merge-enabled"
              checked={settings.autoMergeEnabled}
              onCheckedChange={(value) =>
                updateSetting("autoMergeEnabled", value)
              }
            />
          </div>

          {/* 合并通知 */}
          <div
            className={cn(
              "flex items-center justify-between pl-4 transition-opacity",
              !settings.autoMergeEnabled && "opacity-50",
            )}
          >
            <div className="flex-1 pr-4">
              <Label
                htmlFor="merge-notify"
                className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="size-3.5" />
                合并建议通知
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                发现可合并文件夹时通知
              </p>
            </div>
            <Switch
              id="merge-notify"
              checked={settings.mergeNotify}
              disabled={!settings.autoMergeEnabled}
              onCheckedChange={(value) => updateSetting("mergeNotify", value)}
            />
          </div>

          {/* 相似度阈值 */}
          <div
            className={cn(
              "space-y-2 pl-4 transition-opacity",
              !settings.autoMergeEnabled && "opacity-50",
            )}
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                高相似度阈值
                <span className="ml-2 text-muted-foreground">
                  {Math.round(settings.highSimilarityThreshold * 100)}%
                </span>
              </Label>
            </div>
            <Slider
              value={[settings.highSimilarityThreshold * 100]}
              min={60}
              max={90}
              step={5}
              disabled={!settings.autoMergeEnabled}
              onValueChange={([value]) =>
                updateSetting("highSimilarityThreshold", value / 100)
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              相似度高于此值时建议合并（更高 = 更保守）
            </p>
          </div>
        </div>

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 分析设置 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="size-4" />
            分析设置
          </div>

          {/* 分析频率 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label className="text-sm font-medium">分析频率</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI 分析文件夹健康度的周期
              </p>
            </div>
            <Select
              value={settings.analysisFrequency}
              onValueChange={(value: "daily" | "weekly" | "monthly") =>
                updateSetting("analysisFrequency", value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每周</SelectItem>
                <SelectItem value="monthly">每月</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 最小书签数 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                分析最小书签数
                <span className="ml-2 text-muted-foreground">
                  {settings.minBookmarksForAnalysis} 个
                </span>
              </Label>
            </div>
            <Slider
              value={[settings.minBookmarksForAnalysis]}
              min={5}
              max={30}
              step={5}
              onValueChange={([value]) =>
                updateSetting("minBookmarksForAnalysis", value)
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              文件夹书签数少于此值时跳过分析
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 恢复默认 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestoreDefaults}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            恢复默认设置
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AIFolderSettingsCard;
