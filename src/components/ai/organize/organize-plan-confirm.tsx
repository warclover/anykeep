"use client";

/**
 * 整理方案确认组件
 *
 * 用于展示和确认 AI 智能整理的操作方案
 * 支持查看每个操作的详情、移除不需要的操作
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  AlertTriangle,
  Loader2,
  X,
  Clock,
  Info,
  FolderTree,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { OrganizePlanConfirmProps, OrganizeOperationItem } from "./types";

// ============================================
// 常量定义
// ============================================

const DIALOG_STRINGS = {
  title: "确认整理方案",
  confirmButton: "确认执行",
  confirmingButton: "执行中...",
  cancelButton: "取消",
  highRiskWarning: (count: number) => `有 ${count} 个高风险操作，请仔细确认`,
  estimatedTime: (duration: number) => `预计耗时：${formatDuration(duration)}`,
  affectedItems: (count: number) => `影响 ${count} 条书签`,
} as const;

/**
 * 格式化时长
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`;
  return `${Math.round(ms / 60000)}分钟`;
}

// ============================================
// 风险等级样式
// ============================================

function getRiskStyles(riskLevel: OrganizeOperationItem["riskLevel"]) {
  switch (riskLevel) {
    case "low":
      return {
        badge:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800",
        bg: "",
      };
    case "medium":
      return {
        badge:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800",
        bg: "",
      };
    case "high":
      return {
        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        border: "border-red-200 dark:border-red-800",
        bg: "bg-red-50/50 dark:bg-red-900/10",
      };
  }
}

const RISK_LABELS: Record<OrganizeOperationItem["riskLevel"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

// ============================================
// 操作项组件
// ============================================

interface OperationItemProps {
  operation: OrganizeOperationItem;
  onRemove: () => void;
  isLoading: boolean;
}

function OperationItem({ operation, onRemove, isLoading }: OperationItemProps) {
  const styles = getRiskStyles(operation.riskLevel);

  return (
    <div
      className={cn(
        "flex items-start justify-between p-3 rounded-lg border",
        styles.border,
        styles.bg,
      )}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="mt-0.5 text-lg">{operation.icon}</div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{operation.name}</span>
            <Badge className={cn("text-xs", styles.badge)}>
              {RISK_LABELS[operation.riskLevel]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {operation.description}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3" />
              {DIALOG_STRINGS.affectedItems(operation.affectedCount)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(operation.estimatedDuration)}
            </span>
          </div>
          {/* 警告信息 */}
          {operation.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {operation.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 移除按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={isLoading}
        className="shrink-0 h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * 整理方案确认组件
 */
export function OrganizePlanConfirm({
  plan,
  open,
  onOpenChange,
  onConfirm,
  onModify,
  onCancel,
  isLoading = false,
}: OrganizePlanConfirmProps) {
  const highRiskCount = plan.operations.filter(
    (op) => op.riskLevel === "high",
  ).length;

  const handleRemoveOperation = (operationId: string) => {
    const modifiedPlan = {
      ...plan,
      operations: plan.operations.filter((op) => op.id !== operationId),
      totalAffected: plan.operations
        .filter((op) => op.id !== operationId)
        .reduce((sum, op) => sum + op.affectedCount, 0),
      totalDuration: plan.operations
        .filter((op) => op.id !== operationId)
        .reduce((sum, op) => sum + op.estimatedDuration, 0),
    };
    onModify(modifiedPlan);
  };

  const handleConfirm = () => {
    onConfirm(plan);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  // 如果没有操作，显示空状态
  if (plan.operations.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>没有可执行的操作</DialogTitle>
            <DialogDescription>
              当前方案中没有需要执行的操作，请调整整理条件后重试。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleCancel}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            {DIALOG_STRINGS.title}
          </DialogTitle>
          <DialogDescription>{plan.summary}</DialogDescription>
        </DialogHeader>

        {/* 操作列表 */}
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {plan.operations.map((operation) => (
              <OperationItem
                key={operation.id}
                operation={operation}
                onRemove={() => handleRemoveOperation(operation.id)}
                isLoading={isLoading}
              />
            ))}
          </div>
        </ScrollArea>

        {/* 高风险警告 */}
        {highRiskCount > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {DIALOG_STRINGS.highRiskWarning(highRiskCount)}
            </AlertDescription>
          </Alert>
        )}

        {/* 底部信息栏 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{DIALOG_STRINGS.affectedItems(plan.totalAffected)}</span>
            <span>{DIALOG_STRINGS.estimatedTime(plan.totalDuration)}</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {DIALOG_STRINGS.cancelButton}
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {DIALOG_STRINGS.confirmingButton}
                </>
              ) : (
                DIALOG_STRINGS.confirmButton
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
