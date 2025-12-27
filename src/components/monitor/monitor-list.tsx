/**
 * 监控列表组件
 *
 * 展示用户的所有页面监控
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { useState, useCallback } from "react";
import { Eye, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitors, useMonitorActions } from "@/hooks/monitor";
import { MonitorCard } from "./monitor-card";
import { MonitorSettingsDialog } from "./monitor-settings-dialog";

type StatusFilter = "all" | "active" | "paused" | "failed";

interface MonitorListProps {
  /** 查看监控详情回调 */
  onViewDetail?: (monitorId: number) => void;
}

/**
 * 监控列表组件
 */
export function MonitorList({ onViewDetail }: MonitorListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { monitors, stats, isLoading, error, refresh } =
    useMonitors(statusFilter);
  const {
    pauseMonitor,
    resumeMonitor,
    deleteMonitor,
    isLoading: isActing,
  } = useMonitorActions();

  // 删除确认状态
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // 设置对话框状态
  const [settingsId, setSettingsId] = useState<number | null>(null);

  // 处理暂停
  const handlePause = useCallback(
    async (id: number) => {
      await pauseMonitor(id);
    },
    [pauseMonitor],
  );

  // 处理恢复
  const handleResume = useCallback(
    async (id: number) => {
      await resumeMonitor(id);
    },
    [resumeMonitor],
  );

  // 处理删除
  const handleDelete = useCallback(async () => {
    if (deleteId) {
      await deleteMonitor(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, deleteMonitor]);

  // 加载状态骨架
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">加载失败: {error.message}</p>
        <Button variant="outline" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部：统计和筛选 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" />
            页面监控
          </h2>
          {stats && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="font-normal">
                {stats.quotaUsed}/{stats.quotaMax} 配额
              </Badge>
              {stats.active > 0 && (
                <Badge
                  variant="outline"
                  className="font-normal text-green-600 border-green-200"
                >
                  {stats.active} 活跃
                </Badge>
              )}
              {stats.failed > 0 && (
                <Badge
                  variant="outline"
                  className="font-normal text-red-600 border-red-200"
                >
                  {stats.failed} 失败
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 状态筛选 */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="active">监控中</SelectItem>
              <SelectItem value="paused">已暂停</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <Button variant="outline" size="icon" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 空状态 */}
      {monitors.length === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无监控</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {statusFilter === "all"
              ? "在书签详情页添加页面监控，追踪内容变化"
              : `没有${statusFilter === "active" ? "活跃" : statusFilter === "paused" ? "暂停" : "失败"}的监控`}
          </p>
        </div>
      )}

      {/* 监控卡片网格 */}
      {monitors.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {monitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={(id) => setDeleteId(id)}
              onSettings={(id) => setSettingsId(id)}
              onViewDetail={onViewDetail}
              isLoading={isActing}
            />
          ))}
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除监控？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将停止监控此页面，历史检查记录将被保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 设置对话框 */}
      <MonitorSettingsDialog
        open={!!settingsId}
        onOpenChange={() => setSettingsId(null)}
        monitorId={settingsId}
      />
    </div>
  );
}
