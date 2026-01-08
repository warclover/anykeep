"use client";

/**
 * Save to Note Button - 保存到笔记按钮
 * @description 一键保存 AI 内容到笔记的按钮组件
 */

import * as React from "react";
import { Save, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSaveToNote } from "@/hooks/use-save-to-note";
import { DuplicateWarningPopover } from "./duplicate-warning-popover";
import { SaveSuccessToast } from "./save-success-toast";
import { toast } from "sonner";
import type { SaveSourceType, SaveButtonState } from "./types";
import { cn } from "@/lib/utils";

interface SaveToNoteButtonProps {
  /** 要保存的内容 */
  content: string;
  /** 来源类型 */
  sourceType: SaveSourceType;
  /** 来源 ID */
  sourceId?: string;
  /** 来源对话 ID */
  sourceConversationId?: string;
  /** 建议的标题（用于交付物等已有标题的场景） */
  suggestedTitle?: string;
  /** 按钮变体：default 显示文字，icon 仅显示图标 */
  variant?: "default" | "icon";
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 保存成功回调 */
  onSaveSuccess?: (noteId: number, noteTitle: string) => void;
  /** 保存失败回调 */
  onSaveError?: (error: Error) => void;
}

/**
 * 按钮状态配置
 */
const buttonStates: Record<
  SaveButtonState,
  {
    icon: React.ElementType;
    text: string;
    className: string;
    iconClassName?: string;
  }
> = {
  idle: {
    icon: Save,
    text: "保存",
    className: "text-muted-foreground hover:text-foreground",
  },
  checking: {
    icon: Loader2,
    text: "检查中",
    className: "text-muted-foreground",
    iconClassName: "animate-spin",
  },
  generating: {
    icon: Loader2,
    text: "生成标题",
    className: "text-primary",
    iconClassName: "animate-spin",
  },
  saving: {
    icon: Loader2,
    text: "保存中",
    className: "text-primary",
    iconClassName: "animate-spin",
  },
  success: {
    icon: Check,
    text: "已保存",
    className: "text-green-500",
  },
  error: {
    icon: AlertCircle,
    text: "失败",
    className: "text-destructive",
  },
};

export function SaveToNoteButton({
  content,
  sourceType,
  sourceId,
  sourceConversationId,
  suggestedTitle,
  variant = "default",
  disabled = false,
  className,
  onSaveSuccess,
  onSaveError,
}: SaveToNoteButtonProps) {
  const { state, duplicateInfo, save, saveAnyway, reset } = useSaveToNote({
    onSuccess: (noteId, noteTitle) => {
      // 显示成功 Toast
      toast.custom(
        (t) => (
          <SaveSuccessToast
            noteId={noteId}
            noteTitle={noteTitle}
            folderName="AI 生成"
            onViewNote={() => {
              window.open(`/md-collections/${noteId}`, "_blank");
              toast.dismiss(t);
            }}
          />
        ),
        { duration: 4000 },
      );

      onSaveSuccess?.(noteId, noteTitle);
    },
    onError: (error) => {
      toast.error("保存失败", { description: error.message });
      onSaveError?.(error);
    },
  });

  const handleClick = async () => {
    if (state !== "idle" || disabled) return;

    await save({
      content,
      sourceType,
      sourceId,
      sourceConversationId,
      customTitle: suggestedTitle,
    });
  };

  const handleSaveAnyway = async () => {
    await saveAnyway({
      content,
      sourceType,
      sourceId,
      sourceConversationId,
      customTitle: suggestedTitle,
    });
  };

  const handleViewExisting = () => {
    if (duplicateInfo) {
      window.open(`/md-collections/${duplicateInfo.id}`, "_blank");
      reset();
    }
  };

  const currentState = buttonStates[state];
  const Icon = currentState.icon;
  const isIconOnly = variant === "icon";

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={isIconOnly ? "icon" : "sm"}
              className={cn(
                isIconOnly ? "h-7 w-7" : "h-8 px-2 gap-1.5",
                currentState.className,
                className,
              )}
              onClick={handleClick}
              disabled={disabled || (state !== "idle" && state !== "error")}
            >
              <Icon
                className={cn(
                  isIconOnly ? "h-3.5 w-3.5" : "h-4 w-4",
                  currentState.iconClassName,
                )}
              />
              {!isIconOnly && (
                <span className="text-xs">{currentState.text}</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>保存到我的笔记</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DuplicateWarningPopover
        open={!!duplicateInfo}
        onOpenChange={(open) => !open && reset()}
        duplicateNote={duplicateInfo}
        onViewExisting={handleViewExisting}
        onSaveAnyway={handleSaveAnyway}
      />
    </>
  );
}
