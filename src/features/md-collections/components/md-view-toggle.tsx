/**
 * MD 收藏视图切换组件
 * P2-007: Markdown 内容收藏 - 列表/卡片视图切换
 */

"use client";

import { memo } from "react";
import { List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MdViewMode } from "../types";

interface MdViewToggleProps {
  /** 当前视图模式 */
  value: MdViewMode;
  /** 切换回调 */
  onChange: (mode: MdViewMode) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 视图切换按钮组
 */
export const MdViewToggle = memo(function MdViewToggle({
  value,
  onChange,
  className,
}: MdViewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "px-3 py-1.5 h-auto",
          value === "list"
            ? "bg-white dark:bg-gray-700 shadow-sm"
            : "hover:bg-gray-200 dark:hover:bg-gray-700",
        )}
        onClick={() => onChange("list")}
        title="列表视图"
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "px-3 py-1.5 h-auto",
          value === "card"
            ? "bg-white dark:bg-gray-700 shadow-sm"
            : "hover:bg-gray-200 dark:hover:bg-gray-700",
        )}
        onClick={() => onChange("card")}
        title="卡片视图"
      >
        <LayoutGrid className="w-4 h-4" />
      </Button>
    </div>
  );
});

export default MdViewToggle;
