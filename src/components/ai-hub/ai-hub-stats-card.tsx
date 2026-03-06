/**
 * AI 能力中心 - 统计卡片组件
 */

import { cn } from "@/lib/utils";

export function StatsCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border",
        "bg-white dark:bg-gray-900",
      )}
    >
      <div className={cn("p-2 rounded-lg", color)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}
