/**
 * Flashcard 复习卡片组件
 *
 * 单张 Flashcard 的交互式复习界面
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ExternalLink,
  Clock,
} from "lucide-react";

// ============================================
// 类型定义
// ============================================

export interface FlashcardData {
  flashcardId: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  question: string;
  answer: string;
  sourceParagraph?: string;
  status: "pending" | "learning" | "mastered";
  daysOverdue: number;
  intervalDays: number;
  easeFactor: number;
}

type ReviewResponse = "mastered" | "fuzzy" | "forgotten";

interface FlashcardReviewCardProps {
  flashcard: FlashcardData;
  onResponse: (flashcardId: number, response: ReviewResponse) => void;
  isSubmitting?: boolean;
  currentIndex?: number;
  totalCount?: number;
}

// ============================================
// 组件实现
// ============================================

export function FlashcardReviewCard({
  flashcard,
  onResponse,
  isSubmitting = false,
  currentIndex = 0,
  totalCount = 1,
}: FlashcardReviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedResponse, setSelectedResponse] =
    useState<ReviewResponse | null>(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleResponse = (response: ReviewResponse) => {
    setSelectedResponse(response);
    onResponse(flashcard.flashcardId, response);
  };

  const getStatusBadge = () => {
    if (flashcard.daysOverdue > 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          逾期 {flashcard.daysOverdue} 天
        </Badge>
      );
    }
    switch (flashcard.status) {
      case "mastered":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 text-xs"
          >
            已掌握
          </Badge>
        );
      case "learning":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-700 text-xs"
          >
            学习中
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            待学习
          </Badge>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 进度指示 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          卡片 {currentIndex + 1} / {totalCount}
        </span>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            间隔 {flashcard.intervalDays} 天
          </Badge>
        </div>
      </div>

      {/* 卡片主体 */}
      <Card
        className={cn(
          "cursor-pointer transition-all duration-300 min-h-[300px]",
          "hover:shadow-lg",
          isFlipped && "bg-muted/30",
        )}
        onClick={handleFlip}
      >
        <CardContent className="p-6 flex flex-col h-full">
          {/* 来源标题 */}
          <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
            <span className="truncate max-w-[80%]">
              📖 {flashcard.bookmarkTitle}
            </span>
            <a
              href={flashcard.bookmarkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline flex items-center gap-1"
            >
              原文
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* 卡片内容 */}
          <div className="flex-1 flex flex-col justify-center">
            {!isFlipped ? (
              // 问题面
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                  问题
                </div>
                <div className="text-xl font-medium leading-relaxed">
                  {flashcard.question}
                </div>
                <div className="mt-6 text-sm text-muted-foreground">
                  点击卡片查看答案
                </div>
              </div>
            ) : (
              // 答案面
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                  答案
                </div>
                <div className="text-lg leading-relaxed">
                  {flashcard.answer}
                </div>
                {flashcard.sourceParagraph && (
                  <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground italic">
                    &ldquo;{flashcard.sourceParagraph}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 翻转提示 */}
          <div className="flex justify-center pt-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <RotateCcw className="h-4 w-4 mr-2" />
              {isFlipped ? "查看问题" : "查看答案"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 反馈按钮（翻转后显示） */}
      {isFlipped && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="text-center text-sm text-muted-foreground mb-2">
            你记住了吗？
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              className={cn(
                "h-20 flex-col gap-2 transition-colors",
                "hover:bg-red-50 hover:border-red-300 hover:text-red-700",
                selectedResponse === "forgotten" &&
                  "bg-red-50 border-red-300 text-red-700",
              )}
              onClick={() => handleResponse("forgotten")}
              disabled={isSubmitting}
            >
              <XCircle className="h-6 w-6" />
              <div>
                <div className="font-medium">遗忘</div>
                <div className="text-xs opacity-70">明天复习</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className={cn(
                "h-20 flex-col gap-2 transition-colors",
                "hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700",
                selectedResponse === "fuzzy" &&
                  "bg-yellow-50 border-yellow-300 text-yellow-700",
              )}
              onClick={() => handleResponse("fuzzy")}
              disabled={isSubmitting}
            >
              <HelpCircle className="h-6 w-6" />
              <div>
                <div className="font-medium">模糊</div>
                <div className="text-xs opacity-70">需要巩固</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className={cn(
                "h-20 flex-col gap-2 transition-colors",
                "hover:bg-green-50 hover:border-green-300 hover:text-green-700",
                selectedResponse === "mastered" &&
                  "bg-green-50 border-green-300 text-green-700",
              )}
              onClick={() => handleResponse("mastered")}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <div className="font-medium">掌握</div>
                <div className="text-xs opacity-70">间隔延长</div>
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
