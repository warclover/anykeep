/**
 * 自动化流程 Tab 组件
 *
 * 包含：
 * - 快捷模板（新内容分类、定期清理、到期提醒）
 * - 自定义工作流列表
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Plus,
  Trash2,
  Clock,
  Zap,
  RefreshCw,
  Bell,
  Workflow,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

interface WorkflowTemplate {
  type: string;
  title: string;
  description: string;
  icon: typeof Zap;
  iconColor: string;
  schedule?: string;
  enabled: boolean;
}

interface UserWorkflow {
  id: string;
  name: string;
  description?: string;
  templateType: string | null;
  enabled: boolean;
  lastRunAt?: string;
  runCount: number;
  status?: "idle" | "running" | "success" | "failed";
}

// ============================================
// 常量
// ============================================

const QUICK_TEMPLATES: WorkflowTemplate[] = [
  {
    type: "auto_classify",
    title: "新内容自动分类",
    description: "收藏新内容时自动执行智能分类",
    icon: Zap,
    iconColor: "text-yellow-500",
    enabled: false,
  },
  {
    type: "periodic_cleanup",
    title: "定期清理",
    description: "自动清理过期或重复的收藏内容",
    icon: RefreshCw,
    iconColor: "text-blue-500",
    schedule: "每周日 02:00",
    enabled: false,
  },
  {
    type: "expiry_reminder",
    title: "到期提醒",
    description: "收藏超过 30 天未读时发送提醒",
    icon: Bell,
    iconColor: "text-orange-500",
    enabled: false,
  },
];

// ============================================
// 子组件
// ============================================

/**
 * 快捷模板卡片
 */
interface TemplateCardProps {
  template: WorkflowTemplate;
  onToggle: (type: string, enabled: boolean) => void;
}

function TemplateCard({ template, onToggle }: TemplateCardProps) {
  const Icon = template.icon;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "p-2 rounded-lg bg-gray-100 dark:bg-gray-800",
            template.iconColor,
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {template.title}
          </p>
          <p className="text-sm text-gray-500">{template.description}</p>
          {template.schedule && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="size-3 text-gray-400" />
              <span className="text-xs text-gray-400">{template.schedule}</span>
            </div>
          )}
        </div>
      </div>
      <Switch
        checked={template.enabled}
        onCheckedChange={(checked) => onToggle(template.type, checked)}
      />
    </div>
  );
}

/**
 * 工作流列表项
 */
interface WorkflowItemProps {
  workflow: UserWorkflow;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

function WorkflowItem({
  workflow,
  onToggle,
  onRun,
  onDelete,
}: WorkflowItemProps) {
  const StatusIcon =
    workflow.status === "success"
      ? CheckCircle2
      : workflow.status === "failed"
        ? XCircle
        : workflow.status === "running"
          ? RefreshCw
          : AlertCircle;

  const statusColor =
    workflow.status === "success"
      ? "text-green-500"
      : workflow.status === "failed"
        ? "text-red-500"
        : workflow.status === "running"
          ? "text-blue-500 animate-spin"
          : "text-gray-400";

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <Workflow className="size-5 text-purple-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {workflow.name}
            </p>
            <StatusIcon className={cn("size-4", statusColor)} />
          </div>
          {workflow.description && (
            <p className="text-sm text-gray-500">{workflow.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>执行 {workflow.runCount} 次</span>
            {workflow.lastRunAt && (
              <span>
                上次运行：{new Date(workflow.lastRunAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={workflow.enabled}
          onCheckedChange={(checked) => onToggle(workflow.id, checked)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRun(workflow.id)}>
              <Play className="size-4 mr-2" />
              立即执行
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(workflow.id)}
              className="text-red-600"
            >
              <Trash2 className="size-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function AutomationTab() {
  // 状态
  const [templates, setTemplates] =
    useState<WorkflowTemplate[]>(QUICK_TEMPLATES);
  const [workflows, setWorkflows] = useState<UserWorkflow[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 加载工作流列表
   */
  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: 从 API 加载用户工作流
      // const response = await fetch("/api/rules/workflows");
      // const data = await response.json();
      // if (data.success) {
      //   setWorkflows(data.data);
      // }

      // 临时模拟数据
      setWorkflows([]);
    } catch (error) {
      clientLogger.error({ error }, "Failed to load workflows:");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 切换模板启用状态
   */
  const handleTemplateToggle = async (type: string, enabled: boolean) => {
    setTemplates((prev) =>
      prev.map((t) => (t.type === type ? { ...t, enabled } : t)),
    );

    // TODO: 保存到后端
    toast.success(enabled ? "已启用" : "已禁用");
  };

  /**
   * 切换工作流启用状态
   */
  const handleWorkflowToggle = async (id: string, enabled: boolean) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled } : w)),
    );

    // TODO: 保存到后端
    toast.success(enabled ? "已启用" : "已禁用");
  };

  /**
   * 执行工作流
   */
  const handleWorkflowRun = async (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "running" } : w)),
    );

    // TODO: 调用执行 API
    toast.info("正在执行工作流...");

    // 模拟执行完成
    setTimeout(() => {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, status: "success", runCount: w.runCount + 1 }
            : w,
        ),
      );
      toast.success("工作流执行完成");
    }, 2000);
  };

  /**
   * 删除工作流
   */
  const handleWorkflowDelete = async (id: string) => {
    // TODO: 调用删除 API
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    toast.success("已删除工作流");
  };

  // 初始化加载
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  return (
    <div className="space-y-6">
      {/* 快捷模板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5 text-yellow-500" />
            快捷模板
          </CardTitle>
          <CardDescription>一键启用常用的自动化流程，无需配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.type}
              template={template}
              onToggle={handleTemplateToggle}
            />
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* 自定义工作流 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="size-5 text-purple-500" />
                自定义工作流
              </CardTitle>
              <CardDescription>
                创建自定义的自动化流程，灵活配置触发条件和动作
              </CardDescription>
            </div>
            <Button disabled>
              <Plus className="size-4 mr-2" />
              创建工作流
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-6 animate-spin text-gray-400" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Workflow className="size-12 text-gray-300 mb-4" />
              <p className="text-gray-500 mb-2">暂无自定义工作流</p>
              <p className="text-sm text-gray-400">
                点击「创建工作流」开始构建你的自动化流程
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <WorkflowItem
                  key={workflow.id}
                  workflow={workflow}
                  onToggle={handleWorkflowToggle}
                  onRun={handleWorkflowRun}
                  onDelete={handleWorkflowDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
