/**
 * 整理进度组件
 *
 * 展示整理操作的实时进度和步骤状态
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, Circle, X } from "lucide-react";

interface OrganizeProgressProps {
  status: "analyzing" | "executing" | "complete";
  message?: string;
  steps?: OrganizeStep[];
  currentStep?: number;
  progress?: number;
  onCancel?: () => void;
}

interface OrganizeStep {
  id: string;
  label: string;
  status: "pending" | "running" | "complete";
}

const DEFAULT_STEPS: OrganizeStep[] = [
  { id: "scan", label: "扫描收藏库", status: "pending" },
  { id: "analyze", label: "分析问题", status: "pending" },
  { id: "plan", label: "生成方案", status: "pending" },
  { id: "execute", label: "执行整理", status: "pending" },
  { id: "verify", label: "验证结果", status: "pending" },
];

export function OrganizeProgress({
  status,
  message,
  steps = DEFAULT_STEPS,
  currentStep = 0,
  progress = 0,
  onCancel,
}: OrganizeProgressProps) {
  // 根据状态计算步骤显示（使用 useMemo 而非 useState + useEffect）
  const displaySteps = useMemo(() => {
    return steps.map((step, index) => ({
      ...step,
      status:
        index < currentStep
          ? ("complete" as const)
          : index === currentStep
            ? ("running" as const)
            : ("pending" as const),
    }));
  }, [steps, currentStep]);

  // 模拟进度动画
  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatedProgress((prev) => {
        if (prev < progress) {
          return Math.min(prev + 1, progress);
        }
        return prev;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [progress]);

  return (
    <Card className="border-primary/30">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* 标题和取消按钮 */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              {status === "analyzing" ? "正在分析" : "正在执行整理"}
            </h3>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
            )}
          </div>

          {/* 主进度条 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {message || "正在整理..."}
              </span>
              <span className="font-medium">{animatedProgress}%</span>
            </div>
            <Progress value={animatedProgress} className="h-2" />
          </div>

          {/* 步骤列表 */}
          <div className="space-y-3">
            {displaySteps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md transition-colors",
                  step.status === "running" && "bg-primary/5",
                  step.status === "complete" && "text-muted-foreground",
                )}
              >
                {step.status === "complete" && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {step.status === "running" && (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                {step.status === "pending" && (
                  <Circle className="h-5 w-5 text-muted-foreground/50" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    step.status === "running" && "font-medium text-primary",
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* 提示信息 */}
          <p className="text-xs text-muted-foreground text-center">
            请稍候，整理过程不会影响您的其他操作
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
