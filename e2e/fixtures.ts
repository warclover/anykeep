/**
 * 自定义 Playwright Fixtures
 *
 * 扩展 base test，提供:
 * - testData: 从 API 发现已有的测试数据 ID（不创建/修改任何数据）
 *
 * 使用方式：
 * ```typescript
 * import { test, expect } from "./fixtures";
 *
 * test("example", async ({ page, testData }) => {
 *   if (!testData.bookmarkId) {
 *     test.skip(true, "未发现可用的 bookmark 测试数据");
 *     return;
 *   }
 *   // ...
 * });
 * ```
 *
 * @version 1.0.0
 */

import type { APIRequestContext } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

// ============================================
// 类型定义
// ============================================

/** 通过 API 发现的测试数据 */
export interface DiscoveredTestData {
  /** 书签 ID（number 类型） */
  bookmarkId: number | null;
  /** 综述报告 ID（UUID 字符串） */
  synthesisReportId: string | null;
  /** MD 合集 ID（number 类型） */
  mdCollectionId: number | null;
  /** 反馈 ID（UUID ��符串） */
  feedbackId: string | null;
}

// ============================================
// 数据发现逻辑
// ============================================

/**
 * 安全地从 API 响应中提取第一条记录的 ID
 */
async function fetchFirstId(
  request: APIRequestContext,
  url: string,
  idField: string = "id",
): Promise<string | number | null> {
  try {
    const response = await request.get(url);
    if (!response.ok()) return null;

    const body = await response.json();

    // 支持 { data: [...] } 和 [...] 两种响应格式
    const items = Array.isArray(body) ? body : body?.data;
    if (!Array.isArray(items) || items.length === 0) return null;

    return items[0]?.[idField] ?? null;
  } catch {
    return null;
  }
}

/**
 * 从 API 发现可用的测试数据 ID
 *
 * 仅依赖已有数据，不创建新数据。
 * 并行请求各资源端点，失败时对应字段返回 null。
 */
async function discoverTestData(
  request: APIRequestContext,
): Promise<DiscoveredTestData> {
  const [bookmarkId, synthesisId, mdCollectionId, feedbackId] =
    await Promise.all([
      fetchFirstId(request, "/api/bookmarks?limit=1"),
      fetchFirstId(request, "/api/synthesis?limit=1"),
      fetchFirstId(request, "/api/md-collections?limit=1"),
      fetchFirstId(request, "/api/user-feedback?limit=1"),
    ]);

  return {
    bookmarkId: typeof bookmarkId === "number" ? bookmarkId : null,
    synthesisReportId: typeof synthesisId === "string" ? synthesisId : null,
    mdCollectionId: typeof mdCollectionId === "number" ? mdCollectionId : null,
    feedbackId: typeof feedbackId === "string" ? feedbackId : null,
  };
}

// ============================================
// 导出扩展的 test
// ============================================

export const test = base.extend<{
  testData: DiscoveredTestData;
}>({
  /* eslint-disable react-hooks/rules-of-hooks */
  testData: async ({ request }, use) => {
    const data = await discoverTestData(request);
    await use(data);
  },
  /* eslint-enable react-hooks/rules-of-hooks */
});

export { expect };
