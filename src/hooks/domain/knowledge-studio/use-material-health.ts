"use client";

/**
 * Knowledge Studio - 素材健康度 Hook
 * @module hooks/domain/knowledge-studio
 * @description 管理素材健康度评分和分析
 */

import { useState, useCallback } from "react";
import type { MaterialQuality } from "@/lib/knowledge-studio";
import { getQualityLevel } from "@/lib/knowledge-studio/client";

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

  // 分析素材健康度
  const analyzeHealth = useCallback(
    async (bookmarkIds: string[]) => {
      if (bookmarkIds.length === 0) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/knowledge-studio/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "分析失败");
        }

        const result = await response.json();
        const newScores = new Map<string, MaterialHealthScore>();

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

        setScores(newScores);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "分析失败";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },

    [],
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
