/**
 * 智能分类 v5.0 - 监控指标系统
 *
 * 功能：
 * 1. 分类性能指标（延迟、成功率、T1使用率）
 * 2. 准确性指标（用户纠正率、置信度分布）
 * 3. 系统健康指标（错误率、超时率）
 * 4. 对比指标（v4 vs v5）
 */

import type { LoggerService } from '../shared/logger';

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
  level: 'info' | 'warning' | 'critical';
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
    this.logger = logger.child({ service: 'MonitoringService' });
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
    endTime: Date
  ): Promise<MonitoringReport> {
    this.logger.info('生成监控报告', {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    // 1. 收集分类指标
    const classification = await this.collectClassificationMetrics(
      startTime,
      endTime
    );

    // 2. 收集健康指标
    const health = await this.collectHealthMetrics(startTime, endTime);

    // 3. 收集对比指标（如果有 v4 数据）
    const comparison = await this.collectComparisonMetrics(
      startTime,
      endTime
    );

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
   */
  private async collectClassificationMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<ClassificationMetrics> {
    // TODO: 从数据库查询实际数据
    // 这里返回模拟数据作为示例

    const latencies = [450, 480, 520, 550, 600, 650, 700, 800, 900, 1200];
    const totalClassifications = 1000;
    const successCount = 980;
    const t1UsedCount = 250;
    const userCorrectionCount = 50;

    return {
      totalClassifications,
      successCount,
      failureCount: totalClassifications - successCount,
      avgLatencyMs: this.calculateAverage(latencies),
      p50LatencyMs: this.calculatePercentile(latencies, 50),
      p95LatencyMs: this.calculatePercentile(latencies, 95),
      p99LatencyMs: this.calculatePercentile(latencies, 99),
      t1UsedCount,
      t1UsageRate: (t1UsedCount / totalClassifications) * 100,
      avgConfidence: 0.87,
      userCorrectionCount,
      userCorrectionRate: (userCorrectionCount / totalClassifications) * 100,
    };
  }

  /**
   * 收集健康指标
   */
  private async collectHealthMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<HealthMetrics> {
    // TODO: 从日志/监控系统查询实际数据

    return {
      errorRate: 2.0,
      timeoutRate: 0.5,
      vectorSearchFailureRate: 1.0,
      llmCallFailureRate: 0.8,
      databaseErrorRate: 0.2,
    };
  }

  /**
   * 收集对比指标
   */
  private async collectComparisonMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<ComparisonMetrics | undefined> {
    // TODO: 查询 v4 和 v5 的对比数据

    const v4AvgLatencyMs = 800;
    const v5AvgLatencyMs = 550;
    const v4Accuracy = 82;
    const v5Accuracy = 87;

    return {
      v4AvgLatencyMs,
      v5AvgLatencyMs,
      latencyImprovement:
        ((v4AvgLatencyMs - v5AvgLatencyMs) / v4AvgLatencyMs) * 100,
      v4Accuracy,
      v5Accuracy,
      accuracyImprovement: v5Accuracy - v4Accuracy,
    };
  }

  /**
   * 生成告警
   */
  private generateAlerts(
    classification: ClassificationMetrics,
    health: HealthMetrics
  ): Alert[] {
    const alerts: Alert[] = [];
    const now = new Date().toISOString();

    // 1. 错误率告警
    if (health.errorRate >= this.thresholds.errorRate.critical) {
      alerts.push({
        level: 'critical',
        type: 'error_rate',
        message: `错误率过高: ${health.errorRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { errorRate: health.errorRate },
      });
    } else if (health.errorRate >= this.thresholds.errorRate.warning) {
      alerts.push({
        level: 'warning',
        type: 'error_rate',
        message: `错误率偏高: ${health.errorRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { errorRate: health.errorRate },
      });
    }

    // 2. 延迟告警
    if (classification.p95LatencyMs >= this.thresholds.latency.critical) {
      alerts.push({
        level: 'critical',
        type: 'latency',
        message: `P95 延迟过高: ${classification.p95LatencyMs}ms`,
        timestamp: now,
        metrics: { p95LatencyMs: classification.p95LatencyMs },
      });
    } else if (classification.p95LatencyMs >= this.thresholds.latency.warning) {
      alerts.push({
        level: 'warning',
        type: 'latency',
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
        level: 'critical',
        type: 'correction_rate',
        message: `用户纠正率过高: ${classification.userCorrectionRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { correctionRate: classification.userCorrectionRate },
      });
    } else if (
      classification.userCorrectionRate >=
      this.thresholds.correctionRate.warning
    ) {
      alerts.push({
        level: 'warning',
        type: 'correction_rate',
        message: `用户纠正率偏高: ${classification.userCorrectionRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { correctionRate: classification.userCorrectionRate },
      });
    }

    // 4. T1 使用率告警
    if (classification.t1UsageRate >= this.thresholds.t1UsageRate.critical) {
      alerts.push({
        level: 'critical',
        type: 't1_usage_rate',
        message: `T1 使用率过高: ${classification.t1UsageRate.toFixed(2)}%`,
        timestamp: now,
        metrics: { t1UsageRate: classification.t1UsageRate },
      });
    } else if (
      classification.t1UsageRate >= this.thresholds.t1UsageRate.warning
    ) {
      alerts.push({
        level: 'warning',
        type: 't1_usage_rate',
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
