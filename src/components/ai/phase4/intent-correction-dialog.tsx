"use client";

/**
 * Phase 4: IntentCorrectionDialog - 意图纠正对话框
 *
 * 允许用户在 AI 识别意图错误时选择正确的意图类型
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import * as React from "react";
import { Loader2, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { IntentType } from "@/lib/ai-skills/router/types";

// =============================================================================
// 类型定义
// =============================================================================

interface IntentCorrectionDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 消息 ID */
  messageId: string;
  /** 原始用户输入 */
  originalInput: string;
  /** AI 错误识别的意图 */
  wrongIntent: IntentType;
  /** 提交成功回调 */
  onSuccess?: () => void;
}

/**
 * 意图选项配置
 */
interface IntentOption {
  type: IntentType;
  label: string;
  description: string;
  icon: string;
}

// =============================================================================
// 常量配置
// =============================================================================

const INTENT_OPTIONS: IntentOption[] = [
  {
    type: "query",
    label: "查询",
    description: "搜索、查找、统计数量",
    icon: "🔍",
  },
  {
    type: "action",
    label: "操作",
    description: "移动、删除、添加标签",
    icon: "⚡",
  },
  {
    type: "organize",
    label: "整理",
    description: "分类、清理、去重",
    icon: "📂",
  },
  {
    type: "analyze",
    label: "分析",
    description: "生成报告、统计分析、洞察",
    icon: "📊",
  },
  {
    type: "learn",
    label: "学习",
    description: "复习、学习路径、知识回顾",
    icon: "📚",
  },
  {
    type: "create",
    label: "创建",
    description: "摘要、笔记、文档",
    icon: "✏️",
  },
  {
    type: "chitchat",
    label: "闲聊",
    description: "问候、帮助、一般对话",
    icon: "💬",
  },
];

const INTENT_LABEL_MAP: Record<IntentType, string> = {
  query: "查询",
  action: "操作",
  organize: "整理",
  analyze: "分析",
  learn: "学习",
  create: "创建",
  chitchat: "闲聊",
};

// =============================================================================
// 组件实现
// =============================================================================

export function IntentCorrectionDialog({
  open,
  onOpenChange,
  messageId,
  originalInput,
  wrongIntent,
  onSuccess,
}: IntentCorrectionDialogProps) {
  const [selectedIntent, setSelectedIntent] = React.useState<IntentType | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 重置状态
  React.useEffect(() => {
    if (!open) {
      setSelectedIntent(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // 提交纠正
  const handleSubmit = async () => {
    if (!selectedIntent || selectedIntent === wrongIntent) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/agent/intent-correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalInput,
          wrongIntent,
          correctIntent: selectedIntent,
          signal: "explicit_wrong",
          messageId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "提交失败");
      }

      toast.success("感谢您的反馈！AI 将从中学习改进", {
        icon: "🎓",
        duration: 3000,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 可选意图（排除错误意图）
  const availableIntents = INTENT_OPTIONS.filter(
    (opt) => opt.type !== wrongIntent,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            意图纠正
          </DialogTitle>
          <DialogDescription>
            帮助 AI 理解您的真实意图，让它变得更聪明
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 错误意图显示 */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">AI 识别为</Label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                {INTENT_LABEL_MAP[wrongIntent]}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {selectedIntent ? (
                  <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
                    {INTENT_LABEL_MAP[selectedIntent]}
                  </span>
                ) : (
                  "请选择正确意图"
                )}
              </span>
            </div>
          </div>

          {/* 原始输入预览 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              您的原始输入
            </Label>
            <div className="text-sm text-foreground bg-muted/30 rounded-md p-2 max-h-16 overflow-y-auto">
              {originalInput.length > 100
                ? originalInput.slice(0, 100) + "..."
                : originalInput}
            </div>
          </div>

          {/* 意图选择 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              请选择您期望的意图类型
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {availableIntents.map((intent) => (
                <button
                  key={intent.type}
                  type="button"
                  onClick={() => setSelectedIntent(intent.type)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left",
                    "hover:border-primary/50 hover:bg-primary/5",
                    selectedIntent === intent.type
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-muted/30",
                  )}
                >
                  <span className="text-xl">{intent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {intent.label}
                      </span>
                      {selectedIntent === intent.type && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {intent.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedIntent || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              "提交纠正"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IntentCorrectionDialog;
