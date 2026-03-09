/**
 * 操作按钮组件
 *
 * 展示建议操作，支持点击执行
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

"use client";

import React from "react";
import { FolderOpen, Trash2, Tag, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SuggestedAction } from "@/lib/ai-agent/proactive-briefing";

// ============================================
// 类型定义
// ============================================

export interface ActionButtonProps {
  /** 操作数据 */
  action: SuggestedAction;
  /** 点击回调 */
  onClick?: (action: SuggestedAction) => void;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 图标映射
// ============================================

const actionIcons: Record<SuggestedAction["type"], React.ElementType> = {
  organize_topic: FolderOpen,
  cleanup_duplicates: Trash2,
  tag_untagged: Tag,
  archive_old: Archive,
};

// ============================================
// 组件实现
// ============================================

/**
 * 操作按钮组件
 *
 * @example
 * ```tsx
 * <ActionButton
 *   action={action}
 *   onClick={(a) => executeAction(a)}
 *   loading={isExecuting}
 * />
 * ```
 */
export function ActionButton({
  action,
  onClick,
  loading = false,
  disabled = false,
  className,
}: ActionButtonProps) {
  const Icon = actionIcons[action.type] || FolderOpen;

  const handleClick = () => {
    if (!loading && !disabled) {
      onClick?.(action);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        "gap-1.5 text-xs",
        "hover:bg-primary/5 hover:border-primary/30",
        className,
      )}
      data-testid="action-button"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span>{action.label}</span>
      {action.affectedCount !== undefined && action.affectedCount > 0 && (
        <span className="text-muted-foreground">({action.affectedCount})</span>
      )}
    </Button>
  );
}

// ============================================
// 操作按钮组
// ============================================

export interface ActionButtonGroupProps {
  /** 操作列表 */
  actions: SuggestedAction[];
  /** 点击回调 */
  onActionClick?: (action: SuggestedAction) => void;
  /** 当前执行中的操作 ID */
  executingActionId?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 操作按钮组
 *
 * @example
 * ```tsx
 * <ActionButtonGroup
 *   actions={actions}
 *   onActionClick={handleAction}
 *   executingActionId={currentActionId}
 * />
 * ```
 */
export function ActionButtonGroup({
  actions,
  onActionClick,
  executingActionId,
  className,
}: ActionButtonGroupProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          action={action}
          onClick={onActionClick}
          loading={executingActionId === action.id}
          disabled={!!executingActionId && executingActionId !== action.id}
        />
      ))}
    </div>
  );
}
