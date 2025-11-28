"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPlatformName, getPlatformIcon } from "@/lib/constants/platforms";
import {
  extractPlatformStats,
  getBookmarkIdsByPlatforms,
} from "@/lib/browser-bookmark/platform-utils";
import type { ParsedBookmarkNode } from "@/lib/browser-bookmark";
import type { Platform } from "@/types/supabase";

// 重新导出工具函数以便组件使用者可以直接导入
export { extractPlatformStats, getBookmarkIdsByPlatforms };
export { getBookmarkIdsByPlatform } from "@/lib/browser-bookmark/platform-utils";
export type { PlatformStats } from "@/lib/browser-bookmark/platform-utils";

interface PlatformFilterProps {
  /** 书签节点列表 */
  nodes: ParsedBookmarkNode[];
  /** 选中的平台列表 */
  selectedPlatforms: Set<Platform>;
  /** 平台选择变化回调 */
  onPlatformChange: (platforms: Set<Platform>) => void;
  /** 是否显示为紧凑模式 */
  compact?: boolean;
}

/**
 * 平台筛选组件
 */
export function PlatformFilter({
  nodes,
  selectedPlatforms,
  onPlatformChange,
  compact = false,
}: PlatformFilterProps) {
  // 计算平台统计
  const platformStats = useMemo(() => extractPlatformStats(nodes), [nodes]);

  // 处理平台选择
  const handlePlatformToggle = (platform: Platform) => {
    const newPlatforms = new Set(selectedPlatforms);
    if (newPlatforms.has(platform)) {
      newPlatforms.delete(platform);
    } else {
      newPlatforms.add(platform);
    }
    onPlatformChange(newPlatforms);
  };

  // 全选
  const handleSelectAll = () => {
    const allPlatforms = new Set(platformStats.map((s) => s.platform));
    onPlatformChange(allPlatforms);
  };

  // 取消全选
  const handleSelectNone = () => {
    onPlatformChange(new Set());
  };

  if (platformStats.length === 0) {
    return null;
  }

  // 检查是否全选/部分选
  const allSelected = platformStats.every((s) =>
    selectedPlatforms.has(s.platform),
  );
  const someSelected =
    !allSelected &&
    platformStats.some((s) => selectedPlatforms.has(s.platform));

  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">按平台筛选</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={handleSelectAll}
          >
            全选
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={handleSelectNone}
          >
            清空
          </button>
        </div>
      </div>

      <div className={cn("flex flex-wrap gap-2", compact && "gap-1")}>
        {platformStats.map(({ platform, count }) => {
          const isSelected = selectedPlatforms.has(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => handlePlatformToggle(platform)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50",
                compact && "px-2 py-0.5 text-xs",
              )}
            >
              <span>{getPlatformIcon(platform)}</span>
              <span>{getPlatformName(platform)}</span>
              <Badge
                variant={isSelected ? "default" : "secondary"}
                className={cn("ml-1", compact && "text-[10px] px-1 py-0")}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* 已选中的统计 */}
      <div className="text-xs text-muted-foreground">
        已选 {selectedPlatforms.size}/{platformStats.length} 个平台
        {someSelected &&
          ` (${platformStats
            .filter((s) => selectedPlatforms.has(s.platform))
            .reduce((sum, s) => sum + s.count, 0)} 个书签)`}
      </div>
    </div>
  );
}
