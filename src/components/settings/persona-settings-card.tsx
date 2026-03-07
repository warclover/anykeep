/**
 * 用户画像设置卡片组件
 *
 * 允许用户查看和配置 AI 识别的用户画像：
 * - 查看 AI 推断结果
 * - 手动选择画像类型
 * - 配置响应偏好
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, RefreshCw, Sparkles, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  usePersonaInference,
  usePersonaSettings,
  usePersonaMode,
} from "@/hooks/domain/ai";
import type {
  PersonaType,
  PersonaGroup,
  PersonaPreferences,
} from "@/lib/ai-agent/personas/types";
import {
  PERSONA_METADATA,
  DEFAULT_PERSONA_PREFERENCES,
} from "@/lib/ai-agent/personas/types";
import { clientLogger } from "@/lib/client-logger";

import {
  UI_TEXT,
  PERSONA_GROUPS,
  getPersonasByGroup,
} from "./persona-constants";
import { PersonaInferredSection } from "./persona-inferred-section";
import { PersonaPreferencesForm } from "./persona-preferences-form";

// ============================================================================
// 类型定义
// ============================================================================

interface PersonaSettingsCardProps {
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function PersonaSettingsCard({ className }: PersonaSettingsCardProps) {
  // Hooks
  const {
    inferredPersona,
    confidence,
    alternatives,
    storedSettings,
    bookmarkCount,
    featureEnabled,
    isLoading: isInferenceLoading,
    refresh: refreshInference,
  } = usePersonaInference();

  const { saveSettings, resetToInferred, isSaving } = usePersonaSettings();

  const {
    mode: serverMode,
    currentPersona: _currentPersona,
    currentGroup: _currentGroup,
    switchToManual: _switchToManual,
    switchToInferred: _switchToInferred,
  } = usePersonaMode();

  // 从推断结果获取分组
  const inferredGroup = inferredPersona?.group ?? null;

  // 本地状态
  const [localMode, setLocalMode] = useState<"inferred" | "manual">(serverMode);
  const [selectedGroup, setSelectedGroup] = useState<PersonaGroup | null>(null);
  const [selectedType, setSelectedType] = useState<PersonaType | null>(null);
  const [preferences, setPreferences] = useState<PersonaPreferences>(
    DEFAULT_PERSONA_PREFERENCES,
  );
  const [hasChanges, setHasChanges] = useState(false);

  // 同步服务器模式到本地模式
  useEffect(() => {
    setLocalMode(serverMode);
  }, [serverMode]);

  // 使用本地模式进行 UI 展示
  const mode = localMode;

  // 初始化本地状态
  useEffect(() => {
    if (storedSettings) {
      setSelectedGroup(storedSettings.group);
      setSelectedType(storedSettings.primaryType);
      setPreferences(storedSettings.preferences);
    } else if (inferredGroup && inferredPersona) {
      setSelectedGroup(inferredGroup);
      setSelectedType(inferredPersona.primaryType);
    }
  }, [storedSettings, inferredGroup, inferredPersona]);

  // 检查变化
  const checkChanges = useCallback(() => {
    if (!storedSettings) {
      setHasChanges(mode === "manual" && selectedType !== null);
      return;
    }

    const groupChanged = selectedGroup !== storedSettings.group;
    const typeChanged = selectedType !== storedSettings.primaryType;
    const prefsChanged =
      JSON.stringify(preferences) !==
      JSON.stringify(storedSettings.preferences);

    setHasChanges(groupChanged || typeChanged || prefsChanged);
  }, [storedSettings, selectedGroup, selectedType, preferences, mode]);

  useEffect(() => {
    checkChanges();
  }, [checkChanges]);

  // 保存处理
  const handleSave = async () => {
    if (!selectedType || !selectedGroup) {
      toast.error("请选择画像类型");
      return;
    }

    try {
      await saveSettings({
        primaryType: selectedType,
        group: selectedGroup,
        preferences,
        source: mode === "inferred" ? "inferred" : "settings",
      });
      toast.success("画像设置已保存");
      setHasChanges(false);
    } catch (error) {
      clientLogger.error({ error }, "[PersonaSettingsCard] Failed to save");
      toast.error("保存失败，请重试");
    }
  };

  // 重置处理
  const handleReset = async () => {
    if (storedSettings) {
      setSelectedGroup(storedSettings.group);
      setSelectedType(storedSettings.primaryType);
      setPreferences(storedSettings.preferences);
    } else {
      setSelectedGroup(inferredGroup);
      setSelectedType(inferredPersona?.primaryType ?? null);
      setPreferences(DEFAULT_PERSONA_PREFERENCES);
    }
    setHasChanges(false);
  };

  // 恢复默认
  const handleRestoreDefaults = async () => {
    try {
      await resetToInferred();
      toast.success("已恢复为 AI 推断模式");
    } catch {
      toast.error("恢复失败，请重试");
    }
  };

  // 更新偏好
  const updatePreference = <K extends keyof PersonaPreferences>(
    key: K,
    value: PersonaPreferences[K],
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  // ════════════════════════════════════════════════════════════════════════
  // 加载状态骨架屏
  // ════════════════════════════════════════════════════════════════════════

  if (isInferenceLoading) {
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

  // ════════════════════════════════════════════════════════════════════════
  // 功能未启用状态
  // ════════════════════════════════════════════════════════════════════════

  if (!featureEnabled) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            {UI_TEXT.title}
            <Badge variant="secondary" className="ml-1 text-xs">
              {UI_TEXT.version}
            </Badge>
          </CardTitle>
          <CardDescription>{UI_TEXT.featureDisabled}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // 主渲染
  // ════════════════════════════════════════════════════════════════════════

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            {UI_TEXT.title}
            <Badge
              variant="outline"
              className="ml-1 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 text-xs"
            >
              {UI_TEXT.version}
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
                {UI_TEXT.resetButton}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    {UI_TEXT.saving}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    {UI_TEXT.saveButton}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        <CardDescription>{UI_TEXT.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AI 推断结果 */}
        <PersonaInferredSection
          inferredPersona={inferredPersona}
          inferredGroup={inferredGroup}
          confidence={confidence}
          alternatives={alternatives}
          bookmarkCount={bookmarkCount}
          onRefresh={refreshInference}
        />

        <Separator />

        {/* 模式选择 */}
        <div className="space-y-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <UserCog className="size-4" />
            {UI_TEXT.modeSection}
          </Label>

          <RadioGroup
            value={mode}
            onValueChange={(value) =>
              setLocalMode(value as "inferred" | "manual")
            }
            className="space-y-3"
          >
            {/* AI 推断模式 */}
            <div
              className={cn(
                "flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer",
                mode === "inferred"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50",
              )}
              onClick={() => setLocalMode("inferred")}
            >
              <RadioGroupItem value="inferred" id="inferred" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="inferred"
                  className="flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Sparkles className="size-4 text-purple-500" />
                  {UI_TEXT.useInference}
                  {mode === "inferred" && (
                    <Badge
                      variant="outline"
                      className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300"
                    >
                      当前
                    </Badge>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {UI_TEXT.useInferenceDesc}
                </p>
              </div>
            </div>

            {/* 手动选择模式 */}
            <div
              className={cn(
                "flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer",
                mode === "manual"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50",
              )}
              onClick={() => setLocalMode("manual")}
            >
              <RadioGroupItem value="manual" id="manual" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="manual"
                  className="flex items-center gap-2 cursor-pointer font-medium"
                >
                  <UserCog className="size-4 text-blue-500" />
                  {UI_TEXT.manualSelect}
                  {mode === "manual" && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300"
                    >
                      当前
                    </Badge>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {UI_TEXT.manualSelectDesc}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* 手动选择画像 */}
        {mode === "manual" && (
          <>
            <Separator />
            <div className="space-y-4">
              {/* 分组选择 */}
              <div className="space-y-2">
                <Label className="text-sm">{UI_TEXT.selectGroup}</Label>
                <div className="flex flex-wrap gap-2">
                  {PERSONA_GROUPS.map((group) => {
                    const Icon = group.icon;
                    const isSelected = selectedGroup === group.id;
                    return (
                      <Button
                        key={group.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedGroup(group.id);
                          setSelectedType(null);
                        }}
                        className={cn(
                          "flex items-center gap-1.5",
                          isSelected && "bg-primary",
                        )}
                      >
                        <Icon className="size-3.5" />
                        {group.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* 画像类型选择 */}
              {selectedGroup && (
                <div className="space-y-2">
                  <Label className="text-sm">{UI_TEXT.selectType}</Label>
                  <Select
                    value={selectedType || ""}
                    onValueChange={(value) =>
                      setSelectedType(value as PersonaType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择画像类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {getPersonasByGroup(selectedGroup).map((type) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <span>{PERSONA_METADATA[type]?.displayName}</span>
                            <span className="text-xs text-muted-foreground">
                              {PERSONA_METADATA[type]?.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </>
        )}

        <Separator />

        {/* 响应偏好 */}
        <PersonaPreferencesForm
          preferences={preferences}
          onPreferenceChange={updatePreference}
        />

        {/* 恢复默认 */}
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestoreDefaults}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            {UI_TEXT.restoreDefaults}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PersonaSettingsCard;
