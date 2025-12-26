"use client";

/**
 * "这不是我的意图"按钮组件
 *
 * 显示在 AI 消息操作栏中，让用户快速触发意图纠正
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 */

import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WrongIntentButtonProps } from "./types";

// =============================================================================
// 组件实现
// =============================================================================

export const WrongIntentButton = memo(function WrongIntentButton({
  currentIntent: _currentIntent, // Reserved for analytics
  messageId: _messageId, // Reserved for tracking
  onClick,
  disabled = false,
  className,
}: WrongIntentButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md",
              "text-muted-foreground hover:text-amber-600 hover:bg-amber-50",
              className,
            )}
            onClick={onClick}
            disabled={disabled}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          这不是我的意图
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default WrongIntentButton;
