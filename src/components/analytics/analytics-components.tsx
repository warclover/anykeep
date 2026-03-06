/**
 * 数据统计页面 - 内联子组件
 */

import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type {
  TooltipProps,
  PieTooltipProps,
  TimeComparison,
} from "./analytics-constants";

// 自定义 Tooltip 组件
export function CustomTooltip({
  active,
  payload,
  formatDate,
}: TooltipProps & { formatDate: (d: string) => string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(payload[0].payload.date)}
        </p>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          {payload[0].value} 篇收藏
        </p>
      </div>
    );
  }
  return null;
}

export function CustomPieTooltip({
  active,
  payload,
  totalBookmarks,
}: PieTooltipProps & { totalBookmarks: number }) {
  if (active && payload && payload.length) {
    const percentage = ((payload[0].value / totalBookmarks) * 100).toFixed(1);
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {payload[0].name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {payload[0].value} 篇 ({percentage}%)
        </p>
      </div>
    );
  }
  return null;
}

// 趋势指示器组件
export function TrendIndicator({ comparison }: { comparison: TimeComparison }) {
  const { changePercent, trend } = comparison;

  if (trend === "flat") {
    return (
      <span className="flex items-center text-xs text-gray-500">
        <Minus className="size-3 mr-0.5" />
        持平
      </span>
    );
  }

  const isUp = trend === "up";
  return (
    <span
      className={`flex items-center text-xs ${
        isUp
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {isUp ? (
        <ArrowUpRight className="size-3 mr-0.5" />
      ) : (
        <ArrowDownRight className="size-3 mr-0.5" />
      )}
      {Math.abs(changePercent).toFixed(1)}%
    </span>
  );
}

// 统计卡片组件（带对比）
export function StatCard({
  title,
  value,
  icon: Icon,
  iconBgClass,
  iconClass,
  comparison,
  comparisonLabel,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  iconBgClass: string;
  iconClass: string;
  comparison?: TimeComparison;
  comparisonLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="py-1 px-4 sm:py-1 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBgClass} rounded-lg flex items-center justify-center`}
          >
            <Icon className={`size-5 sm:size-6 ${iconClass}`} />
          </div>
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
              {comparison && (
                <div className="flex flex-col">
                  <TrendIndicator comparison={comparison} />
                  {comparisonLabel && (
                    <span className="text-[10px] text-gray-400">
                      {comparisonLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
