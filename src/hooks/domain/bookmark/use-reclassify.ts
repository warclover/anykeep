/**
 * 重分类 Hook
 * 管理智能更新分类的状态和操作
 *
 * 性能优化：
 * - 延迟 3 秒后才开始检查（不阻塞页面渲染）
 * - 使用 sessionStorage 缓存 5 分钟，避免重复调用
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import type { ClassificationSuggestion, Bookmark } from "@/types/supabase";

// 缓存配置
const CACHE_KEY_CHECK = "anykeep-reclassify-check";
const CACHE_KEY_SUGGESTIONS = "anykeep-reclassify-suggestions";
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟
const INITIAL_DELAY = 3000; // 延迟 3 秒后开始检查

/**
 * 缓存数据结构
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * 从 sessionStorage 读取缓存
 */
function getCache<T>(key: string): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const item: CacheItem<T> = JSON.parse(cached);
    const isExpired = Date.now() - item.timestamp > CACHE_TTL;

    if (isExpired) {
      sessionStorage.removeItem(key);
      return null;
    }

    return item.data;
  } catch {
    return null;
  }
}

/**
 * 写入 sessionStorage 缓存
 */
function setCache<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(key, JSON.stringify(item));
  } catch {
    // 忽略存储错误
  }
}

/**
 * 清除缓存
 */
function clearCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY_CHECK);
    sessionStorage.removeItem(CACHE_KEY_SUGGESTIONS);
  } catch {
    // 忽略错误
  }
}

/**
 * 重分类检查结果
 */
interface ReclassifyCheckResult {
  shouldTrigger: boolean;
  hasPendingSuggestions: boolean;
  pendingSuggestionsCount: number;
  triggers: {
    weekly: boolean;
    threshold: boolean;
  };
  stats: {
    inboxCount: number;
    inboxThreshold: number;
    lastRunAt: string | null;
    daysSinceLastRun: number | null;
  };
}

/**
 * 建议项（包含书签信息）
 */
interface SuggestionWithBookmark extends ClassificationSuggestion {
  bookmarks: Pick<
    Bookmark,
    "id" | "title" | "url" | "cover_url" | "platform" | "ai_summary" | "ai_tags"
  >;
}

/**
 * Hook 返回类型
 */
interface UseReclassifyReturn {
  // 状态
  checkResult: ReclassifyCheckResult | null;
  suggestions: SuggestionWithBookmark[];
  isChecking: boolean;
  isRunning: boolean;
  isProcessing: boolean;

  // 操作
  checkReclassify: () => Promise<void>;
  runReclassify: (forceRun?: boolean) => Promise<void>;
  fetchSuggestions: () => Promise<void>;
  acceptSuggestions: (ids: number[]) => Promise<void>;
  rejectSuggestions: (ids: number[]) => Promise<void>;
  acceptAllSuggestions: () => Promise<void>;
  rejectAllSuggestions: () => Promise<void>;

  // 统计
  stats: {
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
  };
}

export function useReclassify(): UseReclassifyReturn {
  const router = useRouter();
  const initRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [checkResult, setCheckResult] = useState<ReclassifyCheckResult | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<SuggestionWithBookmark[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
  });

  /**
   * 获取建议列表（带缓存）
   */
  const fetchSuggestions = useCallback(async (skipCache = false) => {
    // 尝试从缓存读取
    if (!skipCache) {
      const cached = getCache<{
        suggestions: SuggestionWithBookmark[];
        stats: typeof stats;
      }>(CACHE_KEY_SUGGESTIONS);
      if (cached) {
        setSuggestions(cached.suggestions || []);
        setStats(
          cached.stats || { pending: 0, accepted: 0, rejected: 0, expired: 0 },
        );
        return;
      }
    }

    try {
      const response = await fetch(
        "/api/reclassify/suggestions?status=pending",
      );
      if (response.ok) {
        const data = await response.json();
        const suggestionsData = data.data.suggestions || [];
        const statsData = data.data.stats || {
          pending: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
        };

        setSuggestions(suggestionsData);
        setStats(statsData);

        // 写入缓存
        setCache(CACHE_KEY_SUGGESTIONS, {
          suggestions: suggestionsData,
          stats: statsData,
        });
      }
    } catch (error) {
      clientLogger.error({ error }, "[Reclassify] Fetch suggestions failed");
    }
  }, []);

  /**
   * 检查是否需要重分类（带缓存）
   */
  const checkReclassify = useCallback(async (skipCache = false) => {
    // 尝试从缓存读取
    if (!skipCache) {
      const cached = getCache<ReclassifyCheckResult>(CACHE_KEY_CHECK);
      if (cached) {
        setCheckResult(cached);
        return;
      }
    }

    setIsChecking(true);
    try {
      const response = await fetch("/api/reclassify/check");
      if (response.ok) {
        const data = await response.json();
        setCheckResult(data.data);
        // 写入缓存
        setCache(CACHE_KEY_CHECK, data.data);
      }
    } catch (error) {
      clientLogger.error({ error }, "[Reclassify] Check reclassify failed");
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * 执行重分类
   */
  const runReclassify = useCallback(
    async (forceRun = false) => {
      setIsRunning(true);
      try {
        const response = await fetch("/api/reclassify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRun }),
        });

        const data = await response.json();

        if (response.ok) {
          // 清除缓存，因为状态已变化
          clearCache();

          if (data.data.suggestionsCreated > 0) {
            toast.success(data.data.message, {
              icon: "🔄",
              description: "点击查看分类建议",
              action: {
                label: "查看",
                onClick: () => fetchSuggestions(true), // 跳过缓存
              },
            });
          } else {
            toast.info(data.data.message);
          }
          // 重新检查状态（跳过缓存）
          await checkReclassify(true);
        } else {
          toast.error(data.error?.message || "执行重分类失败");
        }
      } catch (error) {
        toast.error("执行重分类失败");
        clientLogger.error({ error }, "[Reclassify] Run reclassify failed");
      } finally {
        setIsRunning(false);
      }
    },
    [checkReclassify, fetchSuggestions],
  );

  /**
   * 批量接受建议
   */
  const acceptSuggestions = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;

      setIsProcessing(true);
      try {
        const response = await fetch("/api/reclassify/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", suggestionIds: ids }),
        });

        const data = await response.json();

        if (response.ok) {
          clearCache(); // 清除缓存
          toast.success(data.data.message, { icon: "✅" });
          await fetchSuggestions(true); // 跳过缓存
          router.refresh();
        } else {
          toast.error(data.error?.message || "接受建议失败");
        }
      } catch (error) {
        toast.error("接受建议失败");
        clientLogger.error({ error }, "[Reclassify] Accept suggestions failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchSuggestions, router],
  );

  /**
   * 批量拒绝建议
   */
  const rejectSuggestions = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;

      setIsProcessing(true);
      try {
        const response = await fetch("/api/reclassify/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject", suggestionIds: ids }),
        });

        const data = await response.json();

        if (response.ok) {
          clearCache(); // 清除缓存
          toast.info(data.data.message);
          await fetchSuggestions(true); // 跳过缓存
        } else {
          toast.error(data.error?.message || "拒绝建议失败");
        }
      } catch (error) {
        toast.error("拒绝建议失败");
        clientLogger.error({ error }, "[Reclassify] Reject suggestions failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchSuggestions],
  );

  /**
   * 接受所有建议
   */
  const acceptAllSuggestions = useCallback(async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/reclassify/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_all" }),
      });

      const data = await response.json();

      if (response.ok) {
        clearCache(); // 清除缓存
        toast.success(data.data.message, { icon: "✅" });
        await fetchSuggestions(true); // 跳过缓存
        router.refresh();
      } else {
        toast.error(data.error?.message || "接受全部建议失败");
      }
    } catch (error) {
      toast.error("接受全部建议失败");
      clientLogger.error(
        { error },
        "[Reclassify] Accept all suggestions failed",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [fetchSuggestions, router]);

  /**
   * 拒绝所有建议
   */
  const rejectAllSuggestions = useCallback(async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/reclassify/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_all" }),
      });

      const data = await response.json();

      if (response.ok) {
        clearCache(); // 清除缓存
        toast.info(data.data.message);
        await fetchSuggestions(true); // 跳过缓存
      } else {
        toast.error(data.error?.message || "拒绝全部建议失败");
      }
    } catch (error) {
      toast.error("拒绝全部建议失败");
      clientLogger.error(
        { error },
        "[Reclassify] Reject all suggestions failed",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [fetchSuggestions]);

  // 延迟初始化：先尝试缓存，3秒后才发起真正的 API 请求
  useEffect(() => {
    // 防止重复初始化
    if (initRef.current) return;
    initRef.current = true;

    // 立即尝试从缓存加载数据
    const cachedCheck = getCache<ReclassifyCheckResult>(CACHE_KEY_CHECK);
    const cachedSuggestions = getCache<{
      suggestions: SuggestionWithBookmark[];
      stats: typeof stats;
    }>(CACHE_KEY_SUGGESTIONS);

    if (cachedCheck) {
      setCheckResult(cachedCheck);
    }
    if (cachedSuggestions) {
      setSuggestions(cachedSuggestions.suggestions || []);
      setStats(
        cachedSuggestions.stats || {
          pending: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
        },
      );
    }

    // 如果缓存命中，不需要发起请求
    if (cachedCheck && cachedSuggestions) {
      return;
    }

    // 延迟 3 秒后发起 API 请求（不阻塞页面渲染）
    // 使用 Promise.all 并行请求，减少总延迟
    timeoutRef.current = setTimeout(() => {
      const promises: Promise<void>[] = [];
      if (!cachedCheck) {
        promises.push(checkReclassify(true)); // 跳过缓存检查，直接请求
      }
      if (!cachedSuggestions) {
        promises.push(fetchSuggestions(true)); // 跳过缓存检查，直接请求
      }
      // 并行执行所有请求
      Promise.all(promises).catch(() => {
        // 静默处理错误，各自的函数已有错误处理
      });
    }, INITIAL_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [checkReclassify, fetchSuggestions]);

  return {
    checkResult,
    suggestions,
    isChecking,
    isRunning,
    isProcessing,
    checkReclassify,
    runReclassify,
    fetchSuggestions,
    acceptSuggestions,
    rejectSuggestions,
    acceptAllSuggestions,
    rejectAllSuggestions,
    stats,
  };
}
