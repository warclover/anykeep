"use client";

/**
 * 意图纠正选择器组件
 *
 * 当用户点击"这不是我的意图"时弹出的选择器
 * 让用户选择正确的意图类型
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 */

import { memo, useCallback } from "react";
import {
  Search,
  FolderSync,
  FileText,
  Download,
  BookOpen,
  HelpCircle,
  ArrowRight,
  X,
  Zap,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IntentType } from "@/lib/ai-skills/router/types";
import type { IntentCorrectionSelectorProps } from "./types";
import { INTENT_DISPLAY_NAMES } from "./types";

// =============================================================================
// 常量配置
// =============================================================================

/**
 * 意图选项配置
 */
interface IntentOption {
  id: IntentType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: "query",
    name: "搜索查询",
    description: "搜索、查找、筛选收藏内容",
    icon: Search,
    color: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100",
    borderColor: "border-blue-200",
  },
  {
    id: "action",
    name: "数据操作",
    description: "删除、添加、编辑、修改内容",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-50 hover:bg-orange-100",
    borderColor: "border-orange-200",
  },
  {
    id: "organize",
    name: "整理归类",
    description: "整理、分类、移动、标签管理",
    icon: FolderSync,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 hover:bg-emerald-100",
    borderColor: "border-emerald-200",
  },
  {
    id: "analyze",
    name: "数据分析",
    description: "统计分析、导出数据、生成报告",
    icon: Download,
    color: "text-amber-600",
    bgColor: "bg-amber-50 hover:bg-amber-100",
    borderColor: "border-amber-200",
  },
  {
    id: "learn",
    name: "知识学习",
    description: "复习、学习路径、知识回顾",
    icon: BookOpen,
    color: "text-rose-600",
    bgColor: "bg-rose-50 hover:bg-rose-100",
    borderColor: "border-rose-200",
  },
  {
    id: "create",
    name: "内容创作",
    description: "生成摘要、总结、提炼内容",
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-50 hover:bg-purple-100",
    borderColor: "border-purple-200",
  },
  {
    id: "chitchat",
    name: "闲聊问答",
    description: "日常对话、问题解答、闲聊",
    icon: MessageCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-50 hover:bg-gray-100",
    borderColor: "border-gray-200",
  },
];

// =============================================================================
// 组件实现
// =============================================================================

export const IntentCorrectionSelector = memo(function IntentCorrectionSelector({
  wrongIntent,
  onSelectCorrectIntent,
  onClose,
  isOpen,
}: IntentCorrectionSelectorProps) {
  const handleSelect = useCallback(
    (intent: IntentType) => {
      if (intent !== wrongIntent) {
        onSelectCorrectIntent(intent);
      }
    },
    [wrongIntent, onSelectCorrectIntent],
  );

  const wrongIntentName = INTENT_DISPLAY_NAMES[wrongIntent];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="size-5 text-amber-500" />
            告诉我正确的意图
          </DialogTitle>
          <DialogDescription>
            AI 理解为
            <span className="mx-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium">
              {wrongIntentName}
            </span>
            ，请选择您真正想要的操作
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          {INTENT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isWrong = option.id === wrongIntent;

            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={isWrong}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                  isWrong
                    ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200"
                    : cn(option.bgColor, option.borderColor, "cursor-pointer"),
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center size-10 rounded-lg",
                    isWrong ? "bg-gray-200" : option.bgColor,
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5",
                      isWrong ? "text-gray-400" : option.color,
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "font-medium text-sm",
                      isWrong ? "text-gray-400" : "text-gray-800",
                    )}
                  >
                    {option.name}
                    {isWrong && (
                      <span className="ml-2 text-xs text-red-400">
                        （当前识别）
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isWrong ? "text-gray-300" : "text-gray-500",
                    )}
                  >
                    {option.description}
                  </div>
                </div>

                {!isWrong && (
                  <ArrowRight
                    className={cn(
                      "size-4 opacity-0 group-hover:opacity-100",
                      option.color,
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4 mr-1" />
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default IntentCorrectionSelector;
