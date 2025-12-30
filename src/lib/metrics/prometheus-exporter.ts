/**
 * Prometheus Exporter
 * 将应用指标导出为 Prometheus 格式
 *
 * @description
 * - 提供 Prometheus 文本格式的指标导出
 * - 支持 counter、gauge、histogram 类型
 * - 自动收集 Node.js 运行时指标
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

import {
  classificationMetrics,
  type MetricEvent,
} from "./classification-metrics";

// ============================================================================
// 类型定义
// ============================================================================

interface PrometheusMetric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  values: Array<{
    labels: Record<string, string>;
    value: number;
    timestamp?: number;
  }>;
}

// ============================================================================
// 指标描述
// ============================================================================

const METRIC_DESCRIPTIONS: Record<
  string,
  { help: string; type: PrometheusMetric["type"] }
> = {
  // 分类指标
  classification_requests_total: {
    help: "Total number of classification requests",
    type: "counter",
  },
  classification_success_total: {
    help: "Total number of successful classifications",
    type: "counter",
  },
  classification_failures_total: {
    help: "Total number of failed classifications",
    type: "counter",
  },
  classification_latency_ms: {
    help: "Classification latency in milliseconds",
    type: "histogram",
  },
  classification_confidence: {
    help: "Classification confidence distribution",
    type: "histogram",
  },
  user_corrections_total: {
    help: "Total number of user corrections",
    type: "counter",
  },
  auto_decisions_total: {
    help: "Total number of automatic decisions",
    type: "counter",
  },

  // 托管模式指标
  trust_mode_distribution: {
    help: "Distribution of trust modes",
    type: "gauge",
  },
  trust_mode_switches_total: {
    help: "Total number of trust mode switches",
    type: "counter",
  },
  pending_confirmations_gauge: {
    help: "Number of pending confirmations",
    type: "gauge",
  },
  confirmation_response_time_ms: {
    help: "Confirmation response time in milliseconds",
    type: "histogram",
  },

  // 文件夹指标
  folder_auto_create_total: {
    help: "Total number of auto-created folders",
    type: "counter",
  },
  folder_auto_merge_total: {
    help: "Total number of auto-merged folders",
    type: "counter",
  },
  folder_auto_split_total: {
    help: "Total number of auto-split folders",
    type: "counter",
  },

  // 系统指标
  ai_calls_total: {
    help: "Total number of AI API calls",
    type: "counter",
  },
  ai_latency_ms: {
    help: "AI API call latency in milliseconds",
    type: "histogram",
  },
  vector_search_total: {
    help: "Total number of vector searches",
    type: "counter",
  },
  vector_search_latency_ms: {
    help: "Vector search latency in milliseconds",
    type: "histogram",
  },
  cache_hit_rate: {
    help: "Cache hit rate",
    type: "gauge",
  },

  // Node.js 运行时指标
  nodejs_heap_size_bytes: {
    help: "Node.js heap size in bytes",
    type: "gauge",
  },
  nodejs_heap_used_bytes: {
    help: "Node.js heap used in bytes",
    type: "gauge",
  },
  nodejs_external_bytes: {
    help: "Node.js external memory in bytes",
    type: "gauge",
  },
  nodejs_uptime_seconds: {
    help: "Node.js process uptime in seconds",
    type: "gauge",
  },

  // 应用指标
  app_info: {
    help: "Application info",
    type: "gauge",
  },
  http_requests_total: {
    help: "Total HTTP requests",
    type: "counter",
  },
  http_request_duration_ms: {
    help: "HTTP request duration in milliseconds",
    type: "histogram",
  },
};

// ============================================================================
// 聚合存储
// ============================================================================

interface AggregatedMetrics {
  counters: Map<string, number>;
  gauges: Map<string, number>;
  histograms: Map<string, number[]>;
}

const aggregated: AggregatedMetrics = {
  counters: new Map(),
  gauges: new Map(),
  histograms: new Map(),
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 将标签对象转换为 Prometheus 格式的标签字符串
 */
function labelsToString(
  labels: Record<string, string | number | boolean | undefined>,
): string {
  const entries = Object.entries(labels)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join(",");
  return entries ? `{${entries}}` : "";
}

/**
 * 创建指标键（包含标签）
 */
function createMetricKey(
  name: string,
  labels?: Record<string, string | number | boolean | undefined>,
): string {
  if (!labels || Object.keys(labels).length === 0) {
    return name;
  }
  const sortedLabels = Object.keys(labels)
    .sort()
    .filter((k) => labels[k] !== undefined)
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
  return `${name}:${sortedLabels}`;
}

/**
 * 从指标键解析标签
 */
function parseMetricKey(key: string): {
  name: string;
  labels: Record<string, string>;
} {
  const colonIndex = key.indexOf(":");
  if (colonIndex === -1) {
    return { name: key, labels: {} };
  }
  const name = key.substring(0, colonIndex);
  const labelsStr = key.substring(colonIndex + 1);
  const labels: Record<string, string> = {};
  if (labelsStr) {
    labelsStr.split(",").forEach((pair) => {
      const eqIndex = pair.indexOf("=");
      if (eqIndex > 0) {
        labels[pair.substring(0, eqIndex)] = pair.substring(eqIndex + 1);
      }
    });
  }
  return { name, labels };
}

/**
 * 计算直方图分位数
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ============================================================================
// 指标处理
// ============================================================================

/**
 * 处理指标事件并聚合
 */
function processMetricEvent(event: MetricEvent): void {
  const key = createMetricKey(
    event.name,
    event.labels as Record<string, string | number | boolean | undefined>,
  );

  switch (event.type) {
    case "counter":
      aggregated.counters.set(
        key,
        (aggregated.counters.get(key) || 0) + event.value,
      );
      break;
    case "gauge":
      aggregated.gauges.set(key, event.value);
      break;
    case "histogram":
    case "timing":
      const existingValues = aggregated.histograms.get(key);
      if (existingValues) {
        existingValues.push(event.value);
        // 保留最近 1000 个值
        if (existingValues.length > 1000) {
          aggregated.histograms.set(key, existingValues.slice(-1000));
        }
      } else {
        aggregated.histograms.set(key, [event.value]);
      }
      break;
  }
}

/**
 * 收集 Node.js 运行时指标
 */
function collectRuntimeMetrics(): void {
  // 内存指标
  const memUsage = process.memoryUsage();
  aggregated.gauges.set("nodejs_heap_size_bytes", memUsage.heapTotal);
  aggregated.gauges.set("nodejs_heap_used_bytes", memUsage.heapUsed);
  aggregated.gauges.set("nodejs_external_bytes", memUsage.external);

  // 进程运行时间
  aggregated.gauges.set("nodejs_uptime_seconds", process.uptime());

  // 应用信息
  aggregated.gauges.set(
    createMetricKey("app_info", {
      version: process.env.npm_package_version || "unknown",
      node_version: process.version,
      env: process.env.NODE_ENV || "development",
    }),
    1,
  );
}

// ============================================================================
// Prometheus 格式导出
// ============================================================================

/**
 * 生成 Prometheus 文本格式输出
 */
export function generatePrometheusMetrics(): string {
  // 先处理缓冲区中的指标
  const bufferedMetrics = classificationMetrics.getBufferedMetrics();
  bufferedMetrics.forEach(processMetricEvent);

  // 收集运行时指标
  collectRuntimeMetrics();

  const lines: string[] = [];
  const processedMetrics = new Set<string>();

  // 处理 counters
  aggregated.counters.forEach((value, key) => {
    const { name, labels } = parseMetricKey(key);
    if (!processedMetrics.has(name)) {
      const desc = METRIC_DESCRIPTIONS[name];
      if (desc) {
        lines.push(`# HELP ${name} ${desc.help}`);
        lines.push(`# TYPE ${name} ${desc.type}`);
      }
      processedMetrics.add(name);
    }
    lines.push(`${name}${labelsToString(labels)} ${value}`);
  });

  // 处理 gauges
  aggregated.gauges.forEach((value, key) => {
    const { name, labels } = parseMetricKey(key);
    if (!processedMetrics.has(name)) {
      const desc = METRIC_DESCRIPTIONS[name];
      if (desc) {
        lines.push(`# HELP ${name} ${desc.help}`);
        lines.push(`# TYPE ${name} ${desc.type}`);
      }
      processedMetrics.add(name);
    }
    lines.push(`${name}${labelsToString(labels)} ${value}`);
  });

  // 处理 histograms（转换为 summary 格式）
  aggregated.histograms.forEach((values, key) => {
    const { name, labels } = parseMetricKey(key);
    if (!processedMetrics.has(name)) {
      const desc = METRIC_DESCRIPTIONS[name];
      if (desc) {
        lines.push(`# HELP ${name} ${desc.help}`);
        lines.push(`# TYPE ${name} summary`);
      }
      processedMetrics.add(name);
    }

    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;

      // 分位数
      [0.5, 0.9, 0.99].forEach((quantile) => {
        const percentileValue = calculatePercentile(values, quantile * 100);
        lines.push(
          `${name}${labelsToString({ ...labels, quantile: quantile.toString() })} ${percentileValue}`,
        );
      });

      lines.push(`${name}_sum${labelsToString(labels)} ${sum}`);
      lines.push(`${name}_count${labelsToString(labels)} ${count}`);
    }
  });

  return lines.join("\n");
}

/**
 * 重置所有指标（用于测试）
 */
export function resetMetrics(): void {
  aggregated.counters.clear();
  aggregated.gauges.clear();
  aggregated.histograms.clear();
  classificationMetrics.clearBuffer();
}

/**
 * 获取聚合指标的快照（用于调试）
 */
export function getMetricsSnapshot(): {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<
    string,
    { count: number; sum: number; p50: number; p90: number; p99: number }
  >;
} {
  const snapshot = {
    counters: {} as Record<string, number>,
    gauges: {} as Record<string, number>,
    histograms: {} as Record<
      string,
      { count: number; sum: number; p50: number; p90: number; p99: number }
    >,
  };

  aggregated.counters.forEach((v, k) => {
    snapshot.counters[k] = v;
  });

  aggregated.gauges.forEach((v, k) => {
    snapshot.gauges[k] = v;
  });

  aggregated.histograms.forEach((values, k) => {
    if (values.length > 0) {
      snapshot.histograms[k] = {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        p50: calculatePercentile(values, 50),
        p90: calculatePercentile(values, 90),
        p99: calculatePercentile(values, 99),
      };
    }
  });

  return snapshot;
}
