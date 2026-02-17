/**
 * 知识工坊设置卡片
 * @module settings
 * @description 管理知识工坊的 Briefing 偏好设置
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import type { BriefingMode } from "@/types/user-settings";

// ============================================================
// Types
// ============================================================

interface KnowledgeStudioSettingsCardProps {
  briefingMode: BriefingMode;
  onUpdate: (briefingMode: BriefingMode) => Promise<void>;
}

// ============================================================
// Component
// ============================================================

export function KnowledgeStudioSettingsCard({
  briefingMode,
  onUpdate,
}: KnowledgeStudioSettingsCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localBriefingMode, setLocalBriefingMode] =
    useState<BriefingMode>(briefingMode);

  const handleModeChange = async (mode: BriefingMode) => {
    setLocalBriefingMode(mode);
    setIsUpdating(true);

    try {
      await onUpdate(mode);
      toast.success("设置已更新");
    } catch {
      toast.error("更新失败，请重试");
      setLocalBriefingMode(briefingMode); // 回滚
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>知识工坊设置</CardTitle>
        <CardDescription>
          配置内容生成时的 Briefing（需求问答）偏好
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label className="text-base font-medium">Briefing 模式</Label>
          <RadioGroup
            value={localBriefingMode}
            onValueChange={(value) => handleModeChange(value as BriefingMode)}
            disabled={isUpdating}
          >
            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="off" id="briefing-off" />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="briefing-off"
                  className="cursor-pointer font-medium"
                >
                  关闭（推荐）
                </Label>
                <p className="text-sm text-muted-foreground">
                  默认无干扰模式，仅在素材选择后提供可选的&quot;补充说明&quot;文本框
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="quick" id="briefing-quick" />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="briefing-quick"
                  className="cursor-pointer font-medium"
                >
                  快速模式
                </Label>
                <p className="text-sm text-muted-foreground">
                  生成前询问 2 个关键问题，适合快速定制需求
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0">
              <RadioGroupItem value="detailed" id="briefing-detailed" />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="briefing-detailed"
                  className="cursor-pointer font-medium"
                >
                  详细模式
                </Label>
                <p className="text-sm text-muted-foreground">
                  生成前完整回答所有问题，获得最精准的定制内容（3-5 题）
                </p>
              </div>
            </div>
          </RadioGroup>

          {isUpdating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在保存...</span>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            💡 <strong>提示</strong>
            ：即使选择&quot;关闭&quot;，你仍然可以在生成时通过&quot;补充说明&quot;文本框提供特殊要求
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
