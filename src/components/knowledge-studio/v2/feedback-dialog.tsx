/**
 * Feedback Dialog - 反馈对话框组件
 * @module knowledge-studio/v2
 *
 * Phase 4: 草稿迭代与反馈驱动优化
 * P1-5: 反馈优化时展示修改前后对比
 */

"use client";

import { useState, useCallback } from "react";
import { Star, MessageSquare, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getAllFeedbackTypes,
  validateFeedback,
  createFeedback,
  type FeedbackType,
  type DraftFeedback,
} from "@/lib/knowledge-studio/iteration";
import { ContentDiffViewer } from "./content-diff-viewer";

// ============================================================
// Types
// ============================================================

interface FeedbackDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 提交反馈回调 */
  onSubmit: (feedback: DraftFeedback) => void;
  /** 是否正在提交 */
  isSubmitting?: boolean;
  /** 当前内容字数 */
  wordCount?: number;
  /** P1-5: 原始内容（用于 Diff 对比） */
  beforeContent?: string;
  /** P1-5: 修改后内容（用于 Diff 对比） */
  afterContent?: string;
}

// ============================================================
// Star Rating Component
// ============================================================

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function StarRating({ value, onChange, disabled }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={cn(
            "p-0.5 transition-transform hover:scale-110 disabled:opacity-50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              (hoverValue || value) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground",
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {value > 0 ? `${value}/5` : "请评分"}
      </span>
    </div>
  );
}

// ============================================================
// Feedback Type Selector
// ============================================================

interface FeedbackTypeSelectorProps {
  value: FeedbackType | null;
  onChange: (type: FeedbackType) => void;
  disabled?: boolean;
}

function FeedbackTypeSelector({
  value,
  onChange,
  disabled,
}: FeedbackTypeSelectorProps) {
  const feedbackTypes = getAllFeedbackTypes();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {feedbackTypes.map(({ type, label, icon, description }) => (
        <button
          key={type}
          type="button"
          disabled={disabled}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all",
            "hover:border-primary hover:bg-primary/5",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            "disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent",
            value === type
              ? "border-primary bg-primary/10"
              : "border-border bg-background",
          )}
          onClick={() => onChange(type)}
          title={description}
        >
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Feedback Dialog
// ============================================================

export function FeedbackDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  wordCount,
  beforeContent,
  afterContent,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  // P1-5: 是否显示 Diff 对比
  const showDiff =
    beforeContent && afterContent && beforeContent !== afterContent;

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setRating(0);
        setFeedbackType(null);
        setComment("");
        setErrors([]);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  // Handle submit
  const handleSubmit = useCallback(() => {
    const feedbackData = {
      rating,
      type: feedbackType ?? undefined,
      comment: comment.trim() || undefined,
      timestamp: Date.now(),
    };

    const validation = validateFeedback(feedbackData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const feedback = createFeedback(
      rating,
      feedbackType as FeedbackType,
      comment.trim() || undefined,
    );

    onSubmit(feedback);
  }, [rating, feedbackType, comment, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("sm:max-w-md", showDiff && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            内容反馈
          </DialogTitle>
          <DialogDescription>
            请评价生成内容并选择需要改进的方向
            {wordCount && (
              <span className="ml-1 text-muted-foreground">
                （当前 {wordCount.toLocaleString()} 字）
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* P1-5: Diff 对比展示 */}
        {showDiff && (
          <ContentDiffViewer
            before={beforeContent}
            after={afterContent}
            defaultExpanded={false}
            maxHeight="200px"
            className="my-2"
          />
        )}

        <div className="space-y-6 py-4">
          {/* Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">整体评分</label>
            <StarRating
              value={rating}
              onChange={setRating}
              disabled={isSubmitting}
            />
          </div>

          {/* Feedback Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">主要问题</label>
            <FeedbackTypeSelector
              value={feedbackType}
              onChange={setFeedbackType}
              disabled={isSubmitting}
            />
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              补充说明
              {feedbackType === "other" && (
                <span className="ml-1 text-destructive">*</span>
              )}
            </label>
            <Textarea
              placeholder="请描述具体问题或改进建议..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                {comment.length}/500
              </span>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3">
              <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0 || !feedbackType}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                优化中...
              </>
            ) : (
              "🔄 基于反馈重新生成"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackDialog;
