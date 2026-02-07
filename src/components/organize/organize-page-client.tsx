/**
 * 整理中心页面客户端组件
 *
 * 功能：
 * - 展示快速操作网格（左侧）
 * - 展示健康诊断面板（右侧）- 合并自整理大师
 * - 触发 AI 整理流程
 * - 显示整理进度
 * - 展示整理前后对比
 *
 * @version 2.0.0 - 合并整理大师功能
 * @since 2026-01-10
 * @updated 2026-01-31
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Sparkles, CheckCircle } from "lucide-react";
import { QuickActionGrid } from "./quick-action-grid";
import { OrganizeProgress } from "./organize-progress";
import { OrganizeComparison } from "./organize-comparison";
import { HealthDiagnosisPanel } from "./health-diagnosis-panel";
import { IssueDetailDrawer } from "./issue-detail-drawer";
import { useOrganizeComparison } from "@/hooks/domain/organize/use-organize-comparison";
import { useLibrarianAnalysis } from "@/hooks/domain/folder/use-librarian-analysis";
import { useHealthActions } from "@/hooks/domain/organize/use-health-actions";
import { useAIChat } from "@/hooks/domain/ai";
import { clientLogger } from "@/lib/client-logger";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OrganizePageState, QuickActionType } from "@/lib/organize/types";
import type { IssueType, ActionType } from "./issue-summary-list";

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
 * 进度步骤阈值配置
 * 与 OrganizeProgress 中的 DEFAULT_STEPS 保持同步
 */
const PROGRESS_STEP_THRESHOLDS = [
  { maxPercent: 15, step: 0 }, // 扫描收藏库
  { maxPercent: 30, step: 1 }, // 分析问题
  { maxPercent: 50, step: 2 }, // 生成方案
  { maxPercent: 70, step: 3 }, // 执行整理
  { maxPercent: 90, step: 4 }, // 验证结果
] as const;

/**
 * 根据进度百分比计算当前步骤
 */
function calculateStep(percent: number): number {
  for (const { maxPercent, step } of PROGRESS_STEP_THRESHOLDS) {
    if (percent < maxPercent) return step;
  }
  return PROGRESS_STEP_THRESHOLDS.length - 1;
}

/**
 * 进度状态类型（合并多个状态减少重渲染）
 */
interface ProgressState {
  message: string;
  percent: number;
  step: number;
}

export function OrganizePageClient() {
  const [state, setState] = useState<OrganizePageState>("idle");
  // 合并进度相关状态，减少流式响应时的重渲染次数（3次 → 1次）
  const [progress, setProgress] = useState<ProgressState>({
    message: "",
    percent: 0,
    step: 0,
  });
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [showIssueDrawer, setShowIssueDrawer] = useState(false);

  const {
    beforeSnapshot,
    afterSnapshot,
    captureBeforeSnapshot,
    captureAfterSnapshot,
    reset: resetSnapshots,
    hasComparison,
    error: snapshotError,
  } = useOrganizeComparison();

  // 健康分析数据（用于抽屉）
  const { analysis, refresh: refreshAnalysis } = useLibrarianAnalysis();

  // 健康问题操作
  const { mergeFolders, deleteFolder, renameFolder, createFolder } =
    useHealthActions({
      onSuccess: () => {
        // 操作成功后刷新分析
        refreshAnalysis();
      },
    });

  const { sendMessage, cancel } = useAIChat({
    onStream: (chunk) => {
      // 处理进度更新（合并状态更新，减少重渲染）
      if ("type" in chunk && chunk.type === "progress") {
        const data = chunk.data as {
          step?: string;
          percent?: number;
          message?: string;
        };
        setProgress((prev) => {
          const newPercent =
            typeof data.percent === "number" ? data.percent : prev.percent;
          return {
            message: data.step ?? prev.message,
            percent: newPercent,
            step: calculateStep(newPercent),
          };
        });
      }
    },
    onComplete: async () => {
      try {
        // 整理完成，获取后快照
        await captureAfterSnapshot();
        // 刷新健康分析（问题可能已减少）
        await refreshAnalysis();
        setState("complete");
      } catch (error) {
        clientLogger.error({ error }, "Failed to capture after snapshot");
        // 即使快照失败也显示完成状态
        setState("complete");
        setOrganizeError("获取整理后统计数据失败，但整理已完成");
      }
    },
    onError: (error) => {
      clientLogger.error({ error }, "Organize error");
      setOrganizeError(error.message || "整理过程中发生错误");
      setState("idle");
    },
  });

  /**
   * 处理整理��作
   */
  const handleOrganizeAction = useCallback(
    async (actionType: QuickActionType) => {
      setState("analyzing");
      setProgress({ message: "正在分析您的收藏...", percent: 0, step: 0 });
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
        clientLogger.error({ error }, "Organize action failed");
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
    setProgress({ message: "", percent: 0, step: 0 });
    setOrganizeError(null);
    resetSnapshots();
  }, [resetSnapshots]);

  /**
   * 取消整理
   */
  const handleCancel = useCallback(() => {
    cancel();
    setState("idle");
    setProgress({ message: "", percent: 0, step: 0 });
    setOrganizeError(null);
  }, [cancel]);

  /**
   * 处理问题操作（来自健康诊断面板）
   */
  const handleIssueAction = useCallback(
    async (type: IssueType, itemId: number, action: ActionType) => {
      if (!analysis) return;

      switch (action) {
        case "merge": {
          // 合并重复文件夹：优先使用建议的合并目标
          const group = analysis.duplicateFolders[itemId];
          if (group && group.folders.length >= 2) {
            // 查找建议保留的目标文件夹（基于 suggestedMerge）
            const suggestedTarget = group.folders.find((f) =>
              group.suggestedMerge?.includes(f.name),
            );
            const target = suggestedTarget || group.folders[0];
            // 源文件夹为除目标外的第一个
            const source = group.folders.find((f) => f.id !== target.id);
            if (source) {
              await mergeFolders(source.id, target.id);
            }
          }
          break;
        }
        case "delete": {
          // 删除空文件夹
          await deleteFolder(itemId);
          break;
        }
        case "rename": {
          // 重命名：找到建议的新名称
          const namingItem = analysis.poorlyNamedFolders.find(
            (item) => item.folder.id === itemId,
          );
          if (namingItem) {
            await renameFolder(itemId, namingItem.suggestedName);
          }
          break;
        }
        case "create": {
          // 创建缺失分类
          const missingItem = analysis.missingCategories[itemId];
          if (missingItem) {
            await createFolder(missingItem.category);
          }
          break;
        }
        case "split": {
          // 拆分文件夹功能开发中
          toast.info("拆分功能开发中，敬请期待");
          break;
        }
      }
    },
    [analysis, mergeFolders, deleteFolder, renameFolder, createFolder],
  );

  const isExecuting = state === "analyzing" || state === "executing";

  return (
    <div className="container max-w-6xl py-6 space-y-6">
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

      {/* 主内容��� - 两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：快速操作 / 进度 / 结果 (占 3 列) */}
        <div className="lg:col-span-3 space-y-6">
          {state === "idle" && (
            <QuickActionGrid onAction={handleOrganizeAction} />
          )}

          {isExecuting && (
            <OrganizeProgress
              status={state}
              message={progress.message}
              progress={progress.percent}
              currentStep={progress.step}
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

        {/* 右侧：健康诊断面板 (占 2 列) */}
        <div className="lg:col-span-2">
          <HealthDiagnosisPanel
            onViewAllIssues={() => setShowIssueDrawer(true)}
            onIssueAction={handleIssueAction}
            disabled={isExecuting}
          />
        </div>
      </div>

      {/* 问题详情抽屉 */}
      {analysis && (
        <IssueDetailDrawer
          open={showIssueDrawer}
          onOpenChange={setShowIssueDrawer}
          duplicateFolders={analysis.duplicateFolders}
          emptyFolders={analysis.emptyFolders}
          oversizedFolders={analysis.oversizedFolders}
          poorlyNamedFolders={analysis.poorlyNamedFolders}
          missingCategories={analysis.missingCategories}
          onMerge={(groupIndex) => {
            const group = analysis.duplicateFolders[groupIndex];
            if (group && group.folders.length >= 2) {
              const [source, target] = group.folders;
              mergeFolders(source.id, target.id);
            }
          }}
          onDelete={(folderId) => deleteFolder(folderId)}
          onSplit={() => toast.info("拆分功能开发中，敬请期待")}
          onRename={(folderId, newName) => renameFolder(folderId, newName)}
          onCreate={(categoryIndex) => {
            const item = analysis.missingCategories[categoryIndex];
            if (item) {
              createFolder(item.category);
            }
          }}
        />
      )}
    </div>
  );
}
