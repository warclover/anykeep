"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { WorkflowExecution } from "@/hooks/workflow";
import type { FC } from "react";

interface WorkflowResultCardProps {
  execution: WorkflowExecution;
  onViewDetail?: (executionId: string) => void;
}

/**
 * 状态点
 */
const StatusDot: FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    completed: "bg-green-500",
    failed: "bg-red-500",
    skipped: "bg-gray-400",
    running: "bg-blue-500",
    pending: "bg-gray-300",
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors.pending}`}
    />
  );
};

/**
 * 生成执行摘要
 */
function generateSummary(execution: WorkflowExecution): string {
  const completedSteps = execution.steps.filter(
    (s) => s.status === "completed",
  );
  const failedSteps = execution.steps.filter((s) => s.status === "failed");

  if (execution.status === "completed") {
    return `成功执行 ${completedSteps.length} 个步骤`;
  }

  if (execution.status === "failed") {
    const failedStep = failedSteps[0];
    return failedStep
      ? `在「${failedStep.stepName}」步骤失败: ${failedStep.error || "未知错误"}`
      : "执行失败";
  }

  if (execution.status === "cancelled") {
    return `用户取消，已完成 ${completedSteps.length} 个步骤`;
  }

  return `${execution.status}`;
}

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * 工作流执行结果卡片
 */
export const WorkflowResultCard: FC<WorkflowResultCardProps> = ({
  execution,
  onViewDetail,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isSuccess = execution.status === "completed";
  const relativeTime = formatDistanceToNow(new Date(execution.startedAt), {
    locale: zhCN,
    addSuffix: true,
  });

  // 计算总耗时
  const totalDuration = execution.steps.reduce(
    (sum, step) => sum + (step.duration || 0),
    0,
  );

  // 生成摘要
  const summary = generateSummary(execution);

  return (
    <Card
      className={
        isSuccess
          ? "border-green-200 dark:border-green-900"
          : "border-red-200 dark:border-red-900"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <CardTitle className="text-base">
              {execution.workflowName}
            </CardTitle>
          </div>
          <Badge variant={isSuccess ? "secondary" : "destructive"}>
            {isSuccess ? "成功" : "失败"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 摘要 */}
        <p className="text-sm text-muted-foreground">{summary}</p>

        {/* 元信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {relativeTime}
          </span>
          <span>•</span>
          <span>耗时 {formatDuration(totalDuration)}</span>
          <span>•</span>
          <span>
            {execution.steps.filter((s) => s.status === "completed").length}/
            {execution.totalSteps} 步骤
          </span>
        </div>

        {/* 展开详情 */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
            >
              <span>执行详情</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {execution.steps.map((step) => (
                <div
                  key={step.stepId}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={step.status} />
                    <span>{step.stepName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {step.duration ? formatDuration(step.duration) : "-"}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 操作按钮 */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetail?.(execution.id)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            查看详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
