/**
 * 快速操作网格组件
 *
 * 展示整理中心的快速操作入口
 *
 * @version 1.1.0
 * @since 2026-01-10
 * @updated 2026-02-01 - 添加键盘可访问性支持
 */

"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Copy,
  FolderOpen,
  Tag,
  Archive,
  type LucideIcon,
} from "lucide-react";
import type { QuickActionType } from "@/lib/organize/types";

interface QuickActionGridProps {
  onAction: (actionType: QuickActionType) => void;
  disabled?: boolean;
}

interface QuickActionConfig {
  id: QuickActionType;
  title: string;
  description: string;
  icon: LucideIcon;
  variant: "default" | "outline";
  highlight?: boolean;
}

const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: "one-click",
    title: "一键智能整理",
    description: "AI 自动分析并执行最优整理方案",
    icon: Sparkles,
    variant: "default",
    highlight: true,
  },
  {
    id: "clean-duplicates",
    title: "清理重复",
    description: "检测并合并重复收藏",
    icon: Copy,
    variant: "outline",
  },
  {
    id: "smart-categorize",
    title: "智能分类",
    description: "自动将未分类内容归入文件夹",
    icon: FolderOpen,
    variant: "outline",
  },
  {
    id: "auto-tag",
    title: "自动打标签",
    description: "为无标签内容智能添加标签",
    icon: Tag,
    variant: "outline",
  },
  {
    id: "archive-stale",
    title: "归档旧内容",
    description: "整理长期未访问的收藏",
    icon: Archive,
    variant: "outline",
  },
];

export function QuickActionGrid({ onAction, disabled }: QuickActionGridProps) {
  const highlightAction = QUICK_ACTIONS.find((a) => a.highlight);
  const otherActions = QUICK_ACTIONS.filter((a) => !a.highlight);

  /**
   * 处理键盘事件，支持 Enter 和 Space 触发操作
   */
  const handleKeyDown = useCallback(
    (actionId: QuickActionType) => (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault();
        onAction(actionId);
      }
    },
    [onAction, disabled],
  );

  return (
    <div className="space-y-4">
      {/* 主操作：一键整理 */}
      {highlightAction && (
        <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <highlightAction.icon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {highlightAction.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {highlightAction.description}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => onAction(highlightAction.id)}
                disabled={disabled}
              >
                开始整理
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快捷操作网格 */}
      <div className="grid grid-cols-2 gap-4" role="list" aria-label="快捷操作">
        {otherActions.map((action) => (
          <Card
            key={action.id}
            role="listitem"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${action.title}: ${action.description}`}
            aria-disabled={disabled}
            className="cursor-pointer hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={() => !disabled && onAction(action.id)}
            onKeyDown={handleKeyDown(action.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded" aria-hidden="true">
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium">{action.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
