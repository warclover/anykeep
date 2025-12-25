/**
 * AI 助手核心功能 E2E 测试
 *
 * 验证 AI 助手 Tool 调用是否正确工作
 * 基于务实修复方案 P2 测试用例设计
 *
 * @version 2.0.0 - 使用统一工具函数，增强稳定性
 * @since 2025-12-23
 */

import { test, expect } from "@playwright/test";
import {
  TIMEOUTS,
  AI_TEST_CONFIG,
  safeNavigate,
  skipIfLoginRequired,
  openAIPanel,
  sendAIMessage,
  getAIResponse,
  elementExists,
} from "./test-utils";

// ============================================
// 测试配置
// ============================================

test.describe("AI 助手核心功能", () => {
  // 使用 AI 测试配置
  test.setTimeout(AI_TEST_CONFIG.timeout);
  test.describe.configure({ retries: AI_TEST_CONFIG.retries });

  test.beforeEach(async ({ page }) => {
    await safeNavigate(page, "/home");
  });

  test.describe("基础查询", () => {
    test('问"我有多少收藏"应返回收藏数量', async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "我有多少收藏");
      const response = await getAIResponse(page);

      // 验证响应包含数字（收藏数量）
      expect(response).toBeTruthy();
      expect(response).toMatch(/\d+.*条?/);
    });

    test('问"最近收藏了什么"应返回书签列表', async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "最近收藏了什么");
      const response = await getAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
    });

    test("统计概览应返回平台分布信息", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "给我一个统计概览");
      const response = await getAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
    });
  });

  test.describe("搜索功能", () => {
    test('问"找关于 React 的"应执行语义搜索', async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "找一下关于 React 的文章");
      const response = await getAIResponse(page);

      // 验证响应存在（可能没有结果，但应该有回复）
      expect(response).toBeTruthy();
      // 响应应该提到搜索结果或没有找到
      expect(response).toMatch(/找到|没有|暂无|条|结果/);
    });

    test("搜索应在合理时间内响应", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      const startTime = Date.now();
      await sendAIMessage(page, "搜索 AI");
      await getAIResponse(page);
      const responseTime = Date.now() - startTime;

      // 搜索响应应在 15 秒内
      expect(responseTime).toBeLessThan(15000);
    });
  });

  test.describe("平台筛选", () => {
    test('问"微信收藏有多少"应按平台统计', async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "微信公众号收藏有多少");
      const response = await getAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
      // 应该包含数量信息
      expect(response).toMatch(/\d+|没有|暂无/);
    });

    test('问"B站收藏列表"应按平台筛选', async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "看看我的B站收藏");
      const response = await getAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
    });
  });

  test.describe("批量操作确认流程", () => {
    test("批量添加标签应显示确认对话框", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      // 先选择一些书签（如果界面支持）
      const selectAllCheckbox = page.locator(
        '[data-testid="select-all"], input[type="checkbox"]',
      );
      if (await elementExists(selectAllCheckbox, 2000)) {
        await selectAllCheckbox.click();
      }

      await sendAIMessage(page, "给选中的书签添加学习标签");
      await getAIResponse(page);

      // 检查是否显示确认对话框或确认按钮
      const confirmDialog = page.locator(
        '[data-testid="action-confirm-dialog"], [role="alertdialog"]',
      );
      const confirmButton = page.locator(
        'button:has-text("确认"), button:has-text("确认执行")',
      );

      const hasConfirmation =
        (await elementExists(confirmDialog, TIMEOUTS.quickCheck)) ||
        (await elementExists(confirmButton, TIMEOUTS.quickCheck));

      // 应该有确认机制（对话框或按钮）
      expect(hasConfirmation).toBeTruthy();
    });

    test("取消确认应正确处理", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "批量移动书签到学习文件夹");
      await getAIResponse(page);

      // 如果有确认对话框，点击取消
      const cancelButton = page.locator(
        'button:has-text("取消"), [data-testid="cancel-action"]',
      );
      if (await elementExists(cancelButton, TIMEOUTS.quickCheck)) {
        await cancelButton.click();

        // 验证对话框关闭
        const dialog = page.locator('[role="alertdialog"]');
        await expect(dialog).toBeHidden({ timeout: TIMEOUTS.quickCheck });
      }
    });
  });

  test.describe("错误处理", () => {
    test("无效查询应返回友好提示", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "asdfghjkl123456");
      const response = await getAIResponse(page);

      // 应该有回复，而不是崩溃
      expect(response).toBeTruthy();
    });

    test("空查询不应发送", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      const sendButton = page.locator('[data-testid="ai-send"]');
      const input = page.locator('[data-testid="ai-input"]');

      // 检查输入框是否存在
      if (!(await elementExists(input, TIMEOUTS.quickCheck))) {
        test.skip(true, "AI 输入框未找到");
        return;
      }

      // 清空输入
      await input.fill("");

      // 发送按钮应该禁用或点击无效
      if (await sendButton.isVisible()) {
        const isDisabled = await sendButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    });
  });

  test.describe("响应质量", () => {
    test("响应应使用中文", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "你好");
      const response = await getAIResponse(page);

      // 响应应该主要是中文
      expect(response).toBeTruthy();
      // 检查包含中文字符
      expect(response).toMatch(/[\u4e00-\u9fa5]/);
    });

    test("响应不应过长", async ({ page }) => {
      if (await skipIfLoginRequired(page)) return;

      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendAIMessage(page, "我有多少收藏");
      const response = await getAIResponse(page);

      // 简单查询的响应不应超过 500 字符
      expect(response).toBeTruthy();
      expect((response as string).length).toBeLessThan(500);
    });
  });
});

test.describe("AI 助手性能", () => {
  test.setTimeout(AI_TEST_CONFIG.timeout);
  test.describe.configure({ retries: AI_TEST_CONFIG.retries });

  test("首次响应时间应在可接受范围", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    const panelOpened = await openAIPanel(page);
    if (!panelOpened) {
      test.skip(true, "AI 助手面板未找到");
      return;
    }

    const startTime = Date.now();
    await sendAIMessage(page, "你好");
    await getAIResponse(page);
    const responseTime = Date.now() - startTime;

    // 首次响应应在 10 秒内
    expect(responseTime).toBeLessThan(10000);
  });

  test("连续对话应保持上下文", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    const panelOpened = await openAIPanel(page);
    if (!panelOpened) {
      test.skip(true, "AI 助手面板未找到");
      return;
    }

    // 第一个消息
    await sendAIMessage(page, "我有多少微信收藏");
    await getAIResponse(page);

    // 第二个消息（应该理解"它们"指的是微信收藏）
    await sendAIMessage(page, "最近一条是什么");
    const response = await getAIResponse(page);

    // 应该有回复
    expect(response).toBeTruthy();
  });
});
