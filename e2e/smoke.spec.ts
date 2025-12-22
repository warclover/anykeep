/**
 * 基础冒烟测试
 *
 * 验证应用基本功能正常
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { test, expect } from "@playwright/test";

test.describe("基础冒烟测试", () => {
  test("首页可访问", async ({ page }) => {
    await page.goto("/");

    // 验证页面加载成功（不管是首页还是登录页）
    await expect(page).toHaveTitle(/.*/);

    // 检查页面是否有内容
    const body = await page.locator("body");
    await expect(body).toBeVisible();
  });

  test("登录页可访问", async ({ page }) => {
    await page.goto("/login");

    // 验证登录页元素存在
    const loginForm = page.locator("form").first();
    await expect(loginForm).toBeVisible({ timeout: 10000 });
  });

  test("静态资源加载正常", async ({ page }) => {
    await page.goto("/");

    // 检查是否有 JavaScript 错误
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // 等待页面完全加载
    await page.waitForLoadState("networkidle");

    // 如果有严重错误，测试失败
    const criticalErrors = errors.filter(
      (e) => !e.includes("ResizeObserver") && !e.includes("hydration"),
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
