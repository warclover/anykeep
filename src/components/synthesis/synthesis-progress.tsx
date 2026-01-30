/**
 * 综述生成进度组件
 *
 * 显示实时生成进度和流式内容预览
 * 支持取消生成任务
 * [I4] 增强生成体验：预计耗时、已用时间、剩余时间、平滑动画
 * [I5] 水平步骤条布局：紧凑设计，无需滚动
 *
 * @version 1.3.0
 * @since 2025-12-29
 * @updated 2026-01-30 - [I5] 水平步骤条布局优化
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
    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Timer className="h-3.5 w-3.5" />
        <span>{formatTime(elapsedSeconds)}</span>
      </div>
      <span className="text-muted-foreground/50">|</span>
      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        <span>
          剩余 {percent >= 95 ? "即将完成" : formatTime(remainingSeconds)}
        </span>
      </div>
    </div>
  );
}

/**
 * [I5] 水平步骤指示器
 */
function HorizontalStepIndicator({
  step,
  index,
  currentStep,
  isCompleted,
  isCancelled,
  isLast,
}: {
  step: (typeof SYNTHESIS_STEPS)[0];
  index: number;
  currentStep: string | null;
  isCompleted: boolean;
  isCancelled: boolean;
  isLast: boolean;
}) {
  const isCurrent = currentStep === step.id;
  const currentIndex = SYNTHESIS_STEPS.findIndex((s) => s.id === currentStep);
  const isPast = index < currentIndex || isCompleted;

  return (
    <div className="flex items-center flex-1">
      {/* 步骤节点 */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={false}
          animate={{
            scale: isCurrent ? 1.1 : 1,
          }}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors",
            isCurrent &&
              !isCancelled &&
              "bg-primary text-primary-foreground ring-4 ring-primary/20",
            isPast && !isCancelled && "bg-green-500 text-white",
            isCancelled && isCurrent && "bg-muted text-muted-foreground",
            !isCurrent &&
              !isPast &&
              !isCancelled &&
              "bg-muted text-muted-foreground",
          )}
        >
          {isCancelled && isCurrent ? (
            <XCircle className="h-4 w-4" />
          ) : isPast ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isCurrent ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </motion.div>
        {/* 步骤名称 */}
        <span
          className={cn(
            "text-xs mt-1.5 whitespace-nowrap",
            isCurrent && !isCancelled && "text-primary font-medium",
            isPast && !isCancelled && "text-green-600 dark:text-green-400",
            !isCurrent && !isPast && "text-muted-foreground",
          )}
        >
          {step.name}
        </span>
      </div>
      {/* 连接线 */}
      {!isLast && (
        <div className="flex-1 h-0.5 mx-2 mt-[-1.25rem]">
          <div
            className={cn(
              "h-full transition-colors",
              isPast ? "bg-green-500" : "bg-muted",
            )}
          />
        </div>
      )}
    </div>
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
    <div className="space-y-6">
      {/* 状态标题 */}
      <div className="text-center">
        <h3 className="text-lg font-medium">
          {state.status === "completed"
            ? "✅ 分析完成"
            : state.status === "error"
              ? "❌ 分析失败"
              : state.status === "cancelled"
                ? "⏹ 已取消"
                : "正在分析您的收藏内容..."}
        </h3>
      </div>

      {/* [I5] 水平步骤条 */}
      <div className="flex items-start justify-between px-2">
        {SYNTHESIS_STEPS.map((step, index) => (
          <HorizontalStepIndicator
            key={step.id}
            step={step}
            index={index}
            currentStep={currentStep}
            isCompleted={state.status === "completed"}
            isCancelled={isCancelled}
            isLast={index === SYNTHESIS_STEPS.length - 1}
          />
        ))}
      </div>

      {/* 进度条 + 百分比 */}
      <div className="space-y-2">
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {state.progress?.message || "准备中..."}
          </span>
          <span className="font-medium">{percent}%</span>
        </div>
      </div>

      {/* 时间显示 + 取消按钮 */}
      <div className="flex items-center justify-between">
        {isGenerating ? (
          <TimeDisplay
            elapsedSeconds={elapsedSeconds}
            estimatedTotalSeconds={estimatedTotalSeconds}
            percent={percent}
          />
        ) : state.status === "completed" && elapsedSeconds > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-green-600"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>总用时 {formatTime(elapsedSeconds)}</span>
          </motion.div>
        ) : (
          <div />
        )}

        {isGenerating && (
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
        )}
      </div>

      {/* 错误/取消提示 */}
      <AnimatePresence>
        {state.status === "cancelled" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground"
          >
            <XCircle className="h-5 w-5" />
            <p className="text-sm">分析已取消</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.status === "error" && state.error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive"
          >
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{state.error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
