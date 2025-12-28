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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Sparkles,
  UserCog,
  GraduationCap,
  Briefcase,
  Palette,
  TrendingUp,
  Code2,
  PenTool,
  BookOpen,
} from "lucide-react";
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

// ============================================================================
// UI 文本常量
// ============================================================================

const UI_TEXT = {
  title: "AI 个性化",
  version: "Phase 4",
  description: "让 AI 更懂你的使用习惯和偏好",
  inferredSection: "AI 识别的你",
  basedOn: "基于你的 {count} 条收藏",
  primaryPersona: "主画像",
  confidence: "置信度",
  secondaryTraits: "次要特征",
  modeSection: "画像模式",
  useInference: "使用 AI 推断",
  useInferenceDesc: "AI 根据你的收藏行为自动识别最适合的画像",
  manualSelect: "手动选择",
  manualSelectDesc: "自己选择画像类型，覆盖 AI 推断结果",
  selectGroup: "选择分组",
  selectType: "选择画像",
  preferencesSection: "响应偏好",
  responseStyle: "响应风格",
  emojiStyle: "Emoji 风格",
  proactiveReminders: "主动提醒",
  academicCitations: "学术引用",
  saveButton: "保存设置",
  saving: "保存中...",
  saved: "已保存",
  resetButton: "重置",
  restoreDefaults: "恢复默认设置",
  insufficientData: "收藏数据不足（少于 10 条），无法推断画像",
  featureDisabled: "画像功能未启用",
} as const;

// ============================================================================
// 分组配置
// ============================================================================

const PERSONA_GROUPS = [
  {
    id: "academic" as PersonaGroup,
    icon: GraduationCap,
    name: "学术研究",
    description: "学生、教师、科研人员",
  },
  {
    id: "content" as PersonaGroup,
    icon: PenTool,
    name: "内容创作",
    description: "博主、讲师、策展人",
  },
  {
    id: "tech" as PersonaGroup,
    icon: Code2,
    name: "技术实践",
    description: "开发者、架构师、研究员",
  },
  {
    id: "professional" as PersonaGroup,
    icon: Briefcase,
    name: "专业服务",
    description: "咨询、分析、法律、医学",
  },
  {
    id: "design" as PersonaGroup,
    icon: Palette,
    name: "产品设计",
    description: "产品经理、UX、策划",
  },
  {
    id: "growth" as PersonaGroup,
    icon: TrendingUp,
    name: "自我提升",
    description: "学习、考证、转型",
  },
];

// ============================================================================
// 类型定义
// ============================================================================

interface PersonaSettingsCardProps {
  className?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

function getPersonaIcon(group: PersonaGroup) {
  const groupConfig = PERSONA_GROUPS.find((g) => g.id === group);
  return groupConfig?.icon || BookOpen;
}

function getPersonasByGroup(group: PersonaGroup): PersonaType[] {
  return (
    Object.entries(PERSONA_METADATA) as [
      PersonaType,
      (typeof PERSONA_METADATA)[PersonaType],
    ][]
  )
    .filter(([, meta]) => meta.group === group && meta.enabled)
    .map(([type]) => type);
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
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* AI 推断结果 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {inferredPersona && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="size-4 text-purple-500" />
                {UI_TEXT.inferredSection}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshInference()}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                刷新
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {UI_TEXT.basedOn.replace(
                "{count}",
                bookmarkCount.toLocaleString(),
              )}
            </div>

            {/* 主画像 */}
            <div className="rounded-lg border p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getPersonaIcon(inferredGroup!);
                    return <Icon className="size-6 text-purple-500" />;
                  })()}
                  <div>
                    <span className="font-medium">
                      {inferredPersona &&
                        PERSONA_METADATA[inferredPersona.primaryType]
                          ?.displayName}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {inferredPersona &&
                        PERSONA_METADATA[inferredPersona.primaryType]
                          ?.description}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {confidence}% {UI_TEXT.confidence}
                  </Badge>
                  <Badge className="bg-purple-500">
                    {UI_TEXT.primaryPersona}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 次要特征 */}
            {alternatives.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {UI_TEXT.secondaryTraits}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {alternatives.slice(0, 3).map(({ persona, confidence }) => (
                    <Badge key={persona} variant="outline" className="text-xs">
                      {PERSONA_METADATA[persona]?.displayName} ({confidence}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 数据不足提示 */}
        {!inferredPersona && bookmarkCount < 10 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
            <BookOpen className="mx-auto size-8 mb-2 opacity-50" />
            <p className="text-sm">{UI_TEXT.insufficientData}</p>
          </div>
        )}

        <Separator />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 模式选择 */}
        {/* ════════════════════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 手动选择画像 */}
        {/* ════════════════════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 响应偏好 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">
            {UI_TEXT.preferencesSection}
          </Label>

          <div className="grid gap-4">
            {/* 响应风格 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm">{UI_TEXT.responseStyle}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">控制 AI 响应的详细程度</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={preferences.responseStyle}
                onValueChange={(value) =>
                  updatePreference(
                    "responseStyle",
                    value as PersonaPreferences["responseStyle"],
                  )
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">简洁</SelectItem>
                  <SelectItem value="detailed">详细</SelectItem>
                  <SelectItem value="auto">自动</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emoji 风格 */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">{UI_TEXT.emojiStyle}</Label>
              <Select
                value={preferences.emojiStyle}
                onValueChange={(value) =>
                  updatePreference(
                    "emojiStyle",
                    value as PersonaPreferences["emojiStyle"],
                  )
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不使用</SelectItem>
                  <SelectItem value="minimal">适度</SelectItem>
                  <SelectItem value="rich">丰富</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 主动提醒 */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">{UI_TEXT.proactiveReminders}</Label>
              <Switch
                checked={preferences.proactiveReminders}
                onCheckedChange={(checked) =>
                  updatePreference("proactiveReminders", checked)
                }
              />
            </div>

            {/* 学术引用 */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">{UI_TEXT.academicCitations}</Label>
              <Switch
                checked={preferences.academicCitations}
                onCheckedChange={(checked) =>
                  updatePreference("academicCitations", checked)
                }
              />
            </div>
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
            {UI_TEXT.restoreDefaults}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PersonaSettingsCard;
