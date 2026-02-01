/**
 * 通知分组标题
 * @description 日期分组头部
 */

import { cn } from "@/lib/utils";
import type { NotificationDateGroup } from "@/lib/notifications";

interface NotificationGroupHeaderProps {
  dateGroup: NotificationDateGroup;
  label: string;
  count?: number;
  className?: string;
}

export function NotificationGroupHeader({
  label,
  count,
  className,
}: NotificationGroupHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 px-4 py-2 bg-muted/50 backdrop-blur-sm border-b border-border/50",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-xs text-muted-foreground">{count} 条</span>
        )}
      </div>
    </div>
  );
}
