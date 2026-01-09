/**
 * 工作流 Hub 类型定义
 *
 * 用于 AI 能力中心的工作流 Tab 展示
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import type { LucideIcon } from "lucide-react";
import type { WorkflowSummary } from "@/hooks/workflow/use-workflow-list";
import type { SkillCategory } from "@/lib/ai-skills/core/types";
import {
  Zap,
  Calendar,
  Brain,
  HeartPulse,
  Workflow,
  Sparkles,
  FileText,
} from "lucide-react";

/**
 * 扩展的筛选分类（包含工作流）
 */
export type FilterCategory = SkillCategory | "all" | "workflow";

/**
 * 工作流 Hub 展示项
 */
export interface WorkflowHubItem {
  /** 工作流 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述文本 */
  description: string;
  /** 图标组件 */
  icon: LucideIcon;
  /** 图标颜色类名 */
  color: string;
  /** 背景颜色类名 */
  bgColor: string;
  /** 是否内置工作流 */
  isBuiltin: boolean;
  /** 步骤数量 */
  stepCount: number;
  /** 版本号 */
  version: string;
  /** 触发类型 */
  triggerTypes: string[];
}

/**
 * 工作流图标映射表
 * 根据工作流 ID 返回对应的图标配置
 */
const WORKFLOW_ICON_MAP: Record<
  string,
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  smart_intake: {
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  weekly_organize: {
    icon: Calendar,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  deep_learning: {
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  bookmark_health_simple: {
    icon: HeartPulse,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  bookmark_health_full: {
    icon: HeartPulse,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  content_snapshot: {
    icon: FileText,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  ai_enhance: {
    icon: Sparkles,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
};

/**
 * 默认图标配置
 */
const DEFAULT_ICON_CONFIG = {
  icon: Workflow,
  color: "text-gray-500",
  bgColor: "bg-gray-500/10",
};

/**
 * 将 WorkflowSummary 转换为 WorkflowHubItem
 */
export function workflowToHubItem(workflow: WorkflowSummary): WorkflowHubItem {
  const iconConfig = WORKFLOW_ICON_MAP[workflow.id] || DEFAULT_ICON_CONFIG;

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    icon: iconConfig.icon,
    color: iconConfig.color,
    bgColor: iconConfig.bgColor,
    isBuiltin: workflow.category === "builtin",
    stepCount: workflow.stepCount,
    version: workflow.version,
    triggerTypes: workflow.triggers.map((t) => t.type),
  };
}

/**
 * 工作流 Tab 信息
 */
export const WORKFLOW_TAB_INFO = {
  id: "workflow" as const,
  name: "工作流",
  description: "自动化任务流程，一键执行复杂操作",
  icon: "⚡",
};
