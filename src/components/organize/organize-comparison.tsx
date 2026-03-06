/**
 * 整理前后对比组件
 *
 * 展示整理前后的统计对比和改进效果
 *
 * @version 1.1.0
 * @since 2026-01-10
 * @updated 2026-02-01
 */

"use client";

import {
  type OrganizeSnapshot,
  ORGANIZE_CHART_COLORS,
} from "@/lib/organize/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface OrganizeComparisonProps {
  before: OrganizeSnapshot;
  after: OrganizeSnapshot;
  onReset?: () => void;
  className?: string;
}

export function OrganizeComparison({
  before,
  after,
  onReset,
  className,
}: OrganizeComparisonProps) {
  // 安全获取数值，防止 NaN
  const safeNum = (val: number | undefined | null): number =>
    typeof val === "number" && !isNaN(val) ? val : 0;

  // 计算改进指标（使用安全数值）
  const improvements = {
    categorized: safeNum(before.uncategorized) - safeNum(after.uncategorized),
    cleaned: safeNum(before.duplicates) - safeNum(after.duplicates),
    tagged: safeNum(before.untagged) - safeNum(after.untagged),
    archived: safeNum(before.stale) - safeNum(after.stale),
  };

  const totalImproved = Object.values(improvements).reduce(
    (sum, val) => sum + Math.max(0, val),
    0,
  );
  const beforeTotal = safeNum(before.total);
  const afterTotal = safeNum(after.total);
  const improvementPercent =
    beforeTotal > 0 ? Math.round((totalImproved / beforeTotal) * 100) : 0;

  // 准备饼图数据（使用安全数值）
  const beforeChartData = [
    {
      name: "已分类",
      value: beforeTotal - safeNum(before.uncategorized),
      color: ORGANIZE_CHART_COLORS.categorized,
    },
    {
      name: "未分类",
      value: safeNum(before.uncategorized),
      color: ORGANIZE_CHART_COLORS.uncategorized,
    },
  ].filter((d) => d.value > 0);

  const afterChartData = [
    {
      name: "已分类",
      value: afterTotal - safeNum(after.uncategorized),
      color: ORGANIZE_CHART_COLORS.categorized,
    },
    {
      name: "未分类",
      value: safeNum(after.uncategorized),
      color: ORGANIZE_CHART_COLORS.uncategorized,
    },
  ].filter((d) => d.value > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            ✨ 整理完成！
            {improvementPercent > 0 && (
              <span className="text-green-600 text-lg">
                优化了 {improvementPercent}%
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                继续整理
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 关键指标变化 */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="未分类"
            before={safeNum(before.uncategorized)}
            after={safeNum(after.uncategorized)}
            isLowerBetter
          />
          <MetricCard
            label="重复项"
            before={safeNum(before.duplicates)}
            after={safeNum(after.duplicates)}
            isLowerBetter
          />
          <MetricCard
            label="无标签"
            before={safeNum(before.untagged)}
            after={safeNum(after.untagged)}
            isLowerBetter
          />
          <MetricCard
            label="长期未读"
            before={safeNum(before.stale)}
            after={safeNum(after.stale)}
            isLowerBetter
          />
        </div>

        {/* 分布对比图 */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm font-medium text-center mb-2 text-muted-foreground">
              整理前
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={beforeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    strokeWidth={2}
                  >
                    {beforeChartData.map((entry, index) => (
                      <Cell key={`cell-before-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-center mb-2 text-primary">
              整理后 ✨
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={afterChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    strokeWidth={2}
                  >
                    {afterChartData.map((entry, index) => (
                      <Cell key={`cell-after-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 操作汇总 */}
        {totalImproved > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              🎉 本次整理成果
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-green-700 dark:text-green-300">
              {improvements.categorized > 0 && (
                <span>📁 分类了 {improvements.categorized} 条</span>
              )}
              {improvements.cleaned > 0 && (
                <span>🧹 清理了 {improvements.cleaned} 条重复</span>
              )}
              {improvements.tagged > 0 && (
                <span>🏷️ 标记了 {improvements.tagged} 条</span>
              )}
              {improvements.archived > 0 && (
                <span>📦 归档了 {improvements.archived} 条</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 指标变化卡片
 */
function MetricCard({
  label,
  before,
  after,
  isLowerBetter,
}: {
  label: string;
  before: number;
  after: number;
  isLowerBetter?: boolean;
}) {
  const change = after - before;
  const isPositive = isLowerBetter ? change < 0 : change > 0;
  const absChange = Math.abs(change);

  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-lg font-medium text-muted-foreground">
          {before}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span
          className={`text-lg font-bold ${isPositive ? "text-green-600" : after === before ? "" : "text-red-600"}`}
        >
          {after}
        </span>
        {change !== 0 && (
          <span
            className={`text-sm flex items-center ${isPositive ? "text-green-600" : "text-red-600"}`}
          >
            {isPositive ? (
              <TrendingDown className="h-3 w-3 mr-0.5" />
            ) : (
              <TrendingUp className="h-3 w-3 mr-0.5" />
            )}
            {absChange}
          </span>
        )}
      </div>
    </div>
  );
}
