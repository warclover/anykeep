/**
 * V5.5 配额进度条组件
 *
 * 轻量展示 AI 文件夹配额使用情况
 * 仅在使用率 > 60% 时显示
 */

"use client";

import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { useFolderQuota } from "@/hooks/use-folder-quota";

export function FolderQuotaBar() {
  const { data: quota, isLoading } = useFolderQuota();

  // 加载中或无数据时不显示
  if (isLoading || !quota) {
    return null;
  }

  // 计算使用率
  const usage =
    quota.total.limit > 0 ? quota.total.aiCreated / quota.total.limit : 0;

  // 只在接近上限时显示（> 60%）
  if (usage < 0.6) {
    return null;
  }

  const isWarning = usage >= 0.8;
  const isCritical = usage >= 0.95;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <Sparkles
            className={`h-3 w-3 ${
              isCritical ? "text-red-500" : isWarning ? "text-amber-500" : ""
            }`}
          />
          <Progress
            value={usage * 100}
            className={`h-1.5 w-16 ${
              isCritical
                ? "[&>div]:bg-red-500"
                : isWarning
                  ? "[&>div]:bg-amber-500"
                  : ""
            }`}
          />
          <span
            className={
              isCritical ? "text-red-500" : isWarning ? "text-amber-500" : ""
            }
          >
            {quota.total.remaining}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="space-y-1">
          <p>
            AI 文件夹额度：{quota.total.aiCreated}/{quota.total.limit}
          </p>
          <p className="text-muted-foreground">
            今日已创建：{quota.daily.used}/{quota.daily.limit}
          </p>
          {!quota.health.passed && (
            <p className="text-amber-500">{quota.health.reason}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
