/**
 * 链接健康检测页面 - 客户端组件
 * 提供完整的链接健康检测功能界面
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  HeartPulse,
  RefreshCw,
  Play,
  StopCircle,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LinkHealthProgress } from "./link-health-progress";
import { LinkHealthResultList } from "./link-health-result-list";
import { LinkHealthFixDialog } from "./link-health-fix-dialog";
import { useFolders } from "@/hooks/data";
import type {
  CheckScope,
  CheckStatus,
  HealthCheckStats,
  LinkCheckResult,
  FixAction,
} from "@/lib/ai-skills/skills/link-health-check/types";

/** 页面文本常量 */
const PAGE_TEXT = {
  title: "链接健康检测",
  description: "检测收藏链接的可访问性，发现失效链接并提供修复建议",
  scopeLabel: "检测范围",
  folderLabel: "选择文件夹",
  scopeOptions: {
    all: "全部书签",
    folder: "指定文件夹",
  },
  startButton: "开始检测",
  stopButton: "停止检测",
  refreshButton: "刷新",
  emptyState: {
    title: "尚未运行检测",
    description: "选择检测范围后点击「开始检测」按钮",
  },
  stats: {
    total: "已检测",
    healthy: "健康",
    slow: "缓慢",
    redirect: "已重定向",
    failed: "失效",
  },
};

/** 检测运行状态 */
interface CheckRunState {
  status: CheckStatus;
  checkId?: string;
  progress: number;
  stats: HealthCheckStats | null;
  problems: LinkCheckResult[];
  currentStep?: string;
  error?: string;
}

const initialState: CheckRunState = {
  status: "pending",
  progress: 0,
  stats: null,
  problems: [],
};

export function LinkHealthPageClient() {
  // ==================== 状态 ====================

  // 检测配置
  const [scope, setScope] = useState<CheckScope>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  // 检测状态
  const [runState, setRunState] = useState<CheckRunState>(initialState);

  // 修复对话框
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] =
    useState<LinkCheckResult | null>(null);

  // SSE 连接引用
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ==================== 数据获取 ====================

  const { folders, isLoading: isLoadingFolders } = useFolders();

  // ==================== 事件处理 ====================

  /** 处理流式数据块 */
  const handleStreamChunk = useCallback(
    (chunk: { type: string; data: Record<string, unknown> }) => {
      switch (chunk.type) {
        case "progress":
          setRunState((prev) => ({
            ...prev,
            progress: (chunk.data.percent as number) || prev.progress,
            currentStep: (chunk.data.message as string) || prev.currentStep,
          }));
          break;

        case "deliverable":
          // 处理检测结果交付物
          if (chunk.data.type === "report") {
            const content = chunk.data.content as {
              stats?: HealthCheckStats;
              problems?: LinkCheckResult[];
              checkId?: string;
            };
            setRunState((prev) => ({
              ...prev,
              stats: content.stats || prev.stats,
              problems: content.problems || prev.problems,
              checkId: content.checkId || prev.checkId,
            }));
          }
          break;

        case "done":
          setRunState((prev) => ({
            ...prev,
            status: chunk.data.success ? "completed" : "failed",
            progress: 100,
            currentStep: "完成",
          }));
          if (chunk.data.success) {
            toast.success("链接健康检测完成");
          }
          break;

        case "error":
          setRunState((prev) => ({
            ...prev,
            status: "failed",
            error: chunk.data.message as string,
          }));
          toast.error((chunk.data.message as string) || "检测出错");
          break;

        case "cancelled":
          setRunState((prev) => ({
            ...prev,
            status: "cancelled",
            currentStep: "已取消",
          }));
          break;
      }
    },
    [],
  );

  /** 开始检测 */
  const handleStartCheck = useCallback(async () => {
    // 验证文件夹选择
    if (scope === "folder" && !selectedFolderId) {
      toast.error("请选择要检测的文件夹");
      return;
    }

    // 重置状态
    setRunState({
      status: "running",
      progress: 0,
      stats: null,
      problems: [],
      currentStep: "初始化...",
    });

    // 创建 AbortController
    abortControllerRef.current = new AbortController();

    try {
      // 构建请求参数
      const params: Record<string, string> = {
        scope,
        includeWayback: "true",
      };
      if (scope === "folder" && selectedFolderId) {
        params.folderId = selectedFolderId;
      }

      const queryString = new URLSearchParams(params).toString();
      const url = `/api/link-health/check?${queryString}`;

      // 创建 SSE 连接
      const response = await fetch(url, {
        method: "POST",
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`检测请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamChunk(data);
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setRunState((prev) => ({
          ...prev,
          status: "cancelled",
          currentStep: "已取消",
        }));
        toast.info("检测已取消");
      } else {
        setRunState((prev) => ({
          ...prev,
          status: "failed",
          error: (error as Error).message,
        }));
        toast.error(`检测失败: ${(error as Error).message}`);
      }
    }
  }, [scope, selectedFolderId, handleStreamChunk]);

  /** 停止检测 */
  const handleStopCheck = useCallback(async () => {
    // 取消 fetch 请求
    abortControllerRef.current?.abort();

    // 调用取消 API
    if (runState.checkId) {
      try {
        await fetch("/api/agent/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: runState.checkId }),
        });
      } catch {
        // 忽略取消请求的错误
      }
    }
  }, [runState.checkId]);

  /** 重置检测 */
  const handleReset = useCallback(() => {
    setRunState(initialState);
  }, []);

  /** 打开修复对话框 */
  const handleFixProblem = useCallback((problem: LinkCheckResult) => {
    setSelectedProblem(problem);
    setFixDialogOpen(true);
  }, []);

  /** 执行修复操作 */
  const handleFixAction = useCallback(
    async (action: FixAction, newUrl?: string) => {
      if (!selectedProblem) return;

      try {
        const response = await fetch("/api/link-health/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookmarkId: selectedProblem.bookmarkId,
            action,
            newUrl,
          }),
        });

        if (!response.ok) {
          throw new Error("修复操作失败");
        }

        // 从问题列表中移除已修复的项
        setRunState((prev) => ({
          ...prev,
          problems: prev.problems.filter(
            (p) => p.bookmarkId !== selectedProblem.bookmarkId,
          ),
        }));

        toast.success("修复成功");
        setFixDialogOpen(false);
        setSelectedProblem(null);
      } catch (error) {
        toast.error(`修复失败: ${(error as Error).message}`);
      }
    },
    [selectedProblem],
  );

  // ==================== 清理 ====================

  useEffect(() => {
    // Capture refs at effect setup time
    const eventSource = eventSourceRef.current;
    const abortController = abortControllerRef.current;

    return () => {
      eventSource?.close();
      abortController?.abort();
    };
  }, []);

  // ==================== 计算属性 ====================

  const isRunning = runState.status === "running";
  const hasResults =
    runState.status === "completed" || runState.problems.length > 0;

  // ==================== 渲染 ====================

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HeartPulse className="size-7 text-rose-500" />
          <div>
            <h1 className="text-2xl font-bold">{PAGE_TEXT.title}</h1>
            <p className="text-sm text-muted-foreground">
              {PAGE_TEXT.description}
            </p>
          </div>
        </div>
        {hasResults && !isRunning && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="size-4 mr-2" />
            {PAGE_TEXT.refreshButton}
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* 检测配置 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              🔍 检测配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 范围选择 */}
              <div className="space-y-2">
                <Label>{PAGE_TEXT.scopeLabel}</Label>
                <Select
                  value={scope}
                  onValueChange={(v) => setScope(v as CheckScope)}
                  disabled={isRunning}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {PAGE_TEXT.scopeOptions.all}
                    </SelectItem>
                    <SelectItem value="folder">
                      {PAGE_TEXT.scopeOptions.folder}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 文件夹选择 */}
              {scope === "folder" && (
                <div className="space-y-2">
                  <Label>{PAGE_TEXT.folderLabel}</Label>
                  <Select
                    value={selectedFolderId}
                    onValueChange={setSelectedFolderId}
                    disabled={isRunning || isLoadingFolders}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择文件夹" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((folder) => (
                        <SelectItem
                          key={folder.id}
                          value={folder.id.toString()}
                        >
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-2">
              {isRunning ? (
                <Button variant="destructive" onClick={handleStopCheck}>
                  <StopCircle className="size-4 mr-2" />
                  {PAGE_TEXT.stopButton}
                </Button>
              ) : (
                <Button onClick={handleStartCheck}>
                  <Play className="size-4 mr-2" />
                  {PAGE_TEXT.startButton}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 进度显示 */}
        {isRunning && (
          <LinkHealthProgress
            progress={runState.progress}
            currentStep={runState.currentStep}
            stats={runState.stats}
          />
        )}

        {/* 检测结果 */}
        {hasResults && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileWarning className="size-4 text-amber-500" />
                检测结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LinkHealthResultList
                stats={runState.stats}
                problems={runState.problems}
                onFixProblem={handleFixProblem}
              />
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {!isRunning && !hasResults && runState.status === "pending" && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <HeartPulse className="size-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {PAGE_TEXT.emptyState.title}
                </p>
                <p className="text-sm">{PAGE_TEXT.emptyState.description}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 修复对话框 */}
      <LinkHealthFixDialog
        open={fixDialogOpen}
        onOpenChange={setFixDialogOpen}
        problem={selectedProblem}
        onFix={handleFixAction}
      />
    </div>
  );
}
