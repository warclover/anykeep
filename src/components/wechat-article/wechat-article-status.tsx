/**
 * 微信文章抓取状态组件
 *
 * @module wechat-article
 */

"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image,
  Save,
} from "lucide-react";
import type {
  WechatArticleCrawlProgress,
  CrawlStage,
} from "@/lib/wechat-article/wechat-article.types";

// =============================================================================
// 类型定义
// =============================================================================

export interface WechatArticleStatusProps {
  /** 抓取进度 */
  progress: WechatArticleCrawlProgress;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 阶段配置
// =============================================================================

const STAGE_CONFIG: Record<
  CrawlStage,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  fetching: {
    label: "获取网页内容",
    icon: FileText,
    color: "text-blue-500",
  },
  parsing: {
    label: "解析文章内容",
    icon: FileText,
    color: "text-blue-500",
  },
  images: {
    label: "处理图片",
    icon: Image,
    color: "text-purple-500",
  },
  saving: {
    label: "保存数据",
    icon: Save,
    color: "text-green-500",
  },
  completed: {
    label: "完成",
    icon: CheckCircle2,
    color: "text-green-600",
  },
  failed: {
    label: "失败",
    icon: AlertCircle,
    color: "text-red-500",
  },
};

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 抓取状态组件
 */
export function WechatArticleStatus({
  progress,
  className,
}: WechatArticleStatusProps) {
  const config = STAGE_CONFIG[progress.stage];
  const Icon = config.icon;
  const isComplete = progress.stage === "completed";
  const isFailed = progress.stage === "failed";

  return (
    <div className={cn("space-y-3 p-4 rounded-lg bg-muted/50", className)}>
      {/* 状态标题 */}
      <div className="flex items-center gap-2">
        {isComplete || isFailed ? (
          <Icon className={cn("size-5", config.color)} />
        ) : (
          <Loader2 className={cn("size-5 animate-spin", config.color)} />
        )}
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
      </div>

      {/* 进度条 */}
      {!isComplete && !isFailed && (
        <Progress value={progress.progress} className="h-2" />
      )}

      {/* 图片进度详情 */}
      {progress.stage === "images" && progress.images && (
        <div className="text-xs text-muted-foreground">
          已处理 {progress.images.completed} / {progress.images.total} 张图片
        </div>
      )}

      {/* 错误信息 */}
      {isFailed && progress.error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded p-2">
          {progress.error}
        </div>
      )}
    </div>
  );
}

export default WechatArticleStatus;
