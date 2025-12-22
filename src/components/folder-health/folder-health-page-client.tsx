"use client";

/**
 * 文件夹健康检查页面客户端组件
 * 展示文件夹健康状态和优化建议
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FolderSync,
  GitMerge,
  GitBranch,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useFolderHealth,
  type MergeSuggestion,
  type SplitSuggestion,
  type FolderHealthStatus,
} from "@/hooks/domain/folder/use-folder-health";

// ============================================================================
// 常量
// ============================================================================

const STATUS_CONFIG: Record<
  FolderHealthStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  healthy: {
    label: "健康",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  },
  needs_attention: {
    label: "需要优化",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  },
  critical: {
    label: "亟需整理",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: <XCircle className="h-5 w-5 text-red-500" />,
  },
};

// ============================================================================
// 主组件
// ============================================================================

export function FolderHealthPageClient() {
  const router = useRouter();
  const {
    report,
    status,
    totalFolders,
    healthyFolders,
    mergeSuggestions,
    splitSuggestions,
    hasSuggestions,
    isLoading,
    isProcessing,
    error,
    refresh,
    executeMerge,
    dismissMergeSuggestion,
    dismissSplitSuggestion,
  } = useFolderHealth();

  // 合并对话框状态
  const [mergeDialog, setMergeDialog] = useState<{
    open: boolean;
    suggestion: MergeSuggestion | null;
    newName: string;
  }>({
    open: false,
    suggestion: null,
    newName: "",
  });

  // 打开合并对话框
  const openMergeDialog = (suggestion: MergeSuggestion) => {
    const targetName =
      suggestion.suggestedAction === "merge_to_first"
        ? suggestion.folder1.name
        : suggestion.suggestedAction === "merge_to_second"
          ? suggestion.folder2.name
          : `${suggestion.folder1.name} & ${suggestion.folder2.name}`;

    setMergeDialog({
      open: true,
      suggestion,
      newName: targetName,
    });
  };

  // 执行合并
  const handleMerge = async () => {
    if (!mergeDialog.suggestion) return;

    const { folder1, folder2, suggestedAction } = mergeDialog.suggestion;
    const targetId =
      suggestedAction === "merge_to_second" ? folder2.id : folder1.id;
    const sourceId =
      suggestedAction === "merge_to_second" ? folder1.id : folder2.id;

    await executeMerge([sourceId], targetId, mergeDialog.newName);
    setMergeDialog({ open: false, suggestion: null, newName: "" });
  };

  // 健康度百分比
  const healthPercentage =
    totalFolders > 0 ? Math.round((healthyFolders / totalFolders) * 100) : 100;

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            正在分析文件夹健康状况...
          </p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <p className="mt-4 text-lg font-medium">加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={refresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="container max-w-4xl py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文件夹健康检查</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            分析文件夹组织结构，提供优化建议
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={isLoading || isProcessing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          重新检查
        </Button>
      </div>

      {/* 健康状态概览 */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              健康状态
            </CardTitle>
            <Badge className={statusConfig.color}>
              {statusConfig.icon}
              <span className="ml-1">{statusConfig.label}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>健康文件夹</span>
                <span className="font-medium">
                  {healthyFolders} / {totalFolders}
                </span>
              </div>
              <Progress value={healthPercentage} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold">{totalFolders}</p>
                <p className="text-xs text-muted-foreground">总文件夹</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {healthyFolders}
                </p>
                <p className="text-xs text-muted-foreground">健康</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {mergeSuggestions.length + splitSuggestions.length}
                </p>
                <p className="text-xs text-muted-foreground">待优化</p>
              </div>
            </div>

            {report?.analyzedAt && (
              <p className="text-xs text-muted-foreground">
                最后检查时间：
                {new Date(report.analyzedAt).toLocaleString("zh-CN")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 无建议时的提示 */}
      {!hasSuggestions && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 text-lg font-medium">所有文件夹都很健康！</p>
            <p className="mt-2 text-sm text-muted-foreground">
              暂无需要优化的文件夹
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/folders")}
            >
              <FolderSync className="mr-2 h-4 w-4" />
              查看所有文件夹
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 合并建议 */}
      {mergeSuggestions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              合并建议
              <Badge variant="secondary">{mergeSuggestions.length}</Badge>
            </CardTitle>
            <CardDescription>
              这些文件夹内容相似，建议合并以简化组织结构
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mergeSuggestions.map((suggestion, index) => (
              <MergeSuggestionCard
                key={`${suggestion.folder1.id}-${suggestion.folder2.id}`}
                suggestion={suggestion}
                index={index}
                onMerge={() => openMergeDialog(suggestion)}
                onDismiss={() =>
                  dismissMergeSuggestion(
                    suggestion.folder1.id,
                    suggestion.folder2.id,
                  )
                }
                isProcessing={isProcessing}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* 拆分建议 */}
      {splitSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              拆分建议
              <Badge variant="secondary">{splitSuggestions.length}</Badge>
            </CardTitle>
            <CardDescription>
              这些文件夹内容较杂，建议拆分为更细分的类别
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {splitSuggestions.map((suggestion) => (
              <SplitSuggestionCard
                key={suggestion.folderId}
                suggestion={suggestion}
                onDismiss={() => dismissSplitSuggestion(suggestion.folderId)}
                isProcessing={isProcessing}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* 合并确认对话框 */}
      <Dialog
        open={mergeDialog.open}
        onOpenChange={(open) => setMergeDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认合并文件夹</DialogTitle>
            <DialogDescription>
              {mergeDialog.suggestion && (
                <>
                  将「{mergeDialog.suggestion.folder1.name}」和「
                  {mergeDialog.suggestion.folder2.name}」合并为一个文件夹
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newName">合并后的文件夹名称</Label>
              <Input
                id="newName"
                value={mergeDialog.newName}
                onChange={(e) =>
                  setMergeDialog((prev) => ({
                    ...prev,
                    newName: e.target.value,
                  }))
                }
                placeholder="输入新名称"
              />
            </div>
            {mergeDialog.suggestion && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium">合并详情：</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    • {mergeDialog.suggestion.folder1.name} (
                    {mergeDialog.suggestion.folder1.bookmarkCount} 条书签)
                  </li>
                  <li>
                    • {mergeDialog.suggestion.folder2.name} (
                    {mergeDialog.suggestion.folder2.bookmarkCount} 条书签)
                  </li>
                  <li>
                    • 相似度：
                    {(mergeDialog.suggestion.similarity * 100).toFixed(0)}%
                  </li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setMergeDialog({ open: false, suggestion: null, newName: "" })
              }
            >
              取消
            </Button>
            <Button onClick={handleMerge} disabled={isProcessing}>
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              确认合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// 子组件
// ============================================================================

interface MergeSuggestionCardProps {
  suggestion: MergeSuggestion;
  index: number;
  onMerge: () => void;
  onDismiss: () => void;
  isProcessing: boolean;
}

function MergeSuggestionCard({
  suggestion,
  onMerge,
  onDismiss,
  isProcessing,
}: MergeSuggestionCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{suggestion.folder1.name}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{suggestion.folder2.name}</span>
          <Badge variant="outline" className="ml-2">
            {(suggestion.similarity * 100).toFixed(0)}% 相似
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {suggestion.reason}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          共{" "}
          {suggestion.folder1.bookmarkCount + suggestion.folder2.bookmarkCount}{" "}
          条书签
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={isProcessing}
        >
          忽略
        </Button>
        <Button size="sm" onClick={onMerge} disabled={isProcessing}>
          合并
        </Button>
      </div>
    </div>
  );
}

interface SplitSuggestionCardProps {
  suggestion: SplitSuggestion;
  onDismiss: () => void;
  isProcessing: boolean;
}

function SplitSuggestionCard({
  suggestion,
  onDismiss,
  isProcessing,
}: SplitSuggestionCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{suggestion.folderName}</span>
          <Badge variant="outline">{suggestion.bookmarkCount} 条书签</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {suggestion.reason}
        </p>
        {suggestion.suggestedClusters && (
          <p className="mt-1 text-xs text-muted-foreground">
            建议拆分为约 {suggestion.suggestedClusters} 个子文件夹
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={isProcessing}
        >
          忽略
        </Button>
        <Button size="sm" variant="outline" disabled>
          拆分（开发中）
        </Button>
      </div>
    </div>
  );
}

export default FolderHealthPageClient;
