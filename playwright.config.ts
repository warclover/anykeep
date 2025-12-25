import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * @see https://playwright.dev/docs/test-configuration
 * @version 2.0.0 - 增强稳定性配置
 */
export default defineConfig({
  testDir: "./e2e",
  /* 测试超时时间 - 提高到 60 秒 */
  timeout: 60 * 1000,
  /* 期望超时时间 - 提高到 10 秒 */
  expect: {
    timeout: 10000,
  },
  /* 全局设置 */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /* 重试机制 - 本地 1 次，CI 3 次 */
  retries: process.env.CI ? 3 : 1,
  workers: process.env.CI ? 1 : undefined,
  /* 报告器 */
  reporter: [["html", { open: "never" }], ["list"]],
  /* 全局配置 */
  use: {
    /* 基础 URL */
    baseURL: "http://localhost:3000",
    /* 追踪设置 - 失败时保留追踪 */
    trace: "on-first-retry",
    /* 截图设置 - 失败时截图 */
    screenshot: "only-on-failure",
    /* 视频录制 - 失败时录制 */
    video: "on-first-retry",
    /* 智能等待配置 */
    actionTimeout: 15000,
    navigationTimeout: 30000,
    /* 忽略 HTTPS 错误（本地测试用） */
    ignoreHTTPSErrors: true,
  },

  /* 项目配置 - 只使用 Chromium */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* 启动开发服务器 */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
