/**
 * V4.2.18: 顶部导航栏更多菜单（精简版）
 *
 * 收缩后的菜单内容：
 * - 数据导入、导出、批量选择（仅首页）
 * - 设置（始终显示）
 *
 * 高频操作（视图切换、布局模式、排序）已移至 HeaderToolbar
 */

"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  MoreHorizontal,
  Upload,
  Download,
  CheckSquare,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import type { DialogType } from "@/components/home/types";

export function HeaderMenu() {
  const router = useRouter();
  const pathname = usePathname();

  // 获取 HomePageContext（安全版本，不抛错）
  const homeContext = useHomePageSafe();

  // 仅在首页显示完整菜单
  const isHomePage = pathname === "/home";

  // 菜单开关状态
  const [isOpen, setIsOpen] = useState(false);

  /**
   * 触发对话框
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const triggerDialog = (dialogType: DialogType) => {
    if (homeContext) {
      homeContext.dialog.openDialogAction(dialogType);
    } else {
      uiEventBus.emit(UIEvents.DIALOG_OPEN, { type: dialogType });
    }
    setIsOpen(false);
  };

  /**
   * 切换批量选择模式
   * 优先使用 Context，Fallback 到 UIEventBus
   */
  const triggerSelectionMode = () => {
    if (homeContext) {
      homeContext.selection.toggleSelectionMode();
    } else {
      uiEventBus.emit(UIEvents.SELECTION_TOGGLE, { enabled: true });
    }
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex"
          aria-label="更多操作"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {/* 操作菜单（仅首页显示） */}
        {isHomePage && (
          <>
            <DropdownMenuItem onClick={() => router.push("/import")}>
              <Upload className="size-4 mr-2" />
              数据导入
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => triggerDialog("export")}>
              <Download className="size-4 mr-2" />
              导出
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={triggerSelectionMode}>
              <CheckSquare className="size-4 mr-2" />
              批量选择
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* 设置（始终显示） */}
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-4 mr-2" />
          设置
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
