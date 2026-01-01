/**
 * 侧边栏复习提醒组件
 *
 * 在侧边栏显示待复习提醒，点击后打开复习会话
 *
 * @version 1.2.0
 * @since 2025-12-29
 * @updated 2025-12-29 - 优化轮询性能：标签页不可见时暂停轮询
 * @updated 2025-12-29 - 修复 429 限流问题：添加请求去重和短期缓存
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Brain, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewSession } from "./review-session";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 常量配置
// ============================================

/** 轮询间隔（毫秒）：5 分钟 */
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/** 会话完成后刷新延迟（毫秒） */
const REFRESH_DELAY_MS = 1500;

/** 偏好数据缓存时间（毫秒）：30 秒 - 防止 429 限流 */
const PREFERENCES_CACHE_TTL_MS = 30_000;

/** 请求最小间隔（毫秒）：5 秒 - 防止快速重复请求 */
const MIN_REQUEST_INTERVAL_MS = 5_000;

// ============================================
// 模块级缓存（跨组件实例共享）
// ============================================

interface PreferencesCache {
  data: { enabled: boolean } | null;
  timestamp: number;
}

let preferencesCache: PreferencesCache = { data: null, timestamp: 0 };
let lastRequestTime = 0;
let pendingRequest: Promise<{ enabled: boolean } | null> | null = null;

// ============================================
// 类型定义
// ============================================

interface QueueStats {
  total: number;
  overdue: number;
  dueToday: number;
}

interface SidebarReminderProps {
  className?: string;
  collapsed?: boolean;
}

// ============================================
// 组件实现
// ============================================

export function SidebarReminder({
  className,
  collapsed = false,
}: SidebarReminderProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取偏好数据（带缓存和请求去重）
   * 解决 429 限流问题
   */
  const fetchPreferencesWithCache = useCallback(async (): Promise<{
    enabled: boolean;
  } | null> => {
    const now = Date.now();

    // 1. 检查缓存是否有效
    if (
      preferencesCache.data &&
      now - preferencesCache.timestamp < PREFERENCES_CACHE_TTL_MS
    ) {
      return preferencesCache.data;
    }

    // 2. 检查请求间隔，防止快速重复请求
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
      // 如果有正在进行的请求，等待它完成
      if (pendingRequest) {
        return pendingRequest;
      }
      // 否则返回旧缓存（即使过期）或 null
      return preferencesCache.data;
    }

    // 3. 如果有正在进行的请求，复用它
    if (pendingRequest) {
      return pendingRequest;
    }

    // 4. 发起新请求
    lastRequestTime = now;
    pendingRequest = (async () => {
      try {
        const response = await fetch("/api/brain-sync/preferences");

        // 处理 429 错误
        if (response.status === 429) {
          clientLogger.warn(
            { status: 429 },
            "Brain-Sync preferences rate limited, using cache",
          );
          return preferencesCache.data;
        }

        const data = await response.json();
        const result = {
          enabled: data.success && data.data.preferences?.enabled === true,
        };

        // 更新缓存
        preferencesCache = { data: result, timestamp: Date.now() };
        return result;
      } catch (err) {
        clientLogger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to fetch Brain-Sync preferences",
        );
        return preferencesCache.data; // 出错时返回旧缓存
      } finally {
        pendingRequest = null;
      }
    })();

    return pendingRequest;
  }, []);

  // 加载复习队列统计
  const loadStats = useCallback(async () => {
    try {
      // 先检查是否启用（使用缓存机制）
      const prefsResult = await fetchPreferencesWithCache();

      if (!prefsResult?.enabled) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      setEnabled(true);

      // 获取队列统计
      const queueResponse = await fetch("/api/brain-sync/queue?limit=100");
      const queueData = await queueResponse.json();

      if (queueData.success && queueData.data.stats) {
        setStats({
          total: queueData.data.stats.total,
          overdue: queueData.data.stats.overdue,
          dueToday: queueData.data.stats.dueToday,
        });
      }
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to load Brain-Sync stats",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchPreferencesWithCache]);

  // 初始加载
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Page Visibility API：监听标签页可见性
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsPageVisible(visible);

      // 标签页变为可见时立即刷新数据
      if (visible && enabled) {
        loadStats();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, loadStats]);

  // 定期轮询：仅在启用且页面可见时运行
  useEffect(() => {
    // 清理之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 仅在启用且页面可见时创建定时器
    if (enabled && isPageVisible) {
      intervalRef.current = setInterval(loadStats, POLLING_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isPageVisible, loadStats]);

  // 不启用或加载中时不显示
  if (loading || !enabled) {
    return null;
  }

  // 没有待复习的卡片时不显示
  if (!stats || stats.total === 0) {
    return null;
  }

  // 确定显示状态
  const hasOverdue = stats.overdue > 0;
  const hasDueToday = stats.dueToday > 0;

  // 会话完成后刷新统计
  const handleSessionComplete = () => {
    // 延迟刷新，等待数据库更新
    setTimeout(async () => {
      try {
        const response = await fetch("/api/brain-sync/queue?limit=100");
        const data = await response.json();

        if (data.success && data.data.stats) {
          setStats({
            total: data.data.stats.total,
            overdue: data.data.stats.overdue,
            dueToday: data.data.stats.dueToday,
          });
        }
      } catch (err) {
        clientLogger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to refresh Brain-Sync stats",
        );
      }
    }, REFRESH_DELAY_MS);
  };

  if (collapsed) {
    // 折叠状态：只显示图标和徽章
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative",
                hasOverdue && "text-red-500 hover:text-red-600",
                hasDueToday &&
                  !hasOverdue &&
                  "text-yellow-500 hover:text-yellow-600",
                className,
              )}
              onClick={() => setReviewOpen(true)}
            >
              <Brain className="h-5 w-5" />
              {stats.total > 0 && (
                <Badge
                  variant={hasOverdue ? "destructive" : "secondary"}
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {stats.total > 99 ? "99+" : stats.total}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="text-sm">
              <div className="font-medium mb-1">待复习卡片</div>
              <div className="text-muted-foreground">
                {hasOverdue && (
                  <div className="text-red-500">
                    🔴 {stats.overdue} 张待回顾
                  </div>
                )}
                {hasDueToday && (
                  <div className="text-yellow-500">
                    🟡 {stats.dueToday} 张今日到期
                  </div>
                )}
                <div>共 {stats.total} 张待复习</div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        <ReviewSession
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onSessionComplete={handleSessionComplete}
        />
      </TooltipProvider>
    );
  }

  // 展开状态：显示完整卡片
  return (
    <>
      <div
        className={cn(
          "p-3 rounded-lg cursor-pointer transition-colors",
          hasOverdue
            ? "bg-red-50 hover:bg-red-100 border border-red-200"
            : hasDueToday
              ? "bg-yellow-50 hover:bg-yellow-100 border border-yellow-200"
              : "bg-purple-50 hover:bg-purple-100 border border-purple-200",
          className,
        )}
        onClick={() => setReviewOpen(true)}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-full",
              hasOverdue
                ? "bg-red-100"
                : hasDueToday
                  ? "bg-yellow-100"
                  : "bg-purple-100",
            )}
          >
            {hasOverdue ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <Brain
                className={cn(
                  "h-5 w-5",
                  hasDueToday ? "text-yellow-600" : "text-purple-600",
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-medium text-sm",
                  hasOverdue
                    ? "text-red-700"
                    : hasDueToday
                      ? "text-yellow-700"
                      : "text-purple-700",
                )}
              >
                灵感回顾
              </span>
              <Sparkles className="h-3 w-3 text-purple-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {hasOverdue
                ? `${stats.overdue} 张卡片待回顾`
                : hasDueToday
                  ? `${stats.dueToday} 张今日到期`
                  : `${stats.total} 张待复习`}
            </div>
          </div>
          <Badge
            variant={hasOverdue ? "destructive" : "secondary"}
            className="shrink-0"
          >
            {stats.total}
          </Badge>
        </div>
      </div>

      <ReviewSession
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onSessionComplete={handleSessionComplete}
      />
    </>
  );
}
