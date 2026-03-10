/**
 * 分拣沙盒主页面
 *
 * 批量分类的主要交互界面
 *
 * @module app/(main)/import/[batchId]/sandbox/page
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressIndicator } from "@/components/batch-classification/progress-indicator";
import { ClassificationPreview } from "@/components/batch-classification/classification-preview";
import { UndoBanner } from "@/components/batch-classification/undo-banner";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import type {
  ClassificationResult,
  UserDecision,
} from "@/lib/batch-classification";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 页面状态
// ============================================

type PageState =
  | "loading"
  | "processing"
  | "ready"
  | "confirming"
  | "confirmed"
  | "error";

// ============================================
// 页面组件
// ============================================

export default function SandboxPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params?.batchId as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [results, setResults] = useState<ClassificationResult | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(null);
  const [undoDeadline, setUndoDeadline] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载分类结果
  const loadResults = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/batch-classification/${batchId}/results`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
      setResults(data);
      setPageState("ready");
    } catch (err) {
      clientLogger.error({ err }, "Failed to load results:");
      setError("加载结果失败");
      setPageState("error");
    }
  }, [batchId]);

  // 检查分类状态
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/batch-classification/${batchId}/progress`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch status");
      }

      const data = await response.json();

      if (data.phase === "completed") {
        // 分类已完成，加载结果
        await loadResults();
      } else if (data.phase === "failed") {
        setError(data.error?.message || "分类失败");
        setPageState("error");
      } else {
        // 仍在处理中
        setPageState("processing");
      }
    } catch (err) {
      clientLogger.error({ err }, "Failed to check status:");
      setPageState("processing"); // 假设正在处理
    }
  }, [batchId, loadResults]);

  // 加载初始状态
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 处理分类完成
  const handleClassificationComplete = useCallback(() => {
    loadResults();
  }, [loadResults]);

  // 处理分类错误
  const handleClassificationError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setPageState("error");
  }, []);

  // 确认分类
  const handleConfirm = async (decisions: UserDecision[]) => {
    setPageState("confirming");

    try {
      const response = await fetch(
        `/api/batch-classification/${batchId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisions }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to confirm");
      }

      const now = new Date();
      setConfirmedAt(now);
      setUndoDeadline(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      setPageState("confirmed");
    } catch (err) {
      clientLogger.error({ err }, "Failed to confirm:");
      setError("确认失败，请重试");
      setPageState("ready");
    }
  };

  // 取消/暂不处理
  const handleCancel = () => {
    router.push("/import");
  };

  // 撤销分类
  const handleUndo = async () => {
    const response = await fetch(`/api/batch-classification/${batchId}/undo`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to undo");
    }

    router.push("/import");
  };

  return (
    <div className="container max-w-5xl py-8 pb-24">
      {/* 页头 */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">分拣沙盒</h1>
          <p className="text-muted-foreground">
            审核 AI 的分类建议，确认后应用到您的收藏
          </p>
        </div>
      </div>

      {/* 已确认状态 - 显示撤销提示 */}
      {pageState === "confirmed" && confirmedAt && undoDeadline && results && (
        <div className="space-y-6">
          <UndoBanner
            transactionId={batchId}
            confirmedAt={confirmedAt}
            undoDeadline={undoDeadline}
            bookmarkCount={results.stats.totalBookmarks}
            onUndo={handleUndo}
          />

          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">分类完成！</h2>
            <p className="text-muted-foreground mb-6">
              已成功整理 {results.stats.totalBookmarks} 个书签到{" "}
              {results.stats.clusterCount} 个分类
            </p>
            <Button onClick={() => router.push("/")}>返回首页</Button>
          </div>
        </div>
      )}

      {/* 处理中状态 */}
      {pageState === "processing" && (
        <ProgressIndicator
          transactionId={batchId}
          onComplete={handleClassificationComplete}
          onError={handleClassificationError}
        />
      )}

      {/* 加载中 */}
      {pageState === "loading" && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 确认中 */}
      {pageState === "confirming" && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">正在应用分类...</p>
        </div>
      )}

      {/* 错误状态 */}
      {pageState === "error" && (
        <div className="text-center py-24">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">出现错误</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              返回
            </Button>
            <Button onClick={() => window.location.reload()}>重试</Button>
          </div>
        </div>
      )}

      {/* 分类结果预览 */}
      {pageState === "ready" && results && (
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">
                全部 ({results.clusters.length})
              </TabsTrigger>
              <TabsTrigger value="conflicts">
                有冲突 ({results.stats.conflictCount})
              </TabsTrigger>
              <TabsTrigger value="unclustered">
                未分类 ({results.unclustered.length})
              </TabsTrigger>
            </TabsList>

            <div className="text-sm text-muted-foreground">
              共 {results.stats.totalBookmarks} 个书签，
              {results.stats.clusteredCount} 个已分类
            </div>
          </div>

          <TabsContent value="all">
            <ClassificationPreview
              clusters={results.clusters}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          </TabsContent>

          <TabsContent value="conflicts">
            <ClassificationPreview
              clusters={results.clusters.filter(
                (c) => c.conflictType !== "none",
              )}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          </TabsContent>

          <TabsContent value="unclustered">
            <div className="text-center py-12 text-muted-foreground">
              <p>{results.unclustered.length} ���书签未能自动分类</p>
              <p className="text-sm mt-2">
                这些书签将保留在收件箱中，您可以稍后手动整理
              </p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
