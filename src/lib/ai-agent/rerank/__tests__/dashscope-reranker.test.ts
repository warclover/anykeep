/**
 * DashScopeReranker 重排序器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { DashScopeReranker, getDashScopeReranker } from "../dashscope-reranker";
import { DAILY_TOKEN_LIMIT } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ============================================================================
// 测试数据
// ============================================================================

const mockDashScopeResponse = {
  output: {
    results: [
      { index: 2, relevance_score: 0.95 },
      { index: 0, relevance_score: 0.82 },
      { index: 1, relevance_score: 0.65 },
    ],
  },
  usage: {
    total_tokens: 500,
  },
  request_id: "test-request-123",
};

const mockDocuments = [
  "React 是一个用于构建用户界面的 JavaScript 库",
  "Vue.js 是一个渐进式 JavaScript 框架",
  "前端开发入门指南：从 HTML 到 React",
];

// ============================================================================
// 测试套件
// ============================================================================

describe("DashScopeReranker", () => {
  let reranker: DashScopeReranker;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-dashscope-key",
    };
    reranker = new DashScopeReranker();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("rerank", () => {
    it("应该返回重排序后的结果", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDashScopeResponse),
      });

      const results = await reranker.rerank("React教程", mockDocuments);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(2);
      expect(results[0].relevanceScore).toBe(0.95);
      expect(results[1].index).toBe(0);
      expect(results[2].index).toBe(1);
    });

    it("空文档列表应该返回空数组", async () => {
      const results = await reranker.rerank("React教程", []);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("无 API Key 时应该降级返回原始顺序", async () => {
      process.env.DASHSCOPE_API_KEY = "";
      reranker = new DashScopeReranker();

      const results = await reranker.rerank("React教程", mockDocuments);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
      // 降级分数应该线性衰减
      expect(results[0].relevanceScore).toBeGreaterThan(
        results[1].relevanceScore,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("API 失败时应该降级返回原始顺序", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const results = await reranker.rerank("React教程", mockDocuments);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
    });

    it("应该正确处理 topK 参数", async () => {
      const topKResponse = {
        ...mockDashScopeResponse,
        output: {
          results: [
            { index: 2, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.82 },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(topKResponse),
      });

      const results = await reranker.rerank("React教程", mockDocuments, 2);

      expect(results).toHaveLength(2);
    });

    it("应该截断过长的文档", async () => {
      const longDocument = "a".repeat(10000);
      const docs = [longDocument, "短文档"];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            output: {
              results: [
                { index: 0, relevance_score: 0.8 },
                { index: 1, relevance_score: 0.6 },
              ],
            },
            usage: { total_tokens: 300 },
          }),
      });

      await reranker.rerank("查询", docs);

      // 验证请求体中的文档被截断
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.input.documents[0].length).toBeLessThanOrEqual(8000);
    });
  });

  describe("用量追踪", () => {
    it("应该正确追踪每日用量", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDashScopeResponse),
      });

      await reranker.rerank("查询1", mockDocuments);
      await reranker.rerank("查询2", mockDocuments);

      const stats = reranker.getUsageStats();

      expect(stats.dailyTokens).toBe(1000); // 500 * 2
      expect(stats.dailyRequests).toBe(2);
    });

    it("应该正确计算剩余可用 Token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDashScopeResponse),
      });

      await reranker.rerank("查询", mockDocuments);

      const remaining = reranker.getRemainingTokens();

      expect(remaining).toBe(DAILY_TOKEN_LIMIT - 500);
    });

    it("达到限额时应该降级", async () => {
      // 模拟已经使用完限额
      const highUsageReranker = new DashScopeReranker();
      // 直接调用多次来模拟高用量
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            output: { results: [{ index: 0, relevance_score: 0.9 }] },
            usage: { total_tokens: DAILY_TOKEN_LIMIT },
          }),
      });

      // 第一次调用会用完限额
      await highUsageReranker.rerank("查询", ["文档"]);

      // 重置 mock 以验证第二次调用不会发起 API 请求
      mockFetch.mockClear();

      // 第二次调用应该降级
      const results = await highUsageReranker.rerank("查询2", mockDocuments);

      expect(results[0].index).toBe(0); // 降级返回原始顺序
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getDashScopeReranker", () => {
    it("应该返回单例实例", () => {
      const instance1 = getDashScopeReranker();
      const instance2 = getDashScopeReranker();

      expect(instance1).toBe(instance2);
    });
  });
});

describe("DashScopeReranker - 边界情况", () => {
  let reranker: DashScopeReranker;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = "test-key";
    reranker = new DashScopeReranker();
  });

  it("应该处理网络超时", async () => {
    mockFetch.mockImplementationOnce(() => {
      const controller = new AbortController();
      controller.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });

    const results = await reranker.rerank("查询", mockDocuments);

    // 应该降级返回原始顺序
    expect(results[0].index).toBe(0);
  });

  it("应该处理空响应", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          output: { results: [] },
          usage: { total_tokens: 0 },
        }),
    });

    const results = await reranker.rerank("查询", mockDocuments);

    // API 返回空结果时，返回空数组
    expect(results).toHaveLength(0);
  });

  it("单文档应该正常调用 API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          output: { results: [{ index: 0, relevance_score: 0.9 }] },
          usage: { total_tokens: 50 },
        }),
    });

    const results = await reranker.rerank("查询", ["单个文档"]);

    expect(results).toHaveLength(1);
    expect(results[0].index).toBe(0);
    expect(results[0].relevanceScore).toBe(0.9);
  });
});
