/**
 * API 健康检查工具
 * V5.0: 监测 API 可用性，支持降级策略
 *
 * 特点：
 * - 定期健康检查
 * - 延迟测量
 * - 故障检测与恢复
 * - 支持多端点检查
 */

/**
 * 健康状态类型
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * 端点健康信息
 */
export interface EndpointHealth {
  /** 端点名称 */
  name: string;
  /** 端点 URL */
  url: string;
  /** 健康状态 */
  status: HealthStatus;
  /** 响应延迟 (ms) */
  latency: number | null;
  /** 最后检查时间 */
  lastCheck: Date | null;
  /** 最后成功时间 */
  lastSuccess: Date | null;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 错误信息 */
  errorMessage: string | null;
}

/**
 * 整体健康报告
 */
export interface HealthReport {
  /** 整体状态 */
  overallStatus: HealthStatus;
  /** 各端点状态 */
  endpoints: EndpointHealth[];
  /** 检查时间 */
  checkedAt: Date;
  /** 平均延迟 */
  averageLatency: number | null;
}

/**
 * 健康检查配置
 */
interface HealthCheckConfig {
  /** 端点列表 */
  endpoints: Array<{
    name: string;
    url: string;
    /** 可选的自定义检查函数 */
    check?: (response: Response) => boolean;
  }>;
  /** 检查间隔 (ms)，默认 30000 */
  interval?: number;
  /** 请求超时 (ms)，默认 5000 */
  timeout?: number;
  /** 判定为 degraded 的延迟阈值 (ms)，默认 1000 */
  degradedThreshold?: number;
  /** 判定为 unhealthy 的连续失败次数，默认 3 */
  unhealthyThreshold?: number;
  /** 状态变化回调 */
  onStatusChange?: (
    endpoint: string,
    newStatus: HealthStatus,
    oldStatus: HealthStatus,
  ) => void;
}

// 默认空操作回调（避免空函数 lint 警告）
const noop = () => {
  /* 默认不执行任何操作 */
};

/**
 * API 健康检查管理器
 */
class APIHealthChecker {
  private config: Required<HealthCheckConfig>;
  private healthMap = new Map<string, EndpointHealth>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: HealthCheckConfig) {
    this.config = {
      interval: 30000,
      timeout: 5000,
      degradedThreshold: 1000,
      unhealthyThreshold: 3,
      onStatusChange: noop,
      ...config,
    };

    // 初始化端点健康状态
    this.config.endpoints.forEach((endpoint) => {
      this.healthMap.set(endpoint.name, {
        name: endpoint.name,
        url: endpoint.url,
        status: "unknown",
        latency: null,
        lastCheck: null,
        lastSuccess: null,
        consecutiveFailures: 0,
        errorMessage: null,
      });
    });
  }

  /**
   * 检查单个端点
   */
  private async checkEndpoint(
    endpoint: HealthCheckConfig["endpoints"][0],
  ): Promise<void> {
    const health = this.healthMap.get(endpoint.name);
    if (!health) return;

    const oldStatus = health.status;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const response = await fetch(endpoint.url, {
        method: "HEAD",
        signal: controller.signal,
        credentials: "include",
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      // 自定义检查或默认检查
      const isHealthy = endpoint.check ? endpoint.check(response) : response.ok;

      if (isHealthy) {
        health.status =
          latency > this.config.degradedThreshold ? "degraded" : "healthy";
        health.latency = latency;
        health.lastSuccess = new Date();
        health.consecutiveFailures = 0;
        health.errorMessage = null;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      health.consecutiveFailures++;
      health.latency = null;
      health.errorMessage = (error as Error).message;

      if (health.consecutiveFailures >= this.config.unhealthyThreshold) {
        health.status = "unhealthy";
      } else {
        health.status = "degraded";
      }
    }

    health.lastCheck = new Date();

    // 状态变化通知
    if (oldStatus !== health.status) {
      this.config.onStatusChange(endpoint.name, health.status, oldStatus);
    }
  }

  /**
   * 检查所有端点
   */
  async checkAll(): Promise<HealthReport> {
    await Promise.all(
      this.config.endpoints.map((endpoint) => this.checkEndpoint(endpoint)),
    );

    return this.getReport();
  }

  /**
   * 获取健康报告
   */
  getReport(): HealthReport {
    const endpoints = Array.from(this.healthMap.values());

    // 计算整体状态
    let overallStatus: HealthStatus = "healthy";
    const hasUnhealthy = endpoints.some((e) => e.status === "unhealthy");
    const hasDegraded = endpoints.some((e) => e.status === "degraded");
    const hasUnknown = endpoints.some((e) => e.status === "unknown");

    if (hasUnhealthy) {
      overallStatus = "unhealthy";
    } else if (hasDegraded) {
      overallStatus = "degraded";
    } else if (hasUnknown) {
      overallStatus = "unknown";
    }

    // 计算平均延迟
    const latencies = endpoints
      .filter((e) => e.latency !== null)
      .map((e) => e.latency as number);
    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null;

    return {
      overallStatus,
      endpoints,
      checkedAt: new Date(),
      averageLatency,
    };
  }

  /**
   * 获取单个端点状态
   */
  getEndpointHealth(name: string): EndpointHealth | undefined {
    return this.healthMap.get(name);
  }

  /**
   * 开始定期检查
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // 立即执行一次检查
    this.checkAll();

    // 定期检查
    this.intervalId = setInterval(() => {
      this.checkAll();
    }, this.config.interval);
  }

  /**
   * 停止定期检查
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * 是否正在运行
   */
  get running(): boolean {
    return this.isRunning;
  }
}

/**
 * 默认 API 健康检查器
 * 监测主要的 API 端点
 */
let defaultChecker: APIHealthChecker | null = null;

/**
 * 获取默认健康检查器
 */
export function getAPIHealthChecker(): APIHealthChecker {
  if (!defaultChecker) {
    defaultChecker = new APIHealthChecker({
      endpoints: [
        {
          name: "bookmarks",
          url: "/api/bookmarks",
        },
        {
          name: "folders",
          url: "/api/folders",
        },
      ],
      interval: 60000, // 1 分钟检查一次
      timeout: 5000,
      degradedThreshold: 2000,
      onStatusChange: (endpoint, newStatus, oldStatus) => {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console -- API健康状态变化日志
          console.log(`[APIHealth] ${endpoint}: ${oldStatus} -> ${newStatus}`);
        }
      },
    });
  }
  return defaultChecker;
}

/**
 * 创建自定义健康检查器
 */
export function createHealthChecker(
  config: HealthCheckConfig,
): APIHealthChecker {
  return new APIHealthChecker(config);
}

/**
 * React Hook: 使用 API 健康状态
 */
export function useAPIHealth(): HealthReport | null {
  // 这个 hook 需要在客户端组件中使用
  // 为了保持文件的纯函数性，这里只是导出类型
  // 实际的 hook 实现应该在单独的 hooks 文件中
  return null;
}

export { APIHealthChecker };
