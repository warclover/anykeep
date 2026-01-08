/**
 * 通用统计卡片组件
 *
 * 用于展示数字统计信息，支持图标、趋势指示等
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface StatsCardProps {
  /** 统计项标签 */
  label: string;
  /** 统计值 */
  value: string | number;
  /** 单位（可选） */
  unit?: string;
  /** 图标 - 支持 ReactNode 或 ElementType */
  icon: React.ReactNode | React.ElementType;
  /** 图标背景色 (Tailwind 类) */
  color: string;
  /** 趋势指示（可选） */
  trend?: {
    value: number;
    isUp: boolean;
  };
  /** 是否使用简洁模式（无 Card 包装） */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 主组件
// ============================================

export function StatsCard({
  label,
  value,
  unit,
  icon,
  color,
  trend,
  compact = false,
  className,
}: StatsCardProps) {
  // 判断 icon 是 ReactNode 还是 ElementType
  const isIconElement = React.isValidElement(icon);
  const IconComponent = !isIconElement ? (icon as React.ElementType) : null;

  const iconNode = isIconElement ? (
    icon
  ) : IconComponent ? (
    <IconComponent className="size-5 text-white" aria-hidden="true" />
  ) : null;

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-lg", color)}>{iconNode}</div>
        {trend && (
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              trend.isUp
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
            )}
          >
            {trend.isUp ? "↑" : "↓"} {trend.value}%
          </Badge>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
          {unit && (
            <span className="text-sm font-normal text-gray-500 ml-1">
              {unit}
            </span>
          )}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </>
  );

  // 简洁模式：无 Card 包装
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-4 rounded-xl border",
          "bg-white dark:bg-gray-900",
          className,
        )}
      >
        <div className={cn("p-2 rounded-lg", color)}>{iconNode}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
            {unit && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                {unit}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    );
  }

  // 标准模式：Card 包装
  return (
    <Card className={cn("border", className)}>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  );
}
