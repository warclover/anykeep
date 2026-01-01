/**
 * 综述生成进度组件
 *
 * 显示实时生成进度和流式内容预览
 * 支持取消生成任务
 * [I4] 增强生成体验：预计耗时、已用时间、剩余时间、平滑动画
 *
 * @version 1.2.0
 * @since 2025-12-29
 * @updated 2026-01-01 - [I4] 生成体验优化
 */

"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  XCircle,
  StopCircle,
  Clock,
  Timer,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSynthesisStream } from "@/hooks/synthesis/use-synthesis-stream";
import type { SynthesisDepthMode } from "@/lib/synthesis";

// 步骤配置
const SYNTHESIS_STEPS = [
  { id: "prepare", name: "准备数据", icon: "📚", weight: 10 },
  { id: "analyze", name: "分析主题", icon: "🔍", weight: 20 },
  { id: "synthesize", name: "生成综述", icon: "✍️", weight: 35 },
  { id: "conflict", name: "识别分歧", icon: "⚖️", weight: 20 },
  { id: "blindspot", name: "发现盲区", icon: "💡", weight: 15 },
];

// [I4] 深度模式时间系数（秒/来源）
const DEPTH_TIME_FACTORS: Record<
  SynthesisDepthMode,
  { base: number; perSource: number }
> = {
  quick: { base: 15, perSource: 2 },
  standard: { base: 30, perSource: 5 },
  academic: { base: 60, perSource: 10 },
};

/**
 * [I4] 估算总时间（秒）
 */
function estimateTotalTime(
  depthMode: SynthesisDepthMode = "standard",
  sourceCount: number = 10,
): number {
  const factor = DEPTH_TIME_FACTORS[depthMode];
  return factor.base + factor.perSource * Math.max(sourceCount, 3);
}

/**
 * [I4] 格式化时间（秒 -> mm:ss 或文字描述）
 */
function formatTime(seconds: number, useText = false): string {
  if (seconds < 0) return useText ? "计算中..." : "--:--";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (useText) {
    if (mins === 0) return `约 ${secs} 秒`;
    if (secs === 0) return `约 ${mins} 分钟`;
    return `约 ${mins} 分 ${secs} 秒`;
  }

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface SynthesisProgressProps {
  reportId: string;
  /** [I4] 深度模式，用于估算时间 */
  depthMode?: SynthesisDepthMode;
  /** [I4] 来源数量，用于估算时间 */
  sourceCount?: number;
  onComplete?: () => void;
  onCancel?: () => void;
}

/**
 * [I4] 时间显示组件
 */
function TimeDisplay({
  elapsedSeconds,
  estimatedTotalSeconds,
  percent,
}: {
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  percent: number;
}) {
  // 基于进度计算剩余时间
  const remainingSeconds =
    percent > 5
      ? Math.max(0, (elapsedSeconds / percent) * (100 - percent))
      : estimatedTotalSeconds - elapsedSeconds;

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Timer className="h-3.5 w-3.5" />
        <span>已用时: {formatTime(elapsedSeconds)}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        <span>
          预计剩余: {percent >= 95 ? "即将完成" : formatTime(remainingSeconds)}
        </span>
      </div>
    </div>
  );
}

/**
 * 步骤状态指示器 [I4] 增强动画效果
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
    <motion.div
      initial={{ opacity: 0.6, x: -10 }}
      animate={{
        opacity: isCurrent || isPast ? 1 : 0.6,
        x: 0,
        scale: isCurrent ? 1.02 : 1,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        isCurrent && !isCancelled && "bg-primary/10 border border-primary/20",
        isCancelled && isCurrent && "bg-muted/50",
        isPast && !isCancelled && "bg-muted/30",
      )}
    >
      <motion.div
        initial={false}
        animate={{
          scale: isCurrent ? [1, 1.1, 1] : 1,
          rotate: isPast ? [0, 360] : 0,
        }}
        transition={{
          scale: {
            duration: 0.5,
            repeat: isCurrent ? Infinity : 0,
            repeatDelay: 1,
          },
          rotate: { duration: 0.5 },
        }}
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
      </motion.div>
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
        {/* [I4] 当前步骤显示权重提示 */}
        {isCurrent && !isCancelled && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-xs text-muted-foreground mt-0.5"
          >
            此步骤约占 {step.weight}% 总进度
          </motion.p>
        )}
      </div>
    </motion.div>
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
  depthMode = "standard",
  sourceCount = 10,
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

  // [I4] 计时器状态
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // [I4] 估算总时间
  const estimatedTotalSeconds = estimateTotalTime(depthMode, sourceCount);

  // 自动开始生成
  useEffect(() => {
    if (reportId && state.status === "idle") {
      startGeneration(reportId);
    }
  }, [reportId, state.status, startGeneration]);

  // [I4] 开始计时
  useEffect(() => {
    if (state.status === "generating" && !startTimeRef.current) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(
            Math.floor((Date.now() - startTimeRef.current) / 1000),
          );
        }
      }, 1000);
    }

    // 停止计时
    if (
      state.status === "completed" ||
      state.status === "error" ||
      state.status === "cancelled"
    ) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.status]);

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
        {/* [I4] 增强进度条动画 */}
        <div className="relative">
          <Progress value={percent} className="h-2" />
          {isGenerating && (
            <motion.div
              className="absolute top-0 left-0 h-2 bg-primary/30 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </div>
      </div>

      {/* [I4] 时间显示 */}
      {isGenerating && (
        <TimeDisplay
          elapsedSeconds={elapsedSeconds}
          estimatedTotalSeconds={estimatedTotalSeconds}
          percent={percent}
        />
      )}

      {/* [I4] 完成时显示总用时 */}
      {state.status === "completed" && elapsedSeconds > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-green-600"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>总用时: {formatTime(elapsedSeconds)}</span>
        </motion.div>
      )}

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
