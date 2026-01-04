/**
 * SWOT 分析渲染器 (Story 3.5)
 * @module knowledge-studio/structured-output
 *
 * SWOT 四象限分析卡片渲染器，以 2×2 网格形式展示。
 *
 * 功能特性：
 * - 四象限网格布局（优势/劣势/机会/威胁）
 * - 每项显示标题+描述
 * - 重要程度指示器
 * - 颜色编码
 * - 策略建议区域
 */

"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Grid2X2,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  AlertTriangle,
  Star,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import type { SwotRendererProps } from "./types";
import type {
  SwotItem,
  SwotQuadrant,
} from "@/lib/knowledge-studio/blueprint/structured-output";

// ============================================================
// Constants
// ============================================================

/**
 * 象限配置
 */
const QUADRANT_CONFIG: Record<
  SwotQuadrant,
  {
    label: string;
    icon: React.ReactNode;
    bgClass: string;
    textClass: string;
    borderClass: string;
    headerBgClass: string;
  }
> = {
  strengths: {
    label: "优势",
    icon: <ThumbsUp className="size-4" />,
    bgClass: "bg-green-50/50 dark:bg-green-950/20",
    textClass: "text-green-700 dark:text-green-400",
    borderClass: "border-green-200 dark:border-green-800",
    headerBgClass: "bg-green-100/80 dark:bg-green-900/40",
  },
  weaknesses: {
    label: "劣势",
    icon: <ThumbsDown className="size-4" />,
    bgClass: "bg-red-50/50 dark:bg-red-950/20",
    textClass: "text-red-700 dark:text-red-400",
    borderClass: "border-red-200 dark:border-red-800",
    headerBgClass: "bg-red-100/80 dark:bg-red-900/40",
  },
  opportunities: {
    label: "机会",
    icon: <TrendingUp className="size-4" />,
    bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
    headerBgClass: "bg-blue-100/80 dark:bg-blue-900/40",
  },
  threats: {
    label: "威胁",
    icon: <AlertTriangle className="size-4" />,
    bgClass: "bg-amber-50/50 dark:bg-amber-950/20",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
    headerBgClass: "bg-amber-100/80 dark:bg-amber-900/40",
  },
};

// ============================================================
// Helper Components
// ============================================================

/**
 * 重要程度指示器
 */
function ImportanceIndicator({ importance }: { importance: number }) {
  // 1-5 级别，显示星星数量
  const stars = Math.min(5, Math.max(1, importance));

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: stars }).map((_, i) => (
              <Star key={i} className="size-3 fill-current text-yellow-500" />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>重要程度：{importance}/5</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 来源链接
 */
function SourceLink({ source }: { source: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ExternalLink className="size-3 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{source}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * SWOT 项目卡片
 */
function SwotItemCard({
  item,
  textClass,
}: {
  item: SwotItem;
  textClass: string;
}) {
  return (
    <div className="py-2 px-3 rounded-md bg-background/50 border border-border/50 hover:bg-background transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-medium text-sm", textClass)}>{item.title}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {item.description}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.importance && (
            <ImportanceIndicator importance={item.importance} />
          )}
          {item.source && <SourceLink source={item.source} />}
        </div>
      </div>
    </div>
  );
}

/**
 * 单个象限组件
 */
function QuadrantCard({
  quadrant,
  items,
  maxHeight,
}: {
  quadrant: SwotQuadrant;
  items: SwotItem[];
  maxHeight?: string;
}) {
  const config = QUADRANT_CONFIG[quadrant];

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        config.bgClass,
        config.borderClass,
      )}
    >
      <div
        className={cn(
          "px-3 py-2 flex items-center gap-2 border-b",
          config.headerBgClass,
          config.borderClass,
        )}
      >
        <span className={config.textClass}>{config.icon}</span>
        <h3 className={cn("font-semibold text-sm", config.textClass)}>
          {config.label}
        </h3>
        <Badge
          variant="secondary"
          className={cn(
            "ml-auto text-xs h-5 px-1.5",
            config.bgClass,
            config.textClass,
          )}
        >
          {items.length}
        </Badge>
      </div>
      <div
        className="p-2 space-y-2 overflow-auto"
        style={{ maxHeight: maxHeight ?? "200px" }}
      >
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            暂无数据
          </p>
        ) : (
          items.map((item, index) => (
            <SwotItemCard
              key={`${quadrant}-${index}`}
              item={item}
              textClass={config.textClass}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * SWOT 分析渲染器
 *
 * 四象限卡片展示优势/劣势/机会/威胁分析。
 *
 * @example
 * ```tsx
 * <SwotRenderer
 *   data={{
 *     meta: { type: 'swot', ... },
 *     subject: 'AI 产品',
 *     quadrants: {
 *       strengths: [{ title: '技术领先', description: '...' }],
 *       weaknesses: [{ title: '成本高', description: '...' }],
 *       opportunities: [{ title: '市场扩张', description: '...' }],
 *       threats: [{ title: '竞争加剧', description: '...' }],
 *     },
 *     recommendations: ['加大研发投入', '降低成本'],
 *   }}
 * />
 * ```
 */
export const SwotRenderer = memo(function SwotRenderer({
  data,
  className,
  maxHeight,
}: SwotRendererProps) {
  const { subject, overview, quadrants, recommendations } = data;

  // 统计总项目数
  const totalItems = useMemo(() => {
    return (
      quadrants.strengths.length +
      quadrants.weaknesses.length +
      quadrants.opportunities.length +
      quadrants.threats.length
    );
  }, [quadrants]);

  // 计算每个象限的最大高度
  const quadrantMaxHeight = useMemo(() => {
    if (!maxHeight) return "200px";
    // 从总高度中减去头部和建议区域的预估高度
    const numericHeight = parseInt(maxHeight);
    if (isNaN(numericHeight)) return "200px";
    // 头部约 80px, 间距约 40px, 建议区域约 100px
    const availableHeight = numericHeight - 220;
    // 分成两行
    const perQuadrantHeight = Math.max(150, availableHeight / 2);
    return `${perQuadrantHeight}px`;
  }, [maxHeight]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Grid2X2 className="size-5 text-primary" />
          <CardTitle className="text-lg">SWOT 分析：{subject}</CardTitle>
        </div>
        {overview && (
          <p className="text-sm text-muted-foreground mt-2">{overview}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          共 {totalItems} 个分析要点
        </p>
      </CardHeader>

      <CardContent>
        {/* 四象限网格 */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          style={{ maxHeight: maxHeight ?? "auto" }}
        >
          <QuadrantCard
            quadrant="strengths"
            items={quadrants.strengths}
            maxHeight={quadrantMaxHeight}
          />
          <QuadrantCard
            quadrant="weaknesses"
            items={quadrants.weaknesses}
            maxHeight={quadrantMaxHeight}
          />
          <QuadrantCard
            quadrant="opportunities"
            items={quadrants.opportunities}
            maxHeight={quadrantMaxHeight}
          />
          <QuadrantCard
            quadrant="threats"
            items={quadrants.threats}
            maxHeight={quadrantMaxHeight}
          />
        </div>

        {/* 策略建议 */}
        {recommendations && recommendations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="size-4 text-primary" />
              <h3 className="font-medium text-sm">策略建议</h3>
            </div>
            <ul className="space-y-1.5">
              {recommendations.map((rec, index) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="text-primary font-medium shrink-0">
                    {index + 1}.
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

SwotRenderer.displayName = "SwotRenderer";
