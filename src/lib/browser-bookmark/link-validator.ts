/**
 * 链接有效性检测工具
 * 批量检测书签 URL 是否可访问
 */

// ============================================
// 类型定义
// ============================================

/** 链接验证状态 */
export type LinkStatus = "valid" | "invalid" | "timeout" | "error" | "pending";

/** 单个链接验证结果 */
export interface LinkValidationResult {
  /** 书签 ID */
  id: string;
  /** URL */
  url: string;
  /** 验证状态 */
  status: LinkStatus;
  /** HTTP 状态码（如有） */
  statusCode?: number;
  /** 错误信息（如有） */
  error?: string;
  /** 响应时间（毫秒） */
  responseTime?: number;
}

/** 批量验证结果 */
export interface BatchValidationResult {
  /** 总数 */
  total: number;
  /** 有效数量 */
  valid: number;
  /** 无效数量 */
  invalid: number;
  /** 超时数量 */
  timeout: number;
  /** 错误数量 */
  error: number;
  /** 详细结果 */
  results: LinkValidationResult[];
  /** 耗时（毫秒） */
  durationMs: number;
}

/** 验证配置 */
export interface ValidationConfig {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 最大并发数 */
  concurrency?: number;
  /** 重试次数 */
  retries?: number;
  /** 进度回调 */
  onProgress?: (
    completed: number,
    total: number,
    current: LinkValidationResult,
  ) => void;
  /** 取消信号 */
  signal?: AbortSignal;
}

// ============================================
// 常量
// ============================================

const DEFAULT_TIMEOUT = 5000; // 5 秒
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_RETRIES = 1;

// 无法通过 HEAD 请求验证的域名（需要特殊处理）
const SKIP_HEAD_DOMAINS = [
  "weixin.qq.com",
  "mp.weixin.qq.com",
  "bilibili.com",
  "www.bilibili.com",
];

// ============================================
// 核心验证函数
// ============================================

/**
 * 验证单个 URL
 */
export async function validateUrl(
  url: string,
  config: Pick<ValidationConfig, "timeout" | "retries" | "signal"> = {},
): Promise<Omit<LinkValidationResult, "id">> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    signal,
  } = config;

  // 检查 URL 格式
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      url,
      status: "error",
      error: "无效的 URL 格式",
    };
  }

  // 只支持 http/https
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return {
      url,
      status: "error",
      error: `不支持的协议: ${parsedUrl.protocol}`,
    };
  }

  // 检查是否需要跳过 HEAD 请求
  const useGet = SKIP_HEAD_DOMAINS.some((domain) =>
    parsedUrl.hostname.includes(domain),
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 合并外部取消信号
      if (signal?.aborted) {
        return { url, status: "error", error: "已取消" };
      }

      const response = await fetch(url, {
        method: useGet ? "GET" : "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      // 2xx 和 3xx 视为有效
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return {
          url,
          status: "valid",
          statusCode: response.status,
          responseTime,
        };
      }

      // 4xx 和 5xx 视为无效
      return {
        url,
        status: "invalid",
        statusCode: response.status,
        responseTime,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      lastError = error as Error;

      if ((error as Error).name === "AbortError") {
        return {
          url,
          status: "timeout",
          error: `请求超时 (${timeout}ms)`,
          responseTime: Date.now() - startTime,
        };
      }

      // 如果不是最后一次重试，继续
      if (attempt < retries) {
        continue;
      }
    }
  }

  // 所有重试都失败
  return {
    url,
    status: "error",
    error: lastError?.message || "未知错误",
  };
}

/**
 * 批量验证 URL
 */
export async function validateUrls(
  items: Array<{ id: string; url: string }>,
  config: ValidationConfig = {},
): Promise<BatchValidationResult> {
  const {
    timeout = DEFAULT_TIMEOUT,
    concurrency = DEFAULT_CONCURRENCY,
    retries = DEFAULT_RETRIES,
    onProgress,
    signal,
  } = config;

  const startTime = Date.now();
  const results: LinkValidationResult[] = [];
  let completed = 0;

  // 创建并发控制
  const queue = [...items];
  const pending: Promise<void>[] = [];

  async function processNext(): Promise<void> {
    while (queue.length > 0 && !signal?.aborted) {
      const item = queue.shift();
      if (!item) break;

      const result = await validateUrl(item.url, { timeout, retries, signal });
      const fullResult: LinkValidationResult = {
        ...result,
        id: item.id,
      };

      results.push(fullResult);
      completed++;

      onProgress?.(completed, items.length, fullResult);
    }
  }

  // 启动并发任务
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    pending.push(processNext());
  }

  await Promise.all(pending);

  // 统计结果
  const stats = results.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { valid: 0, invalid: 0, timeout: 0, error: 0, pending: 0 },
  );

  return {
    total: items.length,
    valid: stats.valid,
    invalid: stats.invalid,
    timeout: stats.timeout,
    error: stats.error,
    results,
    durationMs: Date.now() - startTime,
  };
}

/**
 * 过滤出无效的链接
 */
export function filterInvalidLinks(
  result: BatchValidationResult,
): LinkValidationResult[] {
  return result.results.filter(
    (r) =>
      r.status === "invalid" || r.status === "timeout" || r.status === "error",
  );
}

/**
 * 获取验证统计摘要
 */
export function getValidationSummary(result: BatchValidationResult): string {
  const parts: string[] = [];

  if (result.valid > 0) {
    parts.push(`${result.valid} 个有效`);
  }
  if (result.invalid > 0) {
    parts.push(`${result.invalid} 个无效`);
  }
  if (result.timeout > 0) {
    parts.push(`${result.timeout} 个超时`);
  }
  if (result.error > 0) {
    parts.push(`${result.error} 个错误`);
  }

  return parts.join("，") || "无结果";
}
