import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// 加载 E2E 测试环境变量（.env.test.local 优先于 .env.local）
dotenv.config({ path: path.resolve(__dirname, ".env.test.local") });
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

/**
 * Playwright E2E 测试配置
 *
 * 多 Project 结构：
 * - auth-setup:     登录 setup，生成 storageState
 * - no-auth:        无需登录的测试（冒烟、页面巡览、认证流程）
 * - authenticated:  需要普通用户登录的测试（动态路由、功能测试）
 * - admin:          需要管理员登录的测试
 *
 * 当 E2E_USER_EMAIL 未配置时，仅运行 no-auth project，
 * 确保现有测试不受影响。
 *
 * @see https://playwright.dev/docs/test-configuration
 * @version 3.0.0 - 多 project 结构 + Auth Fixture
 */

const hasAuthConfig = !!(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD
);
const hasAdminConfig = !!(
  process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
);

export default defineConfig({
  testDir: "./e2e",
  /* 测试超时时间 - 60 秒 */
  timeout: 60 * 1000,
  /* 期望超时时间 - 10 秒 */
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
    /* 绕过 CSP 限制 */
    bypassCSP: true,
    /* 禁用浏览器缓存 - 避免缓存导致页面加载异常 */
    launchOptions: {
      args: ["--disable-cache", "--disk-cache-size=0"],
    },
  },

  /* 多 Project 配置 */
  projects: [
    // ---- Auth Setup（登录并保存 storageState）----
    ...(hasAuthConfig
      ? [
          {
            name: "auth-setup",
            testMatch: /auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),

    // ---- 无需登录的测试 ----
    {
      name: "no-auth",
      testMatch: /smoke\.spec|pages-tour\.spec|auth-flow\.spec/,
      use: { ...devices["Desktop Chrome"] },
    },

    // ---- 需要普通用户登录的测试 ----
    ...(hasAuthConfig
      ? [
          {
            name: "authenticated",
            dependencies: ["auth-setup"],
            testMatch:
              /dynamic-routes\.spec|search-functionality\.spec|knowledge-studio\.spec|batch-operations\.spec|data-export\.spec|link-health\.spec|md-reader-upgrade\.spec|ai-assistant-core\.spec|ai-chat-flow\.spec|ai-react-citation\.spec|browser-bookmark-import\.spec|anykeep-functional-test\.spec/,
            use: {
              ...devices["Desktop Chrome"],
              storageState: ".auth/user.json",
            },
          },
        ]
      : []),

    // ---- 需要管理员登录的测试 ----
    ...(hasAdminConfig
      ? [
          {
            name: "admin",
            dependencies: ["auth-setup"],
            testMatch: /admin\.spec/,
            use: {
              ...devices["Desktop Chrome"],
              storageState: ".auth/admin.json",
            },
          },
        ]
      : []),

    // ---- 兜底：未匹配的测试文件（无 auth，兼容旧行为）----
    ...(!hasAuthConfig
      ? [
          {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],

  /* 启动开发服务器 */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
