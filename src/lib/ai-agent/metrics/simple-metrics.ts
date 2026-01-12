/**
 * 简单指标收集 - 用于后续优化决策
 *
 * 设计原则：
 * 1. 内存存储，轻量级
 * 2. 周期性汇总和导出
 * 3. 驱动架构升级决策
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { logger } from "@/lib/logger";

const log = logger.child({ namespace: "ai-metrics" });

/**
 * 指标数据结构
 */
export interface AIMetrics {
  // ============================================
  // L0 规则指标
  // ============================================
  /** L0 命中次数 */
  l0HitCount: number;
  /** L0 未命中次数 */
  l0MissCount: number;

  // ============================================
  // 缓存指标
  // ============================================
  /** 查询缓存命中次数 */
  queryCacheHitCount: number;
  /** 查询缓存未命中次数 */
  queryCacheMissCount: number;
  /** 意图缓存命中次数 */
  intentCacheHitCount: number;
  /** 意图缓存未命中次数 */
  intentCacheMissCount: number;

  // ============================================
  // 槽位指标
  // ============================================
  /** 参数完整次数 */
  slotCompleteCount: number;
  /** 参数缺失次数 */
  slotMissingCount: number;

  // ============================================
  // 执行模式指标
  // ============================================
  /** 原子模式执行次数 */
  atomicModeCount: number;
  /** 编排模式执行次数 */
  orchestrationModeCount: number;
  /** 工作流模式执行次数 */
  workflowModeCount: number;
  /** 编排回退到原子次数 */
  fallbackCount: number;

  // ============================================
  // 性能指标
  // ============================================
  /** 总响应时间（毫秒） */
  totalResponseTimeMs: number;
  /** 请求总数 */
  totalRequestCount: number;

  // ============================================
  // 撤销指标
  // ============================================
  /** 撤销操作次数 */
  undoCount: number;

  // ============================================
  // 错误指标
  // ============================================
  /** 错误总数 */
  errorCount: number;
  /** 超时次数 */
  timeoutCount: number;
}

/**
 * 指标报告
 */
export interface MetricsReport extends AIMetrics {
  // 计算指标
  /** L0 命中率 */
  l0HitRate: number;
  /** 查询缓存命中率 */
  queryCacheHitRate: number;
  /** 意图缓存命中率 */
  intentCacheHitRate: number;
  /** 参数缺失率 */
  slotMissingRate: number;
  /** 平均响应时间（毫秒） */
  avgResponseTimeMs: number;
  /** 编排模式占比 */
  orchestrationModeRate: number;
  /** 错误率 */
  errorRate: number;
  /** 报告生成时间 */
  generatedAt: string;
  /** 统计周期开始时间 */
  periodStart: string;
}

/**
 * 升级触发条件
 */
export interface UpgradeTriggers {
  /** 是否需要增加 L0 规则（L0 命中率 < 50%） */
  needMoreL0Rules: boolean;
  /** 是否需要语义缓存（精确缓存命中率 < 30%） */
  needSemanticCache: boolean;
  /** 是否需要精确匹配缓存（重复请求 > 20%） */
  needExactMatchCache: boolean;
  /** 是否需要槽位提示（参数缺失率 > 10%） */
  needSlotPrompt: boolean;
  /** 是否需要 DAG 引擎（编排模式 > 5%） */
  needDAGEngine: boolean;
}

/**
 * 简单指标收集器
 */
class SimpleMetrics {
  private metrics: AIMetrics = this.createEmptyMetrics();
  private periodStart: Date = new Date();

  /**
   * 创建空指标对象
   */
  private createEmptyMetrics(): AIMetrics {
    return {
      l0HitCount: 0,
      l0MissCount: 0,
      queryCacheHitCount: 0,
      queryCacheMissCount: 0,
      intentCacheHitCount: 0,
      intentCacheMissCount: 0,
      slotCompleteCount: 0,
      slotMissingCount: 0,
      atomicModeCount: 0,
      orchestrationModeCount: 0,
      workflowModeCount: 0,
      fallbackCount: 0,
      totalResponseTimeMs: 0,
      totalRequestCount: 0,
      undoCount: 0,
      errorCount: 0,
      timeoutCount: 0,
    };
  }

  // ============================================
  // 记录方法
  // ============================================

  /** 记录 L0 命中 */
  recordL0Hit(): void {
    this.metrics.l0HitCount++;
  }

  /** 记录 L0 未命中 */
  recordL0Miss(): void {
    this.metrics.l0MissCount++;
  }

  /** 记录查询缓存命中 */
  recordQueryCacheHit(): void {
    this.metrics.queryCacheHitCount++;
  }

  /** 记录查询缓存未命中 */
  recordQueryCacheMiss(): void {
    this.metrics.queryCacheMissCount++;
  }

  /** 记录意图缓存命中 */
  recordIntentCacheHit(): void {
    this.metrics.intentCacheHitCount++;
  }

  /** 记录意图缓存未命中 */
  recordIntentCacheMiss(): void {
    this.metrics.intentCacheMissCount++;
  }

  /** 记录参数完整 */
  recordSlotComplete(): void {
    this.metrics.slotCompleteCount++;
  }

  /** 记录参数缺失 */
  recordSlotMissing(): void {
    this.metrics.slotMissingCount++;
  }

  /** 记录原子模式执行 */
  recordAtomicMode(): void {
    this.metrics.atomicModeCount++;
  }

  /** 记录编排模式执行 */
  recordOrchestrationMode(): void {
    this.metrics.orchestrationModeCount++;
  }

  /** 记录工作流模式执行 */
  recordWorkflowMode(): void {
    this.metrics.workflowModeCount++;
  }

  /** 记录回退 */
  recordFallback(): void {
    this.metrics.fallbackCount++;
  }

  /** 记录响应时间 */
  recordResponseTime(durationMs: number): void {
    this.metrics.totalResponseTimeMs += durationMs;
    this.metrics.totalRequestCount++;
  }

  /** 记录撤销 */
  recordUndo(): void {
    this.metrics.undoCount++;
  }

  /** 记录错误 */
  recordError(): void {
    this.metrics.errorCount++;
  }

  /** 记录超时 */
  recordTimeout(): void {
    this.metrics.timeoutCount++;
  }

  // ============================================
  // 计算方法
  // ============================================

  /** 获取 L0 命中率 */
  getL0HitRate(): number {
    const total = this.metrics.l0HitCount + this.metrics.l0MissCount;
    return total > 0 ? this.metrics.l0HitCount / total : 0;
  }

  /** 获取查询缓存命中率 */
  getQueryCacheHitRate(): number {
    const total =
      this.metrics.queryCacheHitCount + this.metrics.queryCacheMissCount;
    return total > 0 ? this.metrics.queryCacheHitCount / total : 0;
  }

  /** 获取意图缓存命中率 */
  getIntentCacheHitRate(): number {
    const total =
      this.metrics.intentCacheHitCount + this.metrics.intentCacheMissCount;
    return total > 0 ? this.metrics.intentCacheHitCount / total : 0;
  }

  /** 获取参数缺失率 */
  getSlotMissingRate(): number {
    const total =
      this.metrics.slotCompleteCount + this.metrics.slotMissingCount;
    return total > 0 ? this.metrics.slotMissingCount / total : 0;
  }

  /** 获取平均响应时间 */
  getAvgResponseTimeMs(): number {
    return this.metrics.totalRequestCount > 0
      ? this.metrics.totalResponseTimeMs / this.metrics.totalRequestCount
      : 0;
  }

  /** 获取编排模式占比 */
  getOrchestrationModeRate(): number {
    const total =
      this.metrics.atomicModeCount +
      this.metrics.orchestrationModeCount +
      this.metrics.workflowModeCount;
    return total > 0 ? this.metrics.orchestrationModeCount / total : 0;
  }

  /** 获取错误率 */
  getErrorRate(): number {
    return this.metrics.totalRequestCount > 0
      ? this.metrics.errorCount / this.metrics.totalRequestCount
      : 0;
  }

  // ============================================
  // 报告方法
  // ============================================

  /**
   * 获取完整报告
   */
  getReport(): MetricsReport {
    return {
      ...this.metrics,
      l0HitRate: this.getL0HitRate(),
      queryCacheHitRate: this.getQueryCacheHitRate(),
      intentCacheHitRate: this.getIntentCacheHitRate(),
      slotMissingRate: this.getSlotMissingRate(),
      avgResponseTimeMs: this.getAvgResponseTimeMs(),
      orchestrationModeRate: this.getOrchestrationModeRate(),
      errorRate: this.getErrorRate(),
      generatedAt: new Date().toISOString(),
      periodStart: this.periodStart.toISOString(),
    };
  }

  /**
   * 获取升级触发条件
   */
  getUpgradeTriggers(): UpgradeTriggers {
    const l0HitRate = this.getL0HitRate();
    const queryCacheHitRate = this.getQueryCacheHitRate();
    const slotMissingRate = this.getSlotMissingRate();
    const orchestrationModeRate = this.getOrchestrationModeRate();

    // 计算重复请求率（近似：缓存命中 / 总请求）
    const totalCacheAttempts =
      this.metrics.queryCacheHitCount + this.metrics.queryCacheMissCount;
    const repeatRequestRate =
      totalCacheAttempts > 0
        ? this.metrics.queryCacheHitCount / totalCacheAttempts
        : 0;

    return {
      needMoreL0Rules: l0HitRate < 0.5 && this.metrics.l0HitCount > 100,
      needSemanticCache: queryCacheHitRate < 0.3 && totalCacheAttempts > 100,
      needExactMatchCache:
        repeatRequestRate > 0.2 && this.metrics.totalRequestCount > 100,
      needSlotPrompt:
        slotMissingRate > 0.1 && this.metrics.slotMissingCount > 20,
      needDAGEngine:
        orchestrationModeRate > 0.05 &&
        this.metrics.orchestrationModeCount > 10,
    };
  }

  /**
   * 打印报告到日志
   */
  logReport(): void {
    const report = this.getReport();
    const triggers = this.getUpgradeTriggers();

    log.info(
      {
        report: {
          l0HitRate: `${(report.l0HitRate * 100).toFixed(1)}%`,
          queryCacheHitRate: `${(report.queryCacheHitRate * 100).toFixed(1)}%`,
          slotMissingRate: `${(report.slotMissingRate * 100).toFixed(1)}%`,
          avgResponseTimeMs: report.avgResponseTimeMs.toFixed(0),
          totalRequests: report.totalRequestCount,
          errorRate: `${(report.errorRate * 100).toFixed(1)}%`,
        },
        triggers,
      },
      "AI Metrics Report",
    );
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.periodStart = new Date();
    log.info("Metrics reset");
  }

  /**
   * 获取原始指标
   */
  getRawMetrics(): AIMetrics {
    return { ...this.metrics };
  }
}

// ============================================
// 导出单例
// ============================================

export const aiMetrics = new SimpleMetrics();

// 导出类以便测试
export { SimpleMetrics };
