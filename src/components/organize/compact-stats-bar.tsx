import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { useOrganizeCounts } from "@/hooks/data/use-organize-counts";

interface CompactStatsBarProps {
  stats: ReturnType<typeof useOrganizeCounts>["extendedStats"];
  isLoading: boolean;
}

export function CompactStatsBar({ stats, isLoading }: CompactStatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-xs">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-16" />
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "待整理",
      value: stats?.pending ?? 0,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "处理中",
      value: stats?.processing ?? 0,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "高价值",
      value: stats?.highValue ?? 0,
      color: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="flex items-center gap-3 text-xs">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <span className={cn("font-medium", item.color)}>{item.value}</span>
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
