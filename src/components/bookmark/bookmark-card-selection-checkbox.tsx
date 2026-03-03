/**
 * 书签选择复选框子组件
 */

"use client";

import { memo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectionCheckboxProps {
  className?: string;
  isSelected: boolean;
}

export const BookmarkSelectionCheckbox = memo(
  function BookmarkSelectionCheckbox({
    className = "",
    isSelected,
  }: SelectionCheckboxProps) {
    return (
      <div
        className={cn(
          "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
          isSelected
            ? "bg-blue-500 border-blue-500"
            : "bg-white/90 border-gray-300 dark:bg-gray-800/90 dark:border-gray-600",
          className,
        )}
      >
        {isSelected && <Check className="w-4 h-4 text-white" />}
      </div>
    );
  },
);
