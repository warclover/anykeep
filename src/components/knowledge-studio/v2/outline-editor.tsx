/**
 * Outline Editor v2 - 增强大纲编辑器
 * @module knowledge-studio/v2
 *
 * 功能:
 * - 树形大纲展示
 * - 拖拽排序（dnd-kit）
 * - 节点编辑（标题/描述）
 * - 添加/删除节点
 * - 版本快照对比
 * - 确认/重新生成按钮
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RotateCcw,
  FileText,
  Hash,
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type {
  BlueprintOutline,
  OutlineNode,
} from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

export interface OutlineEditorV2Props {
  /** 大纲数据 */
  outline: BlueprintOutline;
  /** 大纲变更回调 */
  onChange: (outline: BlueprintOutline) => void;
  /** 确认大纲回调 */
  onConfirm: (outline: BlueprintOutline) => void;
  /** 重新生成回调 */
  onRegenerate: () => void;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大高度 */
  maxHeight?: string;
  /** 是否正在重新生成 */
  isRegenerating?: boolean;
  /** 版本历史 */
  versionHistory?: BlueprintOutline[];
  /** 选择历史版本回调 */
  onSelectVersion?: (version: BlueprintOutline) => void;
  /** 类名 */
  className?: string;
}

interface ExpandedState {
  [nodeId: string]: boolean;
}

// ============================================================
// Utility Functions
// ============================================================

function flattenOutlineNodes(nodes: OutlineNode[]): OutlineNode[] {
  const result: OutlineNode[] = [];
  function traverse(nodeList: OutlineNode[]) {
    for (const node of nodeList) {
      result.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return result;
}

function countOutlineNodes(nodes: OutlineNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children) {
      count += countOutlineNodes(node.children);
    }
  }
  return count;
}

function updateNodeInTree(
  nodes: OutlineNode[],
  nodeId: string,
  updates: Partial<OutlineNode>,
): OutlineNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeId, updates),
      };
    }
    return node;
  });
}

function deleteNodeFromTree(
  nodes: OutlineNode[],
  nodeId: string,
): OutlineNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: deleteNodeFromTree(node.children, nodeId),
        };
      }
      return node;
    });
}

function moveNodeInTree(
  nodes: OutlineNode[],
  activeId: string,
  overId: string,
): OutlineNode[] {
  const activeIndex = nodes.findIndex((n) => n.id === activeId);
  const overIndex = nodes.findIndex((n) => n.id === overId);

  if (activeIndex !== -1 && overIndex !== -1) {
    const result = [...nodes];
    const [removed] = result.splice(activeIndex, 1);
    result.splice(overIndex, 0, removed);
    return result;
  }

  return nodes.map((node) => {
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: moveNodeInTree(node.children, activeId, overId),
      };
    }
    return node;
  });
}

function calculateTotalWords(nodes: OutlineNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += node.estimatedWords ?? 0;
    if (node.children) {
      total += calculateTotalWords(node.children);
    }
  }
  return total;
}

/**
 * Sanitize user input to prevent XSS
 * Removes HTML tags and dangerous characters
 */
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>'"&]/g, ""); // Remove dangerous characters
}

// ============================================================
// Sortable Tree Item
// ============================================================

interface SortableTreeItemProps {
  node: OutlineNode;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<OutlineNode>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * SortableTreeItem - memoized to prevent unnecessary re-renders during drag operations
 */
const SortableTreeItem = React.memo(function SortableTreeItem({
  node,
  isExpanded,
  hasChildren,
  onToggleExpand,
  onUpdate,
  onDelete,
  disabled,
}: SortableTreeItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = () => {
    const sanitized = sanitizeInput(editTitle);
    if (sanitized) {
      onUpdate({ title: sanitized });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(node.title);
    setIsEditing(false);
  };

  const levelIndent = (node.level - 1) * 20;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginLeft: levelIndent }}
      className={cn(
        "flex items-center gap-2 py-2 px-3 rounded-lg group",
        "hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50 bg-accent",
      )}
    >
      {/* 拖拽手柄 */}
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* 展开/折叠按钮 */}
      {hasChildren ? (
        <button
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="w-4" />
      )}

      {/* 层级标记 */}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
        H{node.level}
      </Badge>

      {/* 标题 */}
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSave}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCancel}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <span className="flex-1 text-sm font-medium truncate">
          {node.title}
        </span>
      )}

      {/* 预估字数 */}
      {node.estimatedWords && (
        <span className="text-xs text-muted-foreground shrink-0">
          ~{node.estimatedWords}字
        </span>
      )}

      {/* 操作按钮 */}
      {!disabled && !isEditing && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
});

// ============================================================
// Main Component
// ============================================================

export function OutlineEditorV2({
  outline,
  onChange,
  onConfirm,
  onRegenerate,
  readOnly = false,
  maxHeight = "400px",
  isRegenerating = false,
  versionHistory = [],
  onSelectVersion: _onSelectVersion,
  className,
}: OutlineEditorV2Props) {
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const initial: ExpandedState = {};
    outline.nodes.forEach((node) => {
      if (node.level === 1) {
        initial[node.id] = true;
      }
    });
    return initial;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [originalOutline] = useState(outline);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const flatNodes = useMemo(
    () => flattenOutlineNodes(outline.nodes),
    [outline.nodes],
  );

  const stats = useMemo(
    () => ({
      totalNodes: countOutlineNodes(outline.nodes),
      totalWords:
        outline.totalEstimatedWords || calculateTotalWords(outline.nodes),
      h1Count: outline.nodes.length,
    }),
    [outline],
  );

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpanded((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const allExpanded: ExpandedState = {};
    flatNodes.forEach((node) => {
      allExpanded[node.id] = true;
    });
    setExpanded(allExpanded);
  }, [flatNodes]);

  const handleCollapseAll = useCallback(() => {
    setExpanded({});
  }, []);

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<OutlineNode>) => {
      if (readOnly) return;
      const newNodes = updateNodeInTree(outline.nodes, nodeId, updates);
      onChange({
        ...outline,
        nodes: newNodes,
        totalEstimatedWords: calculateTotalWords(newNodes),
      });
    },
    [outline, onChange, readOnly],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      const newNodes = deleteNodeFromTree(outline.nodes, nodeId);
      onChange({
        ...outline,
        nodes: newNodes,
        totalEstimatedWords: calculateTotalWords(newNodes),
      });
      setDeleteConfirm(null);
    },
    [outline, onChange, readOnly],
  );

  const handleReset = useCallback(() => {
    onChange(originalOutline);
  }, [originalOutline, onChange]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id || readOnly) return;
      const newNodes = moveNodeInTree(
        outline.nodes,
        active.id as string,
        over.id as string,
      );
      onChange({ ...outline, nodes: newNodes });
    },
    [outline, onChange, readOnly],
  );

  const activeNode = useMemo(
    () => flatNodes.find((n) => n.id === activeId),
    [flatNodes, activeId],
  );

  // Render tree nodes recursively (plain function, not useCallback, to avoid recursive reference issue)
  function renderNodes(nodes: OutlineNode[]): React.ReactNode {
    return nodes.map((node) => {
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const isExpanded = expanded[node.id] ?? false;

      return (
        <div key={node.id}>
          <SortableTreeItem
            node={node}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            onToggleExpand={() => handleToggleExpand(node.id)}
            onUpdate={(updates) => handleUpdateNode(node.id, updates)}
            onDelete={() => setDeleteConfirm(node.id)}
            disabled={readOnly}
          />
          {hasChildren && isExpanded && node.children && (
            <div>{renderNodes(node.children)}</div>
          )}
        </div>
      );
    });
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="size-5" />
              大纲编辑器
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleExpandAll}>
                <ChevronDown className="size-4 mr-1" />
                展开
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
                <ChevronUp className="size-4 mr-1" />
                折叠
              </Button>
              {versionHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="size-4 mr-1" />
                  历史
                </Button>
              )}
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="size-4 mr-1" />
                  重置
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Hash className="size-3" />
              {stats.h1Count} 个主章节
            </span>
            <span>{stats.totalNodes} 个节点</span>
            <span>~{stats.totalWords.toLocaleString()} 字</span>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <ScrollArea style={{ maxHeight }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={flatNodes.map((n) => n.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5 pr-4">
                  {renderNodes(outline.nodes)}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeNode && (
                  <div className="bg-accent rounded-lg p-2 shadow-lg opacity-90">
                    <span className="font-medium">{activeNode.title}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                重新生成中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                重新生成
              </>
            )}
          </Button>
          <Button onClick={() => onConfirm(outline)} disabled={isRegenerating}>
            <Check className="mr-2 h-4 w-4" />
            确认大纲
          </Button>
        </CardFooter>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个节点吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteNode(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OutlineEditorV2;
