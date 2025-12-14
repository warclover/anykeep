/**
 * 智能列表项组件
 * @description 侧边栏中显示单个智能列表的组件
 * @version 10.0.0
 */

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Calendar,
  Star,
  BookOpen,
  Award,
  Eye,
  RefreshCcw,
  Filter,
  Pin,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SMART_LIST_COLORS } from "@/lib/smart-list/presets";
import type { SmartListClient, SmartListColor } from "@/types/smart-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ============================================
// 图标映射
// ============================================

const ICON_MAP: Record<string, typeof Calendar> = {
  calendar: Calendar,
  star: Star,
  "book-open": BookOpen,
  award: Award,
  eye: Eye,
  "refresh-ccw": RefreshCcw,
  filter: Filter,
};

// ============================================
// 类型定义
// ============================================

export interface SmartListItemProps {
  /** 智能列表数据 */
  smartList: SmartListClient;
  /** 是否选中 */
  isActive?: boolean;
  /** 匹配的书签数量（可选，用于显示角标） */
  count?: number;
  /** 是否显示操作菜单 */
  showActions?: boolean;
  /** 置顶操作回调 */
  onTogglePin?: (id: number, isPinned: boolean) => void;
  /** 编辑操作回调 */
  onEdit?: (smartList: SmartListClient) => void;
  /** 删除操作回调 */
  onDelete?: (id: number) => void;
}

// ============================================
// 组件实现
// ============================================

export function SmartListItem({
  smartList,
  isActive,
  count,
  showActions = true,
  onTogglePin,
  onEdit,
  onDelete,
}: SmartListItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 获取图标组件
  const IconComponent = ICON_MAP[smartList.icon] || Filter;

  // 获取颜色配置
  const colorConfig =
    SMART_LIST_COLORS[smartList.color as SmartListColor] ||
    SMART_LIST_COLORS.default;

  // 构建链接 URL
  const href = `/home?smartList=${smartList.id}`;

  // 判断是否激活（如果没有传入 isActive，则根据 URL 判断）
  const currentSmartListId = searchParams?.get("smartList") ?? null;
  const active =
    isActive ??
    (pathname === "/home" && currentSmartListId === String(smartList.id));

  return (
    <div className="group relative">
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
          active
            ? cn(colorConfig.bg, colorConfig.text)
            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50",
        )}
      >
        {/* 图标 */}
        <IconComponent
          className={cn("size-4 shrink-0", active && colorConfig.text)}
        />

        {/* 名称 */}
        <span className="flex-1 truncate">{smartList.name}</span>

        {/* 置顶标记 */}
        {smartList.isPinned && (
          <Pin className="size-3 text-gray-400 dark:text-gray-500" />
        )}

        {/* 数量角标 */}
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              "text-xs tabular-nums",
              active ? colorConfig.text : "text-gray-400 dark:text-gray-500",
            )}
          >
            {count > 999 ? "999+" : count}
          </span>
        )}
      </Link>

      {/* 操作菜单：移动端更大触控区域 */}
      {showActions && !smartList.isPreset && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 md:size-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={(e) => e.preventDefault()}
                aria-label="更多操作"
              >
                <MoreHorizontal className="size-5 md:size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 md:w-40">
              {onTogglePin && (
                <DropdownMenuItem
                  onClick={() => onTogglePin(smartList.id, !smartList.isPinned)}
                  className="py-2.5 md:py-2"
                >
                  <Pin className="size-4 mr-2" />
                  {smartList.isPinned ? "取消置顶" : "置顶"}
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem
                  onClick={() => onEdit(smartList)}
                  className="py-2.5 md:py-2"
                >
                  编辑
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(smartList.id)}
                  className="text-red-600 focus:text-red-600 py-2.5 md:py-2"
                >
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* 预设列表的置顶操作：移动端更大触控区域 */}
      {showActions && smartList.isPreset && onTogglePin && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 md:size-6",
              smartList.isPinned
                ? "text-amber-500 hover:text-amber-600"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
            )}
            onClick={(e) => {
              e.preventDefault();
              onTogglePin(smartList.id, !smartList.isPinned);
            }}
            aria-label={smartList.isPinned ? "取消置顶" : "置顶"}
          >
            <Pin className="size-4 md:size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default SmartListItem;
