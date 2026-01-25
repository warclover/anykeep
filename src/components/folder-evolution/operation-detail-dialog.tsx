"use client";

/**
 * 操作详情对话框
 */

import { formatDistanceToNow, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  FolderPlus,
  Scissors,
  Merge,
  Edit3,
  MoveRight,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type {
  OperationDetail,
  OperationSnapshotAction,
} from "@/types/supabase";

interface OperationDetailDialogProps {
  operation: OperationDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 操作类型对应的图标映射（静态定义，避免在渲染期间创建组件）
 */
const ACTION_ICONS: Partial<
  Record<OperationSnapshotAction, React.ComponentType<{ className?: string }>>
> = {
  create: FolderPlus,
  split: Scissors,
  merge: Merge,
  rename: Edit3,
  move: MoveRight,
  delete: Trash2,
};

/**
 * 获取操作类型的中文标签
 */
function getActionLabel(action: OperationSnapshotAction): string {
  switch (action) {
    case "create":
      return "创建文件夹";
    case "split":
      return "分拆文件夹";
    case "merge":
      return "合并文件夹";
    case "rename":
      return "重命名";
    case "move":
      return "移动书签";
    case "delete":
      return "删除";
    default:
      return "操作";
  }
}

/**
 * 渲染状态变化详情
 */
function renderStateDetails(operation: OperationDetail) {
  const beforeState = operation.before_state as Record<string, unknown>;
  const afterState = operation.after_state as Record<string, unknown>;

  switch (operation.action) {
    case "create": {
      const folder = afterState?.folder as
        | { id: number; name: string }
        | undefined;
      const bookmarks = afterState?.bookmarks as
        | Array<{ id: number; title: string }>
        | undefined;

      return (
        <div className="space-y-3">
          {folder && (
            <div>
              <h4 className="text-sm font-medium mb-1">创建的文件夹</h4>
              <p className="text-sm text-muted-foreground">「{folder.name}」</p>
            </div>
          )}
          {bookmarks && bookmarks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">
                归类的书签 ({bookmarks.length})
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {bookmarks.slice(0, 5).map((b) => (
                  <li key={b.id} className="truncate">
                    • {b.title}
                  </li>
                ))}
                {bookmarks.length > 5 && (
                  <li className="text-xs">...还有 {bookmarks.length - 5} 条</li>
                )}
              </ul>
            </div>
          )}
        </div>
      );
    }

    case "rename": {
      const oldName = afterState?.old_name as string;
      const newName = afterState?.new_name as string;

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {oldName}
            </span>
            <span>→</span>
            <span className="text-sm font-medium">{newName}</span>
          </div>
        </div>
      );
    }

    case "split": {
      const originalFolder = beforeState?.original_folder as
        | { name: string }
        | undefined;
      const newFolders = afterState?.new_folders as
        | Array<{ id: number; name: string }>
        | undefined;

      return (
        <div className="space-y-3">
          {originalFolder && (
            <div>
              <h4 className="text-sm font-medium mb-1">原文件夹</h4>
              <p className="text-sm text-muted-foreground">
                「{originalFolder.name}」
              </p>
            </div>
          )}
          {newFolders && newFolders.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">分拆为</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {newFolders.map((f) => (
                  <li key={f.id}>• 「{f.name}」</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    case "merge": {
      const sourceFolders = beforeState?.source_folders as
        | Array<{ name: string }>
        | undefined;
      const targetFolder = afterState?.target_folder as
        | { name: string }
        | undefined;

      return (
        <div className="space-y-3">
          {sourceFolders && sourceFolders.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">合并的文件夹</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {sourceFolders.map((f, i) => (
                  <li key={i}>• 「{f.name}」</li>
                ))}
              </ul>
            </div>
          )}
          {targetFolder && (
            <div>
              <h4 className="text-sm font-medium mb-1">合并到</h4>
              <p className="text-sm text-muted-foreground">
                「{targetFolder.name}」
              </p>
            </div>
          )}
        </div>
      );
    }

    case "move": {
      const bookmarks = afterState?.bookmarks as
        | Array<{ id: number; title: string }>
        | undefined;

      return (
        <div>
          <h4 className="text-sm font-medium mb-1">
            移动的书签 ({bookmarks?.length || 0})
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {bookmarks?.slice(0, 5).map((b) => (
              <li key={b.id} className="truncate">
                • {b.title}
              </li>
            ))}
            {(bookmarks?.length || 0) > 5 && (
              <li className="text-xs">
                ...还有 {(bookmarks?.length || 0) - 5} 条
              </li>
            )}
          </ul>
        </div>
      );
    }

    default:
      return null;
  }
}

export function OperationDetailDialog({
  operation,
  open,
  onOpenChange,
}: OperationDetailDialogProps) {
  if (!operation) return null;

  // 使用静态映射获取图标组件，避免在渲染期间动态创建
  const action = operation.action ?? operation.operation_type;
  const IconComponent =
    (action ? ACTION_ICONS[action as OperationSnapshotAction] : undefined) ||
    FolderPlus;
  const actionLabel = action
    ? getActionLabel(action as OperationSnapshotAction)
    : "操作";
  const createdAt = new Date(operation.created_at);
  const expiresAt = operation.expires_at
    ? new Date(operation.expires_at)
    : null;
  const now = new Date();
  const isExpired = expiresAt ? expiresAt < now : false;

  const timeAgo = formatDistanceToNow(createdAt, {
    addSuffix: true,
    locale: zhCN,
  });

  const remainingTime =
    !isExpired && expiresAt
      ? formatDistanceToNow(expiresAt, { locale: zhCN })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5 text-primary" />
            {actionLabel}
          </DialogTitle>
          <DialogDescription>
            {timeAgo} ·{" "}
            {format(createdAt, "yyyy-MM-dd HH:mm", { locale: zhCN })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 状态 */}
          <div className="flex items-center gap-2">
            {operation.can_undo ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">可撤销</span>
                {remainingTime && (
                  <span className="text-xs text-muted-foreground">
                    （剩余 {remainingTime}）
                  </span>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {isExpired ? "撤销窗口已过期" : "已撤销"}
                </span>
              </>
            )}
          </div>

          <Separator />

          {/* 操作详情 */}
          {renderStateDetails(operation)}

          {/* 原因说明 */}
          {operation.reason && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-1">AI 决策原因</h4>
                <p className="text-sm text-muted-foreground">
                  {operation.reason}
                </p>
              </div>
            </>
          )}

          {/* 时间信息 */}
          {expiresAt && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>
                  撤销窗口截止：
                  {format(expiresAt, "yyyy-MM-dd HH:mm", { locale: zhCN })}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
