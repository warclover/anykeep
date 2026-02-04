/**
 * 文件夹选择器组件
 *
 * 用于在综述创建时选择文件夹作为来源
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FolderPickerProps, SourceSelection, ContentStats } from "./types";
import { clientLogger } from "@/lib/client-logger";

interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  bookmark_count?: number;
  children: FolderNode[];
}

/**
 * 文件夹选择器
 */
export function FolderPicker({
  onSelect,
  onCancel,
  disabled,
  initialFolderId,
}: FolderPickerProps) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(
    initialFolderId ? parseInt(initialFolderId, 10) : null,
  );
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [previewStats, setPreviewStats] = useState<ContentStats | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // 加载文件夹列表
  useEffect(() => {
    async function loadFolders() {
      try {
        const response = await fetch("/api/folders");
        const result = await response.json();
        if (result.success) {
          setFolders(result.data || []);
        }
      } catch (error) {
        clientLogger.error({ error }, "Failed to load folders:");
      } finally {
        setIsLoading(false);
      }
    }
    loadFolders();
  }, []);

  // 选择文件夹时加载预览统计
  useEffect(() => {
    if (selectedFolderId === null) {
      setPreviewStats(null);
      return;
    }

    async function loadPreview() {
      setIsLoadingPreview(true);
      try {
        const response = await fetch(
          `/api/synthesis/preview?sourceType=folder&sourceId=${selectedFolderId}&pageSize=1`,
        );
        const result = await response.json();
        setPreviewStats(result.contentStats);
      } catch (error) {
        clientLogger.error({ error }, "Failed to load preview:");
      } finally {
        setIsLoadingPreview(false);
      }
    }
    loadPreview();
  }, [selectedFolderId]);

  // 切换展开/折叠
  const toggleExpand = useCallback((folderId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // 获取选中文件夹的名称
  const getSelectedFolderName = useCallback((): string => {
    const findFolder = (nodes: FolderNode[]): FolderNode | null => {
      for (const node of nodes) {
        if (node.id === selectedFolderId) return node;
        const found = findFolder(node.children);
        if (found) return found;
      }
      return null;
    };
    return findFolder(folders)?.name || "";
  }, [folders, selectedFolderId]);

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (selectedFolderId === null) return;

    const selection: SourceSelection = {
      sourceType: "folder",
      sourceId: String(selectedFolderId),
      sourceName: getSelectedFolderName(),
      bookmarkIds: [],
      excludedIds: [],
      contentStats: previewStats,
    };

    onSelect(selection);
  }, [selectedFolderId, getSelectedFolderName, previewStats, onSelect]);

  // 渲染文件夹节点
  const renderFolderNode = (node: FolderNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSelectedFolderId(node.id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
            "hover:bg-muted/50",
            isSelected && "bg-primary/10 border border-primary",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 hover:bg-muted rounded"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  isExpanded && "rotate-90",
                )}
              />
            </button>
          )}
          {!hasChildren && <div className="w-5" />}
          {isSelected ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <Folder className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 text-left truncate">{node.name}</span>
          {node.bookmark_count !== undefined && (
            <span className="text-xs text-muted-foreground">
              {node.bookmark_count}
            </span>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">选择文件夹</div>

      <ScrollArea className="h-[300px] border rounded-lg p-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Folder className="h-8 w-8 mb-2" />
            <p className="text-sm">暂无文件夹</p>
          </div>
        ) : (
          folders.map((folder) => renderFolderNode(folder))
        )}
      </ScrollArea>

      {/* 预览统计 */}
      {selectedFolderId && (
        <div className="rounded-lg border bg-muted/30 p-3">
          {isLoadingPreview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : previewStats ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">书签数量</span>
                <span className="font-medium">{previewStats.totalCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">有摘要</span>
                <span className="font-medium">
                  {previewStats.withSummary} / {previewStats.totalCount}
                </span>
              </div>
              {previewStats.totalCount < 3 && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ 书签数量较少，建议至少 3 篇以获得更好的综述效果
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={disabled}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={
            disabled ||
            selectedFolderId === null ||
            isLoadingPreview ||
            (previewStats?.totalCount ?? 0) === 0
          }
        >
          确认选择
        </Button>
      </div>
    </div>
  );
}
