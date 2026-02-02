"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label?: string;
  badge?: number;
  position?: "bottom-right" | "bottom-center";
  elevated?: boolean;
}

export const FloatingActionButton = forwardRef<
  HTMLButtonElement,
  FloatingActionButtonProps
>(
  (
    {
      icon,
      label,
      badge,
      position = "bottom-right",
      elevated = false,
      className,
      ...props
    },
    ref,
  ) => {
    const positionClasses = {
      "bottom-right": "right-4 bottom-4",
      "bottom-center": "left-1/2 -translate-x-1/2 bottom-4",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "fixed z-50",
          "flex items-center justify-center",
          "min-w-14 h-14 px-4",
          "rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
          "transition-all duration-200",
          elevated && "translate-y-[-60px]",
          positionClasses[position],
          className,
        )}
        {...props}
      >
        {/* 图标 */}
        <span className="text-xl">{icon}</span>

        {/* 可选标签 */}
        {label && <span className="ml-2 text-sm font-medium">{label}</span>}

        {/* 徽章 */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
    );
  },
);

FloatingActionButton.displayName = "FloatingActionButton";
