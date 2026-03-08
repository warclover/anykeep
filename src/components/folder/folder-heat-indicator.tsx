/**
 * 文件夹热度指示器组件
 *
 * 根据热度值 (0-100) 显示不同颜色的火焰图标
 * 热度基于：最近访问频率 + 内容新增速度
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

import { Flame } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ==================== 类型定义 ====================

interface FolderHeatIndicatorProps {
  /** 热度值 (0-100) */
  heat: number;
  /** 图标大小 */
  size?: "sm" | "md" | "lg";
  /** 是否显示 Tooltip */
  showTooltip?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ==================== 工具函数 ====================

/**
 * 根据热度值获取颜色类名
 */
function getHeatColor(heat: number): string {
  if (heat < 20) return "text-blue-400"; // 冷门
  if (heat < 40) return "text-cyan-400"; // 较少访问
  if (heat < 60) return "text-yellow-400"; // 一般
  if (heat < 80) return "text-orange-400"; // 活跃
  return "text-red-400"; // 热门
}

/**
 * 根据热度值获取热度标签
 */
function getHeatLabel(heat: number): string {
  if (heat < 20) return "冷门";
  if (heat < 40) return "较少访问";
  if (heat < 60) return "一般";
  if (heat < 80) return "活跃";
  return "热门";
}

/**
 * 根据热度值获取背景色类名（用于 Tooltip）
 */
function getHeatBgColor(heat: number): string {
  if (heat < 20) return "bg-blue-100 dark:bg-blue-900/30";
  if (heat < 40) return "bg-cyan-100 dark:bg-cyan-900/30";
  if (heat < 60) return "bg-yellow-100 dark:bg-yellow-900/30";
  if (heat < 80) return "bg-orange-100 dark:bg-orange-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

// ==================== 尺寸配置 ====================

const SIZE_CLASSES = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

// ==================== 组件 ====================

export function FolderHeatIndicator({
  heat,
  size = "sm",
  showTooltip = true,
  className,
}: FolderHeatIndicatorProps) {
  // 热度为 0 时不显示
  if (heat <= 0) {
    return null;
  }

  const colorClass = getHeatColor(heat);
  const sizeClass = SIZE_CLASSES[size];

  const indicator = (
    <Flame
      className={cn(
        sizeClass,
        colorClass,
        "flex-shrink-0 transition-colors",
        className,
      )}
    />
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{indicator}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded",
                getHeatBgColor(heat),
              )}
            >
              <Flame className={cn("h-3 w-3", colorClass)} />
            </span>
            <div>
              <p className="font-medium">
                热度: {Math.round(heat)}% ({getHeatLabel(heat)})
              </p>
              <p className="text-muted-foreground">基于近 30 天访问频率</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==================== 导出工具函数 ====================

export { getHeatColor, getHeatLabel, getHeatBgColor };

export default FolderHeatIndicator;
