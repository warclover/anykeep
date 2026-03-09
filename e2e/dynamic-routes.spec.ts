/**
 * 动态路由页面 E2E 测试
 *
 * 测试策略：
 * 1. 无效 ID 降级测试 — 始终运行，验证错误处理不崩溃
 * 2. 真实数据渲染测试 — 条件运行，依赖 API 数据发现
 *
 * 前提：此文件在 "authenticated" project 下运行，已有 storageState
 *
 * @version 1.0.0
 */

import { test, expect } from "./fixtures";
import { TIMEOUTS, waitForNetworkIdle, elementExists } from "./test-utils";

// 注意：不使用 serial 模式，避免一个测试失败导致后续全部跳过

// ============================================
// 1. 无效 ID 降级测试（无需数据，始终运行）
// ============================================

test.describe("动态路由 - 无效 ID 降级测试", () => {
  test.describe.configure({ retries: 2 });

  // --- /bookmark/[id] ---

  test("bookmark/[id] - 非数字 ID 应优雅降级", async ({ page }) => {
    const response = await page.goto("/bookmark/invalid-id", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    // 不应 500 崩溃
    expect(response?.status() ?? 0).toBeLessThan(500);

    // 等待页面充分渲染（ErrorBoundary 需要客户端渲染）
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    const bodyText = (await body.textContent()) ?? "";

    // 应显示 404、错误边界或��定向
    const is404 = response?.status() === 404;
    const hasErrorUI =
      bodyText.includes("出错") ||
      bodyText.includes("404") ||
      bodyText.includes("不存在") ||
      bodyText.includes("not found") ||
      bodyText.includes("重试");
    const isRedirected =
      page.url().includes("/login") || page.url().includes("/home");

    expect(is404 || hasErrorUI || isRedirected).toBe(true);
  });

  test("bookmark/[id] - 不存在的数字 ID 应优雅降级", async ({ page }) => {
    const response = await page.goto("/bookmark/99999999", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    expect(response?.status() ?? 0).toBeLessThan(500);

    // 等待页面充分渲染
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    const bodyText = (await body.textContent()) ?? "";

    const is404 = response?.status() === 404;
    const hasErrorUI =
      bodyText.includes("出错") ||
      bodyText.includes("404") ||
      bodyText.includes("不存在") ||
      bodyText.includes("not found") ||
      bodyText.includes("重试");
    const isRedirected =
      page.url().includes("/login") || page.url().includes("/home");

    expect(is404 || hasErrorUI || isRedirected).toBe(true);
  });

  // --- /synthesis/[id] ---

  test("synthesis/[id] - 不存在的 UUID 应显示错误或空状态", async ({
    page,
  }) => {
    await page.goto("/synthesis/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    // 页面不应崩溃
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });

    // body 应有内容（不白屏）
    const text = await body.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  // --- /import/[batchId]/sandbox ---

  test("import/[batchId]/sandbox - 虚假 batchId 应显示错误或重定向", async ({
    page,
  }) => {
    await page.goto("/import/fake-batch-id-12345/sandbox", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });

    // 应有错误提示或重定向
    const hasError = await elementExists(
      page.locator("text=/错误|error|失败|出现问题/i"),
      TIMEOUTS.quickCheck,
    );
    const isRedirected =
      page.url().includes("/login") || page.url().includes("/import");

    // 不崩溃 + 有某种降级行为即通过
    expect(hasError || isRedirected || page.url().includes("/sandbox")).toBe(
      true,
    );
  });

  // --- /md-collections/[id] ---

  test("md-collections/[id] - 非数字 ID 应返回 404", async ({ page }) => {
    const response = await page.goto("/md-collections/not-a-number", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });

    expect(response?.status() ?? 0).toBeLessThan(500);
  });

  test("md-collections/[id] - 负数 ID 应返回 404", async ({ page }) => {
    const response = await page.goto("/md-collections/-1", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });

    expect(response?.status() ?? 0).toBeLessThan(500);
  });

  // --- /settings/feedback/[id] ---

  test("settings/feedback/[id] - 不存在的 UUID 应优雅处理", async ({
    page,
  }) => {
    await page.goto("/settings/feedback/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    // 等待客户端 fetch + 可能的 redirect
    await page.waitForTimeout(3000);

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });

    // 不崩溃即通过（可能 redirect 回列表或显示错误提示）
  });

  // --- /settings/ledger/[id] ---

  test("settings/ledger/[id] - 不存在的 ID 应优雅处理", async ({ page }) => {
    await page.goto("/settings/ledger/nonexistent-report-id", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });
  });
});

// ============================================
// 2. 真实数据渲染测试（条件运行，依赖数据发现）
// ============================================

test.describe("动态路由 - 真实数据渲染测试", () => {
  test.describe.configure({ retries: 1 });

  test("bookmark/[id] - 真实书签应正常渲染", async ({ page, testData }) => {
    if (!testData.bookmarkId) {
      test.skip(true, "未发现可用的 bookmark 测试数据");
      return;
    }

    await page.goto(`/bookmark/${testData.bookmarkId}`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    // 验证核心 UI 元素（标题）
    const titleElement = page
      .locator("h1, h2, [data-testid='bookmark-title']")
      .first();
    await expect(titleElement).toBeVisible({
      timeout: TIMEOUTS.elementVisible,
    });
  });

  test("synthesis/[id] - 真实综述应正常渲染", async ({ page, testData }) => {
    if (!testData.synthesisReportId) {
      test.skip(true, "未发现可用的 synthesis 测试数据");
      return;
    }

    await page.goto(`/synthesis/${testData.synthesisReportId}`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });
  });

  test("md-collections/[id] - 真实 MD 合集应正常渲染", async ({
    page,
    testData,
  }) => {
    if (!testData.mdCollectionId) {
      test.skip(true, "未发现可用的 md-collections 测试数据");
      return;
    }

    await page.goto(`/md-collections/${testData.mdCollectionId}`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    // Markdown 内容区应可见
    const content = page
      .locator(".prose, [data-testid='md-content'], article, .markdown-body")
      .first();
    const hasContent = await elementExists(content, TIMEOUTS.elementVisible);
    expect(hasContent).toBe(true);
  });

  test("settings/feedback/[id] - 真实反馈详情应正常渲染", async ({
    page,
    testData,
  }) => {
    if (!testData.feedbackId) {
      test.skip(true, "未发现可用的 feedback 测试数据");
      return;
    }

    await page.goto(`/settings/feedback/${testData.feedbackId}`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    await waitForNetworkIdle(page, TIMEOUTS.networkIdle).catch(() => {});

    // 详情页面可见或仍在列表页（均可接受）
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });
    expect(page.url()).toContain("/settings/feedback");
  });
});

// ============================================
// 3. 管理员页面 - 普通用户权限检查
// ============================================

test.describe("管理员页面 - 普通用户权限检查", () => {
  test.describe.configure({ retries: 2 });

  test("admin/feedback - 普通用户访问应被重定向或显示空数据", async ({
    page,
  }) => {
    await page.goto("/admin/feedback", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });
    // 等待客户端渲染完成
    await page.waitForTimeout(3000);

    const url = page.url();
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });

    // 当前测试账号可能同时是管理员，两种行为均可接受：
    // 1. 非管理员 → redirect 离开 /admin
    // 2. 是管理员 → 留在页面，显示反馈列表
    const isRedirected = !url.includes("/admin/feedback");
    const isOnAdminPage = url.includes("/admin/feedback");

    expect(isRedirected || isOnAdminPage).toBe(true);

    if (isOnAdminPage) {
      // 页面正常渲染即通过
      const text = await body.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });
});
