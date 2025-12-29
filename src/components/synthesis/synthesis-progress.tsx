/**
 * 综述生成进度组件
 *
 * 显示实时生成进度和流式内容预览
 * 支持取消生成任务
 *
 * @version 1.1.0
 * @since 2025-12-29
 */

"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  XCircle,
  StopCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSynthesisStream } from "@/hooks/synthesis/use-synthesis-stream";

// 步骤配置
const SYNTHESIS_STEPS = [
  { id: "prepare", name: "准备数据", icon: "📚" },
  { id: "analyze", name: "分析主题", icon: "🔍" },
  { id: "synthesize", name: "生成综述", icon: "✍️" },
  { id: "conflict", name: "识别分歧", icon: "⚖️" },
  { id: "blindspot", name: "发现盲区", icon: "💡" },
];

interface SynthesisProgressProps {
  reportId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

/**
 * 步骤状态指示器
 */
function StepIndicator({
  step,
  currentStep,
  isCompleted,
  isCancelled,
}: {
  step: (typeof SYNTHESIS_STEPS)[0];
  currentStep: string | null;
  isCompleted: boolean;
  isCancelled: boolean;
}) {
  const isCurrent = currentStep === step.id;
  const stepIndex = SYNTHESIS_STEPS.findIndex((s) => s.id === step.id);
  const currentIndex = SYNTHESIS_STEPS.findIndex((s) => s.id === currentStep);
  const isPast = stepIndex < currentIndex || isCompleted;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        isCurrent && !isCancelled && "bg-primary/10",
        isCancelled && isCurrent && "bg-muted/50",
        isPast && !isCancelled && "bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
          isCurrent && !isCancelled && "bg-primary text-primary-foreground",
          isPast && !isCancelled && "bg-green-500 text-white",
          isCancelled && "bg-muted text-muted-foreground",
          !isCurrent &&
            !isPast &&
            !isCancelled &&
            "bg-muted text-muted-foreground",
        )}
      >
        {isCancelled && isCurrent ? (
          <XCircle className="h-5 w-5" />
        ) : isPast ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : isCurrent ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1">
        <p
          className={cn(
            "font-medium text-sm",
            isCurrent && !isCancelled && "text-primary",
            isCancelled && "text-muted-foreground",
          )}
        >
          {step.icon} {step.name}
        </p>
      </div>
    </div>
  );
}

/**
 * 流式内容预览
 */
function StreamPreview({
  overview,
  consensusCount,
  divergenceCount,
  blindSpotCount,
}: {
  overview: string | null;
  consensusCount: number;
  divergenceCount: number;
  blindSpotCount: number;
}) {
  if (
    !overview &&
    consensusCount === 0 &&
    divergenceCount === 0 &&
    blindSpotCount === 0
  ) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">内容预览</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">概述</p>
            <p className="text-sm line-clamp-3">{overview}</p>
          </div>
        )}

        <div className="flex gap-2">
          {consensusCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            >
              共识 {consensusCount}
            </Badge>
          )}
          {divergenceCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            >
              分歧 {divergenceCount}
            </Badge>
          )}
          {blindSpotCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
              盲区 {blindSpotCount}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 综述生成进度组件
 */
export function SynthesisProgress({
  reportId,
  onComplete,
  onCancel,
}: SynthesisProgressProps) {
  const {
    state,
    startGeneration,
    cancelGeneration,
    isGenerating,
    isCancelling,
  } = useSynthesisStream();

  // 自动开始生成
  useEffect(() => {
    if (reportId && state.status === "idle") {
      startGeneration(reportId);
    }
  }, [reportId, state.status, startGeneration]);

  // 完成时回调
  useEffect(() => {
    if (state.status === "completed" && onComplete) {
      onComplete();
    }
  }, [state.status, onComplete]);

  // 取消时回调
  useEffect(() => {
    if (state.status === "cancelled" && onCancel) {
      onCancel();
    }
  }, [state.status, onCancel]);

  // 处理取消
  const handleCancel = useCallback(async () => {
    await cancelGeneration(reportId);
  }, [cancelGeneration, reportId]);

  const currentStep = state.progress?.step || null;
  const percent = state.progress?.percent || 0;
  const isCancelled = state.status === "cancelled";

  return (
    <div className="space-y-4">
      {/* 总体进度 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {state.status === "completed"
              ? "生成完成"
              : state.status === "error"
                ? "生成失败"
                : state.status === "cancelled"
                  ? "已取消"
                  : state.progress?.message || "准备中..."}
          </span>
          <span className="font-medium">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2" />
      </div>

      {/* 取消按钮 */}
      {isGenerating && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                取消中...
              </>
            ) : (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                取消生成
              </>
            )}
          </Button>
        </div>
      )}

      {/* 步骤列表 */}
      <div className="space-y-1">
        {SYNTHESIS_STEPS.map((step) => (
          <StepIndicator
            key={step.id}
            step={step}
            currentStep={currentStep}
            isCompleted={state.status === "completed"}
            isCancelled={isCancelled}
          />
        ))}
      </div>

      {/* 已取消提示 */}
      <AnimatePresence>
        {state.status === "cancelled" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground"
          >
            <XCircle className="h-5 w-5" />
            <p className="text-sm">综述生成已取消</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误提示 */}
      <AnimatePresence>
        {state.status === "error" && state.error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive"
          >
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{state.error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 流式预览 */}
      <StreamPreview
        overview={state.overview}
        consensusCount={state.consensus.length}
        divergenceCount={state.divergence.length}
        blindSpotCount={state.blindSpots.length}
      />
    </div>
  );
}
