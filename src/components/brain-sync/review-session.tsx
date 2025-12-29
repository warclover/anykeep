/**
 * 复习会话组件
 *
 * 管理完整的 Flashcard 复习会话流程
 *
 * @version 1.1.0
 * @since 2025-12-29
 * @updated 2025-12-29 - 添加 429 错误处理和自动重试
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Brain, Trophy, ArrowRight, RefreshCw, X } from "lucide-react";
import {
  FlashcardReviewCard,
  type FlashcardData,
} from "./flashcard-review-card";
import { clientLogger } from "@/lib/client-logger";
import type { ReviewResponse } from "@/lib/ai-skills/shared/review/types";

// ============================================
// 常量配置
// ============================================

/** 429 错误重试延迟（毫秒） */
const RATE_LIMIT_RETRY_DELAY_MS = 2000;

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

interface ReviewResult {
  flashcardId: number;
  response: ReviewResponse;
  newInterval: number | null;
}

interface SessionStats {
  total: number;
  completed: number;
  mastered: number;
  fuzzy: number;
  forgotten: number;
  archived: number;
}

interface ReviewSessionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionComplete?: (stats: SessionStats) => void;
}

// ============================================
// 组件实现
// ============================================

export function ReviewSession({
  open,
  onOpenChange,
  onSessionComplete,
}: ReviewSessionProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  // 加载复习队列（带 429 重试）
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/brain-sync/queue?limit=10");

      // 处理 429 错误：自动重试
      if (response.status === 429) {
        if (retryCountRef.current < MAX_RETRY_COUNT) {
          retryCountRef.current++;
          clientLogger.warn(
            { retryCount: retryCountRef.current },
            "Brain-Sync queue rate limited, retrying...",
          );
          // 延迟后重试
          setTimeout(() => {
            loadQueue();
          }, RATE_LIMIT_RETRY_DELAY_MS);
          return;
        } else {
          throw new Error("请求过于频繁，请稍后再试");
        }
      }

      // 重置重试计数
      retryCountRef.current = 0;

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "加载失败");
      }

      const queue = data.data.queue || [];
      setFlashcards(
        queue.map(
          (item: {
            flashcardId: number;
            bookmarkId: number;
            bookmarkTitle: string;
            bookmarkUrl: string;
            question: string;
            answer: string;
            sourceParagraph?: string;
            status: string;
            daysOverdue: number;
            intervalDays: number;
            easeFactor: number;
          }) => ({
            flashcardId: item.flashcardId,
            bookmarkId: item.bookmarkId,
            bookmarkTitle: item.bookmarkTitle,
            bookmarkUrl: item.bookmarkUrl,
            question: item.question,
            answer: item.answer,
            sourceParagraph: item.sourceParagraph,
            status: item.status as FlashcardData["status"],
            daysOverdue: item.daysOverdue,
            intervalDays: item.intervalDays,
            easeFactor: item.easeFactor,
          }),
        ),
      );
      setCurrentIndex(0);
      setResults([]);
      setSessionComplete(false);
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to load review queue",
      );
      setError(err instanceof Error ? err.message : "加载复习队列失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 打开时加载数据
  useEffect(() => {
    if (open) {
      loadQueue();
    }
  }, [open, loadQueue]);

  // 处理复习反馈
  const handleResponse = async (
    flashcardId: number,
    response: ReviewResponse,
  ) => {
    setSubmitting(true);

    try {
      const apiResponse = await fetch("/api/brain-sync/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashcardId,
          response,
        }),
      });

      const data = await apiResponse.json();

      if (!data.success) {
        throw new Error(data.error || "提交失败");
      }

      // 记录结果
      const result: ReviewResult = {
        flashcardId,
        response,
        newInterval: data.data.sm2Result?.newInterval ?? null,
      };
      setResults((prev) => [...prev, result]);

      // 移动到下一张或完成
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setSessionComplete(true);
        // 计算统计并回调
        const stats = calculateStats([...results, result]);
        onSessionComplete?.(stats);
      }
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to submit review response",
      );
      setError(err instanceof Error ? err.message : "提交反馈失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 计算会话统计
  const calculateStats = (sessionResults: ReviewResult[]): SessionStats => {
    return {
      total: sessionResults.length,
      completed: sessionResults.length,
      mastered: sessionResults.filter((r) => r.response === "mastered").length,
      fuzzy: sessionResults.filter((r) => r.response === "fuzzy").length,
      forgotten: sessionResults.filter((r) => r.response === "forgotten")
        .length,
      archived: sessionResults.filter((r) => r.response === "archived").length,
    };
  };

  // 重新开始会话
  const handleRestart = () => {
    retryCountRef.current = 0; // 重置重试计数
    loadQueue();
  };

  // 关闭会话
  const handleClose = () => {
    onOpenChange(false);
  };

  // 计算进度
  const progress =
    flashcards.length > 0 ? (results.length / flashcards.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            复习会话
          </DialogTitle>
          <DialogDescription>通过间隔重复复习，巩固您的知识</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* 进度条 */}
          {!loading && flashcards.length > 0 && !sessionComplete && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">复习进度</span>
                <span className="font-medium">
                  {results.length} / {flashcards.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">正在加载复习队列...</p>
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-destructive mb-4">{error}</div>
              <Button onClick={loadQueue}>
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          )}

          {/* 空队列状态 */}
          {!loading && !error && flashcards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="h-12 w-12 text-yellow-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">太棒了！</h3>
              <p className="text-muted-foreground mb-4">
                当前没有需要复习的卡片。
                <br />
                继续收藏有价值的内容，系统会为您自动生成复习卡片。
              </p>
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
            </div>
          )}

          {/* 复习卡片 */}
          {!loading && !error && flashcards.length > 0 && !sessionComplete && (
            <FlashcardReviewCard
              flashcard={flashcards[currentIndex]}
              onResponse={handleResponse}
              isSubmitting={submitting}
              currentIndex={currentIndex}
              totalCount={flashcards.length}
            />
          )}

          {/* 会话完成 */}
          {sessionComplete && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Trophy className="h-16 w-16 text-yellow-500 mb-4" />
              <h3 className="text-xl font-medium mb-2">复习完成！</h3>
              <p className="text-muted-foreground mb-6">
                本次复习了 {results.length} 张卡片
              </p>

              {/* 统计卡片 */}
              <div className="grid grid-cols-4 gap-3 w-full max-w-lg mb-6">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-green-600">
                      {results.filter((r) => r.response === "mastered").length}
                    </div>
                    <div className="text-xs text-green-700">掌握</div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-yellow-600">
                      {results.filter((r) => r.response === "fuzzy").length}
                    </div>
                    <div className="text-xs text-yellow-700">模糊</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-red-600">
                      {results.filter((r) => r.response === "forgotten").length}
                    </div>
                    <div className="text-xs text-red-700">遗忘</div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-purple-600">
                      {results.filter((r) => r.response === "archived").length}
                    </div>
                    <div className="text-xs text-purple-700">归档</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose}>
                  <X className="mr-2 h-4 w-4" />
                  关闭
                </Button>
                <Button onClick={handleRestart}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  继续复习
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
