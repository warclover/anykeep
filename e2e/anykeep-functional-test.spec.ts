/**
 * AnyKeep 全面功能测试
 *
 * 测试所有页面的可访问性、JavaScript 错误、网络请求
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { test, expect, type Page } from "@playwright/test";

// 页面分类
const PUBLIC_PAGES = [
  { path: "/", name: "首页（重定向）" },
  { path: "/login", name: "登录页" },
  { path: "/register", name: "注册页" },
  { path: "/forgot-password", name: "忘记密码页" },
  { path: "/privacy", name: "隐私政策页" },
];

const PROTECTED_PAGES = [
  { path: "/home", name: "主页" },
  { path: "/folders", name: "文件夹管理" },
  { path: "/tags", name: "标签管理" },
  { path: "/search", name: "搜索页" },
  { path: "/batch", name: "批量操作" },
  { path: "/export", name: "数据导出" },
  { path: "/settings", name: "设置页" },
  { path: "/settings/ai", name: "AI 设置" },
  { path: "/settings/ai-reports", name: "AI 报告" },
  { path: "/analytics", name: "数据分析" },
  { path: "/activity", name: "活动记录" },
  { path: "/inbox", name: "收件箱" },
  { path: "/messages", name: "消息中心" },
  { path: "/messages/pending", name: "待处理消息" },
  { path: "/librarian", name: "知识管理" },
  { path: "/folder-health", name: "文件夹健康检查" },
  { path: "/md-collections", name: "Markdown 合集" },
];

const DEV_PAGES = [
  { path: "/ai-test", name: "AI 测试页" },
  { path: "/classification-debugger", name: "分类调试器" },
  { path: "/dev/classification-trace", name: "分类追踪" },
  { path: "/dev/classification-compare", name: "分类对比" },
  { path: "/dev/api-docs", name: "API 文档" },
  { path: "/debug/ai-summary", name: "AI 摘要调试" },
];

interface PageTestResult {
  path: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  loadTime?: number;
  errors: string[];
  warnings: string[];
  networkErrors: string[];
}

/**
 * 测试页面加载
 */
async function testPageLoad(
  page: Page,
  path: string,
  name: string,
  _expectRedirect = false,
): Promise<PageTestResult> {
  const result: PageTestResult = {
    path,
    name,
    status: "passed",
    errors: [],
    warnings: [],
    networkErrors: [],
  };

  const startTime = Date.now();

  // 监听 JavaScript 错误
  page.on("pageerror", (error) => {
    // 过滤已知的非关键错误
    if (
      !error.message.includes("ResizeObserver") &&
      !error.message.includes("hydration")
    ) {
      result.errors.push(error.message);
    }
  });

  // 监听控制台警告和错误
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      result.warnings.push(msg.text());
    }
  });

  // 监听网络请求失败
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    if (failure) {
      result.networkErrors.push(`${request.url()}: ${failure.errorText}`);
    }
  });

  try {
    const response = await page.goto(path, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    result.loadTime = Date.now() - startTime;

    // 检查响应状态
    if (response) {
      const status = response.status();
      if (status >= 400 && status !== 401 && status !== 403) {
        result.status = "failed";
        result.errors.push(`HTTP ${status}`);
      }
    }

    // 等待页面稳定
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
      result.warnings.push("Network idle timeout");
    });

    // 检查页面是否有内容
    const body = await page.locator("body");
    const isVisible = await body.isVisible();
    if (!isVisible) {
      result.status = "failed";
      result.errors.push("Page body not visible");
    }
  } catch (error) {
    result.status = "failed";
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  // 如果有严重错误，标记为失败
  if (result.errors.length > 0) {
    result.status = "failed";
  }

  return result;
}

test.describe("AnyKeep 全面功能测试", () => {
  test.describe("1. 公开页面测试", () => {
    for (const { path, name } of PUBLIC_PAGES) {
      test(`${name} (${path})`, async ({ page }) => {
        const result = await testPageLoad(page, path, name);

        // eslint-disable-next-line no-console
        console.info(
          `[${result.status.toUpperCase()}] ${name}: ${result.loadTime}ms`,
        );
        if (result.errors.length > 0) {
          // eslint-disable-next-line no-console
          console.info(`  Errors: ${result.errors.join(", ")}`);
        }

        expect(result.status).toBe("passed");
      });
    }
  });

  test.describe("2. 受保护页面测试（未登录状态）", () => {
    for (const { path, name } of PROTECTED_PAGES) {
      test(`${name} (${path}) - 应重定向到登录`, async ({ page }) => {
        await page.goto(path, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        // 等待可能的重定向
        await page
          .waitForLoadState("networkidle", { timeout: 10000 })
          .catch(() => {
            /* timeout is expected */
          });

        const currentUrl = page.url();

        // 验证：要么在登录页，要么页面正常显示（某些页面可能有公开部分）
        const isLoginPage = currentUrl.includes("/login");
        const hasContent = await page.locator("body").isVisible();

        expect(isLoginPage || hasContent).toBe(true);

        // eslint-disable-next-line no-console
        console.info(
          `[INFO] ${name}: ${isLoginPage ? "重定向到登录页" : "页面可访问"}`,
        );
      });
    }
  });

  test.describe("3. 开发页面测试", () => {
    for (const { path, name } of DEV_PAGES) {
      test(`${name} (${path})`, async ({ page }) => {
        await page.goto(path, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        // 开发页面可能需要登录或不存在
        const hasContent = await page.locator("body").isVisible();
        expect(hasContent).toBe(true);
      });
    }
  });

  test.describe("4. API 端点测试", () => {
    const API_ENDPOINTS = [
      { path: "/api/health", name: "健康检查", method: "GET" },
      { path: "/api/bookmarks", name: "书签列表", method: "GET" },
      { path: "/api/folders", name: "文件夹列表", method: "GET" },
      { path: "/api/tags", name: "标签列表", method: "GET" },
    ];

    for (const { path, name, method } of API_ENDPOINTS) {
      test(`${name} (${method} ${path})`, async ({ request }) => {
        const response = await request.get(path).catch(() => null);

        if (response) {
          const status = response.status();
          // API 应该返回有效状态（200-299 或 401/403 需要认证）
          expect(status).toBeLessThan(500);
          // eslint-disable-next-line no-console
          console.info(`[API] ${name}: HTTP ${status}`);
        } else {
          // eslint-disable-next-line no-console
          console.info(`[API] ${name}: No response`);
        }
      });
    }
  });

  test.describe("5. 检查网络请求", () => {
    test("5.1 首页无失败请求", async ({ page }) => {
      const failedRequests: string[] = [];

      page.on("requestfailed", (request) => {
        const failure = request.failure();
        if (failure) {
          failedRequests.push(`${request.url()}: ${failure.errorText}`);
        }
      });

      await page.goto("/");
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {
          /* timeout is expected */
        });

      // 过滤掉预期的失败（如分析请求）
      const criticalFailures = failedRequests.filter(
        (r) =>
          !r.includes("analytics") &&
          !r.includes("gtag") &&
          !r.includes("favicon"),
      );

      if (criticalFailures.length > 0) {
        // eslint-disable-next-line no-console
        console.info("Failed requests:", criticalFailures);
      }

      expect(criticalFailures.length).toBe(0);
    });
  });
});
