/**
 * Scenario Quick Entry - 场景快速入口组件
 * @module knowledge-studio/v2
 * @description 提供快速场景选择，降低用户选择门槛
 */

"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

/**
 * 场景配置
 */
interface Scenario {
  id: string;
  icon: string;
  label: string;
  description: string;
  blueprintId: string;
}

interface ScenarioQuickEntryProps {
  /** 选中场景后的回调 */
  onSelect: (blueprintId: string) => void;
  /** 自定义样式类名 */
  className?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 预定义场景列表
 */
const SCENARIOS: Scenario[] = [
  {
    id: "wechat",
    icon: "💬",
    label: "写公众号",
    description: "生成公众号爆款文章",
    blueprintId: "wechat_article",
  },
  {
    id: "xiaohongshu",
    icon: "📕",
    label: "发小红书",
    description: "生成种草笔记",
    blueprintId: "xiaohongshu_note",
  },
  {
    id: "analysis",
    icon: "📊",
    label: "竞品分析",
    description: "生成竞品分析报告",
    blueprintId: "competitive_analysis",
  },
  {
    id: "notes",
    icon: "📝",
    label: "学习笔记",
    description: "整理学习笔记",
    blueprintId: "learning_notes",
  },
  {
    id: "summary",
    icon: "📋",
    label: "内容摘要",
    description: "生成内容摘要",
    blueprintId: "content_summary",
  },
];

// ============================================================
// Component
// ============================================================

export function ScenarioQuickEntry({
  onSelect,
  className,
}: ScenarioQuickEntryProps) {
  const handleSelect = useCallback(
    (blueprintId: string) => {
      onSelect(blueprintId);
    },
    [onSelect],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-lg">🎯</span>
        <span>你想做什么？</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => handleSelect(scenario.blueprintId)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full",
              "bg-muted hover:bg-primary/10 hover:text-primary",
              "border border-transparent hover:border-primary/20",
              "transition-all duration-200",
              "text-sm font-medium",
            )}
            title={scenario.description}
          >
            <span>{scenario.icon}</span>
            <span>{scenario.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
