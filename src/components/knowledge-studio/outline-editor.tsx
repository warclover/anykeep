/**
 * 大纲编辑器组件 (Story 2.2)
 * @module knowledge-studio/outline-editor
 *
 * 可视化编辑生成的大纲：
 * - 树形结构展示 H1/H2/H3 层级
 * - 折叠/展开章节
 * - 编辑章节标题
 * - 删除章节（带确认）
 * - dnd-kit 拖拽排序
 * - 实时更新预览
 */

"use client";

import { useState, useCallback, useMemo } from "react";
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
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FileText,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OutlineTreeItem } from "./outline-tree-item";
import {
  type BlueprintOutline,
  type OutlineNode,
  countOutlineNodes,
  flattenOutlineNodes,
} from "@/lib/knowledge-studio/blueprint";

// ============================================================
// Types
// ============================================================

export interface OutlineEditorProps {
  /** 大纲数据 */
  outline: BlueprintOutline;
  /** 大纲变更回调 */
  onChange: (outline: BlueprintOutline) => void;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大高度 */
  maxHeight?: string;
  /** 是否显示预览 */
  showPreview?: boolean;
  /** 类名 */
  className?: string;
}

interface ExpandedState {
  [nodeId: string]: boolean;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 递归更新节点
 */
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

/**
 * 递归删除节点
 */
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

/**
 * 移动节点
 */
function moveNodeInTree(
  nodes: OutlineNode[],
  activeId: string,
  overId: string,
): OutlineNode[] {
  const activeIndex = nodes.findIndex((n) => n.id === activeId);
  const overIndex = nodes.findIndex((n) => n.id === overId);

  // 如果都在当前层级
  if (activeIndex !== -1 && overIndex !== -1) {
    const result = [...nodes];
    const [removed] = result.splice(activeIndex, 1);
    result.splice(overIndex, 0, removed);
    return result;
  }

  // 递归查找子节点
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

/**
 * 计算总字数
 */
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

// ============================================================
// Component
// ============================================================

export function OutlineEditor({
  outline,
  onChange,
  readOnly = false,
  maxHeight = "500px",
  showPreview = true,
  className,
}: OutlineEditorProps) {
  // 展开状态
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    // 默认展开 H1 节点
    const initial: ExpandedState = {};
    outline.nodes.forEach((node) => {
      if (node.level === 1) {
        initial[node.id] = true;
      }
    });
    return initial;
  });

  // 当前拖拽的节点
  const [activeId, setActiveId] = useState<string | null>(null);

  // 原始大纲（用于重置）
  const [originalOutline] = useState(outline);

  // 配置传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 扁平化节点列表（用于 SortableContext）
  const flatNodes = useMemo(
    () => flattenOutlineNodes(outline.nodes),
    [outline.nodes],
  );

  // 统计信息
  const stats = useMemo(
    () => ({
      totalNodes: countOutlineNodes(outline.nodes),
      totalWords:
        outline.totalEstimatedWords || calculateTotalWords(outline.nodes),
      h1Count: outline.nodes.length,
    }),
    [outline],
  );

  // 切换节点展开
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  // 全部展开
  const handleExpandAll = useCallback(() => {
    const allExpanded: ExpandedState = {};
    flatNodes.forEach((node) => {
      allExpanded[node.id] = true;
    });
    setExpanded(allExpanded);
  }, [flatNodes]);

  // 全部折叠
  const handleCollapseAll = useCallback(() => {
    setExpanded({});
  }, []);

  // 更新节点
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

  // 删除节点
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;

      const newNodes = deleteNodeFromTree(outline.nodes, nodeId);
      onChange({
        ...outline,
        nodes: newNodes,
        totalEstimatedWords: calculateTotalWords(newNodes),
      });
    },
    [outline, onChange, readOnly],
  );

  // 重置大纲
  const handleReset = useCallback(() => {
    onChange(originalOutline);
  }, [originalOutline, onChange]);

  // 开始拖拽
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // 结束拖拽
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

      onChange({
        ...outline,
        nodes: newNodes,
      });
    },
    [outline, onChange, readOnly],
  );

  // 递归渲染节点（使用 useMemo + 内部递归函数避免 hooks 规则问题）
  const renderedNodes = useMemo(() => {
    const renderNodesRecursive = (nodes: OutlineNode[]): React.ReactNode => {
      return nodes.map((node) => {
        const hasChildren = Boolean(node.children && node.children.length > 0);
        const isExpanded = expanded[node.id] ?? false;

        return (
          <div key={node.id}>
            <OutlineTreeItem
              node={node}
              isExpanded={isExpanded}
              hasChildren={hasChildren}
              onToggleExpand={() => handleToggleExpand(node.id)}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              disabled={readOnly}
            />
            {hasChildren && isExpanded && node.children && (
              <div className="ml-2">{renderNodesRecursive(node.children)}</div>
            )}
          </div>
        );
      });
    };
    return renderNodesRecursive(outline.nodes);
  }, [
    outline.nodes,
    expanded,
    handleToggleExpand,
    handleUpdateNode,
    handleDeleteNode,
    readOnly,
  ]);

  // 找到当前拖拽的节点
  const activeNode = useMemo(
    () => flatNodes.find((n) => n.id === activeId),
    [flatNodes, activeId],
  );

  return (
    <div className={cn("flex gap-4", className)}>
      {/* 主编辑区 */}
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="size-5" />
              大纲编辑器
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpandAll}
                title="全部展开"
              >
                <ChevronDown className="size-4 mr-1" />
                展开
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCollapseAll}
                title="全部折叠"
              >
                <ChevronUp className="size-4 mr-1" />
                折叠
              </Button>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  title="重置大纲"
                >
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
                <div className="space-y-0.5 pr-4">{renderedNodes}</div>
              </SortableContext>

              {/* 拖拽覆盖层 */}
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
      </Card>

      {/* 预览区 */}
      {showPreview && (
        <Card className="w-80 flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">大纲预览</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea style={{ maxHeight }}>
              <div className="space-y-2 pr-4">
                <h2 className="font-bold text-lg">{outline.title}</h2>
                {outline.summary && (
                  <p className="text-sm text-muted-foreground">
                    {outline.summary}
                  </p>
                )}
                <div className="mt-4 space-y-1">
                  {flatNodes.map((node) => (
                    <div
                      key={node.id}
                      className={cn(
                        "text-sm",
                        node.level === 1 && "font-semibold mt-3",
                        node.level === 2 && "pl-4 text-muted-foreground",
                        node.level === 3 &&
                          "pl-8 text-muted-foreground/80 text-xs",
                      )}
                    >
                      {node.level === 1 && "● "}
                      {node.level === 2 && "○ "}
                      {node.level === 3 && "- "}
                      {node.title}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Badge variant="secondary">
                    预计 {stats.totalWords.toLocaleString()} 字
                  </Badge>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
