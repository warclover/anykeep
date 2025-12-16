/**
 * 可排序智能列表内容组件（懒加载）
 * @description 包含 @dnd-kit 拖拽排序功能，通过 dynamic import 按需加载
 * @version V4.2.24 - 性能优化：DnD 库懒加载（-30KB 初始包体积）
 */

"use client";

import { useCallback } from "react";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SmartListItem } from "./smart-list-item";
import { cn } from "@/lib/utils";
import type { SmartListClient } from "@/types/smart-list";

// ============================================
// 类型定义
// ============================================

export interface SortableSmartListContentProps {
  /** 智能列表数据 */
  smartLists: SmartListClient[];
  /** 置顶列表 */
  pinnedLists: SmartListClient[];
  /** 非置顶列表 */
  unpinnedLists: SmartListClient[];
  /** 重新排序回调 */
  onReorder: (ids: number[]) => Promise<void>;
  /** 切换置顶回调 */
  onTogglePin: (id: number, isPinned: boolean) => void;
  /** 编辑回调 */
  onEdit: (smartList: SmartListClient) => void;
  /** 删除回调 */
  onDelete: (id: number) => void;
}

// ============================================
// 可排序列表项组件
// ============================================

interface SortableSmartListItemProps {
  smartList: SmartListClient;
  onTogglePin: (id: number, isPinned: boolean) => void;
  onEdit: (smartList: SmartListClient) => void;
  onDelete: (id: number) => void;
}

function SortableSmartListItem({
  smartList,
  onTogglePin,
  onEdit,
  onDelete,
}: SortableSmartListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: smartList.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center",
        isDragging && "opacity-50 z-50",
      )}
    >
      {/* 拖拽手柄：移动端始终可见，桌面端 hover 显示 */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 opacity-40 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1.5 -ml-1 touch-none"
        aria-label="拖拽排序"
      >
        <GripVertical className="size-4 md:size-3 text-gray-400" />
      </div>

      {/* 智能列表项 */}
      <div className="flex-1 pl-4 group-hover:pl-4">
        <SmartListItem
          smartList={smartList}
          count={smartList.bookmarkCount}
          onTogglePin={onTogglePin}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function SortableSmartListContent({
  smartLists,
  pinnedLists,
  unpinnedLists,
  onReorder,
  onTogglePin,
  onEdit,
  onDelete,
}: SortableSmartListContentProps) {
  // 拖拽传感器配置（支持鼠标、触屏、键盘）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 最小拖拽距离，避免误触
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 长按延迟，区分滚动和拖拽
        tolerance: 5, // 容差范围
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 处理拖拽结束
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      // 找到拖拽项在列表中的位置
      const oldIndex = smartLists.findIndex((item) => item.id === active.id);
      const newIndex = smartLists.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // 计算新顺序
      const newOrder = arrayMove(smartLists, oldIndex, newIndex);
      const newIds = newOrder.map((item) => item.id);

      // 调用 API 保存新顺序
      try {
        await onReorder(newIds);
      } catch (err) {
        toast.error("排序失败，请稍后重试");
        console.error("Failed to reorder smart lists:", err);
      }
    },
    [smartLists, onReorder],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={smartLists.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-0.5">
          {/* 置顶列表 */}
          {pinnedLists.map((smartList) => (
            <SortableSmartListItem
              key={smartList.id}
              smartList={smartList}
              onTogglePin={onTogglePin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}

          {/* 分隔线（如果有置顶和非置顶列表） */}
          {pinnedLists.length > 0 && unpinnedLists.length > 0 && (
            <div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-800" />
          )}

          {/* 非置顶列表 */}
          {unpinnedLists.map((smartList) => (
            <SortableSmartListItem
              key={smartList.id}
              smartList={smartList}
              onTogglePin={onTogglePin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default SortableSmartListContent;
