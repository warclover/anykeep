/**
 * 导入卡片组件
 * 展示单个导入选项的卡片
 */

"use client";

import type { LucideIcon } from "lucide-react";
import { Check, Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

interface ImportCardProps {
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description: string;
  /** 图标组件 */
  icon: LucideIcon;
  /** 图标颜色 */
  color: string;
  /** 背景颜色 */
  bgColor: string;
  /** 边框颜色 */
  borderColor: string;
  /** 功能特性列表 */
  features: readonly string[];
  /** 是否即将推出 */
  comingSoon?: boolean;
  /** 点击事件 */
  onClick?: () => void;
}

// ============================================
// 组件实现
// ============================================

export function ImportCard({
  title,
  description,
  icon: Icon,
  color,
  bgColor,
  borderColor,
  features,
  comingSoon = false,
  onClick,
}: ImportCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        "hover:shadow-md",
        borderColor,
        comingSoon && "opacity-70",
      )}
    >
      <CardHeader className={cn("pb-3", bgColor)}>
        <div className="flex items-start justify-between">
          <div
            className={cn("p-2 rounded-lg bg-white dark:bg-gray-900 shadow-sm")}
          >
            <Icon className={cn("h-6 w-6", color)} />
          </div>
          {comingSoon && (
            <Badge variant="secondary" className="gap-1">
              <Construction className="h-3 w-3" />
              即将推出
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-4">
        {/* 功能特性 */}
        <ul className="space-y-2 mb-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* 操作按钮 */}
        <Button
          onClick={onClick}
          disabled={comingSoon}
          className="w-full"
          variant={comingSoon ? "secondary" : "default"}
        >
          {comingSoon ? "敬请期待" : "开始导入"}
        </Button>
      </CardContent>
    </Card>
  );
}
