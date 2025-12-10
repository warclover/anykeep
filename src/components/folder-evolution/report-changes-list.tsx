"use client";

/**
 * V4.2 Report Changes List
 * 展示月度报告中的文件夹变化列表
 */

import {
  FolderPlus,
  Scissors,
  Merge,
  FileEdit,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Type Definitions
// ============================================

export interface FolderChanges {
  foldersCreated: number;
  foldersSplit: number;
  foldersMerged: number;
  foldersRenamed: number;
}

interface ReportChangesListProps {
  changes: FolderChanges;
  className?: string;
}

// ============================================
// Component Implementation
// ============================================

export function ReportChangesList({ changes, className }: ReportChangesListProps) {
  const totalChanges =
    changes.foldersCreated +
    changes.foldersSplit +
    changes.foldersMerged +
    changes.foldersRenamed;

  const changeItems = [
    {
      key: "created",
      label: "新建文件夹",
      value: changes.foldersCreated,
      icon: FolderPlus,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      key: "split",
      label: "分拆文件夹",
      value: changes.foldersSplit,
      icon: Scissors,
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      key: "merged",
      label: "合并文件夹",
      value: changes.foldersMerged,
      icon: Merge,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      key: "renamed",
      label: "重命名文件夹",
      value: changes.foldersRenamed,
      icon: FileEdit,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  if (totalChanges === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">本月无文件夹变化</p>
        <p className="text-xs text-muted-foreground mt-1">
          AI 正在观察你的收藏习惯
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">文件夹变化</h4>
        <span className="text-xs text-muted-foreground">
          共 {totalChanges} 次操作
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {changeItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                item.value > 0 ? item.bgColor : "bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "w-4 h-4",
                    item.value > 0 ? item.color : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm",
                    item.value > 0 ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
              <p
                className={cn(
                  "text-2xl font-bold mt-1",
                  item.value > 0 ? "" : "text-muted-foreground",
                )}
              >
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReportChangesList;
