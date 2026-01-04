/**
 * 大纲节点项组件 (Story 2.2)
 * @module knowledge-studio/outline-editor
 *
 * 单个大纲节点，支持：
 * - 拖拽排序 (dnd-kit)
 * - 折叠/展开
 * - 编辑标题
 * - 删除（带确认）
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { OutlineNode } from "@/lib/knowledge-studio/blueprint";

// ============================================================
// Types
// ============================================================

export interface OutlineTreeItemProps {
  /** 节点数据 */
  node: OutlineNode;
  /** 是否展开 */
  isExpanded: boolean;
  /** 是否有子节点 */
  hasChildren: boolean;
  /** 切换展开回调 */
  onToggleExpand: () => void;
  /** 更新节点回调 */
  onUpdateNode: (id: string, updates: Partial<OutlineNode>) => void;
  /** 删除节点回调 */
  onDeleteNode: (id: string) => void;
  /** 是否禁用（用于拖拽时） */
  disabled?: boolean;
}

// ============================================================
// Level Styles
// ============================================================

const LEVEL_STYLES: Record<
  1 | 2 | 3,
  { indent: string; textSize: string; dotColor: string }
> = {
  1: {
    indent: "pl-2",
    textSize: "text-base font-semibold",
    dotColor: "bg-primary",
  },
  2: {
    indent: "pl-8",
    textSize: "text-sm font-medium",
    dotColor: "bg-primary/70",
  },
  3: {
    indent: "pl-14",
    textSize: "text-sm",
    dotColor: "bg-primary/50",
  },
};

// ============================================================
// Component
// ============================================================

export function OutlineTreeItem({
  node,
  isExpanded,
  hasChildren,
  onToggleExpand,
  onUpdateNode,
  onDeleteNode,
  disabled = false,
}: OutlineTreeItemProps) {
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // 删除确认对话框
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // dnd-kit 排序
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const levelStyle = LEVEL_STYLES[node.level];

  // 聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    setEditValue(node.title);
    setIsEditing(true);
  }, [node.title]);

  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== node.title) {
      onUpdateNode(node.id, { title: trimmed });
    }
    setIsEditing(false);
  }, [editValue, node.id, node.title, onUpdateNode]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditValue(node.title);
    setIsEditing(false);
  }, [node.title]);

  // 键盘事件处理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSaveEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit],
  );

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    onDeleteNode(node.id);
    setShowDeleteDialog(false);
  }, [node.id, onDeleteNode]);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative flex items-center gap-2 py-2 px-2 rounded-lg transition-colors",
          "hover:bg-accent/50",
          isDragging && "opacity-50 z-50 bg-accent",
          levelStyle.indent,
        )}
      >
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "flex-shrink-0 cursor-grab active:cursor-grabbing p-1 -ml-1 touch-none",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            disabled && "opacity-0 pointer-events-none",
          )}
          aria-label="拖拽排序"
        >
          <GripVertical className="size-4 text-muted-foreground" />
        </div>

        {/* 展开/折叠按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-6 flex-shrink-0", !hasChildren && "invisible")}
          onClick={onToggleExpand}
          disabled={!hasChildren}
          aria-label={isExpanded ? "折叠章节" : "展开章节"}
        >
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>

        {/* 层级指示点 */}
        <div
          className={cn(
            "size-2 rounded-full flex-shrink-0",
            levelStyle.dotColor,
          )}
        />

        {/* 标题 */}
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              className="h-7 text-sm"
              placeholder="输入章节标题"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-6 flex-shrink-0"
              onClick={handleSaveEdit}
            >
              <Check className="size-3 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 flex-shrink-0"
              onClick={handleCancelEdit}
            >
              <X className="size-3 text-destructive" />
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "flex-1",
              !disabled && "cursor-pointer",
              levelStyle.textSize,
            )}
            onDoubleClick={disabled ? undefined : handleStartEdit}
          >
            <span>{node.title}</span>
            {node.description && (
              <span className="ml-2 text-xs text-muted-foreground">
                {node.description.length > 50
                  ? `${node.description.slice(0, 50)}...`
                  : node.description}
              </span>
            )}
          </div>
        )}

        {/* 预估字数 */}
        {node.estimatedWords && !isEditing && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            ~{node.estimatedWords}字
          </span>
        )}

        {/* 操作按钮 */}
        {!isEditing && (
          <div
            className={cn(
              "flex items-center gap-0.5 flex-shrink-0",
              "opacity-0 group-hover:opacity-100 transition-opacity",
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleStartEdit}
              aria-label="编辑标题"
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              aria-label="删除章节"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{node.title}」章节吗？
              {hasChildren && (
                <span className="block mt-2 text-destructive">
                  注意：此章节包含子章节，将一并删除！
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
