"use client";

import { Folder, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import type { FolderCategory } from "@/components/folders/types";
import type { Folder as FolderType } from "@/types/supabase";

interface FoldersEmptyStateProps {
  showCreateDialog: boolean;
  onShowCreateDialogChange: (open: boolean) => void;
  categories: FolderCategory[];
  onFolderCreated: (folder: FolderType) => void;
}

export function FoldersEmptyState({
  showCreateDialog,
  onShowCreateDialogChange,
  categories,
  onFolderCreated,
}: FoldersEmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Folder className="size-10 text-primary" />
      </div>
      <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
        开始整理你的收藏
      </h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        创建文件夹来分类管理你的收藏内容，让知识更有条理
      </p>
      <Button size="lg" onClick={() => onShowCreateDialogChange(true)}>
        <Plus className="size-5 mr-2" />
        创建第一个文件夹
      </Button>

      <CreateFolderDialog
        open={showCreateDialog}
        onOpenChange={onShowCreateDialogChange}
        categories={categories}
        onSuccess={onFolderCreated}
      />
    </div>
  );
}
