"use client";

/**
 * Blueprint Selector - 蓝图类型选择器
 * @module components/knowledge-studio
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BlueprintType } from "@/lib/knowledge-studio";
import { BLUEPRINT_DISPLAY_CONFIG } from "@/lib/knowledge-studio";

interface BlueprintSelectorProps {
  value?: BlueprintType;
  onChange?: (type: BlueprintType) => void;
  disabled?: boolean;
  className?: string;
}

const BLUEPRINT_TYPES: BlueprintType[] = [
  "debater",
  "blogger",
  "thread",
  "tutorial",
  "feynman",
];

export function BlueprintSelector({
  value,
  onChange,
  disabled = false,
  className,
}: BlueprintSelectorProps) {
  const [selected, setSelected] = useState<BlueprintType | undefined>(value);

  const handleSelect = (type: BlueprintType) => {
    if (disabled) return;
    setSelected(type);
    onChange?.(type);
  };

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {BLUEPRINT_TYPES.map((type) => {
        const config = BLUEPRINT_DISPLAY_CONFIG[type];
        const isSelected = selected === type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => handleSelect(type)}
            disabled={disabled}
            className={cn(
              "group relative flex flex-col items-start rounded-lg border p-4 text-left transition-all",
              "hover:border-primary hover:bg-accent/50",
              isSelected &&
                "border-primary bg-accent ring-2 ring-primary ring-offset-2",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {/* Icon */}
            <span className="mb-2 text-2xl">{config.icon}</span>

            {/* Name */}
            <span className="font-medium">{config.name}</span>

            {/* Description */}
            <span className="mt-1 text-sm text-muted-foreground">
              {config.description}
            </span>

            {/* Estimated Time */}
            <span className="mt-2 text-xs text-muted-foreground">
              预计 {config.estimatedTime}
            </span>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute right-2 top-2">
                <svg
                  className="h-5 w-5 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
