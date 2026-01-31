/**
 * QuotaDisplay - 配额显示组件
 * 显示用户的配额使用情况
 */

"use client";

import { Zap, HardDrive, Volume2, Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useQuota } from "@/lib/payment/hooks/use-quota";
import { cn } from "@/lib/utils";

interface QuotaItemProps {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  unit?: string;
  showWarning?: boolean;
}

function QuotaItem({
  icon,
  label,
  used,
  limit,
  unit = "",
  showWarning = true,
}: QuotaItemProps) {
  const isUnlimited = limit === -1 || limit === Infinity;
  const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span
          className={cn(
            "font-medium",
            showWarning && isDanger && "text-red-500",
            showWarning && isWarning && !isDanger && "text-amber-500",
          )}
        >
          {used.toLocaleString()}
          {unit} / {isUnlimited ? "∞" : limit.toLocaleString()}
          {unit}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={cn(
            "h-1.5",
            showWarning && isDanger && "[&>div]:bg-red-500",
            showWarning && isWarning && !isDanger && "[&>div]:bg-amber-500",
          )}
        />
      )}
    </div>
  );
}

interface QuotaDisplayProps {
  showAI?: boolean;
  showStorage?: boolean;
  showTTS?: boolean;
  showSynthesis?: boolean;
  compact?: boolean;
}

export function QuotaDisplay({
  showAI = true,
  showStorage = true,
  showTTS = false,
  showSynthesis = false,
  compact = false,
}: QuotaDisplayProps) {
  const { quota, isLoading } = useQuota();

  if (isLoading || !quota) {
    return (
      <div className="space-y-3 animate-pulse">
        {showAI && <div className="h-8 bg-muted rounded" />}
        {showStorage && <div className="h-8 bg-muted rounded" />}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {showAI && (
        <QuotaItem
          icon={<Zap className="h-4 w-4" />}
          label="AI 调用"
          used={quota.aiCallsUsed}
          limit={quota.aiCallsLimit}
          unit=" 次"
        />
      )}
      {showStorage && (
        <QuotaItem
          icon={<HardDrive className="h-4 w-4" />}
          label="存储空间"
          used={Math.round(quota.storageUsedMb)}
          limit={quota.storageLimitMb}
          unit=" MB"
        />
      )}
      {showTTS && quota.ttsSecondsLimit > 0 && (
        <QuotaItem
          icon={<Volume2 className="h-4 w-4" />}
          label="TTS 时长"
          used={Math.round(quota.ttsSecondsUsed / 3600)}
          limit={Math.round(quota.ttsSecondsLimit / 3600)}
          unit=" 小时"
        />
      )}
      {showSynthesis && quota.synthesisLimit !== 0 && (
        <QuotaItem
          icon={<Layers className="h-4 w-4" />}
          label="主题合成"
          used={quota.synthesisCount}
          limit={quota.synthesisLimit}
          unit=" 次"
        />
      )}
    </div>
  );
}
