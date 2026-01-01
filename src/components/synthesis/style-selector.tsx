/**
 * 综述风格选择器组件
 *
 * 用于在综述创建时选择输出风格
 *
 * @version 1.0.0
 * @since 2026-01-01 [S1]
 */

"use client";

import { cn } from "@/lib/utils";
import {
  type SynthesisOutputStyle,
  SYNTHESIS_STYLE_CONFIGS,
} from "@/lib/synthesis";

interface StyleSelectorProps {
  value: SynthesisOutputStyle;
  onChange: (style: SynthesisOutputStyle) => void;
  disabled?: boolean;
  className?: string;
}

const STYLE_ORDER: SynthesisOutputStyle[] = [
  "summary",
  "narrative",
  "comparison",
  "critical",
];

/**
 * 综述风格选择器
 */
export function StyleSelector({
  value,
  onChange,
  disabled,
  className,
}: StyleSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium text-foreground">输出风格</div>

      <div className="grid grid-cols-2 gap-3">
        {STYLE_ORDER.map((styleId) => {
          const config = SYNTHESIS_STYLE_CONFIGS[styleId];
          const isSelected = value === styleId;

          return (
            <button
              key={styleId}
              type="button"
              disabled={disabled}
              onClick={() => onChange(styleId)}
              className={cn(
                "relative flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                "hover:border-primary/50 hover:bg-muted/30",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20 bg-background",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {/* Icon and Name */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{config.icon}</span>
                <span className="font-medium text-sm">{config.name}</span>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {config.description}
              </p>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected style detail */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">
            {SYNTHESIS_STYLE_CONFIGS[value].icon}
          </span>
          <span className="font-medium text-sm">
            {SYNTHESIS_STYLE_CONFIGS[value].name}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="text-muted-foreground">推荐场景：</span>
            <span className="text-foreground">
              {SYNTHESIS_STYLE_CONFIGS[value].recommendedFor}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground">示例输出：</span>
            <pre className="mt-1 p-2 bg-background rounded border text-muted-foreground whitespace-pre-wrap">
              {SYNTHESIS_STYLE_CONFIGS[value].example}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
