/**
 * 整理执行进度组件
 *
 * 显示整理操作的执行进度，包括：
 * - 总体进度条
 * - 当前步骤
 * - 步骤列表
 * - 执行统计
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { memo } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  FolderOpen,
  Tags,
  Trash2,
  Archive,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { OrganizeAction } from "@/lib/ai-skills/skills/batch-organize/types";

// ============================================
// 常量配置
// ============================================

const UI_TEXT = {
  title: "正在整理",
  subtitle: "请稍候，AI 正在为您整理书签...",
  steps: {
    collect: "收集数据",
    analyze: "分析内容",
    categorize: "智能分类",
    tag: "智能打标",
    clean: "整理清理",
    report: "生成报告",
  },
  actions: {
    "auto-categorize": "智能分类",
    "auto-tag": "智能打标签",
    "clean-duplicates": "清理重复",
    "archive-old": "归档旧内容",
    "validate-urls": "验证链接",
  },
  stats: {
    processed: "已处理",
    succeeded: "成功",
    failed: "失败",
  },
} as const;

/**
 * 操作类型图标映射
 */
const ACTION_ICON_MAP: Record<OrganizeAction, React.ElementType> = {
  "auto-categorize": FolderOpen,
  "auto-tag": Tags,
  "clean-duplicates": Trash2,
  "archive-old": Archive,
  "validate-urls": Link2,
};

// ============================================
// 类型定义
// ============================================

export interface OrganizeProgressProps {
  /** 当前步骤名称 */
  currentStep: string;
  /** 当前步骤索引（0-based） */
  stepIndex: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 进度百分比 0-100 */
  percent: number;
  /** 进度消息 */
  message?: string;
  /** 执行的操作类型 */
  actions?: OrganizeAction[];
  /** 执行统计 */
  stats?: {
    processed: number;
    succeeded: number;
    failed: number;
  };
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 步骤项
 */
const StepItem = memo(function StepItem({
  name,
  index,
  currentIndex,
  isCompleted,
}: {
  name: string;
  index: number;
  currentIndex: number;
  isCompleted: boolean;
}) {
  const isCurrent = index === currentIndex;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm py-1",
        isCompleted
          ? "text-green-600"
          : isCurrent
            ? "text-indigo-600 font-medium"
            : "text-gray-400",
      )}
    >
      {isCompleted ? (
        <CheckCircle2 className="size-4 flex-shrink-0" />
      ) : isCurrent ? (
        <Loader2 className="size-4 animate-spin flex-shrink-0" />
      ) : (
        <Circle className="size-4 flex-shrink-0" />
      )}
      <span>{name}</span>
    </div>
  );
});

/**
 * 操作标签
 */
const ActionBadge = memo(function ActionBadge({
  action,
  isActive,
}: {
  action: OrganizeAction;
  isActive: boolean;
}) {
  const Icon = ACTION_ICON_MAP[action] || Circle;
  const label = UI_TEXT.actions[action] || action;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        isActive
          ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
          : "bg-gray-100 text-gray-600 border border-gray-200",
      )}
    >
      <Icon className="size-3" />
      <span>{label}</span>
      {isActive && <Loader2 className="size-3 animate-spin" />}
    </div>
  );
});

/**
 * 统计项
 */
const StatItem = memo(function StatItem({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className={cn("text-center", colorClass)}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 整理执行进度组件
 */
export const OrganizeProgress = memo(function OrganizeProgress({
  currentStep,
  stepIndex,
  totalSteps,
  percent,
  message,
  actions,
  stats,
  className,
}: OrganizeProgressProps) {
  const isCompleted = percent >= 100;

  // 步骤名称列表
  const stepNames = [
    UI_TEXT.steps.collect,
    UI_TEXT.steps.analyze,
    UI_TEXT.steps.categorize,
    UI_TEXT.steps.tag,
    UI_TEXT.steps.clean,
    UI_TEXT.steps.report,
  ];

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="size-5 text-white" />
          ) : (
            <Loader2 className="size-5 text-white animate-spin" />
          )}
          <h3 className="text-lg font-semibold text-white">
            {isCompleted ? "整理完成" : UI_TEXT.title}
          </h3>
        </div>
        <p className="text-sm text-white/80 mt-0.5">
          {message || UI_TEXT.subtitle}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{currentStep}</span>
            <span className="font-medium text-indigo-600">
              {Math.round(percent)}%
            </span>
          </div>
          <Progress value={percent} className="h-2 bg-indigo-100" />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              步骤 {Math.min(stepIndex + 1, totalSteps)}/{totalSteps}
            </span>
            {stats && <span>已处理 {stats.processed} 条书签</span>}
          </div>
        </div>

        {/* 操作类型标签 */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <ActionBadge
                key={action}
                action={action}
                isActive={index === Math.floor(stepIndex / 2)}
              />
            ))}
          </div>
        )}

        {/* 步骤列表 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-indigo-100">
          {stepNames.slice(0, totalSteps).map((name, index) => (
            <StepItem
              key={name}
              name={name}
              index={index}
              currentIndex={stepIndex}
              isCompleted={index < stepIndex || isCompleted}
            />
          ))}
        </div>

        {/* 执行统计 */}
        {stats && (
          <div className="flex items-center justify-around py-3 border-t border-indigo-100">
            <StatItem
              label={UI_TEXT.stats.processed}
              value={stats.processed}
              colorClass="text-gray-700"
            />
            <StatItem
              label={UI_TEXT.stats.succeeded}
              value={stats.succeeded}
              colorClass="text-green-600"
            />
            <StatItem
              label={UI_TEXT.stats.failed}
              value={stats.failed}
              colorClass="text-red-600"
            />
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * 简化版进度指示器（内联显示）
 */
export const OrganizeProgressInline = memo(function OrganizeProgressInline({
  currentStep,
  percent,
}: {
  currentStep: string;
  percent: number;
}) {
  const isCompleted = percent >= 100;

  return (
    <div className="flex items-center gap-2 text-sm">
      {isCompleted ? (
        <CheckCircle2 className="size-4 text-green-500" />
      ) : (
        <Loader2 className="size-4 text-indigo-500 animate-spin" />
      )}
      <span className="text-gray-700">{currentStep}</span>
      <span className="text-xs text-gray-400">({Math.round(percent)}%)</span>
    </div>
  );
});

export default OrganizeProgress;
