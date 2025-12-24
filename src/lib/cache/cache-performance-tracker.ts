/**
 * 缓存性能追踪器
 * V5.0: 专门追踪本地持久化缓存对 FCP 的改善效果
 *
 * 测量指标：
 * - 缓存恢复时间（localStorage → 内存）
 * - 首次渲染时间（有缓存 vs 无缓存）
 * - 后台刷新时间
 * - 缓存命中率
 */

import { logger } from "@/lib/logger";
import { clientLogger } from "@/lib/client-logger";

/**
 * 性能指标类型
 */
interface CachePerformanceMetrics {
  /** 缓存恢复时间 (ms) */
  cacheRestoreTime: number | null;
  /** 首次渲染时间 (ms) */
  timeToFirstRender: number | null;
  /** 后台刷新时间 (ms) */
  backgroundRefreshTime: number | null;
  /** 是否命中缓存 */
  cacheHit: boolean;
  /** 缓存条目数量 */
  cacheEntryCount: number;
  /** 时间戳 */
  timestamp: number;
  /** 页面路径 */
  pathname: string;
}

/**
 * 性能追踪会话
 */
interface TrackingSession {
  startTime: number;
  marks: Map<string, number>;
  metrics: Partial<CachePerformanceMetrics>;
}

/**
 * 缓存性能追踪器
 */
class CachePerformanceTracker {
  private sessions: Map<string, TrackingSession> = new Map();
  private metricsHistory: CachePerformanceMetrics[] = [];
  private readonly maxHistorySize = 100;
  private isEnabled: boolean;

  constructor() {
    // 仅在客户端且开发环境或启用了性能追踪时启用
    this.isEnabled =
      typeof window !== "undefined" &&
      (process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING === "true");
  }

  /**
   * 开始追踪会话
   */
  startSession(sessionId: string = "default"): void {
    if (!this.isEnabled) return;

    this.sessions.set(sessionId, {
      startTime: performance.now(),
      marks: new Map(),
      metrics: {
        timestamp: Date.now(),
        pathname: typeof window !== "undefined" ? window.location.pathname : "",
      },
    });

    this.mark(sessionId, "session_start");
  }

  /**
   * 记录时间点标记
   */
  mark(sessionId: string, markName: string): void {
    if (!this.isEnabled) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const elapsed = performance.now() - session.startTime;
    session.marks.set(markName, elapsed);

    if (process.env.NODE_ENV === "development") {
      clientLogger.debug(
        { sessionId, markName, elapsed: elapsed.toFixed(2) },
        "[CachePerf] Mark",
      );
    }
  }

  /**
   * 记录缓存恢复完成
   */
  markCacheRestored(
    sessionId: string,
    entryCount: number,
    cacheHit: boolean,
  ): void {
    if (!this.isEnabled) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.mark(sessionId, "cache_restored");

    const restoreTime = session.marks.get("cache_restored") || 0;
    session.metrics.cacheRestoreTime = restoreTime;
    session.metrics.cacheEntryCount = entryCount;
    session.metrics.cacheHit = cacheHit;

    if (process.env.NODE_ENV === "development") {
      clientLogger.debug(
        {
          cacheHit,
          entryCount,
          restoreTime: restoreTime.toFixed(2),
        },
        "[CachePerf] Cache restored",
      );
    }
  }

  /**
   * 记录首次渲染完成
   */
  markFirstRender(sessionId: string): void {
    if (!this.isEnabled) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.mark(sessionId, "first_render");

    const renderTime = session.marks.get("first_render") || 0;
    session.metrics.timeToFirstRender = renderTime;
  }

  /**
   * 记录后台刷新开始
   */
  markBackgroundRefreshStart(sessionId: string): void {
    if (!this.isEnabled) return;
    this.mark(sessionId, "background_refresh_start");
  }

  /**
   * 记录后台刷新完成
   */
  markBackgroundRefreshEnd(sessionId: string): void {
    if (!this.isEnabled) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.mark(sessionId, "background_refresh_end");

    const startTime = session.marks.get("background_refresh_start") || 0;
    const endTime = session.marks.get("background_refresh_end") || 0;
    session.metrics.backgroundRefreshTime = endTime - startTime;
  }

  /**
   * 结束会话并生成报告
   */
  endSession(sessionId: string = "default"): CachePerformanceMetrics | null {
    if (!this.isEnabled) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const metrics: CachePerformanceMetrics = {
      cacheRestoreTime: session.metrics.cacheRestoreTime ?? null,
      timeToFirstRender: session.metrics.timeToFirstRender ?? null,
      backgroundRefreshTime: session.metrics.backgroundRefreshTime ?? null,
      cacheHit: session.metrics.cacheHit ?? false,
      cacheEntryCount: session.metrics.cacheEntryCount ?? 0,
      timestamp: session.metrics.timestamp ?? Date.now(),
      pathname: session.metrics.pathname ?? "",
    };

    // 保存到历史记录
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // 输出报告
    this.logReport(sessionId, metrics);

    // 记录到日志系统
    logger.info(
      {
        type: "cache_performance",
        ...metrics,
      },
      "Cache performance metrics collected",
    );

    // 清理会话
    this.sessions.delete(sessionId);

    return metrics;
  }

  /**
   * 输出性能报告到控制台
   */
  private logReport(sessionId: string, metrics: CachePerformanceMetrics): void {
    if (process.env.NODE_ENV !== "development") return;

    const reportLines: string[] = [];
    reportLines.push(`📊 [CachePerf:${sessionId}] Performance Report`);
    reportLines.push(
      `Cache Hit: ${metrics.cacheHit ? "✅ YES" : "❌ NO"} (${metrics.cacheEntryCount} entries)`,
    );

    if (metrics.cacheRestoreTime !== null) {
      const rating = metrics.cacheRestoreTime < 50 ? "✅" : "⚠️";
      reportLines.push(
        `${rating} Cache Restore: ${metrics.cacheRestoreTime.toFixed(2)}ms`,
      );
    }

    if (metrics.timeToFirstRender !== null) {
      const rating = metrics.timeToFirstRender < 100 ? "✅" : "⚠️";
      reportLines.push(
        `${rating} Time to First Render: ${metrics.timeToFirstRender.toFixed(2)}ms`,
      );
    }

    if (metrics.backgroundRefreshTime !== null) {
      reportLines.push(
        `Background Refresh: ${metrics.backgroundRefreshTime.toFixed(2)}ms`,
      );
    }

    // FCP 改善估算
    if (metrics.cacheHit && metrics.timeToFirstRender !== null) {
      reportLines.push(
        `💡 Estimated FCP improvement: ~${(3000 - metrics.timeToFirstRender).toFixed(0)}ms faster than no-cache scenario`,
      );
    }

    clientLogger.info({ sessionId, metrics }, reportLines.join("\n"));
  }

  /**
   * 获取性能统计摘要
   */
  getStats(): {
    totalSessions: number;
    cacheHitRate: number;
    avgRestoreTime: number;
    avgFirstRenderTime: number;
    avgBackgroundRefreshTime: number;
  } {
    const history = this.metricsHistory;
    if (history.length === 0) {
      return {
        totalSessions: 0,
        cacheHitRate: 0,
        avgRestoreTime: 0,
        avgFirstRenderTime: 0,
        avgBackgroundRefreshTime: 0,
      };
    }

    const cacheHits = history.filter((m) => m.cacheHit).length;
    const restoreTimes = history
      .filter((m) => m.cacheRestoreTime !== null)
      .map((m) => m.cacheRestoreTime!);
    const renderTimes = history
      .filter((m) => m.timeToFirstRender !== null)
      .map((m) => m.timeToFirstRender!);
    const refreshTimes = history
      .filter((m) => m.backgroundRefreshTime !== null)
      .map((m) => m.backgroundRefreshTime!);

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      totalSessions: history.length,
      cacheHitRate: (cacheHits / history.length) * 100,
      avgRestoreTime: avg(restoreTimes),
      avgFirstRenderTime: avg(renderTimes),
      avgBackgroundRefreshTime: avg(refreshTimes),
    };
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }

  /**
   * 获取原始历史记录
   */
  getHistory(): CachePerformanceMetrics[] {
    return [...this.metricsHistory];
  }
}

// 导出单例实例
export const cachePerformanceTracker = new CachePerformanceTracker();

/**
 * React Hook: 使用缓存性能追踪
 *
 * @example
 * ```tsx
 * function HomePage() {
 *   const { trackCacheRestore, trackFirstRender } = useCachePerformance('home');
 *
 *   useEffect(() => {
 *     const cached = dataCache.getSync(cacheKey);
 *     trackCacheRestore(cached ? 1 : 0, !!cached);
 *   }, []);
 *
 *   useEffect(() => {
 *     if (data.length > 0) {
 *       trackFirstRender();
 *     }
 *   }, [data]);
 * }
 * ```
 */
export function useCachePerformanceTracking(sessionId: string) {
  return {
    startSession: () => cachePerformanceTracker.startSession(sessionId),
    trackCacheRestore: (entryCount: number, cacheHit: boolean) =>
      cachePerformanceTracker.markCacheRestored(
        sessionId,
        entryCount,
        cacheHit,
      ),
    trackFirstRender: () => cachePerformanceTracker.markFirstRender(sessionId),
    trackBackgroundRefreshStart: () =>
      cachePerformanceTracker.markBackgroundRefreshStart(sessionId),
    trackBackgroundRefreshEnd: () =>
      cachePerformanceTracker.markBackgroundRefreshEnd(sessionId),
    endSession: () => cachePerformanceTracker.endSession(sessionId),
    getStats: () => cachePerformanceTracker.getStats(),
  };
}
