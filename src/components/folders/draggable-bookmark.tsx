/**
 * 可拖拽书签包装组件
 *
 * 将任意书签组件包装为可拖拽元素
 * 用于实现书签拖拽到文件夹的功能
 */

"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { BookmarkDragData } from "./folder-drop-context";

interface DraggableBookmarkProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题（用于拖拽预览） */
  bookmarkTitle: string;
  /** 子元素（书签卡片/列表项） */
  children: ReactNode;
  /** 是否禁用拖拽 */
  disabled?: boolean;
  /** 额外的类名 */
  className?: string;
}

/**
 * 可拖拽书签包装组件
 *
 * @example
 * ```tsx
 * <DraggableBookmark bookmarkId={123} bookmarkTitle="React Docs">
 *   <BookmarkCard bookmark={bookmark} />
 * </DraggableBookmark>
 * ```
 */
export function DraggableBookmark({
  bookmarkId,
  bookmarkTitle,
  children,
  disabled = false,
  className,
}: DraggableBookmarkProps) {
  const dragData: BookmarkDragData = {
    type: "bookmark",
    id: bookmarkId,
    title: bookmarkTitle,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: bookmarkId,
      data: dragData,
      disabled,
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-none", isDragging && "opacity-50 z-50", className)}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
