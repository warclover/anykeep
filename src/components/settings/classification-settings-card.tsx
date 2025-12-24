/**
 * V3.0 智能分类设置卡片组件
 *
 * 允许用户配置智能分类相关的个性化选项：
 * - 自动创建文件夹开关
 * - 回溯分类开关
 * - 置信度阈值调整
 * - 通知偏好
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
  FolderPlus,
  RefreshCw,
  Sparkles,
  Check,
  Loader2,
  HelpCircle,
  Undo2,
  Bell,
  Gauge,
  Layout,
  PanelRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户分类设置
 */
export interface ClassificationSettings {
  /** 启用自动创建文件夹 */
  autoCreateEnabled: boolean;

  /** 自动创建时是否通知 */
  autoCreateNotify: boolean;

  /** 启用回溯分类 */
  backfillEnabled: boolean;

  /** 回溯分类时是否通知 */
  backfillNotify: boolean;

  /** 高置信度阈值 (60-95) */
  highConfidenceThreshold: number;

  /** 启用通用分类 */
  universalCategoriesEnabled: boolean;

  /** 每日自动创建限额 (1-5) */
  dailyAutoCreateLimit: number;
}

/**
 * 默认分类设置
 */
const DEFAULT_SETTINGS: ClassificationSettings = {
  autoCreateEnabled: true,
  autoCreateNotify: true,
  backfillEnabled: true,
  backfillNotify: true,
  highConfidenceThreshold: 80,
  universalCategoriesEnabled: true,
  dailyAutoCreateLimit: 3,
};

interface ClassificationSettingsCardProps {
  className?: string;
}

// ============================================================================
// 待确认消息显示模式相关
// ============================================================================

const DISPLAY_MODE_STORAGE_KEY = "anykeep:confirmation-display-mode";

type DisplayMode = "inline" | "drawer";

interface DisplayModeConfig {
  mode: DisplayMode;
  autoConfirmThreshold?: number;
}

const DEFAULT_DISPLAY_CONFIG: DisplayModeConfig = {
  mode: "inline",
  autoConfirmThreshold: undefined,
};

/**
 * 从 localStorage 读取显示模式配置
 */
function loadDisplayModeConfig(): DisplayModeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_DISPLAY_CONFIG;
  }

  try {
    const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_DISPLAY_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // localStorage 读取失败，使用默认配置
  }

  return DEFAULT_DISPLAY_CONFIG;
}

/**
 * 保存显示模式配置到 localStorage
 */
function saveDisplayModeConfig(config: DisplayModeConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage 保存失败，静默忽略
  }
}

// ============================================================================
// 组件实现
// ============================================================================

export function ClassificationSettingsCard({
  className,
}: ClassificationSettingsCardProps) {
  const [settings, setSettings] =
    useState<ClassificationSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<ClassificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 显示模式状态（独立于其他设置，使用 localStorage）
  const [displayMode, setDisplayMode] = useState<DisplayMode>("inline");

  // 加载设置
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_CLASSIFICATION.settings);
      if (!response.ok) throw new Error("Failed to load settings");

      const data = await response.json();
      const loadedSettings: ClassificationSettings = {
        ...DEFAULT_SETTINGS,
        ...(data.data || {}),
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setHasChanges(false);
    } catch (error) {
      // 使用默认设置
      clientLogger.error(
        { error },
        "[ClassificationSettingsCard] Failed to load classification settings",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 加载显示模式（从 localStorage）
  useEffect(() => {
    const config = loadDisplayModeConfig();
    setDisplayMode(config.mode);
  }, []);

  // 更新显示模式
  const handleDisplayModeChange = (mode: DisplayMode) => {
    setDisplayMode(mode);
    saveDisplayModeConfig({ mode });
    toast.success(
      `已切换为${mode === "inline" ? "内联通知条" : "浮动按钮"}模式`,
    );
  };

  // 检查是否有变化
  const checkChanges = useCallback(
    (newSettings: ClassificationSettings) => {
      const changed =
        JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
    },
    [originalSettings],
  );

  // 更新设置
  const updateSetting = <K extends keyof ClassificationSettings>(
    key: K,
    value: ClassificationSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    checkChanges(newSettings);
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(API_CLASSIFICATION.settings, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      setOriginalSettings({ ...settings });
      setHasChanges(false);
      toast.success("分类设置已保存");
    } catch (error) {
      toast.error("保存失败，请重试");
      clientLogger.error(
        { error },
        "[ClassificationSettingsCard] Failed to save classification settings",
      );
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
            <Sparkles className="size-5 text-indigo-500" />
            智能分类设置
            <Badge
              variant="outline"
              className="ml-1 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-xs"
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
          配置 AI 智能分类的行为和阈值，优化你的收藏整理体验
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 自动创建文件夹 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FolderPlus className="size-4" />
            自动创建文件夹
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="auto-create-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                启用自动创建
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        当收藏内容不匹配任何现有文件夹，但属于明确的内容类别时，
                        AI 会自动创建合适的文件夹
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI 会在合适时机自动创建新文件夹
              </p>
            </div>
            <Switch
              id="auto-create-enabled"
              checked={settings.autoCreateEnabled}
              onCheckedChange={(value) =>
                updateSetting("autoCreateEnabled", value)
              }
            />
          </div>

          {/* 创建通知 */}
          <div
            className={cn(
              "flex items-center justify-between pl-4 transition-opacity",
              !settings.autoCreateEnabled && "opacity-50",
            )}
          >
            <div className="flex-1 pr-4">
              <Label
                htmlFor="auto-create-notify"
                className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="size-3.5" />
                创建后通知
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                自动创建文件夹后显示通知，支持撤销
              </p>
            </div>
            <Switch
              id="auto-create-notify"
              checked={settings.autoCreateNotify}
              disabled={!settings.autoCreateEnabled}
              onCheckedChange={(value) =>
                updateSetting("autoCreateNotify", value)
              }
            />
          </div>

          {/* 每日限额 */}
          <div
            className={cn(
              "space-y-2 pl-4 transition-opacity",
              !settings.autoCreateEnabled && "opacity-50",
            )}
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                每日创建限额
                <span className="ml-2 text-muted-foreground">
                  {settings.dailyAutoCreateLimit} 个
                </span>
              </Label>
            </div>
            <Slider
              value={[settings.dailyAutoCreateLimit]}
              min={1}
              max={5}
              step={1}
              disabled={!settings.autoCreateEnabled}
              onValueChange={([value]) =>
                updateSetting("dailyAutoCreateLimit", value)
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              每天最多自动创建的文件夹数量
            </p>
          </div>
        </div>

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 回溯分类 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Undo2 className="size-4" />
            回溯分类
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label
                htmlFor="backfill-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                启用回溯分类
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        当创建新文件夹后，AI 会自动检查「待整理」中的内容，
                        将匹配的内容自动归类到新文件夹
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                新建文件夹后自动整理待分类内容
              </p>
            </div>
            <Switch
              id="backfill-enabled"
              checked={settings.backfillEnabled}
              onCheckedChange={(value) =>
                updateSetting("backfillEnabled", value)
              }
            />
          </div>

          {/* 回溯通知 */}
          <div
            className={cn(
              "flex items-center justify-between pl-4 transition-opacity",
              !settings.backfillEnabled && "opacity-50",
            )}
          >
            <div className="flex-1 pr-4">
              <Label
                htmlFor="backfill-notify"
                className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="size-3.5" />
                回溯后通知
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                自动整理后显示通知，支持一键撤销
              </p>
            </div>
            <Switch
              id="backfill-notify"
              checked={settings.backfillNotify}
              disabled={!settings.backfillEnabled}
              onCheckedChange={(value) =>
                updateSetting("backfillNotify", value)
              }
            />
          </div>
        </div>

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 置信度阈值 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Gauge className="size-4" />
            分类精度
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                自动分类阈值
                <span className="ml-2 text-muted-foreground">
                  {settings.highConfidenceThreshold}%
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        只有当 AI 的分类置信度超过此阈值时，才会自动分类。
                        更高的阈值意味着更准确但更保守的分类。
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
            <Slider
              value={[settings.highConfidenceThreshold]}
              min={60}
              max={95}
              step={5}
              onValueChange={([value]) =>
                updateSetting("highConfidenceThreshold", value)
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>更多自动 (60%)</span>
              <span>更高精度 (95%)</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 待确认消息显示模式 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Layout className="size-4" />
            待确认消息显示
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <Label className="text-sm font-medium">
                显示模式
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        内联模式：在首页顶部显示紧凑通知条
                        <br />
                        浮动按钮：在右下角显示浮动按钮，点击展开抽屉
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                选择 AI 分类建议的展示方式
              </p>
            </div>
            <Select
              value={displayMode}
              onValueChange={(v) => handleDisplayModeChange(v as DisplayMode)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">
                  <div className="flex items-center gap-2">
                    <Layout className="size-4" />
                    <span>内联通知条</span>
                  </div>
                </SelectItem>
                <SelectItem value="drawer">
                  <div className="flex items-center gap-2">
                    <PanelRight className="size-4" />
                    <span>浮动按钮</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 通用分类 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <Label
              htmlFor="universal-categories"
              className="text-sm font-medium cursor-pointer"
            >
              启用通用分类体系
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="inline-block ml-1 size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      使用预设的 30 个通用内容分类，帮助 AI
                      在你没有自定义文件夹时提供智能建议
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              使用 30 个预设类别辅助分类决策
            </p>
          </div>
          <Switch
            id="universal-categories"
            checked={settings.universalCategoriesEnabled}
            onCheckedChange={(value) =>
              updateSetting("universalCategoriesEnabled", value)
            }
          />
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

export default ClassificationSettingsCard;
