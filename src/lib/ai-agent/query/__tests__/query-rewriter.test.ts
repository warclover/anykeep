/**
 * QueryRewriter 查询改写器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { QueryRewriter, getQueryRewriter } from "../query-rewriter";

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

const mockDeepSeekResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          rewritten: "前端框架 React Vue Angular 开发技术",
          synonyms: ["前端", "框架", "开发"],
          intent: "search",
        }),
      },
    },
  ],
  usage: {
    total_tokens: 150,
  },
};

// ============================================================================
// 测试套件
// ============================================================================

describe("QueryRewriter", () => {
  let rewriter: QueryRewriter;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      DEEPSEEK_API_KEY: "test-api-key",
    };
    rewriter = new QueryRewriter();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("rewrite", () => {
    it("应该返回改写后的查询", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepSeekResponse),
      });

      const result = await rewriter.rewrite("React教程");

      expect(result.original).toBe("React教程");
      expect(result.rewritten).toBe("前端框架 React Vue Angular 开发技术");
      expect(result.synonyms).toEqual(["前端", "框架", "开发"]);
      expect(result.intent).toBe("search");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该使用缓存避免重复调用 API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDeepSeekResponse),
      });

      // 第一次调用
      const result1 = await rewriter.rewrite("React教程");
      expect(result1.cached).toBeFalsy();

      // 第二次调用（应该使用缓存）
      const result2 = await rewriter.rewrite("React教程");
      expect(result2.cached).toBe(true);

      // 只应该调用一次 API
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("API 失败时应该降级返回原始查询", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await rewriter.rewrite("React教程");

      expect(result.original).toBe("React教程");
      expect(result.rewritten).toBe("React教程");
      expect(result.synonyms).toEqual([]);
      expect(result.confidence).toBe(1.0); // passthrough 返回 1.0
    });

    it("无 API Key 时应该降级返回原始查询", async () => {
      process.env.DEEPSEEK_API_KEY = "";
      rewriter = new QueryRewriter();

      const result = await rewriter.rewrite("React教程");

      expect(result.original).toBe("React教程");
      expect(result.rewritten).toBe("React教程");
      expect(result.confidence).toBe(1.0); // passthrough 返回 1.0
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("短查询应该跳过改写", async () => {
      const result = await rewriter.rewrite("a");

      expect(result.original).toBe("a");
      expect(result.rewritten).toBe("a");
      expect(result.confidence).toBe(1.0); // passthrough 返回 1.0
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("应该正确处理用户上下文", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDeepSeekResponse),
      });

      const result = await rewriter.rewrite("React教程", {
        topTags: ["前端", "JavaScript"],
        topPlatforms: ["wechat", "zhihu"],
        totalBookmarks: 100,
      });

      expect(result.rewritten).toBeDefined();
      // 验证请求体中的用户消息包含上下文
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages[1].content).toContain("前端");
    });
  });

  describe("getQueryRewriter", () => {
    it("应该返回单例实例", () => {
      const instance1 = getQueryRewriter();
      const instance2 = getQueryRewriter();

      expect(instance1).toBe(instance2);
    });
  });
});

describe("QueryRewriter - 边界情况", () => {
  let rewriter: QueryRewriter;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = "test-api-key";
    rewriter = new QueryRewriter();
  });

  it("应该处理 JSON 解析错误", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: "invalid json",
              },
            },
          ],
        }),
    });

    const result = await rewriter.rewrite("测试查询");

    // 应该降级返回原始查询
    expect(result.rewritten).toBe("测试查询");
  });

  it("应该处理网络超时", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Timeout"));

    const result = await rewriter.rewrite("测试查询");

    expect(result.original).toBe("测试查询");
    expect(result.rewritten).toBe("测试查询");
    expect(result.confidence).toBe(1.0); // passthrough 返回 1.0
  });

  it("应该正确估算延迟时间", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDeepSeekResponse),
    });

    const result = await rewriter.rewrite("React教程");

    expect(result.latencyMs).toBeDefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
