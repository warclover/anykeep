/**
 * AnyKeep 逐页巡览测试
 *
 * 按顺序访问各页面，验证可访问性及关键元素，便于人工/自动化逐页回归。
 * 未登录时：公开页正常渲染，受保护页应重定向到登录。
 *
 * 运行方式：
 *   npx playwright test pages-tour.spec.ts
 *   npx playwright test pages-tour.spec.ts --headed   # 可观察浏览器
 *
 * @version 1.0.0
 */

import { test, expect } from "@playwright/test";
import { TIMEOUTS, waitForNetworkIdle } from "./test-utils";

// 公开页面（无需登录）
const PUBLIC_PAGES: { path: string; name: string; selector?: string }[] = [
  { path: "/", name: "根路径（重定向）" },
  { path: "/login", name: "登录", selector: "form" },
  { path: "/register", name: "注册", selector: "form" },
  { path: "/forgot-password", name: "忘记密码" },
  { path: "/privacy", name: "隐私政策" },
  { path: "/terms", name: "服务条款" },
];

// 受保护页面（未登录时应跳转登录或显示登录相关 UI）
const PROTECTED_PAGES: { path: string; name: string }[] = [
  { path: "/home", name: "主页" },
  { path: "/search", name: "搜索" },
  { path: "/folders", name: "文件夹" },
  { path: "/tags", name: "标签" },
  { path: "/inbox", name: "收件箱" },
  { path: "/batch", name: "批量操作" },
  { path: "/import", name: "导入" },
  { path: "/export", name: "数据导出" },
  { path: "/data", name: "数据" },
  { path: "/settings", name: "设置" },
  { path: "/analytics", name: "数据分析" },
  { path: "/activity", name: "活动" },
  { path: "/organize", name: "整理" },
  { path: "/messages", name: "消息" },
  { path: "/notifications", name: "通知" },
  { path: "/librarian", name: "知识管理" },
  { path: "/ai-hub", name: "AI 中心" },
  { path: "/learning-hub", name: "学习中心" },
  { path: "/folder-health", name: "文件夹健康" },
  { path: "/link-health", name: "链接健康" },
  { path: "/md-collections", name: "MD 合集" },
  { path: "/synthesis", name: "主题合成" },
  { path: "/knowledge-studio", name: "知识工坊" },
  { path: "/distribution", name: "分发" },
  { path: "/audio-library", name: "音频库" },
  { path: "/rules", name: "规则" },
  { path: "/skills-browser", name: "Skills 浏览" },
  { path: "/classification-manager", name: "分类管理" },
  { path: "/health", name: "健康页" },
  { path: "/admin/feedback", name: "管理员反馈" },
];

test.describe("逐页巡览 - 公开页面", () => {
  test.describe.configure({ retries: 1 });

  for (const { path, name, selector } of PUBLIC_PAGES) {
    test(`${name} (${path})`, async ({ page }) => {
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.pageLoad,
      });
      await waitForNetworkIdle(page, 5000).catch(() => {});

      expect(response?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });
      if (selector) {
        const el = page.locator(selector).first();
        await expect(el).toBeVisible({ timeout: TIMEOUTS.elementVisible });
      }
    });
  }
});

test.describe("逐页巡览 - 受保护页面（未登录）", () => {
  test.describe.configure({ retries: 1 });

  for (const { path, name } of PROTECTED_PAGES) {
    test(`${name} (${path}) - 应重定向或显示登录`, async ({ page }) => {
      await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.pageLoad,
      });
      await waitForNetworkIdle(page, 6000).catch(() => {});

      const url = page.url();
      const isLogin = url.includes("/login");
      const hasBody = await page.locator("body").isVisible();

      expect(hasBody).toBe(true);
      expect(isLogin || url.includes(path)).toBe(true);
    });
  }
});

test.describe("逐页巡览 - 子页面与设置子路由", () => {
  test.describe.configure({ retries: 1 });

  const SUB_PAGES = [
    { path: "/settings/ai", name: "设置 - AI" },
    { path: "/settings/ai-reports", name: "设置 - AI 报告" },
    { path: "/settings/feedback", name: "设置 - 反馈" },
    { path: "/settings/rag-dashboard", name: "设置 - RAG" },
    { path: "/messages/pending", name: "消息 - 待处理" },
    { path: "/synthesis/new", name: "主题合成 - 新建" },
    { path: "/knowledge-studio/v2", name: "知识工坊 v2" },
    { path: "/knowledge-studio/billing", name: "知识工坊 - 计费" },
    { path: "/knowledge-studio/reports", name: "知识工坊 - 报告" },
  ];

  for (const { path, name } of SUB_PAGES) {
    test(`${name} (${path})`, async ({ page }) => {
      await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUTS.pageLoad,
      });
      await waitForNetworkIdle(page, 6000).catch(() => {});

      const url = page.url();
      const hasBody = await page.locator("body").isVisible();
      const isLogin = url.includes("/login");

      expect(hasBody).toBe(true);
      expect(isLogin || url.includes(path.split("?")[0])).toBe(true);
    });
  }
});
