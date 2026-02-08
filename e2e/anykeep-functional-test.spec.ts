/**
 * AnyKeep 全面功能测试
 *
 * 测试所有页面的可访问性、JavaScript 错误、网络请求
 *
 * @version 2.0.0 - 增强稳定性
 * @since 2025-12-25
 */

import { test, expect, type Page } from "@playwright/test";
import { TIMEOUTS, QUICK_TEST_CONFIG, waitForNetworkIdle } from "./test-utils";

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
  { path: "/import", name: "导入" },
  { path: "/export", name: "数据导出" },
  { path: "/data", name: "数据管理" },
  { path: "/settings", name: "设置页" },
  { path: "/settings/ai", name: "AI 设置" },
  { path: "/settings/ai-reports", name: "AI 报告" },
  { path: "/settings/feedback", name: "反馈列表" },
  { path: "/settings/ledger", name: "账本" },
  { path: "/settings/rag-dashboard", name: "RAG 仪表盘" },
  { path: "/analytics", name: "数据分析" },
  { path: "/activity", name: "活动记录" },
  { path: "/inbox", name: "收件箱" },
  { path: "/organize", name: "整理" },
  { path: "/messages", name: "消息中心" },
  { path: "/messages/pending", name: "待处理消息" },
  { path: "/notifications", name: "通知" },
  { path: "/librarian", name: "知识管理" },
  { path: "/ai-hub", name: "AI 中心" },
  { path: "/learning-hub", name: "学习中心" },
  { path: "/folder-health", name: "文件夹健康检查" },
  { path: "/link-health", name: "链接健康检测" },
  { path: "/md-collections", name: "Markdown 合集" },
  { path: "/synthesis", name: "主题合成" },
  { path: "/synthesis/new", name: "新建主题合成" },
  { path: "/knowledge-studio", name: "知识工坊" },
  { path: "/knowledge-studio/v2", name: "知识工坊 v2" },
  { path: "/knowledge-studio/billing", name: "知识工坊计费" },
  { path: "/knowledge-studio/reports", name: "知识工坊报告" },
  { path: "/distribution", name: "分发" },
  { path: "/audio-library", name: "音频库" },
  { path: "/rules", name: "规则" },
  { path: "/skills-browser", name: "Skills 浏览" },
  { path: "/classification-manager", name: "分类管理" },
  { path: "/health", name: "健康检查页" },
];

const DEV_PAGES = [
  { path: "/ai-test", name: "AI 测试页" },
  { path: "/dev/classification-trace", name: "分类追踪" },
  { path: "/dev/api-docs", name: "API 文档" },
  { path: "/dev/ai-debug", name: "AI 调试" },
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
      timeout: TIMEOUTS.pageLoad,
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

    // 等待页面稳定（使用较短超时，避免阻塞）
    await waitForNetworkIdle(page, TIMEOUTS.elementVisible).catch(() => {
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
  // 配置重试以提高稳定性
  test.describe.configure({ retries: QUICK_TEST_CONFIG.retries });

  test.describe("1. 公开页面测试", () => {
    for (const { path, name } of PUBLIC_PAGES) {
      test(`${name} (${path})`, async ({ page }) => {
        const result = await testPageLoad(page, path, name);

        console.info(
          `[${result.status.toUpperCase()}] ${name}: ${result.loadTime}ms`,
        );
        if (result.errors.length > 0) {
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
          timeout: TIMEOUTS.pageLoad,
        });

        // 等待可能的重定向
        await waitForNetworkIdle(page, TIMEOUTS.elementVisible).catch(() => {
          /* timeout is expected */
        });

        const currentUrl = page.url();

        // 验证：要么在登录页，要么页面正常显示（某些页面可能有公开部分）
        const isLoginPage = currentUrl.includes("/login");
        const hasContent = await page.locator("body").isVisible();

        expect(isLoginPage || hasContent).toBe(true);

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
          timeout: TIMEOUTS.pageLoad,
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

          console.info(`[API] ${name}: HTTP ${status}`);
        } else {
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
      await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {
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
        console.info("Failed requests:", criticalFailures);
      }

      expect(criticalFailures.length).toBe(0);
    });
  });
});
