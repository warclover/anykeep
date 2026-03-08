"use client";

/**
 * AI 操作确认对话框
 *
 * 用于显示 AI Agent 需要用户确认的危险操作
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import {
  AlertTriangle,
  Loader2,
  Tags,
  FolderOutput,
  ShieldAlert,
  Info,
  Download,
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MESSAGES } from "@/lib/constants/messages";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

const { CONFIRM_DIALOG } = MESSAGES.AI_COMPONENTS;

// ============================================
// 常量定义
// ============================================

const DIALOG_STRINGS = CONFIRM_DIALOG;

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: CONFIRM_DIALOG.RISK_LEVEL.LOW,
  medium: CONFIRM_DIALOG.RISK_LEVEL.MEDIUM,
  high: CONFIRM_DIALOG.RISK_LEVEL.HIGH,
};

// ============================================
// 类型定义
// ============================================

export interface ActionConfirmDialogProps {
  /** 待确认操作详情 */
  confirmation: PendingConfirmation | null;
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 确认回调 */
  onConfirm: (confirmationId: string) => void;
  /** 取消回调 */
  onCancel: (confirmationId: string) => void;
  /** 是否正在执行 */
  isLoading?: boolean;
}

// ============================================
// 工具函数
// ============================================

/**
 * Tool 图标组件
 * 使用组件而非函数返回组件引用，避免在渲染期间创建组件
 */
function ToolIcon({
  toolName,
  className,
}: {
  toolName: string;
  className?: string;
}) {
  switch (toolName) {
    case "batch_tags":
      return <Tags className={className} />;
    case "move_bookmarks":
      return <FolderOutput className={className} />;
    case "export_bookmarks":
      return <Download className={className} />;
    default:
      return <ShieldAlert className={className} />;
  }
}

/**
 * 获取风险等级样式
 */
function getRiskLevelStyles(riskLevel: PendingConfirmation["riskLevel"]) {
  switch (riskLevel) {
    case "low":
      return {
        badge:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        icon: "text-blue-500",
        button: "bg-blue-600 hover:bg-blue-700",
      };
    case "medium":
      return {
        badge:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        icon: "text-amber-500",
        button: "bg-amber-600 hover:bg-amber-700",
      };
    case "high":
      return {
        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        icon: "text-red-500",
        button: "bg-red-600 hover:bg-red-700",
      };
    default:
      // 默认使用 medium 风险样式
      return {
        badge:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        icon: "text-amber-500",
        button: "bg-amber-600 hover:bg-amber-700",
      };
  }
}

/**
 * 获取 Tool 描述
 */
function getToolDescription(toolName: string): string {
  return (
    DIALOG_STRINGS.TOOL_DESCRIPTIONS[toolName] ||
    DIALOG_STRINGS.TOOL_DESCRIPTIONS.default
  );
}

// ============================================
// 组件实现
// ============================================

/**
 * AI 操作确认对话框
 *
 * 用于确认 AI Agent 的危险操作（如批量标签、批量移动等）
 */
export function ActionConfirmDialog({
  confirmation,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isLoading = false,
}: ActionConfirmDialogProps) {
  if (!confirmation) return null;

  const styles = getRiskLevelStyles(confirmation.riskLevel);
  const toolDescription = getToolDescription(confirmation.toolName);
  const affectedItems = confirmation.affectedItems || [];
  const showItemsList = affectedItems.length > 0 && affectedItems.length <= 20;

  const handleConfirm = () => {
    onConfirm(confirmation.confirmationId);
  };

  const handleCancel = () => {
    onCancel(confirmation.confirmationId);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ToolIcon
              toolName={confirmation.toolName}
              className={cn("w-5 h-5", styles.icon)}
            />
            <span>{DIALOG_STRINGS.TITLE}</span>
            <Badge className={cn("ml-auto text-xs", styles.badge)}>
              {RISK_LEVEL_LABELS[confirmation.riskLevel]}
            </Badge>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {/* 操作类型 */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {DIALOG_STRINGS.OPERATION_TYPE}
                </span>
                <span className="font-medium">{toolDescription}</span>
              </div>

              {/* 操作描述 */}
              <p className="text-sm">{confirmation.description}</p>

              {/* 影响范围摘要 */}
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={cn("w-4 h-4 mt-0.5", styles.icon)}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {DIALOG_STRINGS.IMPACT_SCOPE}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {confirmation.impactSummary}
                    </p>
                  </div>
                </div>
              </div>

              {/* 受影响项目列表（仅显示前20条） */}
              {showItemsList && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {DIALOG_STRINGS.AFFECTED_ITEMS_TITLE}
                  </p>
                  <ScrollArea className="h-32 rounded-md border">
                    <div className="p-2 space-y-1">
                      {affectedItems.map((item) => (
                        <div
                          key={item.id}
                          className="text-xs py-1 px-2 rounded bg-muted/30 truncate"
                          title={item.title}
                        >
                          {item.title}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* 超过20条时显示提示 */}
              {affectedItems.length > 20 && (
                <p className="text-xs text-muted-foreground">
                  {DIALOG_STRINGS.AFFECTED_BOOKMARKS(affectedItems.length)}
                </p>
              )}

              {/* 过期提醒 */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                <span>{DIALOG_STRINGS.EXPIRATION_WARNING}</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            {MESSAGES.COMMON.CANCEL}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isLoading}
            className={styles.button}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {DIALOG_STRINGS.CONFIRMING_BUTTON}
              </>
            ) : (
              DIALOG_STRINGS.CONFIRM_BUTTON
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 简化版确认对话框（用于内联显示）
 */
export interface ActionConfirmInlineProps {
  /** 待确认操作详情 */
  confirmation: PendingConfirmation;
  /** 确认回调 */
  onConfirm: (confirmationId: string) => void;
  /** 取消回调 */
  onCancel: (confirmationId: string) => void;
  /** 是否正在执行 */
  isLoading?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 内联确认组件
 *
 * 用于在消息流中直接显示确认操作
 */
export function ActionConfirmInline({
  confirmation,
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: ActionConfirmInlineProps) {
  const styles = getRiskLevelStyles(confirmation.riskLevel);

  return (
    <div
      className={cn("border rounded-lg p-4 space-y-3 bg-muted/30", className)}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ToolIcon
            toolName={confirmation.toolName}
            className={cn("w-4 h-4", styles.icon)}
          />
          <span className="text-sm font-medium">
            {DIALOG_STRINGS.NEED_CONFIRM}
          </span>
        </div>
        <Badge className={cn("text-xs", styles.badge)}>
          {RISK_LEVEL_LABELS[confirmation.riskLevel]}
        </Badge>
      </div>

      {/* 操作描述 */}
      <p className="text-sm">{confirmation.description}</p>

      {/* 影响范围 */}
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", styles.icon)} />
        <span className="text-muted-foreground">
          {confirmation.impactSummary}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onCancel(confirmation.confirmationId)}
          disabled={isLoading}
          className="flex-1 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
        >
          {MESSAGES.COMMON.CANCEL}
        </button>
        <button
          onClick={() => onConfirm(confirmation.confirmationId)}
          disabled={isLoading}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm text-white rounded-md transition-colors disabled:opacity-50",
            styles.button,
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {DIALOG_STRINGS.CONFIRMING_BUTTON}
            </span>
          ) : (
            DIALOG_STRINGS.CONFIRM_BUTTON
          )}
        </button>
      </div>
    </div>
  );
}
