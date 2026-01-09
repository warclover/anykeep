/**
 * 工作流设置卡片组件
 *
 * 用于在设置页面管理内置工作流的启用/禁用状态
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Workflow,
  Clock,
  Zap,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/client-logger";

interface WorkflowTrigger {
  type: "manual" | "schedule" | "event" | "conversation";
  schedule?: {
    type: string;
    value: string;
  };
  eventType?: string;
  patterns?: string[];
}

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  definitionId: string | null;
  triggers: WorkflowTrigger[];
}

/**
 * 获取触发类型图标
 */
function getTriggerIcon(type: string) {
  switch (type) {
    case "schedule":
      return <Clock className="size-3" />;
    case "event":
      return <Zap className="size-3" />;
    case "conversation":
      return <MessageSquare className="size-3" />;
    default:
      return null;
  }
}

/**
 * 获取触发类型标签
 */
function getTriggerLabel(trigger: WorkflowTrigger): string {
  switch (trigger.type) {
    case "schedule":
      if (trigger.schedule?.value?.includes("0 8 * * *")) {
        return "每日 8:00";
      }
      if (trigger.schedule?.value?.includes("0 3 * * 0")) {
        return "每周日 3:00";
      }
      return "定时执行";
    case "event":
      return "事件触发";
    case "conversation":
      return "对话触发";
    case "manual":
      return "手动执行";
    default:
      return trigger.type;
  }
}

/**
 * 工作流项组件
 */
function WorkflowItemRow({
  workflow,
  onToggle,
  isToggling,
}: {
  workflow: WorkflowItem;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  isToggling: boolean;
}) {
  // 使用 useRef 追踪乐观更新状态
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(
    null,
  );

  // 实际显示的状态：乐观更新值优先，否则使用 workflow.enabled
  const displayEnabled = optimisticEnabled ?? workflow.enabled;

  const handleToggle = async (checked: boolean) => {
    setOptimisticEnabled(checked); // 乐观更新
    try {
      await onToggle(workflow.id, checked);
      setOptimisticEnabled(null); // 成功后清除乐观状态，使用实际值
    } catch {
      setOptimisticEnabled(null); // 失败时清除，回滚到原始值
    }
  };

  // 获取非手动触发类型
  const autoTriggers = workflow.triggers.filter((t) => t.type !== "manual");

  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 pr-4">
        <Label
          htmlFor={`workflow-${workflow.id}`}
          className="text-sm font-medium cursor-pointer flex items-center gap-2"
        >
          {workflow.name}
          {autoTriggers.length > 0 && (
            <div className="flex gap-1">
              {autoTriggers.map((trigger, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5 gap-1 bg-gray-50 dark:bg-gray-800"
                >
                  {getTriggerIcon(trigger.type)}
                  {getTriggerLabel(trigger)}
                </Badge>
              ))}
            </div>
          )}
        </Label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {workflow.description}
        </p>
      </div>
      <Switch
        id={`workflow-${workflow.id}`}
        checked={displayEnabled}
        onCheckedChange={handleToggle}
        disabled={isToggling}
      />
    </div>
  );
}

/**
 * 工作流设置卡片
 */
export function WorkflowSettingsCard() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // 加载工作流列表
  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workflows");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "加载失败");
      }

      setWorkflows(data.workflows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载工作流失败";
      setError(message);
      clientLogger.error({ error: message }, "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // 切换工作流状态
  const handleToggle = async (workflowId: string, enabled: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(workflowId));
    try {
      const response = await fetch(`/api/workflows/${workflowId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "更新失败");
      }

      // 更新本地状态
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, enabled } : w)),
      );

      clientLogger.info(
        { workflowId, enabled },
        "Workflow toggled successfully",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "切换工作流失败";
      clientLogger.error(
        { error: message, workflowId },
        "Failed to toggle workflow",
      );
      throw err; // 抛出错误让组件回滚
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
    }
  };

  // 分组工作流
  const enabledWorkflows = workflows.filter((w) => w.enabled);
  const disabledWorkflows = workflows.filter((w) => !w.enabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="size-5 text-indigo-600 dark:text-indigo-400" />
          自动化工作流
        </CardTitle>
        <CardDescription>
          配置内置工作流的自动执行，包括定时任务和事件触发
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="size-8 text-red-500 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={loadWorkflows}>
              <RefreshCw className="size-4 mr-2" />
              重试
            </Button>
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            暂无可用的工作流
          </div>
        ) : (
          <div className="space-y-1">
            {/* 已启用的工作流 */}
            {enabledWorkflows.length > 0 && (
              <>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  已启用
                </p>
                {enabledWorkflows.map((workflow, idx) => (
                  <div key={workflow.id}>
                    <WorkflowItemRow
                      workflow={workflow}
                      onToggle={handleToggle}
                      isToggling={togglingIds.has(workflow.id)}
                    />
                    {idx < enabledWorkflows.length - 1 && <Separator />}
                  </div>
                ))}
              </>
            )}

            {/* 分隔 */}
            {enabledWorkflows.length > 0 && disabledWorkflows.length > 0 && (
              <div className="my-4" />
            )}

            {/* 已禁用的工作流 */}
            {disabledWorkflows.length > 0 && (
              <>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  已禁用
                </p>
                {disabledWorkflows.map((workflow, idx) => (
                  <div key={workflow.id}>
                    <WorkflowItemRow
                      workflow={workflow}
                      onToggle={handleToggle}
                      isToggling={togglingIds.has(workflow.id)}
                    />
                    {idx < disabledWorkflows.length - 1 && <Separator />}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
