"use client";

/**
 * 撤销确认对话框
 */

import {
  FolderPlus,
  Scissors,
  Merge,
  Edit3,
  MoveRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
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
  OperationDetail,
  OperationSnapshotAction,
} from "@/types/supabase";

interface UndoConfirmDialogProps {
  operation: OperationDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * 获取操作类型的图标
 */
function getActionIcon(action: OperationSnapshotAction) {
  switch (action) {
    case "create":
      return FolderPlus;
    case "split":
      return Scissors;
    case "merge":
      return Merge;
    case "rename":
      return Edit3;
    case "move":
      return MoveRight;
    default:
      return FolderPlus;
  }
}

/**
 * 获取撤销操作的描述
 */
function getUndoDescription(operation: OperationDetail): string {
  const afterState = operation.after_state as Record<string, unknown>;
  const beforeState = operation.before_state as Record<string, unknown>;

  switch (operation.action) {
    case "create": {
      const folder = afterState?.folder as { name: string } | undefined;
      const bookmarks = afterState?.bookmarks as unknown[] | undefined;
      const count = bookmarks?.length || 0;
      return folder?.name
        ? `将删除文件夹「${folder.name}」${count ? `，${count} 条书签将恢复到原位置` : ""}`
        : "将删除创建的文件夹";
    }
    case "rename": {
      const oldName = afterState?.old_name as string;
      const newName = afterState?.new_name as string;
      return `将把文件夹名称从「${newName}」恢复为「${oldName}」`;
    }
    case "split": {
      const newFolders = afterState?.new_folders as
        | { name: string }[]
        | undefined;
      const count = newFolders?.length || 0;
      return `将删除分拆后的 ${count} 个文件夹，书签将恢复到原文件夹`;
    }
    case "merge": {
      const sourceFolders = beforeState?.source_folders as
        | { name: string }[]
        | undefined;
      const count = sourceFolders?.length || 0;
      return `将恢复合并前的 ${count} 个文件夹，书签将移回原位置`;
    }
    case "move": {
      const bookmarks = afterState?.bookmarks as unknown[] | undefined;
      const count = bookmarks?.length || 0;
      return `将把 ${count} 条书签移回原位置`;
    }
    default:
      return "此操作将被撤销";
  }
}

/**
 * 获取撤销影响说明
 */
function getUndoImpact(operation: OperationDetail): string[] {
  const afterState = operation.after_state as Record<string, unknown>;
  const beforeState = operation.before_state as Record<string, unknown>;
  const impacts: string[] = [];

  switch (operation.action) {
    case "create": {
      const folder = afterState?.folder as { name: string } | undefined;
      if (folder) {
        impacts.push(`文件夹「${folder.name}」将被删除`);
      }
      const bookmarks = afterState?.bookmarks as unknown[] | undefined;
      if (bookmarks && bookmarks.length > 0) {
        impacts.push(`${bookmarks.length} 条书签将恢复到原位置`);
      }
      break;
    }
    case "split": {
      const newFolders = afterState?.new_folders as
        | { name: string }[]
        | undefined;
      if (newFolders) {
        newFolders.forEach((f) => {
          impacts.push(`文件夹「${f.name}」将被删除`);
        });
      }
      break;
    }
    case "merge": {
      const sourceFolders = beforeState?.source_folders as
        | { name: string }[]
        | undefined;
      if (sourceFolders) {
        sourceFolders.forEach((f) => {
          impacts.push(`文件夹「${f.name}」将被恢复`);
        });
      }
      break;
    }
  }

  return impacts;
}

export function UndoConfirmDialog({
  operation,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: UndoConfirmDialogProps) {
  if (!operation) return null;

  const _Icon = getActionIcon(operation.action);
  const description = getUndoDescription(operation);
  const impacts = getUndoImpact(operation);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            确认撤销操作？
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{description}</p>

              {impacts.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium mb-2">影响说明：</p>
                  <ul className="text-xs space-y-1">
                    {impacts.map((impact, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-muted-foreground">•</span>
                        <span>{impact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                撤销后无法恢复，请确认操作。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                撤销中...
              </>
            ) : (
              "确认撤销"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
