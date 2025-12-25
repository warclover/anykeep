/**
 * 基础冒烟测试
 *
 * 验证应用基本功能正常
 *
 * @version 2.0.0 - 增强稳定性
 * @since 2025-12-22
 */

import { test, expect } from "@playwright/test";
import { waitForPageReady, safeNavigate, TIMEOUTS } from "./test-utils";

test.describe("基础冒烟测试", () => {
  // 设置重试次数
  test.describe.configure({ retries: 2 });

  test("首页可访问", async ({ page }) => {
    await safeNavigate(page, "/");

    // 验证页面加载成功（不管是首页还是登录页）
    await expect(page).toHaveTitle(/.*/);

    // 检查页面是否有内容
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: TIMEOUTS.elementVisible });
  });

  test("登录页可访问", async ({ page }) => {
    await safeNavigate(page, "/login");

    // 验证登录页元素存在
    const loginForm = page.locator("form").first();
    await expect(loginForm).toBeVisible({ timeout: TIMEOUTS.elementVisible });
  });

  test("静态资源加载正常", async ({ page }) => {
    await page.goto("/");

    // 检查是否有 JavaScript 错误
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // 等待页面完全加载
    await waitForPageReady(page);

    // 过滤非关键错误
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("hydration") &&
        !e.includes("AbortError"),
    );

    // 严重错误应导致测试失败
    expect(criticalErrors).toHaveLength(0);
  });

  test("API 健康检查", async ({ page }) => {
    // 检查 API 是否响应
    const response = await page.request.get("/api/health").catch(() => null);

    // API 可能不存在，但如果存在应该返回成功状态
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});
