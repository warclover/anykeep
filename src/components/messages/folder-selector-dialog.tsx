/**
 * Folder Selector Dialog
 * V4.2 文件夹选择器对话框
 * V4.2.24: 使用 useFolders Hook 统一缓存
 *
 * @description 用于待确认消息流程中的文件夹选择
 * - 显示可用文件夹列表（树形结构）
 * - 支持新建文件夹
 * - 搜索过滤
 * - 置信度显示（如果有备选建议）
 *
 * @version 1.1.0
 * @since 2025-12-11
 */

"use client";

import { useState, useMemo, useRef } from "react";
import {
  Loader2,
  Folder,
  FolderPlus,
  Search,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useFolders } from "@/hooks/use-folders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Folder as FolderType } from "@/types/supabase";

// ============================================================================
// 类型定义
// ============================================================================

interface FolderTreeNode extends FolderType {
  children: FolderTreeNode[];
}

interface FlattenedFolder {
  id: number;
  name: string;
  level: number;
  parentId: number | null;
}

interface AlternativeSuggestion {
  folderId: number;
  folderName: string;
  confidence: number;
}

export interface FolderSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前选中的文件夹 ID */
  currentFolderId?: number | null;
  /** AI 推荐的备选文件夹 */
  alternatives?: AlternativeSuggestion[];
  /** 选择回调 */
  onSelect: (folderId: number | null, folderName: string) => void;
  /** 新建文件夹回调 */
  onCreateFolder?: (name: string) => void;
  /** 对话框标题 */
  title?: string;
  /** 对话框描述 */
  description?: string;
  /** 是否允许选择"无文件夹" */
  allowNoFolder?: boolean;
}

// ============================================================================
// 组件实现
// ============================================================================

export function FolderSelectorDialog({
  open,
  onOpenChange,
  currentFolderId,
  alternatives = [],
  onSelect,
  onCreateFolder,
  title = "选择文件夹",
  description = "选择要将内容归类到的文件夹",
  allowNoFolder = true,
}: FolderSelectorDialogProps) {
  // 状态
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(
    currentFolderId ?? null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // V4.2.24: 使用统一的文件夹缓存 Hook
  const {
    folders: rawFolders,
    isLoading,
    error: hookError,
    refresh: loadFolders,
  } = useFolders({ enabled: open });

  // 转换为树形结构类型
  const loadError = hookError?.message || null;

  // 扁平化列表（将数据转换整合到 useMemo 内部）
  const flattenedFolders = useMemo(() => {
    const folders = (rawFolders || []) as FolderTreeNode[];
    const flattenTree = (
      nodes: FolderTreeNode[],
      level = 0,
    ): FlattenedFolder[] => {
      const result: FlattenedFolder[] = [];
      for (const node of nodes) {
        if (node.is_system) continue;
        result.push({
          id: node.id,
          name: node.name,
          level,
          parentId: node.parent_id,
        });
        if (node.children?.length > 0) {
          result.push(...flattenTree(node.children, level + 1));
        }
      }
      return result;
    };
    return flattenTree(folders);
  }, [rawFolders]);

  // 打开时重置状态（使用 ref 避免 ESLint 警告）
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    // 对话框刚打开时重置状态
    setSelectedId(currentFolderId ?? null);
    setSearchQuery("");
    setIsCreating(false);
    setNewFolderName("");
  }
  prevOpenRef.current = open;

  // 过滤列表
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return flattenedFolders;
    const query = searchQuery.toLowerCase();
    return flattenedFolders.filter((f) => f.name.toLowerCase().includes(query));
  }, [flattenedFolders, searchQuery]);

  // 备选文件夹 ID 集合
  const alternativeIds = useMemo(
    () => new Set(alternatives.map((a) => a.folderId)),
    [alternatives]
  );

  // 获取文件夹的置信度
  const getConfidence = (folderId: number): number | undefined => {
    const alt = alternatives.find((a) => a.folderId === folderId);
    return alt?.confidence;
  };

  // 处理选择
  const handleSelect = () => {
    const selectedFolder = flattenedFolders.find((f) => f.id === selectedId);
    onSelect(selectedId, selectedFolder?.name || "待整理");
    onOpenChange(false);
  };

  // 处理新建文件夹
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("请输入文件夹名称");
      return;
    }
    onCreateFolder?.(newFolderName.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件夹..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 文件夹列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={loadFolders}>
                重试
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-1 pr-4">
                {/* 无文件夹选项 */}
                {allowNoFolder && (
                  <button
                    onClick={() => setSelectedId(null)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                      selectedId === null
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <Folder className="size-4 text-muted-foreground" />
                    <span className="text-sm">待整理</span>
                    {selectedId === null && (
                      <Check className="size-4 ml-auto text-primary" />
                    )}
                  </button>
                )}

                {/* AI 推荐的备选（如果有） */}
                {alternatives.length > 0 && (
                  <div className="pt-2 pb-1">
                    <p className="text-xs font-medium text-muted-foreground px-3 mb-1">
                      AI 推荐
                    </p>
                    {alternatives.map((alt) => (
                      <button
                        key={alt.folderId}
                        onClick={() => setSelectedId(alt.folderId)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                          selectedId === alt.folderId
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-accent"
                        )}
                      >
                        <Folder className="size-4 text-muted-foreground" />
                        <span className="text-sm flex-1">{alt.folderName}</span>
                        <span className="text-xs text-muted-foreground">
                          {alt.confidence}%
                        </span>
                        {selectedId === alt.folderId && (
                          <Check className="size-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* 所有文件夹 */}
                <div className="pt-2 pb-1">
                  <p className="text-xs font-medium text-muted-foreground px-3 mb-1">
                    所有文件夹
                  </p>
                  {filteredFolders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {searchQuery ? "没有找到匹配的文件夹" : "暂无文件夹"}
                    </p>
                  ) : (
                    filteredFolders.map((folder) => {
                      const isAlternative = alternativeIds.has(folder.id);
                      const confidence = getConfidence(folder.id);

                      return (
                        <button
                          key={folder.id}
                          onClick={() => setSelectedId(folder.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                            selectedId === folder.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-accent"
                          )}
                          style={{ paddingLeft: `${12 + folder.level * 16}px` }}
                        >
                          <Folder className="size-4 text-muted-foreground" />
                          <span className="text-sm flex-1">{folder.name}</span>
                          {isAlternative && confidence !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {confidence}%
                            </span>
                          )}
                          {selectedId === folder.id && (
                            <Check className="size-4 text-primary" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          {/* 新建文件夹 */}
          {onCreateFolder && (
            <div className="border-t pt-4">
              {isCreating ? (
                <div className="space-y-2">
                  <Label htmlFor="new-folder-name">新文件夹名称</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-folder-name"
                      placeholder="输入文件夹名称"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      autoFocus
                    />
                    <Button size="sm" onClick={handleCreateFolder}>
                      创建
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreating(false);
                        setNewFolderName("");
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsCreating(true)}
                >
                  <FolderPlus className="size-4 mr-2" />
                  新建文件夹
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSelect} disabled={isLoading}>
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FolderSelectorDialog;
