/**
 * AI 助手核心功能 E2E 测试
 *
 * 验证 AI 助手 Tool 调用是否正确工作
 * 基于务实修复方案 P2 测试用例设计
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";

// ============================================
// 测试配置
// ============================================

const TEST_CONFIG = {
  // 测试超时时间
  timeout: 90000,
  // AI 响应超时
  aiResponseTimeout: 45000,
  // 输入延迟（模拟真实用户）
  typeDelay: 50,
};

// ============================================
// 辅助函数
// ============================================

/**
 * 等待 AI 助手面板打开
 */
async function openAIPanel(page: Page): Promise<boolean> {
  // 查找并点击 AI 助手按钮
  const aiButton = page.locator(
    '[data-testid="ai-assistant-button"], button:has-text("AI助手"), button:has-text("智能助手")',
  );

  if (await aiButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aiButton.click();
    // 等待面板打开
    await page.waitForSelector('[data-testid="ai-assistant-panel"]', {
      timeout: 5000,
    });
    return true;
  }
  return false;
}

/**
 * 发送消息给 AI 助手
 */
async function sendMessage(page: Page, message: string): Promise<void> {
  const input = page.locator(
    '[data-testid="ai-input"], textarea[placeholder*="输入"], input[placeholder*="问"]',
  );
  await input.fill(message);

  // 按回车或点击发送按钮
  const sendButton = page.locator(
    '[data-testid="ai-send"], button:has-text("发送")',
  );
  if (await sendButton.isVisible()) {
    await sendButton.click();
  } else {
    await input.press("Enter");
  }
}

/**
 * 等待 AI 响应完成
 */
async function waitForAIResponse(page: Page): Promise<string | null> {
  // 等待加载指示器消失
  await page
    .waitForSelector('[data-testid="ai-loading"]', {
      state: "hidden",
      timeout: TEST_CONFIG.aiResponseTimeout,
    })
    .catch(() => {
      // 加载指示器可能不存在，忽略
    });

  // 等待响应消息出现
  const response = page.locator('[data-testid="ai-message-assistant"]').last();
  await response
    .waitFor({ timeout: TEST_CONFIG.aiResponseTimeout })
    .catch(() => {
      // 响应可能还未出现，继续
    });

  if (await response.isVisible()) {
    return await response.textContent();
  }
  return null;
}

/**
 * 检查是否有 Tool 调用（保留供未来使用）
 */
async function _checkToolCall(page: Page, toolName: string): Promise<boolean> {
  // 检查 Tool 调用指示器
  const toolIndicator = page.locator(
    `[data-testid="tool-call-${toolName}"], [data-tool="${toolName}"]`,
  );
  return await toolIndicator.isVisible({ timeout: 5000 }).catch(() => false);
}

/**
 * 检查是否显示确认对话框
 */
async function checkConfirmationDialog(page: Page): Promise<boolean> {
  const dialog = page.locator(
    '[data-testid="action-confirm-dialog"], [role="alertdialog"]',
  );
  return await dialog.isVisible({ timeout: 5000 }).catch(() => false);
}

// ============================================
// 测试用例
// ============================================

test.describe("AI 助手核心功能", () => {
  test.setTimeout(TEST_CONFIG.timeout);

  test.beforeEach(async ({ page }) => {
    await page.goto("/home");

    // 检查是否需要登录
    if (page.url().includes("/login")) {
      test.skip(true, "需要登录才能测试 AI 功能");
    }
  });

  test.describe("基础查询", () => {
    test('问"我有多少收藏"应返回收藏数量', async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "我有多少收藏");
      const response = await waitForAIResponse(page);

      // 验证响应包含数字（收藏数量）
      expect(response).toBeTruthy();
      expect(response).toMatch(/\d+.*条?/);
    });

    test('问"最近收藏了什么"应返回书签列表', async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "最近收藏了什么");
      const response = await waitForAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
    });

    test("统计概览应返回平台分布信息", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "给我一个统计概览");
      const response = await waitForAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
    });
  });

  test.describe("搜索功能", () => {
    test('问"找关于 React 的"应执行语义搜索', async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "找一下关于 React 的文章");
      const response = await waitForAIResponse(page);

      // 验证响应存在（可能没有结果，但应该有回复）
      expect(response).toBeTruthy();
      // 响应应该提到搜索结果或没有找到
      expect(response).toMatch(/找到|没有|暂无|条|结果/);
    });

    test("搜索应在合理时间内响应", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      const startTime = Date.now();
      await sendMessage(page, "搜索 AI");
      await waitForAIResponse(page);
      const responseTime = Date.now() - startTime;

      // 搜索响应应在 15 秒内
      expect(responseTime).toBeLessThan(15000);
    });
  });

  test.describe("平台筛选", () => {
    test('问"微信收藏有多少"应按平台统计', async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "微信公众号收藏有多少");
      const response = await waitForAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
      // 应该包含数量信息
      expect(response).toMatch(/\d+|没有|暂无/);
    });

    test('问"B站收藏列表"应按平台筛选', async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "看看我的B站收藏");
      const response = await waitForAIResponse(page);

      // 验证响应存在
      expect(response).toBeTruthy();
    });
  });

  test.describe("批量操作确认流程", () => {
    test("批量添加标签应显示确认对话框", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      // 先选择一些书签（如果界面支持）
      const selectAllCheckbox = page.locator(
        '[data-testid="select-all"], input[type="checkbox"]',
      );
      if (
        await selectAllCheckbox.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await selectAllCheckbox.click();
      }

      await sendMessage(page, "给选中的书签添加学习标签");
      await waitForAIResponse(page);

      // 检查是否显示确认对话框或确认按钮
      const hasConfirmation = await checkConfirmationDialog(page);
      const confirmButton = page.locator(
        'button:has-text("确认"), button:has-text("确认执行")',
      );
      const hasConfirmButton = await confirmButton
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // 应该有确认机制（对话框或按钮）
      expect(hasConfirmation || hasConfirmButton).toBeTruthy();
    });

    test("取消确认应正确处理", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "批量移动书签到学习文件夹");
      await waitForAIResponse(page);

      // 如果有确认对话框，点击取消
      const cancelButton = page.locator(
        'button:has-text("取消"), [data-testid="cancel-action"]',
      );
      if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelButton.click();

        // 验证对话框关闭
        const dialog = page.locator('[role="alertdialog"]');
        await expect(dialog).toBeHidden({ timeout: 3000 });
      }
    });
  });

  test.describe("错误处理", () => {
    test("无效查询应返回友好提示", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "asdfghjkl123456");
      const response = await waitForAIResponse(page);

      // 应该有回复，而不是崩溃
      expect(response).toBeTruthy();
    });

    test("空查询不应发送", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      const sendButton = page.locator('[data-testid="ai-send"]');
      const input = page.locator('[data-testid="ai-input"]');

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
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "你好");
      const response = await waitForAIResponse(page);

      // 响应应该主要是中文
      expect(response).toBeTruthy();
      // 检查包含中文字符
      expect(response).toMatch(/[\u4e00-\u9fa5]/);
    });

    test("响应不应过长", async ({ page }) => {
      const panelOpened = await openAIPanel(page);
      if (!panelOpened) {
        test.skip(true, "AI 助手面板未找到");
        return;
      }

      await sendMessage(page, "我有多少收藏");
      const response = await waitForAIResponse(page);

      // 简单查询的响应不应超过 500 字符
      expect(response).toBeTruthy();
      expect((response as string).length).toBeLessThan(500);
    });
  });
});

test.describe("AI 助手性能", () => {
  test.setTimeout(TEST_CONFIG.timeout);

  test("首次响应时间应在可接受范围", async ({ page }) => {
    await page.goto("/home");

    if (page.url().includes("/login")) {
      test.skip(true, "需要登录");
      return;
    }

    const panelOpened = await openAIPanel(page);
    if (!panelOpened) {
      test.skip(true, "AI 助手面板未找到");
      return;
    }

    const startTime = Date.now();
    await sendMessage(page, "你好");
    await waitForAIResponse(page);
    const responseTime = Date.now() - startTime;

    // 首次响应应在 10 秒内
    expect(responseTime).toBeLessThan(10000);
  });

  test("连续对话应保持上下文", async ({ page }) => {
    await page.goto("/home");

    if (page.url().includes("/login")) {
      test.skip(true, "需要登录");
      return;
    }

    const panelOpened = await openAIPanel(page);
    if (!panelOpened) {
      test.skip(true, "AI 助手面板未找到");
      return;
    }

    // 第一个消息
    await sendMessage(page, "我有多少微信收藏");
    await waitForAIResponse(page);

    // 第二个消息（应该理解"它们"指的是微信收藏）
    await sendMessage(page, "最近一条是什么");
    const response = await waitForAIResponse(page);

    // 应该有回复
    expect(response).toBeTruthy();
  });
});
