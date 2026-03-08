"use client";

/**
 * Knowledge Studio - 素材健康度 Hook
 * @module hooks/domain/knowledge-studio
 * @description 管理素材健康度评分和分析
 */

import { useState, useCallback, useRef } from "react";
import { API_KNOWLEDGE_STUDIO } from "@/lib/constants/api-paths";
import type { MaterialQuality } from "@/lib/knowledge-studio";
import { getQualityLevel } from "@/lib/knowledge-studio/client";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

export interface MaterialHealthScore {
  /** 书签 ID */
  bookmarkId: string;
  /** 总分 (0-100) */
  totalScore: number;
  /** 质量等级 */
  quality: MaterialQuality;
  /** 各维度得分 */
  dimensions: {
    freshness: number;
    relevance: number;
    depth: number;
    credibility: number;
  };
  /** 改进建议 */
  suggestions: string[];
}

export interface UseMaterialHealthReturn {
  /** 健康度得分映射 */
  scores: Map<string, MaterialHealthScore>;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 分析素材健康度 */
  analyzeHealth: (bookmarkIds: string[]) => Promise<void>;
  /** 获取单个素材得分 */
  getScore: (bookmarkId: string) => MaterialHealthScore | undefined;
  /** 获取平均得分 */
  averageScore: number;
  /** 清除缓存 */
  clearCache: () => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useMaterialHealth(): UseMaterialHealthReturn {
  const [scores, setScores] = useState<Map<string, MaterialHealthScore>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于跟踪正在请求的书签 ID，避免重复请求
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  // 用于防抖的定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 用于节流的最后请求时间
  const lastRequestTimeRef = useRef<number>(0);
  // 最小请求间隔（毫秒）
  const MIN_REQUEST_INTERVAL = 1000; // 1秒

  // 分析素材健康度（带重试机制）
  const analyzeHealthWithRetry = useCallback(
    async (
      bookmarkIds: string[],
      retryCount = 0,
      maxRetries = 2,
    ): Promise<void> => {
      try {
        const response = await fetch(API_KNOWLEDGE_STUDIO.materials, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkIds }),
        });

        if (!response.ok) {
          // 处理 429 错误：自动重试
          if (response.status === 429) {
            if (retryCount < maxRetries) {
              // 计算重试延迟：指数退避（1s, 2s, 4s）
              const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              return analyzeHealthWithRetry(
                bookmarkIds,
                retryCount + 1,
                maxRetries,
              );
            }
            throw new Error("请求过于频繁，请稍后再试");
          }

          // 尝试解析错误响应
          let errorMessage = "分析失败";
          try {
            const errorData = await response.json();
            errorMessage =
              errorData.error?.message || errorData.message || errorMessage;
            // 如果是 400 错误，记录详细信息
            if (response.status === 400 && errorData.error?.details) {
              clientLogger.error(
                { details: errorData.error.details },
                "Request validation errors:",
              );
            }
          } catch {
            // 如果无法解析错误响应，使用状态文本
            errorMessage = `${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        // 合并新评分到现有评分中
        setScores((prevScores) => {
          const newScores = new Map(prevScores);

          // API 返回的数据结构: result.data.scores
          if (result.data?.scores && Array.isArray(result.data.scores)) {
            for (const item of result.data.scores) {
              const overallScore = item.overallScore || 0;
              const quality = item.quality || getQualityLevel(overallScore);
              newScores.set(item.bookmarkId, {
                bookmarkId: item.bookmarkId,
                totalScore: overallScore,
                quality,
                dimensions: item.dimensions || {
                  freshness: 0,
                  relevance: 0,
                  depth: 0,
                  credibility: 0,
                },
                suggestions: item.recommendations || [],
              });
            }
          }

          return newScores;
        });
      } catch (err) {
        if (
          retryCount < maxRetries &&
          err instanceof Error &&
          err.message.includes("请求过于频繁")
        ) {
          // 如果是 429 错误且还有重试次数，继续重试
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return analyzeHealthWithRetry(
            bookmarkIds,
            retryCount + 1,
            maxRetries,
          );
        }
        throw err;
      }
    },
    [],
  );

  // 分析素材健康度
  const analyzeHealth = useCallback(
    async (bookmarkIds: string[]) => {
      if (bookmarkIds.length === 0) return;

      // 清除之前的防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 防抖：延迟 500ms 执行（从 300ms 增加到 500ms）
      return new Promise<void>((resolve) => {
        debounceTimerRef.current = setTimeout(async () => {
          // 节流：检查距离上次请求的时间
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestTimeRef.current;

          if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            // 如果距离上次请求时间太短，延迟执行
            const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          // 使用函数式更新来获取最新的 scores，避免依赖 scores
          let idsToAnalyze: string[] = [];

          setScores((prevScores) => {
            // 过滤掉已经有评分的书签和正在请求的书签
            const existingIds = new Set(prevScores.keys());
            const pendingIds = pendingRequestsRef.current;
            idsToAnalyze = bookmarkIds.filter(
              (id) => !existingIds.has(id) && !pendingIds.has(id),
            );
            return prevScores;
          });

          if (idsToAnalyze.length === 0) {
            resolve();
            return;
          }

          // 标记为正在请求
          idsToAnalyze.forEach((id) => pendingRequestsRef.current.add(id));
          lastRequestTimeRef.current = Date.now();

          setIsLoading(true);
          setError(null);

          try {
            // 验证 IDs 不为空且都是有效字符串
            if (idsToAnalyze.length === 0) {
              resolve();
              return;
            }

            const validIds = idsToAnalyze.filter(
              (id) => typeof id === "string" && id.trim() !== "",
            );

            if (validIds.length === 0) {
              throw new Error("没有有效的书签 ID");
            }

            if (validIds.length !== idsToAnalyze.length) {
              console.info(
                `过滤了 ${idsToAnalyze.length - validIds.length} 个无效的书签 ID`,
              );
            }

            await analyzeHealthWithRetry(validIds);
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : "分析失败";
            setError(errorMessage);
            clientLogger.error({ err }, "Material health analysis error:");
          } finally {
            // 清除正在请求的标记
            idsToAnalyze.forEach((id) => pendingRequestsRef.current.delete(id));
            setIsLoading(false);
            resolve();
          }
        }, 500); // 防抖时间从 300ms 增加到 500ms
      });
    },
    [analyzeHealthWithRetry],
  );

  // 获取单个素材得分
  const getScore = useCallback(
    (bookmarkId: string): MaterialHealthScore | undefined => {
      return scores.get(bookmarkId);
    },
    [scores],
  );

  // 计算平均得分
  const averageScore =
    scores.size > 0
      ? Math.round(
          Array.from(scores.values()).reduce(
            (sum, s) => sum + s.totalScore,
            0,
          ) / scores.size,
        )
      : 0;

  // 清除缓存
  const clearCache = useCallback(() => {
    setScores(new Map());
    setError(null);
  }, []);

  return {
    scores,
    isLoading,
    error,
    analyzeHealth,
    getScore,
    averageScore,
    clearCache,
  };
}
