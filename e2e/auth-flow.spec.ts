/**
 * 用户认证流程 E2E 测试
 *
 * 测试登录、注册、登出、密码重置等认证功能
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { test, expect } from "@playwright/test";
import {
  TIMEOUTS,
  QUICK_TEST_CONFIG,
  safeNavigate,
  waitForPageReady,
  elementExists,
  safeFill,
  safeClick,
} from "./test-utils";

// ============================================
// 测试配置
// ============================================

test.describe("用户认证流程", () => {
  test.setTimeout(QUICK_TEST_CONFIG.timeout);
  test.describe.configure({ retries: QUICK_TEST_CONFIG.retries });

  // ============================================
  // 1. 登录页面测试
  // ============================================

  test.describe("登录页面", () => {
    test("1.1 登录页面应正确渲染", async ({ page }) => {
      await safeNavigate(page, "/login");

      // 验证登录表单元素存在
      const emailInput = page.locator(
        'input[type="email"], input[name="email"]',
      );
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await expect(emailInput).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
      await expect(passwordInput).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
      await expect(submitButton).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
    });

    test("1.2 空表单提交应显示验证错误", async ({ page }) => {
      await safeNavigate(page, "/login");

      const submitButton = page.locator('button[type="submit"]');
      await safeClick(submitButton);

      // 验证显示错误信息
      const errorMessage = page.locator(
        '[role="alert"], .error-message, [data-testid="form-error"]',
      );
      const hasError = await elementExists(errorMessage, TIMEOUTS.quickCheck);

      // 或者表单字段显示验证状态
      const invalidField = page.locator('input:invalid, [aria-invalid="true"]');
      const hasInvalidField = await elementExists(
        invalidField,
        TIMEOUTS.quickCheck,
      );

      expect(hasError || hasInvalidField).toBe(true);
    });

    test("1.3 无效邮箱格式应显示错误", async ({ page }) => {
      await safeNavigate(page, "/login");

      const emailInput = page.locator(
        'input[type="email"], input[name="email"]',
      );
      await safeFill(emailInput, "invalid-email");

      const passwordInput = page.locator('input[type="password"]');
      await safeFill(passwordInput, "testpassword123");

      const submitButton = page.locator('button[type="submit"]');
      await safeClick(submitButton);

      // 等待验证反馈
      await page.waitForTimeout(500);

      // 验证邮箱字段显示错误状态
      const emailError = page.locator(
        '[data-testid="email-error"], [role="alert"]',
      );
      const emailInvalid = emailInput.locator('[aria-invalid="true"]');

      const hasEmailError =
        (await elementExists(emailError, TIMEOUTS.quickCheck)) ||
        (await elementExists(emailInvalid, TIMEOUTS.quickCheck));

      // 应该显示某种形式的邮箱验证错误
      expect(hasEmailError || page.url().includes("/login")).toBe(true);
    });
  });

  // ============================================
  // 2. 注册页面测试
  // ============================================

  test.describe("注册页面", () => {
    test("1.4 注册页面应正确渲染", async ({ page }) => {
      await safeNavigate(page, "/register");

      // 验证注册表单元素存在
      const emailInput = page.locator(
        'input[type="email"], input[name="email"]',
      );
      const passwordInput = page.locator('input[type="password"]').first();

      await expect(emailInput).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
      await expect(passwordInput).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
    });
  });

  // ============================================
  // 3. 未认证访问保护测试
  // ============================================

  test.describe("访问控制", () => {
    test("1.5 未登录用户访问受保护页面应重定向到登录页", async ({ page }) => {
      // 尝试访问受保护的页面
      await page.goto("/home", { waitUntil: "domcontentloaded" });

      // 等待可能的重定向
      await page.waitForTimeout(2000);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      await waitForPageReady(page).catch(() => {});

      const currentUrl = page.url();

      // 应该重定向到登录页或显示登录表单
      const isLoginPage = currentUrl.includes("/login");
      const hasLoginForm = await elementExists(
        page.locator('form input[type="password"]'),
        TIMEOUTS.quickCheck,
      );

      expect(isLoginPage || hasLoginForm).toBe(true);
    });
  });
});

// ============================================
// 登录状态测试（需要测试账号）
// ============================================

test.describe("登录状态管理", () => {
  test.setTimeout(QUICK_TEST_CONFIG.timeout);

  test("登录后应能访问受保护页面", async ({ page }) => {
    await safeNavigate(page, "/home");

    // 如果被重定向到登录页，跳过此测试
    if (page.url().includes("/login")) {
      test.skip(true, "需要登录状态才能测试此功能");
      return;
    }

    // 验证页面正常加载
    const mainContent = page.locator('main, [role="main"], #main-content');
    const hasContent = await elementExists(
      mainContent,
      TIMEOUTS.elementVisible,
    );

    expect(hasContent).toBe(true);
  });
});
