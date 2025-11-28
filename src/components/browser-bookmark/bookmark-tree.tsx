"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { ParsedBookmarkNode } from "@/lib/browser-bookmark";

interface BookmarkTreeProps {
  nodes: ParsedBookmarkNode[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  expandedIds?: Set<string>;
  onExpandChange?: (ids: Set<string>) => void;
  maxHeight?: string;
}

interface TreeNodeProps {
  node: ParsedBookmarkNode;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleSelect: (id: string, node: ParsedBookmarkNode) => void;
  onToggleExpand: (id: string) => void;
  getCheckState: (
    node: ParsedBookmarkNode,
  ) => "checked" | "unchecked" | "indeterminate";
}

function TreeNode({
  node,
  selectedIds,
  expandedIds,
  onToggleSelect,
  onToggleExpand,
  getCheckState,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const checkState = getCheckState(node);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/50",
          "cursor-pointer",
        )}
        style={{ paddingLeft: `${(node.depth - 1) * 16 + 4}px` }}
      >
        {/* 展开/折叠按钮 */}
        {node.type === "folder" ? (
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <span className="w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* 复选框 */}
        <Checkbox
          checked={checkState === "checked"}
          // @ts-expect-error - indeterminate is supported
          data-state={
            checkState === "indeterminate" ? "indeterminate" : undefined
          }
          onCheckedChange={() => onToggleSelect(node.id, node)}
          className={cn(
            checkState === "indeterminate" &&
              "data-[state=indeterminate]:bg-primary/50",
          )}
        />

        {/* 图标 */}
        <span className="flex h-5 w-5 items-center justify-center">
          {node.type === "folder" ? (
            <Folder className="h-4 w-4 text-amber-500" />
          ) : (
            <Link className="h-4 w-4 text-blue-500" />
          )}
        </span>

        {/* 标题 */}
        <span
          className="flex-1 truncate text-sm"
          title={
            node.type === "bookmark" ? `${node.title}\n${node.url}` : node.title
          }
          onClick={() => onToggleSelect(node.id, node)}
        >
          {node.title}
        </span>

        {/* 书签数量（仅文件夹） */}
        {node.type === "folder" && node.children && (
          <span className="text-xs text-muted-foreground">
            {countBookmarksInNode(node)}
          </span>
        )}
      </div>

      {/* 子节点 */}
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
              getCheckState={getCheckState}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countBookmarksInNode(node: ParsedBookmarkNode): number {
  let count = 0;
  if (node.type === "bookmark") return 1;
  if (node.children) {
    for (const child of node.children) {
      count += countBookmarksInNode(child);
    }
  }
  return count;
}

function getAllDescendantIds(node: ParsedBookmarkNode): string[] {
  const ids: string[] = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...getAllDescendantIds(child));
    }
  }
  return ids;
}

function getAllBookmarkIds(nodes: ParsedBookmarkNode[]): string[] {
  const ids: string[] = [];
  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark") {
        ids.push(node.id);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return ids;
}

function getAllNodeIds(nodes: ParsedBookmarkNode[]): string[] {
  const ids: string[] = [];
  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      ids.push(node.id);
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return ids;
}

export function BookmarkTree({
  nodes,
  selectedIds,
  onSelectionChange,
  expandedIds: controlledExpandedIds,
  onExpandChange,
  maxHeight = "400px",
}: BookmarkTreeProps) {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    () => {
      // 默认展开第一层
      const ids = new Set<string>();
      nodes.forEach((node) => {
        if (node.type === "folder") {
          ids.add(node.id);
        }
      });
      return ids;
    },
  );

  const expandedIds = controlledExpandedIds ?? internalExpandedIds;
  const setExpandedIds = onExpandChange ?? setInternalExpandedIds;

  const handleToggleExpand = useCallback(
    (id: string) => {
      const newExpandedIds = new Set(expandedIds);
      if (newExpandedIds.has(id)) {
        newExpandedIds.delete(id);
      } else {
        newExpandedIds.add(id);
      }
      setExpandedIds(newExpandedIds);
    },
    [expandedIds, setExpandedIds],
  );

  const handleToggleSelect = useCallback(
    (id: string, node: ParsedBookmarkNode) => {
      const newSelectedIds = new Set(selectedIds);
      const descendantIds = getAllDescendantIds(node);

      if (selectedIds.has(id)) {
        // 取消选择：移除当前节点及所有子节点
        descendantIds.forEach((did) => newSelectedIds.delete(did));
      } else {
        // 选择：添加当前节点及所有子节点
        descendantIds.forEach((did) => newSelectedIds.add(did));
      }

      onSelectionChange(newSelectedIds);
    },
    [selectedIds, onSelectionChange],
  );

  const getCheckState = useCallback(
    (node: ParsedBookmarkNode): "checked" | "unchecked" | "indeterminate" => {
      if (node.type === "bookmark") {
        return selectedIds.has(node.id) ? "checked" : "unchecked";
      }

      // 文件夹：检查所有子节点的状态
      const descendantIds = getAllDescendantIds(node).filter(
        (id) => id !== node.id,
      );
      if (descendantIds.length === 0) {
        return selectedIds.has(node.id) ? "checked" : "unchecked";
      }

      const selectedCount = descendantIds.filter((id) =>
        selectedIds.has(id),
      ).length;
      if (selectedCount === 0) return "unchecked";
      if (selectedCount === descendantIds.length) return "checked";
      return "indeterminate";
    },
    [selectedIds],
  );

  const totalBookmarks = useMemo(
    () => getAllBookmarkIds(nodes).length,
    [nodes],
  );
  const selectedBookmarks = useMemo(() => {
    return getAllBookmarkIds(nodes).filter((id) => selectedIds.has(id)).length;
  }, [nodes, selectedIds]);

  const handleSelectAll = useCallback(() => {
    const allIds = getAllNodeIds(nodes);
    onSelectionChange(new Set(allIds));
  }, [nodes, onSelectionChange]);

  const handleSelectNone = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const handleExpandAll = useCallback(() => {
    const folderIds = new Set<string>();
    function traverse(nodeList: ParsedBookmarkNode[]) {
      for (const node of nodeList) {
        if (node.type === "folder") {
          folderIds.add(node.id);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    }
    traverse(nodes);
    setExpandedIds(folderIds);
  }, [nodes, setExpandedIds]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, [setExpandedIds]);

  return (
    <div className="space-y-2">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            全选
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSelectNone}>
            取消全选
          </Button>
          <span className="text-xs text-muted-foreground">
            已选 {selectedBookmarks}/{totalBookmarks} 个书签
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExpandAll}>
            展开全部
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
            折叠全部
          </Button>
        </div>
      </div>

      {/* 树形列表 */}
      <div className="overflow-auto rounded-md border" style={{ maxHeight }}>
        <div className="p-2">
          {nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleSelect={handleToggleSelect}
              onToggleExpand={handleToggleExpand}
              getCheckState={getCheckState}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
