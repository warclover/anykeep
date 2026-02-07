/**
 * 聚类分布图组件
 *
 * 显示聚类大小分布的条形图
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ============================================================================
// 类型定义
// ============================================================================

export interface ClusterDistributionData {
  size: string;
  count: number;
  label: string;
}

interface ClusterDistributionChartProps {
  data: ClusterDistributionData[];
}

// ============================================================================
// 常量
// ============================================================================

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

// ============================================================================
// 组件
// ============================================================================

/**
 * 聚类分布条形图
 */
export function ClusterDistributionChart({
  data,
}: ClusterDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        暂无分布数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          formatter={(value: number) => [`${value} 个聚类`, "数量"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
