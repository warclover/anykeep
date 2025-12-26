/**
 * 附件弹出面板组件
 *
 * 桌面端使用 Popover，移动端使用底部 Sheet
 * 自动根据设备类型切换
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/ai/use-is-mobile";
import { cn } from "@/lib/utils";
import { AttachmentPanelContent } from "./attachment-panel-content";
import { type AttachmentItem } from "./types";
import type { Bookmark } from "@/types/supabase";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentPopoverProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 触发元素 */
  trigger: ReactNode;
  /** 已选附件列表 */
  selectedItems: AttachmentItem[];
  /** 选择变化回调 */
  onSelectionChange: (items: AttachmentItem[]) => void;
  /** 最大数量 */
  maxCount?: number;
  /** 书签列表 */
  bookmarks: Bookmark[];
  /** 是否正在加载书签 */
  isLoadingBookmarks?: boolean;
  /** 搜索关键词 */
  searchQuery: string;
  /** 搜索关键词变化回调 */
  onSearchChange: (query: string) => void;
  /** 是否正在搜索 */
  isSearching?: boolean;
  /** 是否为搜索模式 */
  isSearchMode?: boolean;
  /** 文件处理中 */
  isProcessingFile?: boolean;
  /** 添加文件回调 */
  onFilesAdd: (files: File[]) => void;
}

// =============================================================================
// 桌面端 Popover 实现
// =============================================================================

function DesktopPopover({
  open,
  onOpenChange,
  trigger,
  ...contentProps
}: AttachmentPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={cn("w-[300px] p-0", "overflow-hidden")}
        side="left"
        align="end"
        sideOffset={12}
        alignOffset={0}
        collisionPadding={16}
      >
        <AttachmentPanelContent
          {...contentProps}
          onClose={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// 移动端 Sheet 实现
// =============================================================================

function MobileSheet({
  open,
  onOpenChange,
  trigger,
  ...contentProps
}: AttachmentPopoverProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className={cn(
          "h-[70vh] max-h-[70vh]",
          "rounded-t-2xl",
          "p-0",
          // 隐藏默认的关闭按钮，使用内容区的关闭按钮
          "[&>[data-slot=sheet-close]]:hidden",
        )}
      >
        {/* 拖动条 */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-gray-300" />
        </div>
        <AttachmentPanelContent
          {...contentProps}
          onClose={() => onOpenChange(false)}
          className="h-[calc(70vh-20px)]"
        />
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// 主组件（自动选择）
// =============================================================================

export function AttachmentPopover(props: AttachmentPopoverProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileSheet {...props} />;
  }

  return <DesktopPopover {...props} />;
}

export default AttachmentPopover;
