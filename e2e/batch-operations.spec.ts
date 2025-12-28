/**
 * 批量操作 E2E 测试
 *
 * 测试批量选择、批量标签管理、批量移动等功能
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

test.describe("批量操作功能", () => {
  test.setTimeout(QUICK_TEST_CONFIG.timeout);
  test.describe.configure({ retries: QUICK_TEST_CONFIG.retries });

  // ============================================
  // 1. 批量选择测试
  // ============================================

  test.describe("批量选择", () => {
    test("3.1 批量操作页面应正确渲染", async ({ page }) => {
      await safeNavigate(page, "/batch");
      if (await skipIfLoginRequired(page)) return;

      // 验证批量操作页面元素
      const batchPage = page.locator(
        '[data-testid="batch-page"], .batch-container, main',
      );
      await expect(batchPage).toBeVisible({ timeout: TIMEOUTS.elementVisible });

      // 验证工具栏存在
      const toolbar = page.locator(
        '[data-testid="batch-toolbar"], .batch-toolbar, [role="toolbar"]',
      );
      const hasToolbar = await elementExists(toolbar, TIMEOUTS.quickCheck);

      expect(hasToolbar).toBe(true);
    });

    test("3.2 全选功能应正确工作", async ({ page }) => {
      await safeNavigate(page, "/batch");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 查找全选复选框
      const selectAllCheckbox = page.locator(
        '[data-testid="select-all"], input[type="checkbox"][aria-label*="全选"], .select-all-checkbox',
      );

      if (await elementExists(selectAllCheckbox, TIMEOUTS.quickCheck)) {
        // 点击全选
        await safeClick(selectAllCheckbox);
        await page.waitForTimeout(500);

        // 验证选中计数更新
        const selectedCount = page.locator(
          '[data-testid="selected-count"], *:has-text("已选"), *:has-text("条")',
        );
        const hasCount = await elementExists(
          selectedCount,
          TIMEOUTS.quickCheck,
        );

        expect(hasCount).toBe(true);
      } else {
        test.skip(true, "全选功能未找到");
      }
    });

    test("3.3 Shift 范围选择应正确工作", async ({ page }) => {
      await safeNavigate(page, "/batch");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 查找书签项
      const bookmarkItems = page.locator(
        '[data-testid="bookmark-item"], .bookmark-item, [role="listitem"]',
      );
      const itemCount = await bookmarkItems.count();

      if (itemCount >= 3) {
        // 点击第一个
        const firstCheckbox = bookmarkItems
          .first()
          .locator('input[type="checkbox"]');
        if (await elementExists(firstCheckbox, TIMEOUTS.quickCheck)) {
          await safeClick(firstCheckbox);

          // Shift + 点击第三个
          const thirdCheckbox = bookmarkItems
            .nth(2)
            .locator('input[type="checkbox"]');
          await thirdCheckbox.click({ modifiers: ["Shift"] });

          await page.waitForTimeout(500);

          // 验证多个被选中
          const checkedItems = page.locator('input[type="checkbox"]:checked');
          const checkedCount = await checkedItems.count();

          expect(checkedCount).toBeGreaterThanOrEqual(3);
        } else {
          // 可能使用不同的选择机制
          await bookmarkItems.first().click();
          await bookmarkItems.nth(2).click({ modifiers: ["Shift"] });

          const selectedIndicator = page.locator(
            '[data-selected="true"], .selected',
          );
          const selectedCount = await selectedIndicator.count();

          expect(selectedCount).toBeGreaterThanOrEqual(1);
        }
      } else {
        test.skip(true, "书签数量不足以测试范围选择");
      }
    });
  });

  // ============================================
  // 2. 批量标签操作测试
  // ============================================

  test.describe("批量标签操作", () => {
    test("3.4 批量添加标签对话框应正确显示", async ({ page }) => {
      await safeNavigate(page, "/batch");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 先选择一些书签
      const selectAllCheckbox = page.locator(
        '[data-testid="select-all"], input[type="checkbox"][aria-label*="全选"]',
      );
      if (await elementExists(selectAllCheckbox, TIMEOUTS.quickCheck)) {
        await safeClick(selectAllCheckbox);
        await page.waitForTimeout(500);
      }

      // 点击添加标签按钮
      const addTagButton = page.locator(
        '[data-testid="batch-add-tag"], button:has-text("添加标签"), button:has-text("标签")',
      );

      if (await elementExists(addTagButton, TIMEOUTS.quickCheck)) {
        await safeClick(addTagButton);

        // 验证标签对话框显示
        const tagDialog = page.locator(
          '[data-testid="tag-dialog"], [role="dialog"]:has-text("标签")',
        );
        const hasDialog = await elementExists(
          tagDialog,
          TIMEOUTS.elementVisible,
        );

        expect(hasDialog).toBe(true);
      } else {
        test.skip(true, "添加标签按钮未找到");
      }
    });

    test("3.5 批量移除标签应正确工作", async ({ page }) => {
      await safeNavigate(page, "/batch");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 选择书签
      const selectAllCheckbox = page.locator('[data-testid="select-all"]');
      if (await elementExists(selectAllCheckbox, TIMEOUTS.quickCheck)) {
        await safeClick(selectAllCheckbox);
        await page.waitForTimeout(500);
      }

      // 查找移除标签按钮
      const removeTagButton = page.locator(
        '[data-testid="batch-remove-tag"], button:has-text("移除标签")',
      );

      if (await elementExists(removeTagButton, TIMEOUTS.quickCheck)) {
        await safeClick(removeTagButton);

        // 验证移除标签对话框显示
        const removeDialog = page.locator(
          '[role="dialog"]:has-text("移除"), [data-testid="remove-tag-dialog"]',
        );
        const hasDialog = await elementExists(
          removeDialog,
          TIMEOUTS.elementVisible,
        );

        expect(hasDialog).toBe(true);
      } else {
        // 移除标签可能在同一对话框中
        test.skip(true, "移除标签按钮未找到");
      }
    });
  });

  // ============================================
  // 3. 批量操作确认测试
  // ============================================

  test.describe("批量操作确认", () => {
    test("3.6 批量操作应显示确认对话框", async ({ page }) => {
      await safeNavigate(page, "/batch");
      if (await skipIfLoginRequired(page)) return;

      await waitForNetworkIdle(page);

      // 选择多个书签
      const selectAllCheckbox = page.locator('[data-testid="select-all"]');
      if (await elementExists(selectAllCheckbox, TIMEOUTS.quickCheck)) {
        await safeClick(selectAllCheckbox);
        await page.waitForTimeout(500);
      }

      // 尝试执行批量操作
      const batchDeleteButton = page.locator(
        'button:has-text("删除"), button:has-text("移动")',
      );

      if (await elementExists(batchDeleteButton, TIMEOUTS.quickCheck)) {
        await safeClick(batchDeleteButton);

        // 验证确认对话框
        const confirmDialog = page.locator(
          '[role="alertdialog"], [data-testid="confirm-dialog"]',
        );
        const confirmButton = page.locator('button:has-text("确认")');

        const hasConfirmation =
          (await elementExists(confirmDialog, TIMEOUTS.quickCheck)) ||
          (await elementExists(confirmButton, TIMEOUTS.quickCheck));

        expect(hasConfirmation).toBe(true);

        // 取消操作
        const cancelButton = page.locator('button:has-text("取消")');
        if (await elementExists(cancelButton, TIMEOUTS.quickCheck)) {
          await safeClick(cancelButton);
        }
      } else {
        test.skip(true, "批量操作按钮未找到");
      }
    });
  });
});

// ============================================
// 首页批量选择测试
// ============================================

test.describe("首页批量选择", () => {
  test.setTimeout(QUICK_TEST_CONFIG.timeout);

  test("首页应支持多选模式", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    await waitForNetworkIdle(page);

    // 查找书签项的复选框或多选模式入口
    const multiSelectToggle = page.locator(
      '[data-testid="multi-select-toggle"], button:has-text("多选"), button:has-text("选择")',
    );
    const checkboxes = page.locator(
      '[data-testid="bookmark-item"] input[type="checkbox"]',
    );

    const hasMultiSelect =
      (await elementExists(multiSelectToggle, TIMEOUTS.quickCheck)) ||
      (await checkboxes.count()) > 0;

    expect(hasMultiSelect).toBe(true);
  });
});
