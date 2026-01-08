"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useWorkflowTrigger } from "@/hooks/workflow";
import {
  Zap,
  Calendar,
  Brain,
  HeartPulse,
  Loader2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FC } from "react";

/**
 * 预设工作流配置
 */
interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const QUICK_WORKFLOWS: readonly WorkflowConfig[] = [
  {
    id: "smart_intake",
    name: "智能收录",
    description: "自动整理今日新增书签",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    id: "weekly_organize",
    name: "周度整理",
    description: "本周收藏智能分类归档",
    icon: Calendar,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "deep_learning",
    name: "深度学习",
    description: "生成学习计划和知识图谱",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "bookmark_health_simple",
    name: "书签巡检",
    description: "检测失效链接和重复内容",
    icon: HeartPulse,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
] as const;

interface WorkflowQuickActionsProps {
  /** 显示模式：toolbar（工具栏紧凑）或 sidebar（侧边栏完整） */
  variant?: "toolbar" | "sidebar";
  /** 工作流启动回调 */
  onExecutionStart?: (workflowId: string, executionId: string) => void;
  /** 最大显示数量（仅 toolbar 模式） */
  maxVisible?: number;
}

export const WorkflowQuickActions: FC<WorkflowQuickActionsProps> = ({
  variant = "toolbar",
  onExecutionStart,
  maxVisible = 3,
}) => {
  const { triggerWorkflow, isLoading, loadingWorkflowId } =
    useWorkflowTrigger();

  const handleTrigger = async (workflow: WorkflowConfig) => {
    const result = await triggerWorkflow(workflow.id);
    if (result.success && result.executionId) {
      onExecutionStart?.(workflow.id, result.executionId);
    }
  };

  if (variant === "sidebar") {
    return (
      <SidebarVariant
        workflows={QUICK_WORKFLOWS}
        onTrigger={handleTrigger}
        isLoading={isLoading}
        loadingWorkflowId={loadingWorkflowId}
      />
    );
  }

  return (
    <ToolbarVariant
      workflows={QUICK_WORKFLOWS}
      onTrigger={handleTrigger}
      isLoading={isLoading}
      loadingWorkflowId={loadingWorkflowId}
      maxVisible={maxVisible}
    />
  );
};

/**
 * 工具栏变体：紧凑图标按钮
 */
const ToolbarVariant: FC<{
  workflows: readonly WorkflowConfig[];
  onTrigger: (workflow: WorkflowConfig) => void;
  isLoading: boolean;
  loadingWorkflowId: string | null;
  maxVisible: number;
}> = ({ workflows, onTrigger, isLoading, loadingWorkflowId, maxVisible }) => {
  const visibleWorkflows = workflows.slice(0, maxVisible);
  const hiddenWorkflows = workflows.slice(maxVisible);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {visibleWorkflows.map((workflow) => {
          const Icon = workflow.icon;
          const isCurrentLoading =
            isLoading && loadingWorkflowId === workflow.id;

          return (
            <Tooltip key={workflow.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onTrigger(workflow)}
                  disabled={isLoading}
                  className="h-8 w-8"
                >
                  {isCurrentLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className={`h-4 w-4 ${workflow.color}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">{workflow.name}</p>
                <p className="text-xs text-muted-foreground">
                  {workflow.description}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {hiddenWorkflows.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hiddenWorkflows.map((workflow) => {
                const Icon = workflow.icon;
                return (
                  <DropdownMenuItem
                    key={workflow.id}
                    onClick={() => onTrigger(workflow)}
                    disabled={isLoading}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${workflow.color}`} />
                    <span>{workflow.name}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
};

/**
 * 侧边栏变体：完整按钮列表
 */
const SidebarVariant: FC<{
  workflows: readonly WorkflowConfig[];
  onTrigger: (workflow: WorkflowConfig) => void;
  isLoading: boolean;
  loadingWorkflowId: string | null;
}> = ({ workflows, onTrigger, isLoading, loadingWorkflowId }) => {
  return (
    <div className="flex flex-col gap-1 p-2">
      {workflows.map((workflow) => {
        const Icon = workflow.icon;
        const isCurrentLoading = isLoading && loadingWorkflowId === workflow.id;

        return (
          <Button
            key={workflow.id}
            variant="ghost"
            size="sm"
            onClick={() => onTrigger(workflow)}
            disabled={isLoading}
            className="justify-start gap-2 h-9"
          >
            {isCurrentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className={`p-1 rounded ${workflow.bgColor}`}>
                <Icon className={`h-3 w-3 ${workflow.color}`} />
              </div>
            )}
            <span className="text-sm">{workflow.name}</span>
          </Button>
        );
      })}
    </div>
  );
};
