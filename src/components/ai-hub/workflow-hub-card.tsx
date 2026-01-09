/**
 * 工作流 Hub 卡片组件
 *
 * 用于在 AI 能力中心展示工作流
 * 支持直接点击执行
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

"use client";

import { Play, Loader2, CheckCircle2, Layers, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkflowHubItem } from "./workflow-hub-types";
import type { FC } from "react";

// ============================================
// 常量
// ============================================

const WORKFLOW_CARD = {
  BUILTIN: "内置",
  USER_DEFINED: "自定义",
  STEPS: "步",
  EXECUTE: "执行",
  EXECUTING: "执行中...",
  TRIGGERS: "触发方式",
};

// ============================================
// 组件
// ============================================

interface WorkflowHubCardProps {
  /** 工作流数据 */
  workflow: WorkflowHubItem;
  /** 点击执行回调 */
  onExecute: (workflowId: string) => void;
  /** 是否正在执行 */
  isExecuting: boolean;
  /** 点击卡片回调（可选，用于查看详情） */
  onClick?: () => void;
}

export const WorkflowHubCard: FC<WorkflowHubCardProps> = ({
  workflow,
  onExecute,
  isExecuting,
  onClick,
}) => {
  const Icon = workflow.icon;

  return (
    <Card
      className={cn(
        "group transition-all duration-200",
        "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600",
        "border border-gray-200 dark:border-gray-700",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex items-center gap-2",
              onClick && "cursor-pointer",
            )}
            onClick={onClick}
          >
            <div className={cn("p-2 rounded-lg", workflow.bgColor)}>
              <Icon className={cn("size-5", workflow.color)} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold hover:text-primary transition-colors">
                {workflow.name}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                v{workflow.version}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {workflow.isBuiltin ? (
              <Badge
                variant="secondary"
                className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              >
                <Workflow className="size-3 mr-1" />
                {WORKFLOW_CARD.BUILTIN}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
              >
                <CheckCircle2 className="size-3 mr-1" />
                {WORKFLOW_CARD.USER_DEFINED}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className={cn(
            "text-sm text-gray-600 dark:text-gray-300 line-clamp-2",
            onClick && "cursor-pointer",
          )}
          onClick={onClick}
        >
          {workflow.description}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            {workflow.stepCount} {WORKFLOW_CARD.STEPS}
          </span>
          {workflow.triggerTypes.length > 0 && (
            <span className="flex items-center gap-1">
              •
              {workflow.triggerTypes.map((type) => (
                <Badge key={type} variant="outline" className="text-xs px-1.5">
                  {type}
                </Badge>
              ))}
            </span>
          )}
        </div>

        {/* 执行按钮 */}
        <div className="pt-2 border-t">
          <Button
            size="sm"
            variant="default"
            className={cn(
              "w-full gap-2",
              workflow.bgColor,
              !isExecuting && "hover:opacity-90",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onExecute(workflow.id);
            }}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {WORKFLOW_CARD.EXECUTING}
              </>
            ) : (
              <>
                <Play className="size-4" />
                {WORKFLOW_CARD.EXECUTE}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// 空状态组件
// ============================================

interface WorkflowEmptyStateProps {
  /** 搜索词（用于显示搜索结果为空） */
  searchQuery?: string;
}

export const WorkflowEmptyState: FC<WorkflowEmptyStateProps> = ({
  searchQuery,
}) => {
  return (
    <div className="text-center py-12">
      <Workflow className="size-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
        {searchQuery ? "未找到匹配的工作流" : "暂无工作流"}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {searchQuery
          ? "尝试使用不同的搜索词"
          : "工作流可以帮助您自动化执行复杂任务"}
      </p>
    </div>
  );
};
