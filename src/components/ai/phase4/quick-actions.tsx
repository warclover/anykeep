"use client";

/**
 * Phase 4: QuickActions - 消息快速操作栏组件
 * @version 1.1.0
 * @description AI 消息的快速操作栏，支持复制、重新生成、保存、导出和反馈
 * @changelog
 * - 1.1.0: 集成新版 SaveToNoteButton，支持 AI 标题生成和重复检测
 */

import * as React from "react";
import { clientLogger } from "@/lib/client-logger";
import {
  Copy,
  RefreshCw,
  Download,
  ThumbsUp,
  ThumbsDown,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { SaveToNoteButton } from "@/components/shared/save-to-note";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  MessageActionsBarProps,
  FeedbackDetails,
  FeedbackReason,
  FeedbackReasonOption,
} from "./types";

// =============================================================================
// 常量配置
// =============================================================================

/**
 * 反馈原因选项
 */
const FEEDBACK_REASONS: FeedbackReasonOption[] = [
  { id: "wrong_intent", label: "理解错了我的意图" },
  { id: "inaccurate_result", label: "结果不准确" },
  { id: "bad_format", label: "格式或排版不好" },
  { id: "incomplete", label: "回答不完整" },
  { id: "other", label: "其他原因" },
];

// =============================================================================
// 消息操作栏组件
// =============================================================================

export function MessageActionsBar({
  messageId: _messageId, // Reserved for future analytics use
  content,
  onRegenerate,
  onSave,
  onExport,
  onFeedback,
  onWrongIntent,
  classifiedIntent: _classifiedIntent, // Reserved for analytics
  feedbackGiven,
  isLoading = false,
}: MessageActionsBarProps) {
  // 状态管理
  const [copied, setCopied] = React.useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = React.useState(false);

  // 复制到剪贴板
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      clientLogger.error(
        { component: "QuickActions", error },
        "Failed to copy",
      );
    }
  }, [content]);

  // 处理正面反馈
  const handlePositiveFeedback = React.useCallback(() => {
    if (feedbackGiven !== "like" && onFeedback) {
      onFeedback("like");
    }
  }, [feedbackGiven, onFeedback]);

  // 处理负面反馈（打开对话框）
  const handleNegativeFeedback = React.useCallback(() => {
    if (feedbackGiven !== "dislike") {
      setShowFeedbackDialog(true);
    }
  }, [feedbackGiven]);

  // 提交负面反馈
  const handleSubmitNegativeFeedback = React.useCallback(
    (details: FeedbackDetails) => {
      if (onFeedback) {
        onFeedback("dislike", details);
      }
      setShowFeedbackDialog(false);
    },
    [onFeedback],
  );

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div
          className={cn(
            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            "absolute -bottom-8 left-0",
          )}
        >
          {/* 复制按钮 */}
          <ActionButton
            icon={copied ? Check : Copy}
            label={copied ? "已复制" : "复制"}
            onClick={handleCopy}
            disabled={isLoading}
            active={copied}
          />

          {/* 重新生成按钮 */}
          <ActionButton
            icon={RefreshCw}
            label="重新生成"
            onClick={onRegenerate}
            disabled={isLoading}
            loading={isLoading}
          />

          {/* 保存到笔记按钮 */}
          <SaveToNoteButton
            content={content}
            sourceType="ai_response"
            variant="icon"
            disabled={isLoading}
            onSaveSuccess={
              onSave ? (noteId) => onSave(String(noteId)) : undefined
            }
          />

          {/* 导出按钮 */}
          <ActionButton
            icon={Download}
            label="导出"
            onClick={onExport}
            disabled={isLoading}
          />

          {/* 意图纠正按钮 */}
          {onWrongIntent && (
            <ActionButton
              icon={AlertTriangle}
              label="这不是我的意图"
              onClick={onWrongIntent}
              disabled={isLoading}
            />
          )}

          {/* 分隔线 */}
          <div className="w-px h-4 bg-border mx-1" />

          {/* 有帮助按钮 */}
          <ActionButton
            icon={ThumbsUp}
            label="有帮助"
            onClick={handlePositiveFeedback}
            disabled={isLoading || feedbackGiven === "dislike"}
            active={feedbackGiven === "like"}
            activeColor="text-green-500"
          />

          {/* 无帮助按钮 */}
          <ActionButton
            icon={ThumbsDown}
            label="无帮助"
            onClick={handleNegativeFeedback}
            disabled={isLoading || feedbackGiven === "like"}
            active={feedbackGiven === "dislike"}
            activeColor="text-red-500"
          />
        </div>
      </TooltipProvider>

      {/* 负面反馈对话框 */}
      <FeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        onSubmit={handleSubmitNegativeFeedback}
      />
    </>
  );
}

// =============================================================================
// 操作按钮组件
// =============================================================================

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
  activeColor?: string;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  active = false,
  activeColor = "text-primary",
}: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md",
            active && activeColor,
            !active && "text-muted-foreground hover:text-foreground",
          )}
          onClick={onClick}
          disabled={disabled || !onClick}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// =============================================================================
// 负面反馈对话框组件
// =============================================================================

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (details: FeedbackDetails) => void;
}

function FeedbackDialog({ open, onOpenChange, onSubmit }: FeedbackDialogProps) {
  const [selectedReasons, setSelectedReasons] = React.useState<
    FeedbackReason[]
  >([]);
  const [comment, setComment] = React.useState("");

  // 重置表单
  React.useEffect(() => {
    if (!open) {
      setSelectedReasons([]);
      setComment("");
    }
  }, [open]);

  // 切换选中状态
  const toggleReason = (reason: FeedbackReason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason],
    );
  };

  // 提交反馈
  const handleSubmit = () => {
    onSubmit({
      reasons: selectedReasons,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>告诉我们哪里可以改进</DialogTitle>
          <DialogDescription>
            您的反馈将帮助我们提供更好的 AI 体验
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 反馈原因选择 */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">请选择原因（可多选）</Label>
            {FEEDBACK_REASONS.map((reason) => (
              <div key={reason.id} className="flex items-center space-x-2">
                <Checkbox
                  id={reason.id}
                  checked={selectedReasons.includes(reason.id)}
                  onCheckedChange={() => toggleReason(reason.id)}
                />
                <Label
                  htmlFor={reason.id}
                  className="text-xs font-normal cursor-pointer"
                >
                  {reason.label}
                </Label>
              </div>
            ))}
          </div>

          {/* 补充说明 */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-xs font-medium">
              补充说明（可选）
            </Label>
            <Textarea
              id="comment"
              placeholder="请描述具体问题..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedReasons.length === 0}
          >
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// 内联操作栏变体（用于流式响应完成后）
// =============================================================================

interface InlineActionsProps {
  content: string;
  onCopy?: () => void;
  className?: string;
}

export function InlineActions({
  content,
  onCopy,
  className,
}: InlineActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (error) {
      clientLogger.error(
        { component: "QuickActions", error },
        "Failed to copy",
      );
    }
  }, [content, onCopy]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  复制
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            复制到剪贴板
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// 导出
// =============================================================================

export default MessageActionsBar;
