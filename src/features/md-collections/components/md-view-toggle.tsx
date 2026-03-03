/**
 * MD 收藏视图切换组件
 * P2-007: Markdown 内容收藏 - 列表/卡片视图切换
 */

"use client";

import { memo } from "react";
import { List, LayoutGrid, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MdViewMode } from "../types";

interface MdViewToggleProps {
  /** 当前视图模式 */
  value: MdViewMode;
  /** 切换回调 */
  onChange: (mode: MdViewMode) => void;
  /** 自定义类名 */
  className?: string;
}

const VIEW_OPTIONS: {
  mode: MdViewMode;
  label: string;
  Icon: React.ElementType;
}[] = [
  { mode: "list", label: "列表视图", Icon: List },
  { mode: "card", label: "卡片视图", Icon: LayoutGrid },
];

/**
 * 视图切换下拉菜单
 */
export const MdViewToggle = memo(function MdViewToggle({
  value,
  onChange,
  className,
}: MdViewToggleProps) {
  const current = VIEW_OPTIONS.find((o) => o.mode === value) ?? VIEW_OPTIONS[0];
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-7 px-2 text-xs gap-1", className)}
        >
          <CurrentIcon className="w-3 h-3" />
          {current.label}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {VIEW_OPTIONS.map(({ mode, label, Icon }) => (
          <DropdownMenuItem
            key={mode}
            onClick={() => onChange(mode)}
            className="flex items-center gap-2 text-xs cursor-pointer"
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="flex-1">{label}</span>
            {value === mode && <Check className="w-3 h-3 opacity-70" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default MdViewToggle;
