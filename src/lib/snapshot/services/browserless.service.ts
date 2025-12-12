/**
 * Browserless.io Service (V4.2.1)
 * 无头浏览器服务 - 用于生成完整快照（含截图）
 *
 * 功能：
 * - 页面截图（全页/视口）
 * - MHTML 存档导出
 * - PDF 导出（可选）
 *
 * @see https://docs.browserless.io/
 */

import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

export interface BrowserlessConfig {
  /** API 端点 */
  endpoint: string;
  /** API Token */
  token: string;
  /** 请求超时（毫秒） */
  timeout?: number;
}

export interface ScreenshotOptions {
  /** 页面 URL */
  url: string;
  /** 截图类型 */
  type?: "png" | "jpeg" | "webp";
  /** 图片质量 (1-100，仅 jpeg/webp) */
  quality?: number;
  /** 是否全页截图 */
  fullPage?: boolean;
  /** 视口宽度 */
  viewportWidth?: number;
  /** 视口高度 */
  viewportHeight?: number;
  /** 等待选择器出现 */
  waitForSelector?: string;
  /** 等待超时（毫秒） */
  waitTimeout?: number;
  /** 滚动到底部后截图 */
  scrollToBottom?: boolean;
  /** 设备模拟 */
  device?: "desktop" | "mobile" | "tablet";
}

export interface MhtmlOptions {
  /** 页面 URL */
  url: string;
  /** 等待选择器 */
  waitForSelector?: string;
  /** 等待超时 */
  waitTimeout?: number;
}

export interface BrowserlessResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
}

export interface ScreenshotResult {
  /** 图片二进制数据 */
  buffer: Buffer;
  /** 图片类型 */
  type: "png" | "jpeg" | "webp";
  /** 文件大小 */
  size: number;
}

export interface MhtmlResult {
  /** MHTML 内容 */
  content: string;
  /** 内容大小 */
  size: number;
}

// ============================================================================
// 常量配置
// ============================================================================

const DEFAULT_TIMEOUT = 60000; // 60 秒
const _DEFAULT_VIEWPORT_WIDTH = 1280;
const _DEFAULT_VIEWPORT_HEIGHT = 800;
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_MHTML_SIZE = 20 * 1024 * 1024; // 20MB

const DEVICE_CONFIGS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
};

// ============================================================================
// Browserless 客户端类
// ============================================================================

export class BrowserlessService {
  private config: BrowserlessConfig;

  constructor(config?: Partial<BrowserlessConfig>) {
    const endpoint = config?.endpoint || process.env.BROWSERLESS_ENDPOINT;
    const token = config?.token || process.env.BROWSERLESS_TOKEN;

    if (!endpoint || !token) {
      throw new Error(
        "Browserless configuration missing. Set BROWSERLESS_ENDPOINT and BROWSERLESS_TOKEN environment variables.",
      );
    }

    this.config = {
      endpoint: endpoint.replace(/\/$/, ""), // 移除尾部斜杠
      token,
      timeout: config?.timeout || DEFAULT_TIMEOUT,
    };
  }

  /**
   * 检查服务是否可用
   */
  static isAvailable(): boolean {
    return !!(
      process.env.BROWSERLESS_ENDPOINT && process.env.BROWSERLESS_TOKEN
    );
  }

  /**
   * 获取 API 请求 URL
   */
  private getApiUrl(path: string): string {
    return `${this.config.endpoint}${path}?token=${this.config.token}`;
  }

  /**
   * 截取网页截图
   */
  async screenshot(
    options: ScreenshotOptions,
  ): Promise<BrowserlessResult<ScreenshotResult>> {
    const startTime = Date.now();
    const {
      url,
      type = "png",
      quality = 80,
      fullPage = true,
      viewportWidth,
      viewportHeight,
      waitForSelector,
      waitTimeout = 10000,
      scrollToBottom = false,
      device = "desktop",
    } = options;

    const viewport = DEVICE_CONFIGS[device] || DEVICE_CONFIGS.desktop;

    try {
      logger.info(
        { url, type, fullPage, device },
        "[Browserless] Starting screenshot",
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      // 构建请求体
      const requestBody = {
        url,
        options: {
          type,
          quality: type === "png" ? undefined : quality,
          fullPage,
        },
        viewport: {
          width: viewportWidth || viewport.width,
          height: viewportHeight || viewport.height,
          deviceScaleFactor: 1,
        },
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: waitTimeout,
        },
        ...(waitForSelector && {
          waitForSelector: {
            selector: waitForSelector,
            timeout: waitTimeout,
          },
        }),
        ...(scrollToBottom && {
          scrollPage: true,
        }),
      };

      const response = await fetch(this.getApiUrl("/screenshot"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Browserless API error: ${response.status} - ${errorText}`,
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const size = buffer.length;

      // 检查大小限制
      if (size > MAX_SCREENSHOT_SIZE) {
        throw new Error(
          `Screenshot too large: ${(size / 1024 / 1024).toFixed(2)}MB (max: ${MAX_SCREENSHOT_SIZE / 1024 / 1024}MB)`,
        );
      }

      const duration = Date.now() - startTime;

      logger.info(
        { url, size, duration, type },
        "[Browserless] Screenshot completed",
      );

      return {
        success: true,
        data: { buffer, type, size },
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        { url, error: errorMessage },
        "[Browserless] Screenshot failed",
      );

      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 导出 MHTML 存档
   * MHTML 包含完整页面（HTML + CSS + 图片）
   */
  async mhtml(options: MhtmlOptions): Promise<BrowserlessResult<MhtmlResult>> {
    const startTime = Date.now();
    const { url, waitForSelector, waitTimeout = 10000 } = options;

    try {
      logger.info({ url }, "[Browserless] Starting MHTML export");

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      // 使用 /function API 执行自定义脚本导出 MHTML
      // Browserless 2.x 使用 /content API
      const requestBody = {
        url,
        gotoOptions: {
          waitUntil: "networkidle2",
          timeout: waitTimeout,
        },
        ...(waitForSelector && {
          waitForSelector: {
            selector: waitForSelector,
            timeout: waitTimeout,
          },
        }),
      };

      const response = await fetch(this.getApiUrl("/content"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Browserless API error: ${response.status} - ${errorText}`,
        );
      }

      const content = await response.text();
      const size = Buffer.byteLength(content, "utf8");

      // 检查大小限制
      if (size > MAX_MHTML_SIZE) {
        throw new Error(
          `MHTML too large: ${(size / 1024 / 1024).toFixed(2)}MB (max: ${MAX_MHTML_SIZE / 1024 / 1024}MB)`,
        );
      }

      const duration = Date.now() - startTime;

      logger.info(
        { url, size, duration },
        "[Browserless] MHTML export completed",
      );

      return {
        success: true,
        data: { content, size },
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        { url, error: errorMessage },
        "[Browserless] MHTML export failed",
      );

      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 同时获取截图和 HTML 内容
   * 用于 Full 快照
   */
  async captureFullSnapshot(
    url: string,
    options?: Partial<ScreenshotOptions>,
  ): Promise<
    BrowserlessResult<{
      screenshot: ScreenshotResult;
      html: string;
      htmlSize: number;
    }>
  > {
    const startTime = Date.now();

    try {
      logger.info({ url }, "[Browserless] Starting full snapshot capture");

      // 并行执行截图和内容获取
      const [screenshotResult, contentResult] = await Promise.all([
        this.screenshot({ url, ...options }),
        this.mhtml({ url }),
      ]);

      if (!screenshotResult.success || !screenshotResult.data) {
        throw new Error(
          `Screenshot failed: ${screenshotResult.error || "Unknown error"}`,
        );
      }

      if (!contentResult.success || !contentResult.data) {
        throw new Error(
          `Content capture failed: ${contentResult.error || "Unknown error"}`,
        );
      }

      const duration = Date.now() - startTime;

      logger.info(
        {
          url,
          screenshotSize: screenshotResult.data.size,
          htmlSize: contentResult.data.size,
          duration,
        },
        "[Browserless] Full snapshot capture completed",
      );

      return {
        success: true,
        data: {
          screenshot: screenshotResult.data,
          html: contentResult.data.content,
          htmlSize: contentResult.data.size,
        },
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        { url, error: errorMessage },
        "[Browserless] Full snapshot capture failed",
      );

      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let browserlessInstance: BrowserlessService | null = null;

/**
 * 获取 Browserless 服务实例（懒加载）
 */
export function getBrowserlessService(): BrowserlessService {
  if (!browserlessInstance) {
    browserlessInstance = new BrowserlessService();
  }
  return browserlessInstance;
}

/**
 * 检查 Browserless 服务是否配置
 */
export function isBrowserlessConfigured(): boolean {
  return BrowserlessService.isAvailable();
}
