'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBattery } from '../hooks/use-battery';

export function BatteryIndicator() {
  const { level, remaining, total, resetAt, isPro, loading } = useBattery();

  // 满电/中电时不显示
  if (loading || level === 'full' || level === 'medium' || isPro) {
    return null;
  }

  const icon = level === 'low' ? '🪫' : '⚡';
  const message = level === 'low'
    ? `今日智能推荐次数即将用完 (${remaining}/${total})`
    : `今日智能推荐次数已用完，${formatResetTime(resetAt)} 重置`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-lg cursor-help" role="status" aria-label={message}>
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function formatResetTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟后`;
  }
  return `${minutes}分钟后`;
}
