import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* 测试超时时间 */
  timeout: 30 * 1000,
  /* 期望超时时间 */
  expect: {
    timeout: 5000,
  },
  /* 全局设置 */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /* 报告器 */
  reporter: [["html", { open: "never" }], ["list"]],
  /* 全局配置 */
  use: {
    /* 基础 URL */
    baseURL: "http://localhost:3000",
    /* 追踪设置 */
    trace: "on-first-retry",
    /* 截图设置 */
    screenshot: "only-on-failure",
    /* 视频录制 */
    video: "on-first-retry",
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
