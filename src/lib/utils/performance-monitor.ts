/**
 * Performance Monitor - 后端性能监控工具
 *
 * 用于跟踪 API 请求各阶段的耗时，帮助定位性能瓶颈。
 *
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor("InboxAnalysis");
 * monitor.mark("Start");
 * await monitor.measure("FetchProfiles", () => fetchProfiles());
 * monitor.mark("ProfilesFetched");
 * await monitor.measure("Clustering", () => clusterBookmarks());
 * monitor.logReport();
 * ```
 */

import { clientLogger } from "@/lib/client-logger";

interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface PerformanceReport {
  name: string;
  totalDuration: number;
  entries: PerformanceEntry[];
  slowEntries: PerformanceEntry[]; // > 1s
}

export class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private startTime: number;
  private name: string;
  private slowThreshold: number;

  constructor(name: string, options?: { slowThreshold?: number }) {
    this.name = name;
    this.startTime = performance.now();
    this.slowThreshold = options?.slowThreshold ?? 1000; // 默认 1s
  }

  /**
   * 记录一个时间点标记
   */
  mark(stageName: string, metadata?: Record<string, unknown>): void {
    const now = performance.now();
    const duration = now - this.startTime;

    this.entries.push({
      name: stageName,
      duration,
      timestamp: now,
      metadata,
    });

    // 开发环境输出日志
    if (process.env.NODE_ENV === "development") {
      clientLogger.info(
        { stageName, duration: duration.toFixed(2), metadata },
        `[${this.name}] Mark`,
      );
    }
  }

  /**
   * 测量一个异步操作的耗时
   */
  async measure<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;

      this.entries.push({
        name: operationName,
        duration,
        timestamp: performance.now(),
        metadata: { ...metadata, success: true },
      });

      // 慢操作警告
      if (duration > this.slowThreshold) {
        clientLogger.warn(
          { operationName, duration: duration.toFixed(2) },
          `[${this.name}] Slow operation`,
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.entries.push({
        name: operationName,
        duration,
        timestamp: performance.now(),
        metadata: { ...metadata, success: false, error: String(error) },
      });

      throw error;
    }
  }

  /**
   * 测量一个同步操作的耗时
   */
  measureSync<T>(
    operationName: string,
    operation: () => T,
    metadata?: Record<string, unknown>,
  ): T {
    const start = performance.now();
    try {
      const result = operation();
      const duration = performance.now() - start;

      this.entries.push({
        name: operationName,
        duration,
        timestamp: performance.now(),
        metadata: { ...metadata, success: true },
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.entries.push({
        name: operationName,
        duration,
        timestamp: performance.now(),
        metadata: { ...metadata, success: false, error: String(error) },
      });

      throw error;
    }
  }

  /**
   * 生成性能报告
   */
  getReport(): PerformanceReport {
    const totalDuration = performance.now() - this.startTime;
    const slowEntries = this.entries.filter(
      (e) => e.duration > this.slowThreshold,
    );

    return {
      name: this.name,
      totalDuration,
      entries: this.entries,
      slowEntries,
    };
  }

  /**
   * 输出报告到控制台
   */
  logReport(): void {
    const report = this.getReport();

    clientLogger.info(
      {
        name: this.name,
        totalDuration: report.totalDuration.toFixed(2),
        stages: report.entries.length,
      },
      "Performance Report",
    );

    if (report.slowEntries.length > 0) {
      clientLogger.warn(
        {
          threshold: this.slowThreshold,
          slowOperations: report.slowEntries.map((e) => ({
            name: e.name,
            duration: e.duration.toFixed(2),
          })),
        },
        "Slow operations detected",
      );
    }
  }

  /**
   * 获取 JSON 格式的报告（用于 API 响应）
   */
  toJSON(): Record<string, unknown> {
    const report = this.getReport();
    return {
      name: report.name,
      totalDuration: Math.round(report.totalDuration),
      stages: report.entries.map((e) => ({
        name: e.name,
        duration: Math.round(e.duration),
        ...e.metadata,
      })),
      slowOperations: report.slowEntries.map((e) => e.name),
    };
  }

  /**
   * 重置监控器
   */
  reset(): void {
    this.entries = [];
    this.startTime = performance.now();
  }
}

/**
 * 创建一个简单的性能计时器
 */
export function createTimer(name: string): {
  elapsed: () => number;
  log: () => void;
} {
  const start = performance.now();

  return {
    elapsed: () => performance.now() - start,
    log: () => {
      const duration = performance.now() - start;
      clientLogger.info({ name, duration: duration.toFixed(2) }, "[Timer]");
    },
  };
}

/**
 * 装饰器：自动记录方法执行时间
 * 注意：需要在 tsconfig.json 中启用 experimentalDecorators
 */
export function timed(
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    const start = performance.now();
    const className = target.constructor.name;

    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;

      if (process.env.NODE_ENV === "development") {
        clientLogger.info(
          { className, method: propertyKey, duration: duration.toFixed(2) },
          "Method execution time",
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      clientLogger.error(
        {
          className,
          method: propertyKey,
          duration: duration.toFixed(2),
          error: error instanceof Error ? error.message : String(error),
        },
        "Method execution failed",
      );
      throw error;
    }
  };

  return descriptor;
}
