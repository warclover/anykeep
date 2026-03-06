/**
 * 收件箱 - 托管模式横幅组件
 */

"use client";

import { Zap, Clock, Hand, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TrustModeBannerProps {
  isFullAuto: boolean;
  isSemiAuto: boolean;
  isManual: boolean;
  isLoading: boolean;
  pendingCount: number;
  onGoToMessages: () => void;
  onGoToSettings: () => void;
}

export function TrustModeBanner({
  isFullAuto,
  isSemiAuto,
  isManual,
  isLoading,
  pendingCount,
  onGoToMessages,
  onGoToSettings,
}: TrustModeBannerProps) {
  if (isLoading) {
    return null;
  }

  if (isFullAuto) {
    return (
      <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
        <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <AlertTitle className="text-xs text-emerald-800 dark:text-emerald-300">
          全自动模式
        </AlertTitle>
        <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-400">
          <span>新书签会被 AI 自动分类到合适的文件夹。</span>
          <span className="ml-1">
            这里的书签正在等待 AI 处理或置信度较低待聚类分析。
          </span>
          <Button
            variant="link"
            size="sm"
            onClick={onGoToSettings}
            className="text-emerald-600 dark:text-emerald-400 p-0 h-auto ml-2"
          >
            <Settings className="w-3 h-3 mr-1" />
            调整设置
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isSemiAuto) {
    return (
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          半自动模式
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              {pendingCount} 个待确认
            </span>
          )}
        </AlertTitle>
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
          <span>AI 会为新书签建议分类，但需要您确认后才会执行。</span>
          {pendingCount > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={onGoToMessages}
              className="text-blue-600 dark:text-blue-400 p-0 h-auto ml-2"
            >
              <Bell className="w-3 h-3 mr-1" />
              查看待确认
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            onClick={onGoToSettings}
            className="text-blue-600 dark:text-blue-400 p-0 h-auto ml-2"
          >
            <Settings className="w-3 h-3 mr-1" />
            调整设置
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isManual) {
    return (
      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <Hand className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-xs text-amber-800 dark:text-amber-300">
          手动模式
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
          <span>AI 分类已关闭，请手动将书签整理到文件夹。</span>
          <span className="ml-1">左侧面板提供智能建议供参考。</span>
          <Button
            variant="link"
            size="sm"
            onClick={onGoToSettings}
            className="text-amber-600 dark:text-amber-400 p-0 h-auto ml-2"
          >
            <Settings className="w-3 h-3 mr-1" />
            切换到自动模式
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
