/**
 * 自动快照设置组件 (P2-010)
 * 用于设置页面配置自动快照触发规则
 */

"use client";

import { useState } from "react";
import { Camera, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAutoSnapshotSettings } from "@/hooks/domain/bookmark";
import { useSnapshotFeature } from "@/lib/feature-flags";
import { USAGE_TAG_PRESETS } from "@/lib/constants/usage-tags";
import {
  RECOMMENDED_TRIGGER_TAGS,
  CONFIRM_DELAY_OPTIONS,
} from "@/lib/constants/auto-snapshot";
import type { SnapshotType } from "@/lib/snapshot/snapshot.types";

// ============================================================================
// 类型定义
// ============================================================================

export interface AutoSnapshotSettingsProps {
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function AutoSnapshotSettings({ className }: AutoSnapshotSettingsProps) {
  const isSnapshotFeatureEnabled = useSnapshotFeature();
  const { settings, updateSettings, resetToDefaults, isLoading } =
    useAutoSnapshotSettings();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 如果快照功能未启用，不显示此组件
  if (!isSnapshotFeatureEnabled) {
    return null;
  }

  // 切换触发标签
  const handleToggleTag = async (tagValue: string, checked: boolean) => {
    setIsSaving(true);
    try {
      const newTags = checked
        ? [...settings.triggerTags, tagValue]
        : settings.triggerTags.filter((t) => t !== tagValue);

      await updateSettings({ triggerTags: newTags });
      toast.success(checked ? "已添加触发标签" : "已移除触发标签");
    } catch (error) {
      toast.error("保存失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 切换功能开关
  const handleToggleEnabled = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      await updateSettings({ enabled });
      toast.success(enabled ? "自动快照已启用" : "自动快照已关闭");
    } catch {
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 更新快照类型
  const handleSnapshotTypeChange = async (value: string) => {
    setIsSaving(true);
    try {
      await updateSettings({ snapshotType: value as SnapshotType });
      toast.success("快照类型已更新");
    } catch {
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 更新高级选项
  const handleAdvancedOptionChange = async (
    key: keyof typeof settings,
    value: boolean | number,
  ) => {
    setIsSaving(true);
    try {
      await updateSettings({ [key]: value });
    } catch {
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 重置为默认设置
  const handleResetToDefaults = async () => {
    setIsSaving(true);
    try {
      await resetToDefaults();
      toast.success("已恢复默认设置");
    } catch {
      toast.error("重置失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-lg">自动快照设置</CardTitle>
        </div>
        <CardDescription>
          当添加特定用途标签时，自动为收藏创建网页快照
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 总开关 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="font-medium">自动快照</p>
            <p className="text-sm text-muted-foreground">
              标记特定标签时自动创建快照
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={isLoading || isSaving}
          />
        </div>

        {settings.enabled && (
          <>
            {/* 触发标签选择 */}
            <div className="space-y-3">
              <p className="font-medium">触发标签</p>
              <p className="text-sm text-muted-foreground">
                选择哪些用途标签会触发自动快照
              </p>
              <div className="space-y-2 rounded-lg border p-4">
                {USAGE_TAG_PRESETS.map((preset) => {
                  const isChecked = settings.triggerTags.includes(preset.value);
                  const recommendation = RECOMMENDED_TRIGGER_TAGS.find(
                    (r) => r.value === preset.value,
                  );

                  return (
                    <div
                      key={preset.value}
                      className="flex items-start gap-3 py-2"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleToggleTag(preset.value, !!checked)
                        }
                        disabled={isSaving || isLoading}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-sm font-medium border",
                            preset.bgLight,
                            preset.bgDark,
                            preset.textLight,
                            preset.textDark,
                            preset.borderLight,
                            preset.borderDark,
                          )}
                        >
                          {preset.label}
                          {recommendation?.recommended && (
                            <span className="text-xs opacity-70">推荐</span>
                          )}
                        </span>
                        {recommendation && (
                          <p className="text-sm text-muted-foreground">
                            {recommendation.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 快照类型 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">快照类型</p>
                <p className="text-sm text-muted-foreground">
                  基础类型提取正文，节省配额
                </p>
              </div>
              <Select
                value={settings.snapshotType}
                onValueChange={handleSnapshotTypeChange}
                disabled={isSaving || isLoading}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">基础</SelectItem>
                  <SelectItem value="standard">
                    <span className="flex items-center gap-1">
                      标准
                      <span className="text-xs text-muted-foreground">Pro</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="full">
                    <span className="flex items-center gap-1">
                      完整
                      <span className="text-xs text-muted-foreground">Pro</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 高级选项 */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isAdvancedOpen && "rotate-180",
                  )}
                />
                高级选项
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4 pl-6 border-l-2 border-muted">
                {/* 显示确认提示 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium">创建前显示提示</p>
                    <p className="text-sm text-muted-foreground">
                      显示 Toast 并提供取消机会
                    </p>
                  </div>
                  <Switch
                    checked={settings.showConfirmToast}
                    onCheckedChange={(checked) =>
                      handleAdvancedOptionChange("showConfirmToast", checked)
                    }
                    disabled={isSaving || isLoading}
                  />
                </div>

                {/* 确认延迟 */}
                {settings.showConfirmToast && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-medium">确认延迟</p>
                      <p className="text-sm text-muted-foreground">
                        取消窗口时间
                      </p>
                    </div>
                    <Select
                      value={String(settings.confirmDelayMs)}
                      onValueChange={(value) =>
                        handleAdvancedOptionChange(
                          "confirmDelayMs",
                          Number(value),
                        )
                      }
                      disabled={isSaving || isLoading}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONFIRM_DELAY_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 配额不足时静默 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium">配额不足时静默跳过</p>
                    <p className="text-sm text-muted-foreground">
                      关闭后会显示升级提示
                    </p>
                  </div>
                  <Switch
                    checked={settings.silentOnQuotaExceeded}
                    onCheckedChange={(checked) =>
                      handleAdvancedOptionChange(
                        "silentOnQuotaExceeded",
                        checked,
                      )
                    }
                    disabled={isSaving || isLoading}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* 操作按钮 */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefaults}
                disabled={isSaving || isLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                恢复默认
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AutoSnapshotSettings;
