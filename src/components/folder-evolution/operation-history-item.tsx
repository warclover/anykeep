"use client";

/**
 * 操作历史记录项组件
 */

import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  FolderPlus,
  Scissors,
  Merge,
  Edit3,
  MoveRight,
  Trash2,
  Undo2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  OperationDetail,
  OperationSnapshotAction,
} from "@/types/supabase";

interface OperationHistoryItemProps {
  operation: OperationDetail;
  onUndo?: (id: string) => void;
  onViewDetail?: (id: string) => void;
  isUndoing?: boolean;
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
 * 获取操作的描述文本
 */
function getOperationDescription(operation: OperationDetail): string {
  const afterState = operation.after_state as Record<string, unknown>;

  switch (operation.action) {
    case "create": {
      const folder = afterState?.folder as { name: string } | undefined;
      const bookmarks = afterState?.bookmarks as unknown[] | undefined;
      const count = bookmarks?.length || 0;
      return folder?.name
        ? `创建「${folder.name}」${count ? `，归类 ${count} 条书签` : ""}`
        : "创建新文件夹";
    }
    case "rename": {
      const oldName = (afterState?.old_name as string) || "";
      const newName = (afterState?.new_name as string) || "";
      return `「${oldName}」→「${newName}」`;
    }
    case "split": {
      const original = afterState?.original_folder as
        | { name: string }
        | undefined;
      const newFolders = afterState?.new_folders as
        | { name: string }[]
        | undefined;
      const names = newFolders?.map((f) => f.name).join("、") || "";
      return original?.name
        ? `将「${original.name}」分拆为 ${names || "多个文件夹"}`
        : "分拆文件夹";
    }
    case "merge": {
      const target = afterState?.target_folder as { name: string } | undefined;
      const sources = (operation.before_state as Record<string, unknown>)
        ?.source_folders as { name: string }[] | undefined;
      const count = sources?.length || 0;
      return target?.name
        ? `将 ${count} 个文件夹合并到「${target.name}」`
        : "合并文件夹";
    }
    case "move": {
      const bookmarks = afterState?.bookmarks as unknown[] | undefined;
      const count = bookmarks?.length || 0;
      return `移动 ${count} 条书签`;
    }
    default:
      return "操作完成";
  }
}

/**
 * 计算剩余可撤销时间
 */
function getRemainingTime(expiresAt?: string): {
  hours: number;
  minutes: number;
  expired: boolean;
} {
  if (!expiresAt) {
    return { hours: 0, minutes: 0, expired: true };
  }
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes, expired: false };
}

export function OperationHistoryItem({
  operation,
  onUndo,
  onViewDetail,
  isUndoing = false,
}: OperationHistoryItemProps) {
  // 使用静态映射获取图标组件，避免在渲染期间动态创建
  const action = operation.action ?? operation.operation_type;
  const IconComponent =
    (action ? ACTION_ICONS[action as OperationSnapshotAction] : undefined) ||
    FolderPlus;
  const actionLabel = action
    ? getActionLabel(action as OperationSnapshotAction)
    : "操作";
  const description = getOperationDescription(operation);
  const remaining = getRemainingTime(operation.expires_at);

  const timeAgo = formatDistanceToNow(new Date(operation.created_at), {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      {/* 图标 */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <IconComponent className="w-5 h-5 text-primary" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-xs">
            {actionLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        <p className="text-sm text-foreground truncate">{description}</p>

        {operation.reason && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            原因：{operation.reason}
          </p>
        )}

        {/* 撤销时间提示 */}
        {operation.can_undo && !remaining.expired && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              撤销窗口剩余{" "}
              {remaining.hours > 0
                ? `${remaining.hours}小时${remaining.minutes}分钟`
                : `${remaining.minutes}分钟`}
            </span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {operation.can_undo && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUndo?.(operation.id)}
                  disabled={isUndoing}
                  className="h-8 px-2"
                >
                  <Undo2 className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">撤销</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>撤销此操作</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetail?.(operation.id)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
