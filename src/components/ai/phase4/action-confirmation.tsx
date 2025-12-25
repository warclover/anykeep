"use client";

/**
 * Phase 4: ActionConfirmation - 执行确认组件
 * @version 1.0.0
 * @description AI 整理操作的确认界面，支持风险等级展示、操作预览和二次确认
 */

import * as React from "react";
import {
  FolderOpen,
  Tag,
  Trash2,
  Archive,
  Merge,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  ActionConfirmationProps,
  OrganizeAction,
  OrganizeActionType,
  RiskLevel,
  ActionRisk,
  ActionSummary,
} from "./types";

// =============================================================================
// 常量配置
// =============================================================================

/**
 * 操作类型配置
 */
const ACTION_CONFIG: Record<
  OrganizeActionType,
  {
    icon: React.ElementType;
    label: string;
    verb: string;
    color: string;
  }
> = {
  move: {
    icon: FolderOpen,
    label: "移动",
    verb: "移动到",
    color: "text-blue-500",
  },
  tag: {
    icon: Tag,
    label: "添加标签",
    verb: "添加标签",
    color: "text-green-500",
  },
  untag: {
    icon: Tag,
    label: "移除标签",
    verb: "移除标签",
    color: "text-orange-500",
  },
  merge: {
    icon: Merge,
    label: "合并",
    verb: "合并为",
    color: "text-purple-500",
  },
  archive: {
    icon: Archive,
    label: "归档",
    verb: "归档到",
    color: "text-slate-500",
  },
  delete: {
    icon: Trash2,
    label: "删除",
    verb: "删除",
    color: "text-red-500",
  },
};

/**
 * 风险等级配置
 */
const RISK_CONFIG: Record<
  RiskLevel,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  low: {
    icon: CheckCircle2,
    label: "低风险",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  medium: {
    icon: Info,
    label: "中等风险",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  high: {
    icon: AlertCircle,
    label: "高风险",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  critical: {
    icon: AlertTriangle,
    label: "危险操作",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 评估操作风险等级
 */
function evaluateRisk(actions: OrganizeAction[]): ActionRisk {
  const totalTargets = actions.reduce((sum, a) => sum + a.targets.length, 0);
  const hasDelete = actions.some((a) => a.type === "delete");
  const hasPermanentDelete = actions.some(
    (a) => a.type === "delete" && a.params.permanent,
  );

  // 永久删除 = 危险
  if (hasPermanentDelete) {
    return {
      level: "critical",
      message: `将永久删除 ${totalTargets} 项内容，此操作不可恢复`,
      requiresConfirmation: true,
      requiresInput: "DELETE",
    };
  }

  // 删除 50+ 项 = 高风险
  if (hasDelete && totalTargets >= 50) {
    return {
      level: "high",
      message: `将删除 ${totalTargets} 项内容（可在 24 小时内撤销）`,
      requiresConfirmation: true,
    };
  }

  // 删除操作 = 中等风险
  if (hasDelete) {
    return {
      level: "medium",
      message: `将删除 ${totalTargets} 项内容（可在 24 小时内撤销）`,
      requiresConfirmation: true,
    };
  }

  // 批量操作 100+ 项 = 中等风险
  if (totalTargets >= 100) {
    return {
      level: "medium",
      message: `将影响 ${totalTargets} 项内容`,
      requiresConfirmation: true,
    };
  }

  // 其他操作 = 低风险
  return {
    level: "low",
    message: `将处理 ${totalTargets} 项内容`,
    requiresConfirmation: false,
  };
}

/**
 * 生成操作摘要
 */
function generateSummaries(actions: OrganizeAction[]): ActionSummary[] {
  const summaryMap = new Map<OrganizeActionType, ActionSummary>();

  for (const action of actions) {
    const existing = summaryMap.get(action.type);
    if (existing) {
      existing.count += action.targets.length;
    } else {
      const config = ACTION_CONFIG[action.type];
      let target = "";

      if (action.type === "move" && action.params.folderName) {
        target = action.params.folderName;
      } else if (
        (action.type === "tag" || action.type === "untag") &&
        action.params.tags
      ) {
        target = action.params.tags.join(", ");
      }

      summaryMap.set(action.type, {
        type: action.type,
        count: action.targets.length,
        target,
        description: target ? `${config.verb} "${target}"` : config.label,
      });
    }
  }

  return Array.from(summaryMap.values());
}

// =============================================================================
// 主组件
// =============================================================================

export function ActionConfirmation({
  title,
  actions,
  onConfirm,
  onAdjust,
  onCancel,
  isExecuting = false,
}: ActionConfirmationProps) {
  // 状态
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState("");

  // 计算风险和摘要
  const risk = React.useMemo(() => evaluateRisk(actions), [actions]);
  const summaries = React.useMemo(() => generateSummaries(actions), [actions]);
  const totalCount = actions.reduce((sum, a) => sum + a.targets.length, 0);

  const riskConfig = RISK_CONFIG[risk.level];
  const RiskIcon = riskConfig.icon;

  // 检查是否可以确认
  const canConfirm = risk.requiresInput
    ? confirmInput.toUpperCase() === risk.requiresInput
    : true;

  return (
    <Card
      className={cn(
        "w-full border-2 transition-colors",
        riskConfig.borderColor,
      )}
    >
      <CardHeader className={cn("pb-3", riskConfig.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <RiskIcon className={cn("h-4 w-4", riskConfig.color)} />
              <span className={riskConfig.color}>{riskConfig.label}</span>
              <span className="text-muted-foreground">·</span>
              <span>{totalCount} 项内容</span>
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "px-2 py-1",
              risk.level === "critical" &&
                "border-red-300 bg-red-100 text-red-700",
              risk.level === "high" &&
                "border-orange-300 bg-orange-100 text-orange-700",
            )}
          >
            {risk.level === "critical" ? "需要二次确认" : "可撤销"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* 操作摘要 */}
        <div className="space-y-2">
          {summaries.map((summary, index) => {
            const config = ACTION_CONFIG[summary.type];
            const Icon = config.icon;

            return (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    "bg-background shadow-sm",
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{summary.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.count} 个书签
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 风险提示 */}
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg p-3",
            riskConfig.bgColor,
          )}
        >
          <RiskIcon className={cn("h-5 w-5 mt-0.5", riskConfig.color)} />
          <p className={cn("text-sm", riskConfig.color)}>{risk.message}</p>
        </div>

        {/* 危险操作二次确认 */}
        {risk.requiresInput && (
          <div className="space-y-2">
            <Label htmlFor="confirm-input" className="text-sm font-medium">
              请输入{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-red-600">
                {risk.requiresInput}
              </code>{" "}
              确认操作
            </Label>
            <Input
              id="confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`输入 ${risk.requiresInput} 确认`}
              className="font-mono"
              disabled={isExecuting}
            />
          </div>
        )}

        {/* 详细操作列表（可折叠） */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground"
            >
              <span>查看详细操作</span>
              {detailsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3">
              <ul className="space-y-1 text-sm">
                {actions.map((action, index) => {
                  const config = ACTION_CONFIG[action.type];
                  return (
                    <li key={index} className="flex items-center gap-2">
                      <span className={cn("font-medium", config.color)}>
                        {config.label}
                      </span>
                      <span className="text-muted-foreground">
                        {action.targets.length} 项
                      </span>
                      {action.params.folderName && (
                        <span>→ {action.params.folderName}</span>
                      )}
                      {action.params.tags && action.params.tags.length > 0 && (
                        <span>: {action.params.tags.join(", ")}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex justify-between gap-2 border-t pt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isExecuting}
          >
            取消
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdjust}
            disabled={isExecuting}
          >
            <Undo2 className="mr-1 h-4 w-4" />
            调整方案
          </Button>
        </div>

        <Button
          size="sm"
          onClick={onConfirm}
          disabled={!canConfirm || isExecuting}
          className={cn(
            risk.level === "critical" && "bg-red-600 hover:bg-red-700",
            risk.level === "high" && "bg-orange-600 hover:bg-orange-700",
          )}
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              执行中...
            </>
          ) : (
            <>{risk.level === "critical" ? "确认删除" : "确认执行"}</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// 执行进度组件
// =============================================================================

interface ExecutionProgressProps {
  currentStep: number;
  totalSteps: number;
  currentAction?: string;
  completedCount: number;
  totalCount: number;
}

export function ExecutionProgress({
  currentStep,
  totalSteps,
  currentAction,
  completedCount,
  totalCount,
}: ExecutionProgressProps) {
  const percent = Math.round((completedCount / totalCount) * 100);

  return (
    <Card className="w-full">
      <CardContent className="py-4">
        <div className="space-y-3">
          {/* 进度条 */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                步骤 {currentStep}/{totalSteps}
              </span>
              <span className="font-medium">{percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* 当前操作 */}
          {currentAction && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{currentAction}</span>
            </div>
          )}

          {/* 完成数量 */}
          <p className="text-xs text-muted-foreground">
            已处理 {completedCount} / {totalCount} 项
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// 撤销提示组件
// =============================================================================

interface UndoToastProps {
  message: string;
  timeRemaining: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({
  message,
  timeRemaining,
  onUndo,
  onDismiss,
}: UndoToastProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3 shadow-lg">
      <CheckCircle2 className="h-5 w-5 text-green-500" />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">
          {timeRemaining} 内可撤销
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onUndo}>
          <Undo2 className="mr-1 h-4 w-4" />
          撤销
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          关闭
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// 导出
// =============================================================================

export { evaluateRisk, generateSummaries };
export default ActionConfirmation;
