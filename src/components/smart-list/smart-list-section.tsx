/**
 * 智能列表区块组件
 * @description 侧边栏中显示智能列表区块的容器组件，支持拖拽排序
 * @version 10.1.0
 */

"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SmartListItem } from "./smart-list-item";
import { SmartListEditorDialog } from "./smart-list-editor-dialog";
import { useSmartLists } from "@/hooks/use-smart-lists";
import { cn } from "@/lib/utils";
import type {
  SmartListClient,
  CreateSmartListRequest,
  UpdateSmartListRequest,
} from "@/types/smart-list";

// ============================================
// 类型定义
// ============================================

export interface SmartListSectionProps {
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 是否显示创建按钮 */
  showCreateButton?: boolean;
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
// 组件实现
// ============================================

export function SmartListSection({
  defaultExpanded = true,
  showCreateButton = true,
}: SmartListSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 对话框状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSmartList, setEditingSmartList] = useState<
    SmartListClient | undefined
  >();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 使用 SWR Hook 获取智能列表
  const {
    smartLists,
    isLoading,
    error,
    refresh,
    create,
    update,
    togglePin,
    remove,
    preview,
    reorder,
    initPresets,
  } = useSmartLists({
    includePresets: true,
    enabled: true,
  });

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
        await reorder(newIds);
      } catch (err) {
        toast.error("排序失败，请稍后重试");
        console.error("Failed to reorder smart lists:", err);
      }
    },
    [smartLists, reorder],
  );

  // 处理置顶切换
  const handleTogglePin = useCallback(
    async (id: number, isPinned: boolean) => {
      try {
        await togglePin(id, isPinned);
        toast.success(isPinned ? "已置顶" : "已取消置顶");
      } catch (err) {
        toast.error("操作失败，请稍后重试");
        console.error("Failed to toggle pin:", err);
      }
    },
    [togglePin],
  );

  // 处理删除确认
  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmId === null) return;

    try {
      await remove(deleteConfirmId);
      toast.success("智能列表已删除");
    } catch (err) {
      toast.error("删除失败，请稍后重试");
      console.error("Failed to delete smart list:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, remove]);

  // 初始化预设
  const handleInitPresets = useCallback(async () => {
    try {
      const count = await initPresets();
      toast.success(`已创建 ${count} 个预设智能列表`);
    } catch (err) {
      toast.error("初始化失败，请稍后重试");
      console.error("Failed to init presets:", err);
    }
  }, [initPresets]);

  // 切换展开/收起
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 打开新建对话框
  const handleCreate = useCallback(() => {
    setEditingSmartList(undefined);
    setIsEditorOpen(true);
  }, []);

  // 打开编辑对话框
  const handleEdit = useCallback((smartList: SmartListClient) => {
    setEditingSmartList(smartList);
    setIsEditorOpen(true);
  }, []);

  // 保存（创建或更新）
  const handleSave = useCallback(
    async (data: CreateSmartListRequest | UpdateSmartListRequest) => {
      try {
        if (editingSmartList) {
          await update(editingSmartList.id, data as UpdateSmartListRequest);
          toast.success("智能列表已更新");
        } else {
          await create(data as CreateSmartListRequest);
          toast.success("智能列表已创建");
        }
      } catch (err) {
        toast.error(
          editingSmartList ? "更新失败，请稍后重试" : "创建失败，请稍后重试",
        );
        throw err; // 重新抛出以便对话框处理
      }
    },
    [editingSmartList, create, update],
  );

  // 加载中状态
  if (isLoading) {
    return (
      <div className="py-2">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
            智能列表
          </p>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="py-2">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
            智能列表
          </p>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-red-500 mb-2">
            <AlertTriangle className="size-3.5" />
            <span>加载失败</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => refresh()}
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 空状态 - 提示初始化预设
  if (smartLists.length === 0) {
    return (
      <div className="py-2">
        <div className="px-3 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
            智能列表
          </p>
        </div>
        <div className="px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleInitPresets}
          >
            <Plus className="size-3 mr-1" />
            初始化预设模板
          </Button>
        </div>
      </div>
    );
  }

  // 分离置顶和非置顶列表
  const pinnedLists = smartLists.filter((list) => list.isPinned);
  const unpinnedLists = smartLists.filter((list) => !list.isPinned);

  return (
    <>
      <div className="py-2">
        {/* 标题栏 */}
        <div className="px-3 mb-2 flex items-center justify-between">
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            智能列表
          </button>

          {showCreateButton && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={handleCreate}
            >
              <Plus className="size-3" />
            </Button>
          )}
        </div>

        {/* 列表内容（支持拖拽排序） */}
        {isExpanded && (
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
                    onTogglePin={handleTogglePin}
                    onEdit={handleEdit}
                    onDelete={setDeleteConfirmId}
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
                    onTogglePin={handleTogglePin}
                    onEdit={handleEdit}
                    onDelete={setDeleteConfirmId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 编辑对话框 */}
      <SmartListEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        smartList={editingSmartList}
        onSave={handleSave}
        onPreview={preview}
      />

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个智能列表吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SmartListSection;
