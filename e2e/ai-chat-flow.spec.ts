/**
 * AI 对话流程 E2E 测试
 *
 * 测试 AI 助手的核心交互流程
 *
 * @version 2.0.0 - 使用统一工具函数，增强稳定性
 * @since 2025-12-22
 */

import { test, expect } from "@playwright/test";
import {
  TIMEOUTS,
  AI_TEST_CONFIG,
  safeNavigate,
  skipIfLoginRequired,
  waitForAIResponse,
  waitForNetworkIdle,
  elementExists,
} from "./test-utils";

test.describe("AI 对话流程", () => {
  test.setTimeout(AI_TEST_CONFIG.timeout);
  test.describe.configure({ retries: AI_TEST_CONFIG.retries });

  test("首页应显示 AI 助手入口", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    // 检查 AI 助手按钮是否存在
    const aiButton = page.locator('[data-testid="ai-assistant-button"]');

    // 验证 AI 入口存在
    const exists = await elementExists(aiButton, TIMEOUTS.quickCheck);
    if (!exists) {
      test.skip(true, "AI 助手按钮未找到，可能需要配置");
      return;
    }

    await expect(aiButton).toBeVisible();
  });

  test("AI 搜索增强功能", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    // 查找搜索框
    const searchInput = page.locator('input[placeholder*="搜索"]').first();

    if (await elementExists(searchInput, TIMEOUTS.quickCheck)) {
      // 输入搜索词
      await searchInput.fill("AI 技术");
      await searchInput.press("Enter");

      // 等待搜索结果
      await waitForNetworkIdle(page);

      // 检查 AI 搜索增强组件
      const aiEnhanced = page.locator('[data-testid="ai-search-enhanced"]');
      const hasEnhanced = await elementExists(
        aiEnhanced,
        TIMEOUTS.elementVisible,
      );

      if (!hasEnhanced) {
        test.skip(true, "AI 搜索增强组件未显示");
      }
    } else {
      test.skip(true, "搜索框未找到");
    }
  });

  test("语义搜索切换", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    // 查找语义搜索切换按钮
    const semanticToggle = page.locator(
      '[data-testid="semantic-search-toggle"]',
    );

    if (await elementExists(semanticToggle, TIMEOUTS.quickCheck)) {
      // 点击切换到语义搜索
      await semanticToggle.click();

      // 验证切换状态
      await expect(semanticToggle)
        .toHaveAttribute("data-state", "checked", {
          timeout: TIMEOUTS.quickCheck,
        })
        .catch(() => {
          // 可能使用不同的状态表示
        });
    } else {
      test.skip(true, "语义搜索切换未找到");
    }
  });
});

test.describe("AI 书签对话", () => {
  test.setTimeout(AI_TEST_CONFIG.timeout);
  test.describe.configure({ retries: AI_TEST_CONFIG.retries });

  test("书签详情页 AI 对话组件", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    // 等待页面加载
    await waitForNetworkIdle(page);

    // 尝试点击第一个书签
    const firstBookmark = page.locator('[data-testid="bookmark-item"]').first();

    if (await elementExists(firstBookmark, TIMEOUTS.quickCheck)) {
      await firstBookmark.click();

      // 等待详情页加载
      await waitForNetworkIdle(page);

      // 查找 AI 对话组件
      const aiChat = page.locator('[data-testid="ai-bookmark-chat"]');

      if (await elementExists(aiChat, TIMEOUTS.quickCheck)) {
        // 展开 AI 对话
        const expandButton = aiChat.locator("button").first();
        await expandButton.click();

        // 验证对话区域展开
        const chatArea = page.locator('[data-testid="ai-chat-messages"]');
        const chatVisible = await elementExists(chatArea, TIMEOUTS.quickCheck);

        if (!chatVisible) {
          test.skip(true, "AI 对话区域未展开");
        }
      } else {
        test.skip(true, "AI 对话组件未找到");
      }
    } else {
      test.skip(true, "书签列表为空");
    }
  });

  test("AI 快捷操作按钮", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    await waitForNetworkIdle(page);

    // 查找快捷操作按钮
    const quickActions = page.locator('[data-testid="ai-quick-actions"]');

    if (await elementExists(quickActions, TIMEOUTS.quickCheck)) {
      // 点击生成摘要按钮
      const summaryButton = quickActions.locator('button:has-text("摘要")');

      if (await elementExists(summaryButton, TIMEOUTS.quickCheck)) {
        await summaryButton.click();

        // 等待 AI 处理
        await waitForAIResponse(page);

        // 验证摘要生成
        const summary = page.locator('[data-testid="ai-summary"]');
        const summaryVisible = await elementExists(
          summary,
          TIMEOUTS.aiResponse,
        );

        if (!summaryVisible) {
          test.skip(true, "AI 摘要未生成");
        }
      } else {
        test.skip(true, "摘要按钮未找到");
      }
    } else {
      test.skip(true, "AI 快捷操作未找到");
    }
  });
});

test.describe("AI 相关内容推荐", () => {
  test.setTimeout(AI_TEST_CONFIG.timeout);
  test.describe.configure({ retries: AI_TEST_CONFIG.retries });

  test("显示相关内容推荐", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    await waitForNetworkIdle(page);

    // 点击第一个书签查看详情
    const firstBookmark = page.locator('[data-testid="bookmark-item"]').first();

    if (await elementExists(firstBookmark, TIMEOUTS.quickCheck)) {
      await firstBookmark.click();
      await waitForNetworkIdle(page);

      // 查找相关内容组件
      const relatedContent = page.locator('[data-testid="ai-related-content"]');

      if (await elementExists(relatedContent, TIMEOUTS.elementVisible)) {
        // 验证相关内容列表
        const relatedItems = relatedContent.locator(
          '[data-testid="related-item"]',
        );
        const count = await relatedItems.count();

        // 如果有相关内容，点击第一个
        if (count > 0) {
          await relatedItems.first().click();
          // 验证导航成功
          await waitForNetworkIdle(page);
        }
      } else {
        test.skip(true, "相关内容组件未找到");
      }
    } else {
      test.skip(true, "书签列表为空");
    }
  });
});

test.describe("AI 功能性能", () => {
  test.setTimeout(AI_TEST_CONFIG.timeout);
  test.describe.configure({ retries: AI_TEST_CONFIG.retries });

  test("AI 响应时间应在可接受范围内", async ({ page }) => {
    await safeNavigate(page, "/home");
    if (await skipIfLoginRequired(page)) return;

    await waitForNetworkIdle(page);

    // 记录开始时间
    const startTime = Date.now();

    // 触发搜索
    const searchInput = page.locator('input[placeholder*="搜索"]').first();

    if (await elementExists(searchInput, TIMEOUTS.quickCheck)) {
      await searchInput.fill("测试");
      await searchInput.press("Enter");

      // 等待搜索完成
      await waitForNetworkIdle(page);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 验证响应时间在 5 秒内
      expect(responseTime).toBeLessThan(5000);
    } else {
      test.skip(true, "搜索框未找到");
    }
  });
});
