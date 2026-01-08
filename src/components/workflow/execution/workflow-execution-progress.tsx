"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  SkipForward,
  X,
  AlertTriangle,
} from "lucide-react";
import { useWorkflowExecution } from "@/hooks/workflow";
import type { ExecutionStep } from "@/hooks/workflow";
import type { FC } from "react";

interface WorkflowExecutionProgressProps {
  executionId: string;
  onClose?: () => void;
  onComplete?: () => void;
  compact?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  waiting_confirmation: "等待确认",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "outline",
  waiting_confirmation: "default",
};

/**
 * 步骤状态图标
 */
const StepStatusIcon: FC<{ status: ExecutionStep["status"] }> = ({
  status,
}) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * 工作流执行进度组件
 */
export const WorkflowExecutionProgress: FC<WorkflowExecutionProgressProps> = ({
  executionId,
  onClose,
  onComplete,
  compact = false,
}) => {
  const { execution, isLoading, error, cancelExecution } = useWorkflowExecution(
    executionId,
    {
      onComplete: () => {
        onComplete?.();
      },
    },
  );

  // 加载中状态
  if (isLoading && !execution) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
          <p className="text-sm text-muted-foreground">加载执行状态失败</p>
        </CardContent>
      </Card>
    );
  }

  if (!execution) {
    return null;
  }

  const isActive =
    execution.status === "pending" || execution.status === "running";

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {execution.workflowName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              ID: {execution.id.slice(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[execution.status]}>
              {STATUS_LABELS[execution.status]}
            </Badge>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-1">
          <Progress value={execution.progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {execution.steps.filter((s) => s.status === "completed").length} /{" "}
              {execution.totalSteps} 步骤
            </span>
            <span>{execution.progress}%</span>
          </div>
        </div>

        {/* 步骤列表 */}
        <div className="space-y-2">
          {execution.steps.map((step) => (
            <div
              key={step.stepId}
              className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
            >
              <StepStatusIcon status={step.status} />
              <span className="flex-1">{step.stepName}</span>
              {step.duration && step.status === "completed" && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(step.duration)}
                </span>
              )}
              {step.error && (
                <span className="text-xs text-red-500 truncate max-w-[120px]">
                  {step.error}
                </span>
              )}
            </div>
          ))}

          {/* 待执行步骤占位 */}
          {execution.totalSteps > execution.steps.length && (
            <div className="text-xs text-muted-foreground text-center py-1">
              还有 {execution.totalSteps - execution.steps.length} 个步骤待执行
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {isActive && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelExecution}
              className="text-red-500 hover:text-red-600"
            >
              <X className="h-4 w-4 mr-1" />
              取消执行
            </Button>
          </div>
        )}

        {/* 错误信息 */}
        {execution.status === "failed" && execution.errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              {execution.errorMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
