/**
 * 文件夹快速选择器
 * 用于分类建议的「换一个」功能
 * 轻量级弹窗，快速选择目标文件夹
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Folder, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FolderOption {
  id: number;
  name: string;
}

interface FolderQuickSelectProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 书签 ID */
  bookmarkId: number;
  /** 原建议的文件夹 ID（用于排除） */
  excludeFolderId?: number;
  /** 选择文件夹后的回调 */
  onSelect: (folderId: number, folderName: string) => Promise<void>;
  /** 标题 */
  title?: string;
}

export function FolderQuickSelect({
  open,
  onOpenChange,
  bookmarkId: _bookmarkId,
  excludeFolderId,
  onSelect,
  title = "选择文件夹",
}: FolderQuickSelectProps) {
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 加载文件夹列表
  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "加载文件夹失败");
      }

      // 扁平化文件夹列表并排除原建议文件夹
      const flatFolders: FolderOption[] = [];
      const flatten = (items: FolderOption[]) => {
        for (const item of items) {
          if (item.id !== excludeFolderId) {
            flatFolders.push({ id: item.id, name: item.name });
          }
        }
      };
      flatten(data.data || []);
      setFolders(flatFolders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载文件夹失败");
    } finally {
      setIsLoading(false);
    }
  }, [excludeFolderId]);

  useEffect(() => {
    if (open) {
      loadFolders();
      setSelectedId(null);
      setSearchTerm("");
    }
  }, [open, loadFolders]);

  // 过滤文件夹
  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 确认选择
  const handleConfirm = async () => {
    if (!selectedId) return;

    const folder = folders.find((f) => f.id === selectedId);
    if (!folder) return;

    setIsSubmitting(true);
    try {
      await onSelect(folder.id, folder.name);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>选择要归类到的文件夹</DialogDescription>
        </DialogHeader>

        {/* 搜索框 */}
        <Input
          placeholder="搜索文件夹..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9"
        />

        {/* 文件夹列表 */}
        <ScrollArea className="h-[240px] -mx-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Folder className="w-8 h-8 mb-2" />
              <p className="text-sm">
                {searchTerm ? "未找到匹配的文件夹" : "暂无文件夹"}
              </p>
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedId(folder.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                    selectedId === folder.id
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800",
                  )}
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{folder.name}</span>
                  {selectedId === folder.id && (
                    <Check className="w-4 h-4 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                移动中
              </>
            ) : (
              "确认移动"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FolderQuickSelect;
