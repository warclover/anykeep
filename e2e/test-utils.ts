/**
 * E2E 测试工具函数
 *
 * 提供智能等待、重试机制和测试数据管理
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

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
} as const;

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
  timeout = TIMEOUTS.networkIdle,
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
