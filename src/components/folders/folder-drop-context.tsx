/**
 * 文件夹页面拖拽上下文
 *
 * 提供书签拖拽到文件夹的功能
 * 使用 @dnd-kit 实现平滑的拖拽体验
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useBookmarkMove } from "@/hooks/data/use-bookmark-move";
import { toast } from "sonner";

// ==================== 类型定义 ====================

interface DraggedBookmark {
  id: number;
  title: string;
}

interface FolderDropContextValue {
  /** 当前正在拖拽的书签 */
  draggedBookmark: DraggedBookmark | null;
  /** 当前悬停的文件夹 ID */
  activeDropFolderId: number | null;
  /** 是否正在移动 */
  isMoving: boolean;
}

interface FolderDropProviderProps {
  children: ReactNode;
  /** 移动成功后的回调 */
  onMoveSuccess?: () => void;
}

// ==================== Context ====================

const FolderDropContext = createContext<FolderDropContextValue | null>(null);

/**
 * 获取拖拽上下文
 */
export function useFolderDropContext(): FolderDropContextValue {
  const context = useContext(FolderDropContext);
  if (!context) {
    throw new Error(
      "useFolderDropContext must be used within FolderDropProvider",
    );
  }
  return context;
}

// ==================== Provider 组件 ====================

/**
 * 文件夹拖拽 Provider
 *
 * 包裹需要支持拖拽的区域，提供拖拽状态和处理逻辑
 */
export function FolderDropProvider({
  children,
  onMoveSuccess,
}: FolderDropProviderProps) {
  // 拖拽状态
  const [draggedBookmark, setDraggedBookmark] =
    useState<DraggedBookmark | null>(null);
  const [activeDropFolderId, setActiveDropFolderId] = useState<number | null>(
    null,
  );

  // 移动 Hook
  const { moveBookmark, isMoving } = useBookmarkMove({
    onSuccess: () => {
      onMoveSuccess?.();
    },
  });

  // 传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要移动 8px 才开始拖拽，防止误触
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 长按 200ms 开始拖拽
        tolerance: 5,
      },
    }),
  );

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const bookmark = active.data.current as {
      id: number;
      title: string;
    } | null;

    if (bookmark) {
      setDraggedBookmark({
        id: bookmark.id,
        title: bookmark.title,
      });
    }
  }, []);

  // 拖拽悬停
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;

    if (over && over.data.current?.type === "folder") {
      setActiveDropFolderId(over.id as number);
    } else {
      setActiveDropFolderId(null);
    }
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      // 清除拖拽状态
      setDraggedBookmark(null);
      setActiveDropFolderId(null);

      // 检查是否放置到有效的文件夹
      if (!over || over.data.current?.type !== "folder") {
        return;
      }

      const bookmarkId = active.id as number;
      const targetFolderId = over.id as number;

      // 执行移动
      await moveBookmark(bookmarkId, targetFolderId);
    },
    [moveBookmark],
  );

  // 拖拽取消
  const handleDragCancel = useCallback(() => {
    // 只有正在拖拽时才显示取消提示
    if (draggedBookmark) {
      toast.info("已取消移动", { duration: 1500 });
    }
    setDraggedBookmark(null);
    setActiveDropFolderId(null);
  }, [draggedBookmark]);

  const contextValue: FolderDropContextValue = {
    draggedBookmark,
    activeDropFolderId,
    isMoving,
  };

  return (
    <FolderDropContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/* 拖拽预览层 */}
        <DragOverlay dropAnimation={null}>
          {draggedBookmark && (
            <div
              className={cn(
                "px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border",
                "text-sm font-medium truncate max-w-[200px]",
              )}
            >
              {draggedBookmark.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </FolderDropContext.Provider>
  );
}

// ==================== 工具类型 ====================

/**
 * 书签拖拽数据类型
 */
export interface BookmarkDragData {
  type: "bookmark";
  id: number;
  title: string;
}

/**
 * 文件夹放置数据类型
 */
export interface FolderDropData {
  type: "folder";
  id: number;
  name: string;
}
