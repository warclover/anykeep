/**
 * 扩展画像设置卡片组件
 * 收集用户职业、使用场景等画像信息，帮助 AI 优化分类建议
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCircle,
  Check,
  Loader2,
  RefreshCw,
  Briefcase,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "@/contexts/user-context";
import { clientLogger } from "@/lib/client-logger";

/**
 * 职业/身份选项
 */
const OCCUPATION_OPTIONS = [
  { id: "developer", label: "开发者", icon: "💻" },
  { id: "designer", label: "设计师", icon: "🎨" },
  { id: "product_manager", label: "产品经理", icon: "📱" },
  { id: "marketing", label: "市场/运营", icon: "📢" },
  { id: "student", label: "学生", icon: "📚" },
  { id: "researcher", label: "研究员", icon: "🔬" },
  { id: "entrepreneur", label: "创业者", icon: "🚀" },
  { id: "freelancer", label: "自由职业", icon: "🏠" },
  { id: "other", label: "其他", icon: "👤" },
] as const;

type OccupationId = (typeof OCCUPATION_OPTIONS)[number]["id"];

/**
 * 使用场景选项
 */
const SCENARIO_OPTIONS = [
  {
    id: "work_learning",
    label: "工作学习",
    icon: "💼",
    description: "专业技能提升、工作参考资料",
  },
  {
    id: "hobby_interest",
    label: "兴趣爱好",
    icon: "🎯",
    description: "个人兴趣、休闲娱乐内容",
  },
  {
    id: "investment",
    label: "投资理财",
    icon: "💰",
    description: "财经资讯、投资分析",
  },
  {
    id: "reading",
    label: "阅读收藏",
    icon: "📖",
    description: "文章、书评、知识收集",
  },
  {
    id: "shopping",
    label: "购物清单",
    icon: "🛒",
    description: "产品比较、购物灵感",
  },
  {
    id: "travel",
    label: "旅行攻略",
    icon: "✈️",
    description: "旅行计划、目的地参考",
  },
] as const;

type ScenarioId = (typeof SCENARIO_OPTIONS)[number]["id"];

/**
 * 用户画像数据结构
 */
interface UserProfile {
  occupation: OccupationId | null;
  scenarios: ScenarioId[];
}

interface ProfileSettingsCardProps {
  className?: string;
}

export function ProfileSettingsCard({ className }: ProfileSettingsCardProps) {
  const { profile, refetch } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile>({
    occupation: null,
    scenarios: [],
  });
  const [originalProfile, setOriginalProfile] = useState<UserProfile>({
    occupation: null,
    scenarios: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 从 profile.settings 加载用户画像
  const loadProfile = useCallback(() => {
    setIsLoading(true);
    try {
      const settings = profile?.settings as Record<string, unknown> | null;
      const savedProfile: UserProfile = {
        occupation: (settings?.occupation as OccupationId) || null,
        scenarios: (settings?.scenarios as ScenarioId[]) || [],
      };
      setUserProfile(savedProfile);
      setOriginalProfile(savedProfile);
      setHasChanges(false);
    } catch (error) {
      clientLogger.error(
        { error },
        "[ProfileSettingsCard] Failed to load profile",
      );
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 检查是否有更改
  const checkChanges = useCallback(
    (newProfile: UserProfile) => {
      const changed =
        newProfile.occupation !== originalProfile.occupation ||
        JSON.stringify(newProfile.scenarios.sort()) !==
          JSON.stringify(originalProfile.scenarios.sort());
      setHasChanges(changed);
    },
    [originalProfile],
  );

  // 选择职业
  const selectOccupation = (occupationId: OccupationId) => {
    const newProfile = {
      ...userProfile,
      occupation: userProfile.occupation === occupationId ? null : occupationId,
    };
    setUserProfile(newProfile);
    checkChanges(newProfile);
  };

  // 切换使用场景
  const toggleScenario = (scenarioId: ScenarioId) => {
    let newScenarios: ScenarioId[];
    if (userProfile.scenarios.includes(scenarioId)) {
      newScenarios = userProfile.scenarios.filter((id) => id !== scenarioId);
    } else if (userProfile.scenarios.length < 4) {
      newScenarios = [...userProfile.scenarios, scenarioId];
    } else {
      toast.warning("最多只能选择 4 个使用场景");
      return;
    }

    const newProfile = { ...userProfile, scenarios: newScenarios };
    setUserProfile(newProfile);
    checkChanges(newProfile);
  };

  // 保存画像设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupation: userProfile.occupation,
          scenarios: userProfile.scenarios,
        }),
      });

      if (!response.ok) throw new Error("Failed to save profile");

      setOriginalProfile({ ...userProfile });
      setHasChanges(false);
      await refetch();
      toast.success("画像设置已保存");
    } catch (error) {
      toast.error("保存失败，请重试");
      clientLogger.error(
        { error },
        "[ProfileSettingsCard] Failed to save profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 重置为原始值
  const handleReset = () => {
    setUserProfile({ ...originalProfile });
    setHasChanges(false);
  };

  // 加载状态
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
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-24" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
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
            <UserCircle className="size-5 text-blue-500" />
            扩展画像
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
          告诉我们更多关于你的信息，帮助 AI 提供更精准的分类建议
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 职业/身份 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Briefcase className="w-4 h-4" />
            你的职业/身份
          </h4>
          <div className="flex flex-wrap gap-2">
            {OCCUPATION_OPTIONS.map((option) => {
              const isSelected = userProfile.occupation === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectOccupation(option.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    "border-2 hover:shadow-sm",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted bg-background text-foreground hover:border-muted-foreground/50",
                  )}
                >
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 使用场景 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Target className="w-4 h-4" />
            主要使用场景（最多选 4 个）
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SCENARIO_OPTIONS.map((option) => {
              const isSelected = userProfile.scenarios.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleScenario(option.id)}
                  disabled={!isSelected && userProfile.scenarios.length >= 4}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                    "border-2 hover:shadow-sm",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-muted bg-background hover:border-muted-foreground/50",
                    !isSelected &&
                      userProfile.scenarios.length >= 4 &&
                      "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="text-xl">{option.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-medium text-sm",
                        isSelected ? "text-primary" : "text-foreground",
                      )}
                    >
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 提示信息 */}
        {!userProfile.occupation && userProfile.scenarios.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            填写画像信息后，AI 将根据你的背景提供更个性化的分类建议
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ProfileSettingsCard;
