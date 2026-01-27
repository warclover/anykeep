/**
 * 智能分类 v5.0 - 监控指标系统
 *
 * 功能：
 * 1. 分类性能指标（延迟、成功率、T1使用率）
 * 2. 准确性指标（用户纠正率、置信度分布）
 * 3. 系统健康指标（错误率、超时率）
 * 4. 对比指标（v4 vs v5）
 */

import type { LoggerService } from "../shared/logger";

/**
 * 分类指标
 */
export interface ClassificationMetrics {
  /** 总分类次数 */
  totalClassifications: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均延迟（毫秒） */
  avgLatencyMs: number;
  /** P50 延迟 */
  p50LatencyMs: number;
  /** P95 延迟 */
  p95LatencyMs: number;
  /** P99 延迟 */
  p99LatencyMs: number;
  /** T1 使用次数 */
  t1UsedCount: number;
  /** T1 使用率 */
  t1UsageRate: number;
  /** 平均置信度 */
  avgConfidence: number;
  /** 用户纠正次数 */
  userCorrectionCount: number;
  /** 用户纠正率 */
  userCorrectionRate: number;
}

/**
 * 系统健康指标
 */
export interface HealthMetrics {
  /** 错误率 */
  errorRate: number;
  /** 超时率 */
  timeoutRate: number;
  /** 向量搜索失败率 */
  vectorSearchFailureRate: number;
  /** LLM 调用失败率 */
  llmCallFailureRate: number;
  /** 数据库错误率 */
  databaseErrorRate: number;
}

/**
 * 对比指标（v4 vs v5）
 */
export interface ComparisonMetrics {
  /** v4 平均延迟 */
  v4AvgLatencyMs: number;
  /** v5 平均延迟 */
  v5AvgLatencyMs: number;
  /** 延迟改进百分比 */
  latencyImprovement: number;
  /** v4 准确率 */
  v4Accuracy: number;
  /** v5 准确率 */
  v5Accuracy: number;
  /** 准确率改进百分比 */
  accuracyImprovement: number;
}

/**
 * 监控报告
 */
export interface MonitoringReport {
  /** 时间范围 */
  timeRange: {
    start: string;
    end: string;
  };
  /** 分类指标 */
  classification: ClassificationMetrics;
  /** 健康指标 */
  health: HealthMetrics;
  /** 对比指标 */
  comparison?: ComparisonMetrics;
  /** 告警列表 */
  alerts: Alert[];
}

/**
 * 告警
 */
export interface Alert {
  /** 告警级别 */
  level: "info" | "warning" | "critical";
  /** 告警类型 */
  type: string;
  /** 告警消息 */
  message: string;
  /** 触发时间 */
  timestamp: string;
  /** 相关指标 */
  metrics?: Record<string, number>;
}

/**
 * 告警阈值配置
 */
interface AlertThresholds {
  /** 错误率阈值（%） */
  errorRate: {
    warning: number;
    critical: number;
  };
  /** 延迟阈值（毫秒） */
  latency: {
    warning: number;
    critical: number;
  };
  /** 用户纠正率阈值（%） */
  correctionRate: {
    warning: number;
    critical: number;
  };
  /** T1 使用率阈值（%） */
  t1UsageRate: {
    warning: number;
    critical: number;
  };
}

/**
 * 默认告警阈值
 */
const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRate: {
    warning: 5, // 5% 错误率警告
    critical: 10, // 10% 错误率严重
  },
  latency: {
    warning: 1000, // 1s 延迟警告
    critical: 2000, // 2s 延迟严重
  },
  correctionRate: {
    warning: 20, // 20% 纠正率警告
    critical: 30, // 30% 纠正率严重
  },
  t1UsageRate: {
    warning: 40, // 40% T1 使用率警告
    critical: 60, // 60% T1 使用率严重
  },
};

/**
 * 监控服务
 */
export class MonitoringService {
  private logger: LoggerService;
  private thresholds: AlertThresholds;

  constructor(logger: LoggerService, thresholds?: Partial<AlertThresholds>) {
    this.logger = logger.child({ service: "MonitoringService" });
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds,
    };
  }

  /**
   * 生成监控报告
   */
  async generateReport(
    startTime: Date,
    endTime: Date,
  ): Promise<MonitoringReport> {
    this.logger.info("生成监控报告", {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    // 1. 收集分类指标
    const classification = await this.collectClassificationMetrics(
      startTime,
      endTime,
    );

    // 2. 收集健康指标
    const health = await this.collectHealthMetrics(startTime, endTime);

    // 3. 收集对比指标（如果有 v4 数据）
    const comparison = await this.collectComparisonMetrics(startTime, endTime);

    // 4. 生成告警
    const alerts = this.generateAlerts(classification, health);

    return {
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
      classification,
      health,
      comparison,
      alerts,
    };
  }

  /**
   * 收集分类指标
   * v6.4: 实现真实数据库查询，替换模拟数据
   */
  private async collectClassificationMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<ClassificationMetrics> {
    try {
      // 动态导入 Supabase 客户端（避免循环依赖）
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      // 查询分类日志统计
      const { data: statsData, error: statsError } = await supabase
        .from("classification_logs")
        .select("id, latency_ms, confidence, used_t1, user_corrected")
        .gte("created_at", startTime.toISOString())
        .lte("created_at", endTime.toISOString());

      if (statsError || !statsData) {
        this.logger.warn("无法查询分类日志，使用降级数据", {
          error: statsError?.message,
        });
        return this.getFallbackClassificationMetrics();
      }

      const totalClassifications = statsData.length;
      if (totalClassifications === 0) {
        return this.getEmptyClassificationMetrics();
      }

      // 计算各项指标
      const latencies = statsData
        .map((r) => r.latency_ms)
        .filter((l): l is number => l !== null)
        .sort((a, b) => a - b);

      const successCount = statsData.filter(
        (r) => r.confidence !== null && r.confidence > 0,
      ).length;
      const t1UsedCount = statsData.filter((r) => r.used_t1 === true).length;
      const userCorrectionCount = statsData.filter(
        (r) => r.user_corrected === true,
      ).length;

      const confidences = statsData
        .map((r) => r.confidence)
        .filter((c): c is number => c !== null);
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

      return {
        totalClassifications,
        successCount,
        failureCount: totalClassifications - successCount,
        avgLatencyMs: this.calculateAverage(latencies),
        p50LatencyMs: this.calculatePercentile(latencies, 50),
        p95LatencyMs: this.calculatePercentile(latencies, 95),
        p99LatencyMs: this.calculatePercentile(latencies, 99),
        t1UsedCount,
        t1UsageRate:
          totalClassifications > 0
            ? (t1UsedCount / totalClassifications) * 100
            : 0,
        avgConfidence,
        userCorrectionCount,
        userCorrectionRate:
          totalClassifications > 0
            ? (userCorrectionCount / totalClassifications) * 100
            : 0,
      };
    } catch (error) {
      this.logger.error("收集分类指标失败", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getFallbackClassificationMetrics();
    }
  }

  /**
   * 获取空指标（无数据时）
   */
  private getEmptyClassificationMetrics(): ClassificationMetrics {
    return {
      totalClassifications: 0,
      successCount: 0,
      failureCount: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      t1UsedCount: 0,
      t1UsageRate: 0,
      avgConfidence: 0,
      userCorrectionCount: 0,
      userCorrectionRate: 0,
    };
  }

  /**
   * 获取降级指标（查询失败时的合理默认值）
   */
  private getFallbackClassificationMetrics(): ClassificationMetrics {
    return {
      totalClassifications: -1, // -1 表示数据不可用
      successCount: -1,
      failureCount: -1,
      avgLatencyMs: -1,
      p50LatencyMs: -1,
      p95LatencyMs: -1,
      p99LatencyMs: -1,
      t1UsedCount: -1,
      t1UsageRate: -1,
      avgConfidence: -1,
      userCorrectionCount: -1,
      userCorrectionRate: -1,
    };
  }

  /**
   * 收集健康指标
   * v6.4: 实现真实数据库查询
   */
  private async collectHealthMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<HealthMetrics> {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      // 查询错误日志统计
      const { data: errorData, error: errorQueryError } = await supabase
        .from("classification_logs")
        .select("id, error_type")
        .gte("created_at", startTime.toISOString())
        .lte("created_at", endTime.toISOString())
        .not("error_type", "is", null);

      const { count: totalCount } = await supabase
        .from("classification_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startTime.toISOString())
        .lte("created_at", endTime.toISOString());

      if (errorQueryError || totalCount === null || totalCount === 0) {
        return this.getFallbackHealthMetrics();
      }

      const errors = errorData || [];
      const errorCount = errors.length;
      const timeoutCount = errors.filter(
        (e) => e.error_type === "timeout",
      ).length;
      const vectorSearchFailures = errors.filter(
        (e) => e.error_type === "vector_search",
      ).length;
      const llmFailures = errors.filter(
        (e) => e.error_type === "llm_call",
      ).length;
      const dbErrors = errors.filter((e) => e.error_type === "database").length;

      return {
        errorRate: (errorCount / totalCount) * 100,
        timeoutRate: (timeoutCount / totalCount) * 100,
        vectorSearchFailureRate: (vectorSearchFailures / totalCount) * 100,
        llmCallFailureRate: (llmFailures / totalCount) * 100,
        databaseErrorRate: (dbErrors / totalCount) * 100,
      };
    } catch (error) {
      this.logger.error("收集健康指标失败", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getFallbackHealthMetrics();
    }
  }

  /**
   * 获取降级健康指标
   */
  private getFallbackHealthMetrics(): HealthMetrics {
    return {
      errorRate: -1,
      timeoutRate: -1,
      vectorSearchFailureRate: -1,
      llmCallFailureRate: -1,
      databaseErrorRate: -1,
    };
  }

  /**
   * 收集对比指标
   * v6.4: 实现真实数据库查询
   */
  private async collectComparisonMetrics(
    startTime: Date,
    endTime: Date,
  ): Promise<ComparisonMetrics | undefined> {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      // 查询 V4.1 和 V5.0 的分类数据
      const { data: v4Data } = await supabase
        .from("classification_logs")
        .select("latency_ms, user_corrected")
        .eq("version", "v4.1")
        .gte("created_at", startTime.toISOString())
        .lte("created_at", endTime.toISOString());

      const { data: v5Data } = await supabase
        .from("classification_logs")
        .select("latency_ms, user_corrected")
        .eq("version", "v5.0")
        .gte("created_at", startTime.toISOString())
        .lte("created_at", endTime.toISOString());

      // 如果没有对比数据，返回 undefined
      if (!v4Data?.length || !v5Data?.length) {
        return undefined;
      }

      const v4Latencies = v4Data
        .map((r) => r.latency_ms)
        .filter((l): l is number => l !== null);
      const v5Latencies = v5Data
        .map((r) => r.latency_ms)
        .filter((l): l is number => l !== null);

      const v4AvgLatencyMs = this.calculateAverage(v4Latencies);
      const v5AvgLatencyMs = this.calculateAverage(v5Latencies);

      // 计算准确率（未被用户纠正的比例）
      const v4Accuracy =
        ((v4Data.length -
          v4Data.filter((r) => r.user_corrected === true).length) /
          v4Data.length) *
        100;
      const v5Accuracy =
        ((v5Data.length -
          v5Data.filter((r) => r.user_corrected === true).length) /
          v5Data.length) *
        100;

      return {
        v4AvgLatencyMs,
        v5AvgLatencyMs,
        latencyImprovement:
          v4AvgLatencyMs > 0
            ? ((v4AvgLatencyMs - v5AvgLatencyMs) / v4AvgLatencyMs) * 100
            : 0,
        v4Accuracy,
        v5Accuracy,
        accuracyImprovement: v5Accuracy - v4Accuracy,
      };
    } catch (error) {
      this.logger.error("收集对比指标失败", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * 生成告警
   */
  private generateAlerts(
    classification: ClassificationMetrics,
    health: HealthMetrics,
  ): Alert[] {
    const alerts: Alert[] = [];
    const now = new Date().toISOString();

    // 1. 错误率告警
    if (health.errorRate >= this.thresholds.errorRate.critical) {
      alerts.push({
        level: "critical",
        type: "error_rate",
        message: `错误率过高: ${health.errorRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { errorRate: health.errorRate },
      });
    } else if (health.errorRate >= this.thresholds.errorRate.warning) {
      alerts.push({
        level: "warning",
        type: "error_rate",
        message: `错误率偏高: ${health.errorRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { errorRate: health.errorRate },
      });
    }

    // 2. 延迟告警
    if (classification.p95LatencyMs >= this.thresholds.latency.critical) {
      alerts.push({
        level: "critical",
        type: "latency",
        message: `P95 延迟过高: ${classification.p95LatencyMs}ms`,
        timestamp: now,
        metrics: { p95LatencyMs: classification.p95LatencyMs },
      });
    } else if (classification.p95LatencyMs >= this.thresholds.latency.warning) {
      alerts.push({
        level: "warning",
        type: "latency",
        message: `P95 延迟偏高: ${classification.p95LatencyMs}ms`,
        timestamp: now,
        metrics: { p95LatencyMs: classification.p95LatencyMs },
      });
    }

    // 3. 用户纠正率告警
    if (
      classification.userCorrectionRate >=
      this.thresholds.correctionRate.critical
    ) {
      alerts.push({
        level: "critical",
        type: "correction_rate",
        message: `用户纠正率过高: ${classification.userCorrectionRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { correctionRate: classification.userCorrectionRate },
      });
    } else if (
      classification.userCorrectionRate >=
      this.thresholds.correctionRate.warning
    ) {
      alerts.push({
        level: "warning",
        type: "correction_rate",
        message: `用户纠正率偏高: ${classification.userCorrectionRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { correctionRate: classification.userCorrectionRate },
      });
    }

    // 4. T1 使用率告警
    if (classification.t1UsageRate >= this.thresholds.t1UsageRate.critical) {
      alerts.push({
        level: "critical",
        type: "t1_usage_rate",
        message: `T1 使用率过高: ${classification.t1UsageRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { t1UsageRate: classification.t1UsageRate },
      });
    } else if (
      classification.t1UsageRate >= this.thresholds.t1UsageRate.warning
    ) {
      alerts.push({
        level: "warning",
        type: "t1_usage_rate",
        message: `T1 使用率偏高: ${classification.t1UsageRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { t1UsageRate: classification.t1UsageRate },
      });
    }

    return alerts;
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * 计算百分位数
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
