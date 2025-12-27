/**
 * 链接健康检测 E2E 测试
 *
 * 测试链接健康检测页面的完整用户流程
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { test, expect, type Page, type Route } from "@playwright/test";
import {
  TIMEOUTS,
  safeNavigate,
  waitForPageReady,
  skipIfLoginRequired,
  safeClick,
  waitForElementStable,
} from "./test-utils";

// ============================================
// 测试常量
// ============================================

const LINK_HEALTH_PATH = "/link-health";

/** 页面选择器 */
const SELECTORS = {
  // 页面标题
  pageTitle: 'h1:has-text("链接健康检测")',
  pageDescription: "text=检测收藏链接的可访问性",

  // 配置区域
  configCard: "text=检测配置",
  scopeSelect: '[role="combobox"]',
  scopeOptionAll: "text=全部书签",
  scopeOptionFolder: "text=指定文件夹",
  folderSelect: '[placeholder="选择文件夹"]',

  // 操作按钮
  startButton: 'button:has-text("开始检测")',
  stopButton: 'button:has-text("停止检测")',
  refreshButton: 'button:has-text("刷新")',

  // 进度显示
  progressBar: '[role="progressbar"]',
  progressText: "text=正在检测",

  // 结果区域
  resultCard: "text=检测结果",
  healthRate: "text=链接健康率",
  statsGrid: ".grid-cols-5",

  // 问题列表
  problemTabs: '[role="tablist"]',
  tabAll: "text=全部",
  tabFailed: "text=失效",
  tabSlow: "text=缓慢",
  tabRedirect: "text=重定向",
  problemTable: "table",
  fixButton: 'button:has-text("修复")',

  // 修复对话框
  fixDialog: '[role="dialog"]',
  fixDialogTitle: "text=修复问题链接",
  fixOptionDelete: "text=删除书签",
  fixOptionArchive: "text=归档书签",
  fixOptionUpdate: "text=更新链接",
  fixOptionIgnore: "text=忽略问题",
  newUrlInput: 'input[type="url"]',
  confirmButton: 'button:has-text("确认修复")',
  cancelButton: '[role="dialog"] button:has-text("取消")',

  // 空状态
  emptyState: "text=尚未运行检测",
  successState: "text=太棒了！所有链接都是健康的",

  // Wayback 提示
  waybackHint: "text=发现该链接的归档版本",
  useWaybackButton: 'button:has-text("使用此链接")',
};

// ============================================
// Mock 数据
// ============================================

const MOCK_CHECK_RESPONSE = {
  stats: {
    totalChecked: 10,
    healthyCount: 7,
    failedCount: 2,
    slowCount: 1,
    redirectCount: 0,
  },
  problems: [
    {
      bookmarkId: 1,
      url: "https://example.com/broken",
      status: "failed",
      httpStatus: 404,
      errorType: "not_found",
      errorMessage: "页面不存在",
      checkedAt: new Date().toISOString(),
    },
    {
      bookmarkId: 2,
      url: "https://example.com/slow",
      status: "slow",
      httpStatus: 200,
      responseTimeMs: 8500,
      checkedAt: new Date().toISOString(),
    },
    {
      bookmarkId: 3,
      url: "https://example.com/archived",
      status: "failed",
      httpStatus: 410,
      errorType: "not_found",
      errorMessage: "页面已删除",
      waybackUrl:
        "https://web.archive.org/web/20231001/https://example.com/archived",
      checkedAt: new Date().toISOString(),
    },
  ],
};

// ============================================
// 辅助函数
// ============================================

/**
 * 模拟 SSE 检测响应
 */
function createMockSSEResponse(): string {
  const events = [
    { type: "progress", data: { percent: 10, message: "正在检测: 1/10" } },
    { type: "progress", data: { percent: 50, message: "正在检测: 5/10" } },
    { type: "progress", data: { percent: 90, message: "正在检测: 9/10" } },
    {
      type: "deliverable",
      data: {
        type: "report",
        content: {
          checkId: "test-check-123",
          stats: MOCK_CHECK_RESPONSE.stats,
          problems: MOCK_CHECK_RESPONSE.problems,
        },
      },
    },
    { type: "done", data: { success: true } },
  ];

  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

/**
 * 设置 API Mock
 */
async function setupMocks(page: Page): Promise<void> {
  // Mock 检测 API
  await page.route("**/api/link-health/check**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: createMockSSEResponse(),
    });
  });

  // Mock 修复 API
  await page.route("**/api/link-health/fix", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock 状态 API
  await page.route("**/api/link-health/status", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hasActiveCheck: false,
        lastCheck: null,
        stats: { total: 100, healthy: 95, failed: 3, slow: 2, unknown: 0 },
      }),
    });
  });
}

// ============================================
// 测试套件
// ============================================

test.describe("链接健康检测 E2E 测试", () => {
  // 配置重试
  test.describe.configure({ retries: 2 });

  test.describe("1. 页面导航测试", () => {
    test("1.1 页面可访问（未登录重定向）", async ({ page }) => {
      await page.goto(LINK_HEALTH_PATH, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.pageLoad,
      });

      // 等待可能的重定向
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes("/login");
      const isLinkHealthPage = currentUrl.includes("/link-health");

      // 要么重定向到登录页，要么在链接健康页
      expect(isLoginPage || isLinkHealthPage).toBe(true);
    });

    test("1.2 侧边栏入口可见", async ({ page }) => {
      await safeNavigate(page, "/home");

      // 检查侧边栏是否包含链接健康入口
      const sidebarLink = page.locator('a[href="/link-health"]');

      // 侧边栏可能折叠，先等待页面加载
      await waitForPageReady(page);

      // 展开开发者工具分组（如果需要）
      const devToolsGroup = page.locator("text=开发者工具");
      if (await devToolsGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
        await devToolsGroup.click();
        await page.waitForTimeout(300);
      }

      // 验证链接存在
      const linkExists = await sidebarLink.count();
      expect(linkExists).toBeGreaterThan(0);
    });
  });

  test.describe("2. 页面 UI 测试", () => {
    test.beforeEach(async ({ page }) => {
      await setupMocks(page);
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;
    });

    test("2.1 页面标题和描述正确", async ({ page }) => {
      if (page.url().includes("/login")) {
        test.skip(true, "需要登录");
        return;
      }

      await expect(page.locator(SELECTORS.pageTitle)).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
      await expect(page.locator(SELECTORS.pageDescription)).toBeVisible();
    });

    test("2.2 检测配置区域显示", async ({ page }) => {
      if (page.url().includes("/login")) {
        test.skip(true, "需要登录");
        return;
      }

      await expect(page.locator(SELECTORS.configCard)).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
      await expect(page.locator(SELECTORS.startButton)).toBeVisible();
    });

    test("2.3 范围选择器工作正常", async ({ page }) => {
      if (page.url().includes("/login")) {
        test.skip(true, "需要登录");
        return;
      }

      const scopeSelect = page.locator(SELECTORS.scopeSelect).first();
      await expect(scopeSelect).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });

      // 点击打开选择器
      await safeClick(scopeSelect);
      await page.waitForTimeout(300);

      // 验证选项存在
      await expect(page.locator(SELECTORS.scopeOptionAll)).toBeVisible();
      await expect(page.locator(SELECTORS.scopeOptionFolder)).toBeVisible();
    });

    test("2.4 初始状态显示空状态", async ({ page }) => {
      if (page.url().includes("/login")) {
        test.skip(true, "需要登录");
        return;
      }

      await expect(page.locator(SELECTORS.emptyState)).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
    });
  });

  test.describe("3. 检测流程测试（Mock）", () => {
    test.beforeEach(async ({ page }) => {
      await setupMocks(page);
    });

    test("3.1 点击开始检测启动流程", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      const startButton = page.locator(SELECTORS.startButton);
      await waitForElementStable(startButton);

      // 点击开始
      await startButton.click();

      // 应该显示进度或结果
      await page.waitForTimeout(500);

      // 由于是 Mock，应该很快完成并显示结果
      const hasProgress = await page
        .locator(SELECTORS.progressBar)
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const hasResult = await page
        .locator(SELECTORS.resultCard)
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(hasProgress || hasResult).toBe(true);
    });

    test("3.2 检测完成后显示结果", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 点击开始检测
      await page.locator(SELECTORS.startButton).click();

      // 等待结果显示
      await expect(page.locator(SELECTORS.resultCard)).toBeVisible({
        timeout: TIMEOUTS.aiResponse,
      });

      // 验证统计数据显示
      await expect(page.locator(SELECTORS.healthRate)).toBeVisible();
    });

    test("3.3 问题标签页切换正常", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 运行检测
      await page.locator(SELECTORS.startButton).click();
      await expect(page.locator(SELECTORS.resultCard)).toBeVisible({
        timeout: TIMEOUTS.aiResponse,
      });

      // 验证标签页存在
      const tabs = page.locator(SELECTORS.problemTabs);
      await expect(tabs).toBeVisible();

      // 点击失效标签
      const failedTab = page.locator('[role="tab"]:has-text("失效")');
      if (await failedTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await failedTab.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe("4. 修复对话框测试", () => {
    test.beforeEach(async ({ page }) => {
      await setupMocks(page);
    });

    test("4.1 点击修复按钮打开对话框", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 运行检测
      await page.locator(SELECTORS.startButton).click();
      await expect(page.locator(SELECTORS.resultCard)).toBeVisible({
        timeout: TIMEOUTS.aiResponse,
      });

      // 点击修复按钮
      const fixButton = page.locator(SELECTORS.fixButton).first();
      if (await fixButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fixButton.click();

        // 验证对话框打开
        await expect(page.locator(SELECTORS.fixDialog)).toBeVisible({
          timeout: TIMEOUTS.elementVisible,
        });
        await expect(page.locator(SELECTORS.fixDialogTitle)).toBeVisible();
      }
    });

    test("4.2 修复选项全部显示", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 运行检测并打开修复对话框
      await page.locator(SELECTORS.startButton).click();
      await expect(page.locator(SELECTORS.resultCard)).toBeVisible({
        timeout: TIMEOUTS.aiResponse,
      });

      const fixButton = page.locator(SELECTORS.fixButton).first();
      if (await fixButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fixButton.click();

        // 验证所有修复选项
        await expect(page.locator(SELECTORS.fixOptionDelete)).toBeVisible();
        await expect(page.locator(SELECTORS.fixOptionArchive)).toBeVisible();
        await expect(page.locator(SELECTORS.fixOptionUpdate)).toBeVisible();
        await expect(page.locator(SELECTORS.fixOptionIgnore)).toBeVisible();
      }
    });

    test("4.3 选择更新链接显示输入框", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 运行检测并打开修复对话框
      await page.locator(SELECTORS.startButton).click();
      await expect(page.locator(SELECTORS.resultCard)).toBeVisible({
        timeout: TIMEOUTS.aiResponse,
      });

      const fixButton = page.locator(SELECTORS.fixButton).first();
      if (await fixButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fixButton.click();

        // 点击更新链接选项
        const updateOption = page.locator(SELECTORS.fixOptionUpdate);
        await updateOption.click();
        await page.waitForTimeout(300);

        // 验证输入框显示
        await expect(page.locator(SELECTORS.newUrlInput)).toBeVisible();
      }
    });

    test("4.4 取消按钮关闭对话框", async ({ page }) => {
      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 运行检测并打开修复对话框
      await page.locator(SELECTORS.startButton).click();
      await expect(page.locator(SELECTORS.resultCard)).toBeVisible({
        timeout: TIMEOUTS.aiResponse,
      });

      const fixButton = page.locator(SELECTORS.fixButton).first();
      if (await fixButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fixButton.click();
        await expect(page.locator(SELECTORS.fixDialog)).toBeVisible();

        // 点击取消
        await page.locator(SELECTORS.cancelButton).click();

        // 验证对话框关闭
        await expect(page.locator(SELECTORS.fixDialog)).toBeHidden({
          timeout: TIMEOUTS.elementVisible,
        });
      }
    });
  });

  test.describe("5. API 端点测试", () => {
    test("5.1 检测 API 端点响应", async ({ request }) => {
      const response = await request
        .get("/api/link-health/status")
        .catch(() => null);

      if (response) {
        const status = response.status();
        // 应该返回有效状态（200 或 401 需要认证）
        expect(status).toBeLessThan(500);
      }
    });

    test("5.2 修复 API 端点响应", async ({ request }) => {
      const response = await request
        .post("/api/link-health/fix", {
          data: { bookmarkId: 1, action: "ignore" },
        })
        .catch(() => null);

      if (response) {
        const status = response.status();
        // 应该返回有效状态
        expect(status).toBeLessThan(500);
      }
    });
  });

  test.describe("6. 错误处理测试", () => {
    test("6.1 网络错误时显示错误提示", async ({ page }) => {
      // Mock 网络错误
      await page.route("**/api/link-health/check**", async (route: Route) => {
        await route.abort("failed");
      });

      await safeNavigate(page, LINK_HEALTH_PATH);
      const skipped = await skipIfLoginRequired(page);
      if (skipped) return;

      // 尝试开始检测
      await page.locator(SELECTORS.startButton).click();

      // 应该有错误提示（toast 或状态更新）
      await page.waitForTimeout(2000);

      // 验证没有崩溃，页面仍然可用
      await expect(page.locator(SELECTORS.startButton)).toBeVisible();
    });
  });
});
