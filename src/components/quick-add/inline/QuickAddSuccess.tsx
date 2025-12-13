"use client";

/**
 * Quick Add Success Component
 *
 * Shows success feedback after bookmark is created.
 * Includes pulse animation and optional undo action.
 */

import { useEffect } from "react";
import { CheckCircle2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface QuickAddSuccessProps {
  message?: string;
  folderName?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  autoHideDelay?: number;
  className?: string;
}

export function QuickAddSuccess({
  message = "已收藏！",
  folderName = "待整理",
  onUndo,
  onDismiss,
  autoHideDelay = 2000,
  className,
}: QuickAddSuccessProps) {
  // Auto-dismiss after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [autoHideDelay, onDismiss]);

  return (
    <div
      className={cn(
        // Base styles
        "flex items-center gap-3 w-full h-11 px-4",
        "rounded-full border-none transition-all",

        // Success state - green gradient
        "bg-gradient-to-r from-emerald-500 to-emerald-600",
        "text-white",

        // Pulse animation
        "animate-success-pulse",

        className,
      )}
    >
      {/* Success icon */}
      <CheckCircle2 className="w-4 h-4 flex-shrink-0 animate-in zoom-in duration-200" />

      {/* Message */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm font-medium">{message}</span>
        {folderName && (
          <span className="text-xs text-emerald-100">→ {folderName}</span>
        )}
      </div>

      {/* Undo button */}
      {onUndo && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 rounded-full",
            "text-white/80 hover:text-white hover:bg-white/10",
            "text-xs",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onUndo();
          }}
        >
          <Undo2 className="w-3 h-3 mr-1" />
          撤销
        </Button>
      )}
    </div>
  );
}

// Add custom animation to global styles
const successPulseKeyframes = `
@keyframes success-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.animate-success-pulse {
  animation: success-pulse 0.5s ease-out;
}
`;

// Inject animation styles
if (typeof document !== "undefined") {
  const styleId = "quick-add-success-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = successPulseKeyframes;
    document.head.appendChild(style);
  }
}
