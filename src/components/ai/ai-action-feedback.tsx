/**
 * AI 操作反馈组件
 *
 * 用于展示 AI 执行操作时的确认/拒绝界面
 * 支持危险操作警告、操作详情展示、一键确认/取消
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Bookmark,
  Folder,
  Tag,
  Search,
  Sparkles,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MESSAGES } from "@/lib/constants/messages";
import type { ConfirmationInfo, AIActionType } from "@/lib/ai-actions";

const { ACTION_FEEDBACK } = MESSAGES.AI_COMPONENTS;

// ============================================
// 类型定义
// ============================================

/**
 * 操作风险等级
 */
export type ActionRiskLevel = "low" | "medium" | "high";

/**
 * AI 操作反馈属性
 */
export interface AIActionFeedbackProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 操作类型 */
  actionType: AIActionType;
  /** 确认信息 */
  confirmation: ConfirmationInfo;
  /** 确认回调 */
  onConfirm: () => void | Promise<void>;
  /** 拒绝回调 */
  onReject: () => void;
  /** 是否正在执行 */
  isExecuting?: boolean;
}

/**
 * 内联操作反馈属性（用于消息内展示）
 */
export interface AIActionFeedbackInlineProps {
  /** 操作类型 */
  actionType: AIActionType;
  /** 确认信息 */
  confirmation: ConfirmationInfo;
  /** 确认回调 */
  onConfirm: () => void | Promise<void>;
  /** 拒绝回调 */
  onReject: () => void;
  /** 是否正在执行 */
  isExecuting?: boolean;
  /** 是否已处理 */
  isHandled?: boolean;
  /** 处理结果 */
  result?: "confirmed" | "rejected";
}

// ============================================
// 常量配置
// ============================================

const RISK_LEVEL_CONFIG: Record<
  ActionRiskLevel,
  { color: string; bgColor: string; label: string }
> = {
  low: {
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: ACTION_FEEDBACK.RISK_LEVEL.LOW,
  },
  medium: {
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    label: ACTION_FEEDBACK.RISK_LEVEL.MEDIUM,
  },
  high: {
    color: "text-red-600",
    bgColor: "bg-red-50",
    label: ACTION_FEEDBACK.RISK_LEVEL.HIGH,
  },
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取操作的风险等级
 */
function getActionRiskLevel(actionType: AIActionType): ActionRiskLevel {
  if (actionType.includes("delete")) return "high";
  if (actionType.includes("batch")) return "medium";
  if (actionType.includes("move") || actionType.includes("update"))
    return "low";
  return "low";
}

/**
 * 动态 Action 图标组件 - 使用 switch 直接返回 JSX 避免 ESLint 警告
 */
function DynamicActionIcon({
  actionType,
  className,
}: {
  actionType: AIActionType;
  className?: string;
}) {
  const category = actionType.split(":")[0];
  switch (category) {
    case "bookmark":
      return <Bookmark className={className} />;
    case "folder":
      return <Folder className={className} />;
    case "tag":
      return <Tag className={className} />;
    case "search":
      return <Search className={className} />;
    case "ai":
      return <Sparkles className={className} />;
    default:
      return <Info className={className} />;
  }
}

/**
 * 获取操作的中文描述
 */
function getActionLabel(actionType: AIActionType): string {
  return ACTION_FEEDBACK.ACTION_LABELS[actionType] || actionType;
}

// ============================================
// 对话框模式组件
// ============================================

/**
 * AI 操作反馈对话框
 */
export function AIActionFeedback({
  open,
  onOpenChange,
  actionType,
  confirmation,
  onConfirm,
  onReject,
  isExecuting = false,
}: AIActionFeedbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  const riskLevel = getActionRiskLevel(actionType);
  const riskConfig = RISK_LEVEL_CONFIG[riskLevel];

  const handleConfirm = useCallback(async () => {
    await onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleReject = useCallback(() => {
    onReject();
    onOpenChange(false);
  }, [onReject, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          {/* 风险等级指示器 */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                "flex items-center justify-center size-10 rounded-full",
                riskConfig.bgColor,
              )}
            >
              {riskLevel === "high" ? (
                <AlertTriangle className={cn("size-5", riskConfig.color)} />
              ) : (
                <DynamicActionIcon
                  actionType={actionType}
                  className={cn("size-5", riskConfig.color)}
                />
              )}
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs", riskConfig.color)}
            >
              {riskConfig.label}
            </Badge>
          </div>

          <AlertDialogTitle className="text-left">
            {ACTION_FEEDBACK.DIALOG_TITLE}
          </AlertDialogTitle>

          <AlertDialogDescription className="text-left">
            {confirmation.message}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 操作详情 */}
        <div className="space-y-3">
          {/* 影响范围 */}
          {confirmation.affectedCount !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {ACTION_FEEDBACK.AFFECTED_SCOPE}
              </span>
              <span className="font-medium">
                {ACTION_FEEDBACK.AFFECTED_ITEMS(confirmation.affectedCount)}
              </span>
            </div>
          )}

          {/* 可撤销提示 */}
          {confirmation.reversible !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {ACTION_FEEDBACK.REVERSIBLE_LABEL}
              </span>
              <span
                className={cn(
                  "font-medium",
                  confirmation.reversible ? "text-green-600" : "text-red-600",
                )}
              >
                {confirmation.reversible
                  ? ACTION_FEEDBACK.REVERSIBLE_YES
                  : ACTION_FEEDBACK.REVERSIBLE_NO}
              </span>
            </div>
          )}

          {/* 操作列表（可折叠） */}
          {confirmation.actions.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => setShowDetails(!showDetails)}
              >
                <span className="text-muted-foreground">
                  {ACTION_FEEDBACK.ACTIONS_COUNT(confirmation.actions.length)}
                </span>
                {showDetails ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>

              {showDetails && (
                <ul className="px-3 py-2 space-y-1 text-sm max-h-32 overflow-y-auto">
                  {confirmation.actions.map((action, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-muted-foreground"
                    >
                      <span className="text-primary mt-0.5">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isExecuting}
            className="flex-1 sm:flex-none"
          >
            <X className="size-4 mr-1" />
            {MESSAGES.COMMON.CANCEL}
          </Button>
          <Button
            variant={riskLevel === "high" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isExecuting}
            className="flex-1 sm:flex-none"
          >
            {isExecuting ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" />
                {ACTION_FEEDBACK.EXECUTING}
              </>
            ) : (
              <>
                <Check className="size-4 mr-1" />
                {MESSAGES.COMMON.CONFIRM}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================
// 内联模式组件
// ============================================

/**
 * AI 操作反馈内联组件
 * 用于在消息流中展示确认请求
 */
export function AIActionFeedbackInline({
  actionType,
  confirmation,
  onConfirm,
  onReject,
  isExecuting = false,
  isHandled = false,
  result,
}: AIActionFeedbackInlineProps) {
  const [showDetails, setShowDetails] = useState(false);

  const riskLevel = getActionRiskLevel(actionType);
  const riskConfig = RISK_LEVEL_CONFIG[riskLevel];
  const actionLabel = getActionLabel(actionType);

  // 已处理状态
  if (isHandled) {
    return (
      <div
        className={cn(
          "rounded-lg border p-3",
          result === "confirmed"
            ? "bg-green-50 border-green-200"
            : "bg-gray-50 border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          {result === "confirmed" ? (
            <>
              <Check className="size-4 text-green-600" />
              <span className="text-green-700">
                {ACTION_FEEDBACK.CONFIRMED_ACTION(actionLabel)}
              </span>
            </>
          ) : (
            <>
              <X className="size-4 text-gray-500" />
              <span className="text-gray-600">
                {ACTION_FEEDBACK.CANCELLED_ACTION(actionLabel)}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-3 space-y-3", riskConfig.bgColor)}>
      {/* 头部 */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex items-center justify-center size-8 rounded-full bg-white/80",
          )}
        >
          {riskLevel === "high" ? (
            <AlertTriangle className={cn("size-4", riskConfig.color)} />
          ) : (
            <DynamicActionIcon
              actionType={actionType}
              className={cn("size-4", riskConfig.color)}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{actionLabel}</span>
            <Badge
              variant="outline"
              className={cn("text-xs", riskConfig.color)}
            >
              {riskConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {confirmation.message}
          </p>
        </div>
      </div>

      {/* 详情 */}
      {confirmation.actions.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            {ACTION_FEEDBACK.VIEW_DETAILS(confirmation.actions.length)}
          </button>

          {showDetails && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {confirmation.actions.map((action, index) => (
                <li key={index} className="flex items-start gap-1.5">
                  <span className="text-primary">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={isExecuting}
          className="h-8"
        >
          <X className="size-3 mr-1" />
          {MESSAGES.COMMON.CANCEL}
        </Button>
        <Button
          size="sm"
          variant={riskLevel === "high" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={isExecuting}
          className="h-8"
        >
          {isExecuting ? (
            <>
              <Loader2 className="size-3 mr-1 animate-spin" />
              {ACTION_FEEDBACK.EXECUTING_SHORT}
            </>
          ) : (
            <>
              <Check className="size-3 mr-1" />
              {ACTION_FEEDBACK.CONFIRM_EXECUTE}
            </>
          )}
        </Button>
      </div>

      {/* 影响范围和可撤销提示 */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {confirmation.affectedCount !== undefined && (
          <span>
            {ACTION_FEEDBACK.AFFECTED_SHORT(confirmation.affectedCount)}
          </span>
        )}
        {confirmation.reversible !== undefined && (
          <span className={confirmation.reversible ? "" : "text-red-500"}>
            {confirmation.reversible
              ? ACTION_FEEDBACK.REVERSIBLE
              : ACTION_FEEDBACK.IRREVERSIBLE}
          </span>
        )}
      </div>
    </div>
  );
}

export default AIActionFeedback;
