/**
 * 兴趣设置卡片组件
 * 用于设置页面中编辑用户兴趣领域
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
import { Heart, Check, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PresetInterestId } from "@/lib/classification";
import { clientLogger } from "@/lib/client-logger";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

// 从 InterestSelector 复制的类别定义
const INTEREST_CATEGORIES = [
  {
    key: "tech",
    name: "技术",
    ids: ["tech_frontend", "tech_backend", "tech_ai", "tech_mobile"],
  },
  { key: "design", name: "设计", ids: ["design_ui", "design_graphic"] },
  { key: "business", name: "产品/运营", ids: ["product", "marketing"] },
  {
    key: "lifestyle",
    name: "生活/学习",
    ids: ["reading", "investment", "lifestyle", "learning"],
  },
] as const;

interface InterestDomain {
  name: string;
  icon: string;
  category: string;
}

interface InterestSettingsCardProps {
  className?: string;
}

export function InterestSettingsCard({ className }: InterestSettingsCardProps) {
  const [selectedInterests, setSelectedInterests] = useState<
    PresetInterestId[]
  >([]);
  const [presetDomains, setPresetDomains] = useState<
    Record<PresetInterestId, InterestDomain>
  >({} as Record<PresetInterestId, InterestDomain>);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalInterests, setOriginalInterests] = useState<
    PresetInterestId[]
  >([]);

  // 加载用户兴趣配置
  const loadInterests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_CLASSIFICATION.interests);
      if (!response.ok) throw new Error("Failed to load interests");

      const data = await response.json();
      const interests = data.data?.userConfig?.presetInterests || [];
      const domains = data.data?.presetDomains || {};

      setSelectedInterests(interests);
      setOriginalInterests(interests);
      setPresetDomains(domains);
      setHasChanges(false);
    } catch (error) {
      toast.error("加载兴趣配置失败");
      clientLogger.error(
        { error },
        "[InterestSettingsCard] Failed to load interests",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterests();
  }, [loadInterests]);

  // 切换兴趣选择
  const toggleInterest = (interestId: PresetInterestId) => {
    let newInterests: PresetInterestId[];
    if (selectedInterests.includes(interestId)) {
      newInterests = selectedInterests.filter((id) => id !== interestId);
    } else if (selectedInterests.length < 12) {
      newInterests = [...selectedInterests, interestId];
    } else {
      toast.warning("最多只能选择 12 个兴趣领域");
      return;
    }

    setSelectedInterests(newInterests);
    setHasChanges(
      JSON.stringify(newInterests.sort()) !==
        JSON.stringify(originalInterests.sort()),
    );
  };

  // 保存兴趣设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(API_CLASSIFICATION.interests, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetInterests: selectedInterests }),
      });

      if (!response.ok) throw new Error("Failed to save interests");

      setOriginalInterests([...selectedInterests]);
      setHasChanges(false);
      toast.success("兴趣设置已保存");
    } catch (error) {
      toast.error("保存失败，请重试");
      clientLogger.error(
        { error },
        "[InterestSettingsCard] Failed to save interests",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 重置为原始值
  const handleReset = () => {
    setSelectedInterests([...originalInterests]);
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
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-20" />
              </div>
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
            <Heart className="size-5 text-pink-500" />
            兴趣领域
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
          选择你感兴趣的领域，AI 将据此优化分类建议（已选{" "}
          {selectedInterests.length}/12）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {INTEREST_CATEGORIES.map((category) => (
          <div key={category.key} className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              {category.name}
            </h4>
            <div className="flex flex-wrap gap-2">
              {category.ids.map((id) => {
                const interestId = id as PresetInterestId;
                const domain = presetDomains[interestId];
                const isSelected = selectedInterests.includes(interestId);

                if (!domain) return null;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleInterest(interestId)}
                    disabled={!isSelected && selectedInterests.length >= 12}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      "border-2 hover:shadow-sm",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-background text-foreground hover:border-muted-foreground/50",
                      !isSelected &&
                        selectedInterests.length >= 12 &&
                        "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <span>{domain.icon}</span>
                    <span>{domain.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* 提示信息 */}
        {selectedInterests.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            选择兴趣领域后，AI 将根据你的偏好提供更精准的分类建议
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default InterestSettingsCard;
