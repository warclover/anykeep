/**
 * 可放置文件夹项包装组件
 *
 * 将文件夹导航项包装为可放置区域
 * 当书签拖拽到上方时高亮显示
 */

"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { FolderDropData } from "./folder-drop-context";

interface DroppableFolderProps {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 子元素（文件夹导航项） */
  children: ReactNode;
  /** 是否禁用放置（如系统文件夹） */
  disabled?: boolean;
  /** 额外的类名 */
  className?: string;
}

/**
 * 可放置文件夹包装组件
 *
 * @example
 * ```tsx
 * <DroppableFolder folderId={456} folderName="工作">
 *   <NavItem label="工作" ... />
 * </DroppableFolder>
 * ```
 */
export function DroppableFolder({
  folderId,
  folderName,
  children,
  disabled = false,
  className,
}: DroppableFolderProps) {
  const dropData: FolderDropData = {
    type: "folder",
    id: folderId,
    name: folderName,
  };

  const { setNodeRef, isOver, active } = useDroppable({
    id: folderId,
    data: dropData,
    disabled,
  });

  // 只在有拖拽活动且悬停时高亮
  const isActiveOver = isOver && active !== null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-colors duration-150",
        isActiveOver &&
          "ring-2 ring-primary ring-inset rounded-lg bg-primary/5",
        className,
      )}
    >
      {children}

      {/* 放置提示覆盖层 */}
      {isActiveOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg bg-primary/10">
          <span className="text-xs font-medium text-primary">
            放置到「{folderName}」
          </span>
        </div>
      )}
    </div>
  );
}
