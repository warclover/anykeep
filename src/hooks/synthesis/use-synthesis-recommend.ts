/**
 * 综述推荐 Hook
 *
 * 管理综述推荐的获取、显示控制和用户偏好
 *
 * @version 1.1.0
 * @since 2025-12-29
 * @updated 2026-02-01 - 添加请求去重机制
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import type {
  RecommendedTopic,
  SynthesisRecommendPreferences,
  SynthesisRecommendResponse,
} from "@/lib/synthesis/types/recommend";
import { RECOMMEND_LIMITS } from "@/lib/synthesis/types/recommend";
import { requestDeduplicator } from "@/lib/utils/request-deduplicator";

interface UseSynthesisRecommendResult {
  /** 当前推荐 (用于气泡显示) */
  currentRecommend: RecommendedTopic | null;
  /** 所有推荐列表 */
  recommendations: RecommendedTopic[];
  /** 用户偏好 */
  preferences: SynthesisRecommendPreferences | null;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否应该显示气泡 */
  shouldShowBubble: boolean;
  /** 接受推荐 */
  acceptRecommend: (topic: RecommendedTopic) => void;
  /** 忽略当前推荐 */
  dismissRecommend: (neverShowAgain?: boolean) => Promise<void>;
  /** 关闭气泡 */
  closeBubble: () => void;
  /** 切换推荐开关 */
  toggleEnabled: (enabled: boolean) => Promise<void>;
  /** 刷新推荐 */
  refresh: () => Promise<void>;
}

interface UseSynthesisRecommendOptions {
  /** 是否自动获取推荐 */
  autoFetch?: boolean;
  /** 是否自动显示气泡 */
  autoShowBubble?: boolean;
}

export function useSynthesisRecommend(
  options: UseSynthesisRecommendOptions = {},
): UseSynthesisRecommendResult {
  const { autoFetch = true, autoShowBubble = true } = options;

  const [recommendations, setRecommendations] = useState<RecommendedTopic[]>(
    [],
  );
  const [preferences, setPreferences] =
    useState<SynthesisRecommendPreferences | null>(null);
  const [currentRecommend, setCurrentRecommend] =
    useState<RecommendedTopic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldShowBubble, setShouldShowBubble] = useState(false);

  // 用于防止重复触发的 ref
  const hasShownRef = useRef(false);
  const fetchingRef = useRef(false);

  /**
   * 获取推荐列表
   */
  const fetchRecommendations = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // 使用请求去重器，防止并发重复请求
      const data = await requestDeduplicator.dedupe(
        API_SYNTHESIS.recommend,
        async () => {
          const response = await fetch(API_SYNTHESIS.recommend);
          if (!response.ok) {
            throw new Error("Failed to fetch recommendations");
          }
          return response.json() as Promise<SynthesisRecommendResponse>;
        },
      );

      if (data.success) {
        setRecommendations(data.data.recommendations);
        if (data.data.preferences) {
          setPreferences(data.data.preferences);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取推荐失败");
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  /**
   * 检查是否应该显示气泡
   */
  const checkShouldShowBubble = useCallback(() => {
    // 已经显示过了
    if (hasShownRef.current) return false;

    // 功能未启用
    if (!preferences?.enabled) return false;

    // 没有推荐
    if (recommendations.length === 0) return false;

    // 检查每日显示次数限制
    const today = new Date().toISOString().split("T")[0];
    if (
      preferences.dailyShowDate === today &&
      preferences.dailyShowCount >= RECOMMEND_LIMITS.MAX_DAILY_SHOWS
    ) {
      return false;
    }

    // 检查显示间隔
    if (preferences.lastShownAt) {
      const lastShown = new Date(preferences.lastShownAt).getTime();
      const now = Date.now();
      if (now - lastShown < RECOMMEND_LIMITS.MIN_SHOW_INTERVAL) {
        return false;
      }
    }

    // 过滤已忽略的主题
    const availableRecommends = recommendations.filter(
      (r) => !preferences.dismissedTopics.includes(r.id),
    );

    if (availableRecommends.length === 0) return false;

    return true;
  }, [preferences, recommendations]);

  /**
   * 显示气泡
   */
  const showBubble = useCallback(async () => {
    if (!checkShouldShowBubble()) return;

    // 过滤已忽略的主题
    const availableRecommends = recommendations.filter(
      (r) => !preferences?.dismissedTopics.includes(r.id),
    );

    if (availableRecommends.length === 0) return;

    // 选择相关性最高的推荐
    const topRecommend = availableRecommends[0];
    setCurrentRecommend(topRecommend);
    setShouldShowBubble(true);
    hasShownRef.current = true;

    // 更新显示计数
    try {
      await fetch(API_SYNTHESIS.recommendShown, {
        method: "POST",
      });
    } catch {
      // 忽略更新失败
    }
  }, [checkShouldShowBubble, recommendations, preferences]);

  /**
   * 接受推荐
   */
  const acceptRecommend = useCallback((topic: RecommendedTopic) => {
    setShouldShowBubble(false);
    setCurrentRecommend(null);

    // 导航到综述创建页
    const params = new URLSearchParams({
      sourceType: topic.sourceType,
    });

    if (topic.sourceId) {
      if (topic.sourceType === "tag") {
        params.set("tag", topic.sourceId);
      } else if (topic.sourceType === "folder") {
        params.set("folderId", topic.sourceId);
      }
    }

    window.location.href = `/synthesis/new?${params.toString()}`;
  }, []);

  /**
   * 忽略推荐
   */
  const dismissRecommend = useCallback(
    async (neverShowAgain = false) => {
      setShouldShowBubble(false);

      if (neverShowAgain && currentRecommend) {
        try {
          await fetch(API_SYNTHESIS.recommendDismiss, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topicId: currentRecommend.id }),
          });

          // 更新本地状态
          if (preferences) {
            setPreferences({
              ...preferences,
              dismissedTopics: [
                ...preferences.dismissedTopics,
                currentRecommend.id,
              ],
            });
          }
        } catch {
          // 忽略错误
        }
      }

      setCurrentRecommend(null);
    },
    [currentRecommend, preferences],
  );

  /**
   * 关闭气泡
   */
  const closeBubble = useCallback(() => {
    setShouldShowBubble(false);
    setCurrentRecommend(null);
  }, []);

  /**
   * 切换启用状态
   */
  const toggleEnabled = useCallback(async (enabled: boolean) => {
    try {
      const response = await fetch(API_SYNTHESIS.recommendPreferences, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setPreferences((prev) => (prev ? { ...prev, enabled } : null));
      }
    } catch {
      // 忽略错误
    }
  }, []);

  /**
   * 刷新推荐
   */
  const refresh = useCallback(async () => {
    hasShownRef.current = false;
    await fetchRecommendations();
  }, [fetchRecommendations]);

  // 自动获取推荐
  useEffect(() => {
    if (autoFetch) {
      fetchRecommendations();
    }
  }, [autoFetch, fetchRecommendations]);

  // 自动显示气泡
  useEffect(() => {
    if (autoShowBubble && !isLoading && recommendations.length > 0) {
      // 延迟显示，让用户先看到页面内容
      const timer = setTimeout(() => {
        showBubble();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [autoShowBubble, isLoading, recommendations.length, showBubble]);

  return {
    currentRecommend,
    recommendations,
    preferences,
    isLoading,
    error,
    shouldShowBubble,
    acceptRecommend,
    dismissRecommend,
    closeBubble,
    toggleEnabled,
    refresh,
  };
}
