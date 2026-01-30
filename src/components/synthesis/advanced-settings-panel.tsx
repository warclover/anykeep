/**
 * 高级设置折叠面板组件
 *
 * 用于在综述创建时展示深度模式和输出风格选择（默认折叠）
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

"use client";

import { useState } from "react";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { SynthesisDepthMode, SynthesisOutputStyle } from "@/lib/synthesis";
import { StyleSelector } from "./style-selector";

// 深度模式配置
const DEPTH_MODES = [
  {
    id: "quick" as SynthesisDepthMode,
    label: "快读模式",
    description: "3-5 句概要，快速了解主题",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-200 dark:border-yellow-900",
  },
  {
    id: "standard" as SynthesisDepthMode,
    label: "标准模式",
    description: "完整四维输出（共识/分歧/盲区）",
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-900",
  },
  {
    id: "academic" as SynthesisDepthMode,
    label: "学术模式",
    description: "深度分析，详细论证和引用",
    icon: GraduationCap,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-900",
  },
];

interface AdvancedSettingsPanelProps {
  depthMode: SynthesisDepthMode;
  outputStyle: SynthesisOutputStyle;
  onDepthModeChange: (mode: SynthesisDepthMode) => void;
  onOutputStyleChange: (style: SynthesisOutputStyle) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 高级设置折叠面板
 */
export function AdvancedSettingsPanel({
  depthMode,
  outputStyle,
  onDepthModeChange,
  onOutputStyleChange,
  disabled,
  className,
}: AdvancedSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentMode = DEPTH_MODES.find((m) => m.id === depthMode);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>高级设置</span>
          <span className="text-xs">({currentMode?.label})</span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-6 rounded-lg border bg-muted/30 p-4">
        {/* 深度模式选择 */}
        <div className="space-y-3">
          <div className="text-sm font-medium">综述深度</div>
          <RadioGroup
            value={depthMode}
            onValueChange={(value) =>
              onDepthModeChange(value as SynthesisDepthMode)
            }
            disabled={disabled}
          >
            <div className="grid gap-2">
              {DEPTH_MODES.map((mode) => (
                <label
                  key={mode.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    mode.bgColor,
                    mode.borderColor,
                    depthMode === mode.id && "ring-2 ring-primary",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <RadioGroupItem value={mode.id} disabled={disabled} />
                  <div className={cn("rounded-lg p-1.5", mode.bgColor)}>
                    <mode.icon className={cn("h-4 w-4", mode.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {mode.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* 风格选择 */}
        <StyleSelector
          value={outputStyle}
          onChange={onOutputStyleChange}
          disabled={disabled}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
