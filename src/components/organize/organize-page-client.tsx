/**
 * 整理中心页面客户端组件
 *
 * 功能：
 * - 展示快速操作网格
 * - 触发 AI 整理流程
 * - 显示整理进度
 * - 展示整理前后对比
 *
 * @version 1.1.0
 * @since 2026-01-10
 */

"use client";

import { useState, useCallback } from "react";
import { Sparkles, CheckCircle } from "lucide-react";
import { QuickActionGrid } from "./quick-action-grid";
import { OrganizeProgress } from "./organize-progress";
import { OrganizeComparison } from "./organize-comparison";
import { useOrganizeComparison } from "@/hooks/domain/organize/use-organize-comparison";
import { useAIChat } from "@/hooks/domain/ai";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OrganizePageState, QuickActionType } from "@/lib/organize/types";

/**
 * 操作类型到消息的映射
 */
const ACTION_MESSAGES: Record<QuickActionType, string> = {
  "one-click": "帮我一键整理收藏",
  "clean-duplicates": "清理重复的收藏",
  "smart-categorize": "智能分类未分类的收藏",
  "auto-tag": "为没有标签的收藏自动打标签",
  "archive-stale": "归档长期未读的内容",
};

/**
 * 操作类型到 Skill 的映射（预留，后续实现 Skill 直接调用时使用）
 */
const _ACTION_SKILLS: Record<QuickActionType, string> = {
  "one-click": "batch_organize",
  "clean-duplicates": "duplicate_cleanup",
  "smart-categorize": "batch_organize",
  "auto-tag": "smart_tagging",
  "archive-stale": "batch_organize",
};

/**
 * 根据进度百分比计算当前步骤
 */
function calculateStep(percent: number): number {
  if (percent < 15) return 0; // 收集数据
  if (percent < 30) return 1; // 分析内容
  if (percent < 50) return 2; // 智能分类
  if (percent < 70) return 3; // 智能打标
  if (percent < 90) return 4; // 整理清理
  return 4; // 生成报告
}

export function OrganizePageClient() {
  const [state, setState] = useState<OrganizePageState>("idle");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [organizeError, setOrganizeError] = useState<string | null>(null);

  const {
    beforeSnapshot,
    afterSnapshot,
    captureBeforeSnapshot,
    captureAfterSnapshot,
    reset: resetSnapshots,
    hasComparison,
    error: snapshotError,
  } = useOrganizeComparison();

  const { sendMessage, cancel } = useAIChat({
    onStream: (chunk) => {
      // 处理进度更新
      if ("type" in chunk && chunk.type === "progress") {
        const data = chunk.data as {
          step?: string;
          percent?: number;
          message?: string;
        };
        if (data.step) setProgressMessage(data.step);
        if (typeof data.percent === "number") {
          setProgressPercent(data.percent);
          // 根据百分比计算步骤
          setCurrentStep(calculateStep(data.percent));
        }
      }
    },
    onComplete: async () => {
      try {
        // 整理完成，获取后快照
        await captureAfterSnapshot();
        setState("complete");
      } catch (error) {
        console.error("Failed to capture after snapshot:", error);
        // 即使快照失败也显示完成状态
        setState("complete");
        setOrganizeError("获取整理后统计数据失败，但整理已完成");
      }
    },
    onError: (error) => {
      console.error("Organize error:", error);
      setOrganizeError(error.message || "整理过程中发生错误");
      setState("idle");
    },
  });

  /**
   * 处理整理操作
   */
  const handleOrganizeAction = useCallback(
    async (actionType: QuickActionType) => {
      setState("analyzing");
      setProgressMessage("正在分析您的收藏...");
      setProgressPercent(0);
      setCurrentStep(0);
      setOrganizeError(null);

      try {
        // 获取整理前快照
        await captureBeforeSnapshot();

        setState("executing");

        // 发送 AI 整理请求
        await sendMessage(ACTION_MESSAGES[actionType], {
          useUnifiedEngine: true,
        });

        // 完成状态在 onComplete 回调中设置
      } catch (error) {
        console.error("Organize action failed:", error);
        setOrganizeError(
          error instanceof Error ? error.message : "整理操作失败",
        );
        setState("idle");
      }
    },
    [captureBeforeSnapshot, sendMessage],
  );

  /**
   * 重置状态，继续整理
   */
  const handleReset = useCallback(() => {
    setState("idle");
    setProgressMessage("");
    setProgressPercent(0);
    setCurrentStep(0);
    setOrganizeError(null);
    resetSnapshots();
  }, [resetSnapshots]);

  /**
   * 取消整理
   */
  const handleCancel = useCallback(() => {
    cancel();
    setState("idle");
    setProgressMessage("");
    setProgressPercent(0);
    setOrganizeError(null);
  }, [cancel]);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          整理中心
        </h1>
        <p className="text-muted-foreground">
          AI 帮你智能整理收藏，保持知识库整洁有序
        </p>
      </div>

      {/* 错误提示 */}
      {organizeError && state === "idle" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              ⚠️ {organizeError}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 主内容区 */}
      {state === "idle" && <QuickActionGrid onAction={handleOrganizeAction} />}

      {(state === "analyzing" || state === "executing") && (
        <OrganizeProgress
          status={state}
          message={progressMessage}
          progress={progressPercent}
          currentStep={currentStep}
          onCancel={handleCancel}
        />
      )}

      {state === "complete" &&
        hasComparison &&
        beforeSnapshot &&
        afterSnapshot && (
          <OrganizeComparison
            before={beforeSnapshot}
            after={afterSnapshot}
            onReset={handleReset}
          />
        )}

      {/* 完成但没有对比数据时显示简单完成状态 */}
      {state === "complete" && !hasComparison && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">整理完成！</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {snapshotError || organizeError || "整理操作已完成"}
              </p>
            </div>
            <Button onClick={handleReset}>继续整理</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
