/**
 * SnapshotQuotaSection Component (V4.2.1)
 * 快照配额设置区块 - 用于 Settings 页面
 *
 * 功能：
 * - 显示配额使用情况（进度条）
 * - 显示会员等级和允许的快照类型
 * - 显示过期策略
 * - Pro 升级引导
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Crown,
  Clock,
  FileText,
  ImageIcon,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSnapshotFeature } from "@/lib/feature-flags";
import type { SnapshotQuota, SnapshotType } from "@/lib/snapshot";
import { API_SNAPSHOTS } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

interface SnapshotQuotaSectionProps {
  /** 自定义类名 */
  className?: string;
}

// 快照类型描述
const SNAPSHOT_TYPE_INFO: Record<
  SnapshotType,
  {
    label: string;
    description: string;
    icon: React.ReactNode;
    proOnly: boolean;
  }
> = {
  basic: {
    label: "基础快照",
    description: "提取正文内容，便于阅读",
    icon: <FileText className="size-4" />,
    proOnly: false,
  },
  standard: {
    label: "标准快照",
    description: "保留完整样式，支持离线查看",
    icon: <ImageIcon className="size-4" />,
    proOnly: true,
  },
  full: {
    label: "完整快照",
    description: "含截图，完美还原原始页面",
    icon: <Camera className="size-4" />,
    proOnly: true,
  },
};

// ============================================================================
// 辅助函数
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================================================
// 组件实现
// ============================================================================

export function SnapshotQuotaSection({ className }: SnapshotQuotaSectionProps) {
  const isSnapshotEnabled = useSnapshotFeature();
  const [quota, setQuota] = useState<SnapshotQuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载配额数据
  const loadQuota = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_SNAPSHOTS.quota);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "获取配额失败");
      }

      setQuota(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取配额失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (isSnapshotEnabled) {
      loadQuota();
    }
  }, [isSnapshotEnabled, loadQuota]);

  // 功能未启用
  if (!isSnapshotEnabled) {
    return null;
  }

  // 计算使用百分比
  const countPercent = quota ? (quota.usedCount / quota.maxCount) * 100 : 0;
  const storagePercent = quota ? (quota.usedBytes / quota.quotaBytes) * 100 : 0;

  // 状态颜色
  const getStatusColor = (percent: number) => {
    if (percent >= 95) return "text-red-500";
    if (percent >= 80) return "text-amber-500";
    return "text-green-500";
  };

  const getProgressStyle = (percent: number) => {
    if (percent >= 95) return "[&>div]:bg-red-500";
    if (percent >= 80) return "[&>div]:bg-amber-500";
    return "";
  };

  // 是否为 Pro 用户
  const isPro = quota?.membership === "PRO";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-5 text-cyan-600 dark:text-cyan-400" />
          网页快照
          {isPro && (
            <Badge
              variant="outline"
              className="ml-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-300"
            >
              <Crown className="size-3 mr-1" />
              Pro
            </Badge>
          )}
        </CardTitle>
        <CardDescription>保存网页内容，防止链接失效</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 加载状态 */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              加载配额信息...
            </span>
          </div>
        )}

        {/* 错误状态 */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="size-8 text-red-500 mb-2" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={loadQuota}>
              <RefreshCw className="size-4 mr-2" />
              重试
            </Button>
          </div>
        )}

        {/* 配额信息 */}
        {quota && !isLoading && !error && (
          <>
            {/* 配额使用情况 */}
            <div className="space-y-4">
              {/* 快照数量配额 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">快照数量</span>
                  <span
                    className={cn("font-medium", getStatusColor(countPercent))}
                  >
                    {quota.usedCount} / {quota.maxCount}
                  </span>
                </div>
                <Progress
                  value={countPercent}
                  className={cn("h-2", getProgressStyle(countPercent))}
                />
              </div>

              {/* 存储空间配额 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">存储空间</span>
                  <span
                    className={cn(
                      "font-medium",
                      getStatusColor(storagePercent),
                    )}
                  >
                    {formatBytes(quota.usedBytes)} /{" "}
                    {formatBytes(quota.quotaBytes)}
                  </span>
                </div>
                <Progress
                  value={storagePercent}
                  className={cn("h-2", getProgressStyle(storagePercent))}
                />
              </div>
            </div>

            <Separator />

            {/* 允许的快照类型 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="size-4 text-purple-500" />
                可用快照类型
              </h4>
              <div className="grid gap-2">
                {(Object.keys(SNAPSHOT_TYPE_INFO) as SnapshotType[]).map(
                  (type) => {
                    const info = SNAPSHOT_TYPE_INFO[type];
                    const isAllowed = quota.allowedTypes.includes(type);

                    return (
                      <div
                        key={type}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isAllowed
                            ? "bg-card border-border"
                            : "bg-muted/30 border-muted opacity-60",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-md",
                              isAllowed
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {info.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {info.label}
                              </span>
                              {info.proOnly && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  Pro
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {info.description}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={isAllowed ? "default" : "secondary"}
                          className={cn(
                            "text-xs",
                            isAllowed
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"
                              : "",
                          )}
                        >
                          {isAllowed ? "可用" : "未解锁"}
                        </Badge>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <Separator />

            {/* 过期策略 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="size-4 text-blue-500" />
                快照保留策略
              </h4>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">
                  快照保留时间
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    isPro
                      ? "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-300"
                      : "",
                  )}
                >
                  {quota.expirationDays === null ? (
                    <>
                      <Crown className="size-3 mr-1" />
                      永久保留
                    </>
                  ) : (
                    `${quota.expirationDays} 天`
                  )}
                </Badge>
              </div>
            </div>

            {/* 升级提示 */}
            {!isPro && (
              <>
                <Separator />
                <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                      <Crown className="size-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        升级到 Pro
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        解锁标准和完整快照类型，获得 1000 个快照配额和 500MB
                        存储空间，快照永久保留。
                      </p>
                      <Button
                        size="sm"
                        className="mt-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        立即升级
                        <ExternalLink className="size-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotQuotaSection;
