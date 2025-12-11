/**
 * V4.2 托管模式设置卡片组件
 *
 * 允许用户配置智能分类的托管模式：
 * - 全自动：AI 全权处理
 * - 半自动：低置信度需确认
 * - 手动：仅整理到待整理
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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  Loader2,
  HelpCircle,
  RefreshCw,
  Zap,
  UserCheck,
  Hand,
  TrendingUp,
  BarChart3,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TrustMode } from "@/types/trust-mode";

// ============================================================================
// 类型定义
// ============================================================================

interface TrustModeStats {
  autoDecisions: number;
  userCorrections: number;
  pendingConfirmations: number;
  correctionRate: number;
}

interface TrustModeSettings {
  mode: TrustMode;
  autoConfirmThreshold: number;
  dailyAutoLimit: number;
}

const DEFAULT_SETTINGS: TrustModeSettings = {
  mode: "full_auto",
  autoConfirmThreshold: 80,
  dailyAutoLimit: 100,
};

interface TrustModeSettingsCardProps {
  className?: string;
}

// ============================================================================
// 模式配置
// ============================================================================

const TRUST_MODE_OPTIONS = [
  {
    value: "full_auto" as TrustMode,
    label: "全自动",
    description: "AI 全权处理所有分类，低置信度内容进入待整理聚类",
    icon: Zap,
    iconColor: "text-green-500",
    badgeColor: "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300",
  },
  {
    value: "semi_auto" as TrustMode,
    label: "半自动",
    description: "高置信度自动处理，低置信度发送确认消息等待用户决定",
    icon: UserCheck,
    iconColor: "text-blue-500",
    badgeColor: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300",
  },
  {
    value: "manual" as TrustMode,
    label: "手动",
    description: "仅整理到待整理，不自动分类，适合喜欢完全掌控的用户",
    icon: Hand,
    iconColor: "text-orange-500",
    badgeColor: "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-300",
  },
];

// ============================================================================
// 组件实现
// ============================================================================

export function TrustModeSettingsCard({
  className,
}: TrustModeSettingsCardProps) {
  const [settings, setSettings] = useState<TrustModeSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<TrustModeSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<TrustModeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 加载设置
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/trust-mode");
      if (!response.ok) throw new Error("Failed to load settings");

      const data = await response.json();

      if (data.success) {
        const loadedSettings: TrustModeSettings = {
          mode: data.data.mode || "full_auto",
          autoConfirmThreshold: data.data.config?.classification?.autoConfirmThreshold || 80,
          dailyAutoLimit: data.data.config?.folder?.dailyAutoLimit || 100,
        };

        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
        setStats(data.data.stats || null);
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Failed to load trust mode settings:", error);
      toast.error("加载设置失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 检查是否有变化
  const checkChanges = useCallback(
    (newSettings: TrustModeSettings) => {
      const changed = JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    },
    [originalSettings],
  );

  // 更新设置
  const updateSetting = <K extends keyof TrustModeSettings>(
    key: K,
    value: TrustModeSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    checkChanges(newSettings);
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/trust-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: settings.mode,
          autoConfirmThreshold: settings.autoConfirmThreshold,
          dailyAutoLimit: settings.dailyAutoLimit,
        }),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      setOriginalSettings({ ...settings });
      setHasChanges(false);
      toast.success("托管模式设置已保存");
    } catch (error) {
      toast.error("保存失败，请重试");
      console.error("Failed to save trust mode settings:", error);
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

  // 当前模式配置
  const currentModeConfig = TRUST_MODE_OPTIONS.find(
    (opt) => opt.value === settings.mode,
  );

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
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
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
            <Shield className="size-5 text-purple-500" />
            托管模式
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
          选择 AI 智能分类的托管程度，平衡自动化与控制权
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 模式选择 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">选择托管模式</Label>

          <RadioGroup
            value={settings.mode}
            onValueChange={(value) => updateSetting("mode", value as TrustMode)}
            className="space-y-3"
          >
            {TRUST_MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.mode === option.value;

              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                  onClick={() => updateSetting("mode", option.value)}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={option.value}
                      className="flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Icon className={cn("size-4", option.iconColor)} />
                      {option.label}
                      {isSelected && (
                        <Badge variant="outline" className={option.badgeColor}>
                          当前
                        </Badge>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 半自动模式配置 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {settings.mode === "semi_auto" && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="size-4" />
                半自动模式配置
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    自动确认阈值
                    <span className="ml-2 text-muted-foreground">
                      {settings.autoConfirmThreshold}%
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            置信度高于此阈值的分类将自动执行，
                            低于此阈值的将发送确认消息等待你决定
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                </div>
                <Slider
                  value={[settings.autoConfirmThreshold]}
                  min={50}
                  max={95}
                  step={5}
                  onValueChange={([value]) =>
                    updateSetting("autoConfirmThreshold", value)
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>更多自动 (50%)</span>
                  <span>更多确认 (95%)</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 全自动模式配置 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {settings.mode === "full_auto" && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Zap className="size-4" />
                全自动模式配置
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    每日自动分类限额
                    <span className="ml-2 text-muted-foreground">
                      {settings.dailyAutoLimit} 条
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            每天最多自动分类的书签数量，
                            超过限额后将暂停自动分类
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                </div>
                <Slider
                  value={[settings.dailyAutoLimit]}
                  min={10}
                  max={500}
                  step={10}
                  onValueChange={([value]) =>
                    updateSetting("dailyAutoLimit", value)
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>保守 (10)</span>
                  <span>高效 (500)</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 统计信息 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stats && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="size-4" />
                使用统计
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-primary">
                    {stats.autoDecisions}
                  </div>
                  <div className="text-xs text-muted-foreground">自动决策</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {stats.userCorrections}
                  </div>
                  <div className="text-xs text-muted-foreground">用户纠正</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {stats.pendingConfirmations}
                  </div>
                  <div className="text-xs text-muted-foreground">待确认</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {((1 - stats.correctionRate) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">准确率</div>
                </div>
              </div>
            </div>
          </>
        )}

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

export default TrustModeSettingsCard;
