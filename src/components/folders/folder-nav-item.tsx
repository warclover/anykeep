/**
 * 文件夹导航项组件
 *
 * 从 folder-nav-panel.tsx 提取
 */

"use client";

import { cn } from "@/lib/utils";
import { FolderHeatIndicator } from "@/components/folder/folder-heat-indicator";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  todayCount?: number;
  heat?: number;
  isSelected?: boolean;
  isSystem?: boolean;
  indent?: number;
  onClick?: () => void;
  actionMenu?: React.ReactNode;
  folderColor?: string | null;
  folderIcon?: string | null;
}

export function NavItem({
  icon,
  label,
  count,
  todayCount,
  heat,
  isSelected,
  isSystem,
  indent = 0,
  onClick,
  actionMenu,
  folderColor,
  folderIcon,
}: NavItemProps) {
  return (
    <div className="group flex items-center min-w-0">
      <button
        onClick={onClick}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={indent + 1}
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          isSelected && "bg-primary/10 text-primary font-medium",
          isSystem && !isSelected && "bg-blue-50/50 dark:bg-blue-900/10",
        )}
        style={{
          paddingLeft: `${12 + indent * 16}px`,
          ...(folderColor &&
            !isSelected && {
              borderLeftColor: folderColor,
              borderLeftWidth: "3px",
            }),
        }}
      >
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {folderIcon ? <span className="text-base">{folderIcon}</span> : icon}
        </span>
        <span className="flex-1 min-w-0 text-left truncate">{label}</span>
        {heat !== undefined && heat > 0 && (
          <FolderHeatIndicator heat={heat} size="sm" />
        )}
        {count !== undefined && count > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
        {todayCount !== undefined && todayCount > 0 && (
          <span className="text-xs text-green-500 tabular-nums">
            +{todayCount}
          </span>
        )}
      </button>
      {actionMenu && <div className="pr-1">{actionMenu}</div>}
    </div>
  );
}
