"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Zap, Layers, Loader2 } from "lucide-react";
import { useWorkflowTrigger } from "@/hooks/workflow";
import type { WorkflowSummary } from "@/hooks/workflow";
import type { FC } from "react";

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  onExecutionStart?: (executionId: string) => void;
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "手动",
  event: "事件",
  schedule: "定时",
  conversation: "对话",
};

/**
 * 工作流卡片组件
 */
export const WorkflowCard: FC<WorkflowCardProps> = ({
  workflow,
  onExecutionStart,
}) => {
  const { triggerWorkflow, isLoading, loadingWorkflowId } =
    useWorkflowTrigger();

  const isCurrentLoading = isLoading && loadingWorkflowId === workflow.id;
  const isBuiltin = workflow.category === "builtin";

  const handleRun = async () => {
    const result = await triggerWorkflow(workflow.id);
    if (result.success && result.executionId) {
      onExecutionStart?.(result.executionId);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {workflow.name}
              {isBuiltin && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  预设
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {workflow.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 元信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {workflow.stepCount} 步骤
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            {workflow.triggers.map((t) => TRIGGER_LABELS[t.type]).join(" / ")}
          </span>
        </div>

        {/* 触发器标签 */}
        <div className="flex flex-wrap gap-1">
          {workflow.triggers.map((trigger, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {TRIGGER_LABELS[trigger.type]}
            </Badge>
          ))}
        </div>

        {/* 运行按钮 */}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleRun} disabled={isLoading}>
            {isCurrentLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                启动中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                运行
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
