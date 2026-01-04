/**
 * 检查清单渲染器 (Story 3.2)
 * @module knowledge-studio/structured-output
 *
 * 交互式检查清单渲染器。
 */

"use client";

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ListChecks, CheckCircle2 } from "lucide-react";
import type { ChecklistRendererProps } from "./types";

/**
 * 检查清单渲染器
 *
 * 支持交互式勾选的清单组件。
 */
export const ChecklistRenderer = memo(function ChecklistRenderer({
  data,
  className,
  maxHeight,
  readOnly = false,
  onToggle,
}: ChecklistRendererProps) {
  const { title, description, items } = data;

  // 本地状态（如果没有 onToggle 回调）
  const [localChecked, setLocalChecked] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      items.forEach((item) => {
        initial[item.id] = item.status === "completed";
      });
      return initial;
    },
  );

  const handleToggle = useCallback(
    (itemId: string, checked: boolean) => {
      if (onToggle) {
        onToggle(itemId, checked);
      } else {
        setLocalChecked((prev) => ({
          ...prev,
          [itemId]: checked,
        }));
      }
    },
    [onToggle],
  );

  // 计算完成进度
  const checkedItems = items.filter(
    (item) => localChecked[item.id] ?? item.status === "completed",
  );
  const progress =
    items.length > 0
      ? Math.round((checkedItems.length / items.length) * 100)
      : 0;

  const renderContent = () => (
    <div className="space-y-4">
      {/* 进度 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          已完成 {checkedItems.length}/{items.length}
        </span>
        <Badge
          variant={progress === 100 ? "default" : "secondary"}
          className={cn(progress === 100 && "bg-green-600")}
        >
          {progress}%
        </Badge>
      </div>

      {/* 进度条 */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            progress === 100 ? "bg-green-600" : "bg-primary",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 清单项 */}
      <div className="space-y-1">
        {items.map((item) => {
          const isChecked =
            localChecked[item.id] ?? item.status === "completed";
          return (
            <label
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-2 rounded-md cursor-pointer",
                "hover:bg-accent/50 transition-colors",
                isChecked && "opacity-60",
                readOnly && "cursor-default",
              )}
            >
              <Checkbox
                checked={isChecked}
                disabled={readOnly}
                onCheckedChange={(checked) =>
                  handleToggle(item.id, checked === true)
                }
                className="mt-0.5"
              />
              <div className="flex-1 space-y-0.5">
                <span
                  className={cn(
                    "text-sm",
                    isChecked && "line-through text-muted-foreground",
                  )}
                >
                  {item.title}
                </span>
                {item.description && (
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              {item.priority === "high" && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  高优
                </Badge>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {progress === 100 ? (
            <CheckCircle2 className="size-5 text-green-600" />
          ) : (
            <ListChecks className="size-5 text-primary" />
          )}
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {maxHeight ? (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            {renderContent()}
          </ScrollArea>
        ) : (
          renderContent()
        )}
      </CardContent>
    </Card>
  );
});

ChecklistRenderer.displayName = "ChecklistRenderer";
