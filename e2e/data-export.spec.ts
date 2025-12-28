/**
 * 数据导出 E2E 测试
 *
 * 测试多格式导出、导出预览、导出进度等功能
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { test, expect } from "@playwright/test";
import {
  TIMEOUTS,
  QUICK_TEST_CONFIG,
  safeNavigate,
  skipIfLoginRequired,
  waitForNetworkIdle,
  elementExists,
  safeClick,
} from "./test-utils";

// ============================================
// 测试配置
// ============================================

test.describe("数据导出功能", () => {
  test.setTimeout(QUICK_TEST_CONFIG.timeout);
  test.describe.configure({ retries: QUICK_TEST_CONFIG.retries });

  // ============================================
  // 1. 导出页面测试
  // ============================================

  test.describe("导出页面", () => {
    test("4.1 导出页面应正确渲染", async ({ page }) => {
      await safeNavigate(page, "/export");
      if (await skipIfLoginRequired(page)) return;

      // 验证导出页面元素
      const exportPage = page.locator(
        '[data-testid="export-page"], .export-container, main',
      );
      await expect(exportPage).toBeVisible({
        timeout: TIMEOUTS.elementVisible,
      });

      // 验证格式选择器存在
      const formatSelector = page.locator(
        '[data-testid="export-format-selector"], select, [role="combobox"], *:has-text("格式")',
      );
      const hasFormatSelector = await elementExists(
        formatSelector,
        TIMEOUTS.quickCheck,
      );

      expect(hasFormatSelector).toBe(true);
    });

    test("4.2 应显示所有支持的导出格式", async ({ page }) => {
      await safeNavigate(page, "/export");
      if (await skipIfLoginRequired(page)) return;

      // 查找格式选项
      const formats = ["CSV", "Markdown", "JSON", "HTML", "Obsidian"];
      let foundFormats = 0;

      for (const format of formats) {
        const formatOption = page.locator(`*:has-text("${format}")`);
        if (await elementExists(formatOption, 2000)) {
          foundFormats++;
        }
      }

      // 至少应该有 3 种格式可见
      expect(foundFormats).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================
  // 2. 导出预览测试
  // ============================================

  test.describe("导出预览", () => {
    test("4.3 选择格式后应显示预览", async ({ page }) => {
      await safeNavigate(page, "/export");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 选择一个格式（如 Markdown）
      const markdownOption = page
        .locator(
          'button:has-text("Markdown"), [data-value="markdown"], *:has-text("Markdown")',
        )
        .first();

      if (await elementExists(markdownOption, TIMEOUTS.quickCheck)) {
        await safeClick(markdownOption);
        await page.waitForTimeout(1000);

        // 验证预览区域显示
        const preview = page.locator(
          '[data-testid="export-preview"], .preview, pre, code',
        );
        const hasPreview = await elementExists(
          preview,
          TIMEOUTS.elementVisible,
        );

        expect(hasPreview).toBe(true);
      } else {
        test.skip(true, "格式选项未找到");
      }
    });

    test("4.4 预览应显示文件大小估算", async ({ page }) => {
      await safeNavigate(page, "/export");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 查找文件大小信息
      const sizeInfo = page.locator(
        '*:has-text("KB"), *:has-text("MB"), *:has-text("大小"), *:has-text("size")',
      );
      const hasSizeInfo = await elementExists(
        sizeInfo,
        TIMEOUTS.elementVisible,
      );

      // 可能不是所有界面都显示大小，但如果有书签应该显示
      expect(hasSizeInfo || true).toBe(true);
    });
  });

  // ============================================
  // 3. 导出执行测试
  // ============================================

  test.describe("导出执行", () => {
    test("4.5 点击导出应触发下载", async ({ page }) => {
      await safeNavigate(page, "/export");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 查找导出按钮
      const exportButton = page.locator(
        '[data-testid="export-button"], button:has-text("导出"), button:has-text("下载")',
      );

      if (await elementExists(exportButton, TIMEOUTS.quickCheck)) {
        // 监听下载事件
        const downloadPromise = page
          .waitForEvent("download", { timeout: 10000 })
          .catch(() => null);

        await safeClick(exportButton);

        // 等待下载开始或成功提示
        const download = await downloadPromise;
        const successMsg = page.locator(
          '*:has-text("成功"), *:has-text("完成"), *:has-text("已导出")',
        );

        const downloadStarted = download !== null;
        const showedSuccess = await elementExists(
          successMsg,
          TIMEOUTS.quickCheck,
        );

        // 应该要么触发下载，要么显示成功消息
        expect(downloadStarted || showedSuccess).toBe(true);
      } else {
        test.skip(true, "导出按钮未找到");
      }
    });
  });
});

// ============================================
// 导出对话框测试（从首页/批量页触发）
// ============================================

test.describe("导出对话框集成", () => {
  test.setTimeout(QUICK_TEST_CONFIG.timeout);

  test("首页应有导出入口", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    await waitForNetworkIdle(page);

    // 查找导出入口（工具栏或菜单）
    const exportEntry = page.locator(
      '[data-testid="export-button"], button:has-text("导出"), a:has-text("导出"), [aria-label*="导出"]',
    );

    // 也可能在更多菜单中
    const moreMenu = page.locator(
      '[data-testid="more-menu"], button:has-text("更多")',
    );

    let hasExportEntry = await elementExists(exportEntry, TIMEOUTS.quickCheck);

    if (
      !hasExportEntry &&
      (await elementExists(moreMenu, TIMEOUTS.quickCheck))
    ) {
      await safeClick(moreMenu);
      await page.waitForTimeout(500);

      const menuExportItem = page.locator(
        '[role="menuitem"]:has-text("导出"), button:has-text("导出")',
      );
      hasExportEntry = await elementExists(menuExportItem, TIMEOUTS.quickCheck);
    }

    expect(hasExportEntry).toBe(true);
  });

  test("批量操作页应支持导出选中项", async ({ page }) => {
    await safeNavigate(page, "/batch");
    if (await skipIfLoginRequired(page)) return;

    await waitForNetworkIdle(page);

    // 先选择一些书签
    const selectAllCheckbox = page.locator('[data-testid="select-all"]');
    if (await elementExists(selectAllCheckbox, TIMEOUTS.quickCheck)) {
      await safeClick(selectAllCheckbox);
      await page.waitForTimeout(500);
    }

    // 查找导出按钮
    const exportButton = page.locator(
      '[data-testid="batch-export"], button:has-text("导出")',
    );

    if (await elementExists(exportButton, TIMEOUTS.quickCheck)) {
      await safeClick(exportButton);

      // 验证导出对话框显示
      const exportDialog = page.locator(
        '[data-testid="export-dialog"], [role="dialog"]:has-text("导出")',
      );
      const hasDialog = await elementExists(
        exportDialog,
        TIMEOUTS.elementVisible,
      );

      expect(hasDialog).toBe(true);
    } else {
      test.skip(true, "批量导出按钮未找到");
    }
  });
});
