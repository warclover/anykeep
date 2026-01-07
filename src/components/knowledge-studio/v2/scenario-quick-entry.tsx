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
 * 映射到已注册的蓝图 ID
 */
const SCENARIOS: Scenario[] = [
  {
    id: "newsletter",
    icon: "📰",
    label: "周刊策展",
    description: "生成专业周刊内容",
    blueprintId: "creator-newsletter",
  },
  {
    id: "scriptwriter",
    icon: "🎬",
    label: "视频脚本",
    description: "生成视频脚本和分镜",
    blueprintId: "creator-scriptwriter",
  },
  {
    id: "analysis",
    icon: "📊",
    label: "竞品分析",
    description: "生成竞品分析报告",
    blueprintId: "business-competitor_scout",
  },
  {
    id: "tutorial",
    icon: "📝",
    label: "技术教程",
    description: "生成技术教程文章",
    blueprintId: "geek-tutorial_architect",
  },
  {
    id: "paper",
    icon: "📄",
    label: "论文解读",
    description: "解读学术论文",
    blueprintId: "geek-arxiv_decoder",
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
