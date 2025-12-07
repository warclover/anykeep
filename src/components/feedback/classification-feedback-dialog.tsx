/**
 * 分类反馈对话框组件
 * 用于收集用户对 AI 分类建议的反馈
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquarePlus,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 反馈类型定义
const FEEDBACK_TYPES = [
  { value: "helpful", label: "建议很有帮助", icon: ThumbsUp, positive: true },
  {
    value: "wrong_folder",
    label: "分类到错误的文件夹",
    icon: ThumbsDown,
    positive: false,
  },
  {
    value: "better_folder",
    label: "有更好的文件夹选择",
    icon: AlertCircle,
    positive: false,
  },
  {
    value: "confidence_too_high",
    label: "置信度过高",
    icon: AlertCircle,
    positive: false,
  },
  {
    value: "confidence_too_low",
    label: "置信度过低",
    icon: AlertCircle,
    positive: false,
  },
  { value: "other", label: "其他", icon: MessageSquarePlus, positive: false },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

interface FolderOption {
  id: number;
  name: string;
}

interface ClassificationFeedbackDialogProps {
  /** 触发器元素 */
  trigger?: React.ReactNode;
  /** 关联的建议 ID (V1) */
  suggestionId?: number;
  /** 关联的建议 ID (V2) */
  organizationSuggestionId?: number;
  /** 可用的文件夹列表 */
  availableFolders?: FolderOption[];
  /** 反馈提交成功回调 */
  onFeedbackSubmitted?: () => void;
  /** 原始分类结果上下文 */
  context?: Record<string, unknown>;
}

export function ClassificationFeedbackDialog({
  trigger,
  suggestionId,
  organizationSuggestionId,
  availableFolders = [],
  onFeedbackSubmitted,
  context,
}: ClassificationFeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | "">("");
  const [comment, setComment] = useState("");
  const [suggestedFolderId, setSuggestedFolderId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setFeedbackType("");
    setComment("");
    setSuggestedFolderId("");
  };

  // 提交反馈
  const handleSubmit = async () => {
    if (!feedbackType) {
      toast.error("请选择反馈类型");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/classification/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType,
          suggestionId,
          organizationSuggestionId,
          comment: comment.trim() || undefined,
          suggestedCorrectFolderId: suggestedFolderId
            ? parseInt(suggestedFolderId)
            : undefined,
          context,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit feedback");

      toast.success("感谢您的反馈！");
      setOpen(false);
      resetForm();
      onFeedbackSubmitted?.();
    } catch (error) {
      toast.error("提交反馈失败，请重试");
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 是否需要显示文件夹选择
  const showFolderSelect =
    feedbackType === "wrong_folder" || feedbackType === "better_folder";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <MessageSquarePlus className="w-4 h-4" />
            反馈
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>提供反馈</DialogTitle>
          <DialogDescription>
            您的反馈将帮助我们改进 AI 分类的准确性
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 反馈类型选择 */}
          <div className="space-y-2">
            <Label>反馈类型</Label>
            <RadioGroup
              value={feedbackType}
              onValueChange={(value) => setFeedbackType(value as FeedbackType)}
              className="grid grid-cols-1 gap-2"
            >
              {FEEDBACK_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.value} id={type.value} />
                    <Label
                      htmlFor={type.value}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        type.positive
                          ? "text-green-600"
                          : "text-muted-foreground",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* 建议正确的文件夹 */}
          {showFolderSelect && availableFolders.length > 0 && (
            <div className="space-y-2">
              <Label>建议的正确文件夹</Label>
              <Select
                value={suggestedFolderId}
                onValueChange={setSuggestedFolderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择文件夹" />
                </SelectTrigger>
                <SelectContent>
                  {availableFolders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 补充说明 */}
          <div className="space-y-2">
            <Label htmlFor="comment">补充说明（可选）</Label>
            <Textarea
              id="comment"
              placeholder="请描述您的具体建议..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!feedbackType || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                提交中
              </>
            ) : (
              "提交反馈"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClassificationFeedbackDialog;
