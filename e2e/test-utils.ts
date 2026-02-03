/**
 * E2E 测试工具函数
 *
 * 提供智能等待、重试机制和测试数据管理
 *
 * @version 2.0.0 - 增强稳定性
 * @since 2025-12-25
 */

import type { Page, Locator, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";

// ============================================
// 超时配置
// ============================================

export const TIMEOUTS = {
  /** 页面加载超时 */
  pageLoad: 30000,
  /** AI 响应超时 */
  aiResponse: 60000,
  /** 元素可见超时 */
  elementVisible: 10000,
  /** 动画完成超时 */
  animation: 3000,
  /** 网络空闲超时 */
  networkIdle: 15000,
  /** 快速检查超时 */
  quickCheck: 5000,
  /** 重定向检查超时 */
  redirectCheck: 3000,
} as const;

// ============================================
// 测试配置预设
// ============================================

/**
 * AI 测试配置 - 用于需要 AI 响应的测试
 */
export const AI_TEST_CONFIG = {
  timeout: 90000,
  retries: 2,
};

/**
 * 快速测试配置 - 用于简单的 UI 测试
 */
export const QUICK_TEST_CONFIG = {
  timeout: 30000,
  retries: 1,
};

// ============================================
// 智能等待函数
// ============================================

/**
 * 等待页面完全加载（包括网络空闲）
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.networkIdle });
}

/**
 * 等待元素可见并稳定（无动画）
 */
export async function waitForElementStable(
  locator: Locator,
  timeout = TIMEOUTS.elementVisible,
): Promise<void> {
  await locator.waitFor({ state: "visible", timeout });
  // 等待动画完成
  await locator.page().waitForTimeout(100);
}

/**
 * 等待 AI 响应完成
 *
 * 检测加载指示器消失和响应内容出现
 */
export async function waitForAIResponse(page: Page): Promise<void> {
  // 等待加载指示器消失
  const loadingIndicator = page.locator(
    '[data-testid="ai-loading"], .ai-loading',
  );
  try {
    await loadingIndicator.waitFor({
      state: "hidden",
      timeout: TIMEOUTS.aiResponse,
    });
  } catch {
    // 如果没有加载指示器，继续
  }

  // 等待响应内容出现
  const responseContent = page.locator(
    '[data-testid="ai-response"], .ai-response, [data-role="assistant"]',
  );
  try {
    await responseContent.waitFor({
      state: "visible",
      timeout: TIMEOUTS.aiResponse,
    });
  } catch {
    // 如果没有响应元素，继续
  }
}

/**
 * 等待网络请求完成
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = TIMEOUTS.networkIdle,
): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout });
}

// ============================================
// 重试机制
// ============================================

/**
 * 带重试的操作执行器
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const { maxRetries = 3, delay = 1000, onRetry } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        onRetry?.(attempt, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================
// 导航辅助
// ============================================

/**
 * 安全导航到页面
 */
export async function safeNavigate(
  page: Page,
  url: string,
  options: { waitForReady?: boolean } = {},
): Promise<void> {
  const { waitForReady = true } = options;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (waitForReady) {
    await waitForPageReady(page);
  }
}

/**
 * 等待页面导航完成
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: TIMEOUTS.pageLoad });
  await waitForPageReady(page);
}

// ============================================
// 断言辅助
// ============================================

/**
 * 断言元素最终可见
 */
export async function expectEventuallyVisible(
  locator: Locator,
  timeout = TIMEOUTS.elementVisible,
): Promise<void> {
  await expect(locator).toBeVisible({ timeout });
}

/**
 * 断言文本最终出现
 */
export async function expectEventuallyContainsText(
  locator: Locator,
  text: string | RegExp,
  timeout = TIMEOUTS.elementVisible,
): Promise<void> {
  await expect(locator).toContainText(text, { timeout });
}

// ============================================
// 表单辅助
// ============================================

/**
 * 安全填写输入框
 */
export async function safeFill(locator: Locator, value: string): Promise<void> {
  await waitForElementStable(locator);
  await locator.clear();
  await locator.fill(value);
}

/**
 * 安全点击
 */
export async function safeClick(locator: Locator): Promise<void> {
  await waitForElementStable(locator);
  await locator.click();
}

// ============================================
// 测试数据标识
// ============================================

/**
 * 生成唯一测试标识
 */
export function generateTestId(prefix = "test"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// ============================================
// 登录检测辅助
// ============================================

/**
 * 检查是否需要登录
 *
 * @returns true 如果当前在登录页（需要登录）
 */
export function isOnLoginPage(page: Page): boolean {
  return page.url().includes("/login");
}

/**
 * 如果需要登录则跳过测试
 *
 * 在 test body 开头调用，会自动检查并跳过需要认证的测试
 */
export async function skipIfLoginRequired(page: Page): Promise<boolean> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500); // 等待可能的重定向

  if (isOnLoginPage(page)) {
    test.skip(true, "需要登录才能测试此功能");
    return true;
  }
  return false;
}

// ============================================
// AI 助手辅助函数
// ============================================

/**
 * AI 助手面板选择器
 */
const AI_SELECTORS = {
  button:
    '[data-testid="ai-assistant-button"], button:has-text("AI助手"), button:has-text("智能助手")',
  panel: '[data-testid="ai-assistant-panel"], [data-testid="ai-panel"]',
  input:
    '[data-testid="ai-input"], textarea[placeholder*="输入"], input[placeholder*="问"]',
  sendButton: '[data-testid="ai-send"], button:has-text("发送")',
  loading: '[data-testid="ai-loading"], .ai-loading, [data-loading="true"]',
  response:
    '[data-testid="ai-message-assistant"], [data-testid="ai-response"], [data-role="assistant"]',
};

/**
 * 打开 AI 助手面板
 *
 * @returns true 如果成功打开
 */
export async function openAIPanel(page: Page): Promise<boolean> {
  const aiButton = page.locator(AI_SELECTORS.button);

  try {
    await aiButton.waitFor({ state: "visible", timeout: TIMEOUTS.quickCheck });
    await aiButton.click();
    await page.locator(AI_SELECTORS.panel).waitFor({
      state: "visible",
      timeout: TIMEOUTS.quickCheck,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 发送消息给 AI 助手
 */
export async function sendAIMessage(
  page: Page,
  message: string,
): Promise<void> {
  const input = page.locator(AI_SELECTORS.input).first();
  await input.waitFor({ state: "visible", timeout: TIMEOUTS.quickCheck });
  await input.fill(message);

  // 按回车或点击发送按钮
  const sendButton = page.locator(AI_SELECTORS.sendButton);
  if (await sendButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sendButton.click();
  } else {
    await input.press("Enter");
  }
}

/**
 * 等待 AI 响应完成并获取响应文本
 *
 * @returns 响应文本或 null
 */
export async function getAIResponse(page: Page): Promise<string | null> {
  // 等待加载指示器消失
  const loading = page.locator(AI_SELECTORS.loading);
  try {
    // 先等待加载指示器出现（可能已经出现）
    await loading.waitFor({ state: "attached", timeout: 3000 }).catch(() => {
      /* 忽略：加载指示器可能不存在 */
    });
    // 然后等待它消失
    await loading.waitFor({ state: "hidden", timeout: TIMEOUTS.aiResponse });
  } catch {
    // 加载指示器可能不存在，继续
  }

  // 获取最后一条响应消息
  const responses = page.locator(AI_SELECTORS.response);
  try {
    await responses
      .last()
      .waitFor({ state: "visible", timeout: TIMEOUTS.aiResponse });
    return await responses.last().textContent();
  } catch {
    return null;
  }
}

// ============================================
// 诊断和调试辅助
// ============================================

/**
 * 捕获当前页面状态用于调试
 */
export async function capturePageState(
  page: Page,
  testInfo: TestInfo,
  label = "state",
): Promise<void> {
  // 截图
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${label}-screenshot`, {
    body: screenshot,
    contentType: "image/png",
  });

  // 页面 URL
  await testInfo.attach(`${label}-url`, {
    body: page.url(),
    contentType: "text/plain",
  });

  // 控制台日志
  const consoleLogs: string[] = [];
  page.on("console", (msg) =>
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`),
  );

  if (consoleLogs.length > 0) {
    await testInfo.attach(`${label}-console`, {
      body: consoleLogs.join("\n"),
      contentType: "text/plain",
    });
  }
}

/**
 * 带诊断信息的安全操作
 */
export async function safeOperation<T>(
  operation: () => Promise<T>,
  page: Page,
  testInfo: TestInfo,
  operationName: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    await capturePageState(page, testInfo, `error-${operationName}`);
    throw error;
  }
}

// ============================================
// 条件测试辅助
// ============================================

/**
 * 条件测试 - 如果条件不满足则跳过
 */
export async function conditionalTest(
  condition: () => Promise<boolean>,
  skipReason: string,
): Promise<boolean> {
  const shouldRun = await condition();
  if (!shouldRun) {
    test.skip(true, skipReason);
  }
  return shouldRun;
}

/**
 * 检查元素是否存在（不抛出错误）
 */
export async function elementExists(
  locator: Locator,
  timeout: number = TIMEOUTS.quickCheck,
): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}
