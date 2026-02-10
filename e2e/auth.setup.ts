/**
 * Auth Setup - 在测试运行前登录并保存 storageState
 *
 * 生成文件:
 * - .auth/user.json   普通用户登录态
 * - .auth/admin.json  管理员登录态（需 ADMIN_EMAILS 包含该邮箱）
 *
 * 环境变量:
 * - E2E_USER_EMAIL / E2E_USER_PASSWORD
 * - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD（可选）
 *
 * @version 1.0.0
 */

import type { Page } from "@playwright/test";
import { test as setup, expect } from "@playwright/test";
import { TIMEOUTS } from "./test-utils";

const USER_STORAGE = ".auth/user.json";
const ADMIN_STORAGE = ".auth/admin.json";

/**
 * 通用登录函数
 *
 * 导航到 /login → 填写邮箱密码 → 提交 → 等待跳转离开 /login
 */
async function performLogin(
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  await page.goto("/login", {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.pageLoad,
  });

  // 等待页面稳定
  await page
    .waitForLoadState("networkidle", { timeout: TIMEOUTS.networkIdle })
    .catch(() => {});

  // 填写登录表单
  const emailInput = page
    .locator('input[type="email"], input[name="email"]')
    .first();
  const passwordInput = page.locator('input[type="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  await emailInput.waitFor({
    state: "visible",
    timeout: TIMEOUTS.elementVisible,
  });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitButton.click();

  // 等待登录成功（跳转离开 /login）
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

// ---- 普通用户登录 ----
setup("authenticate as user", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    setup.skip(
      true,
      "E2E_USER_EMAIL / E2E_USER_PASSWORD 未配置，跳过 user auth setup",
    );
    return;
  }

  const success = await performLogin(page, email, password);

  if (!success) {
    setup.skip(true, "普通用户登录失败，可能账号无效");
    return;
  }

  // 验证登录成功
  await expect(page).not.toHaveURL(/\/login/);

  // 保存 storageState
  await page.context().storageState({ path: USER_STORAGE });
});

// ---- 管理员登录 ----
setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    setup.skip(
      true,
      "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD 未配置，跳过 admin auth setup",
    );
    return;
  }

  const success = await performLogin(page, email, password);

  if (!success) {
    setup.skip(true, "管理员登录失败，可能账号无效");
    return;
  }

  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: ADMIN_STORAGE });
});
