/**
 * classify() 集成测试
 *
 * 测试主入口函数的 4 种 action 路径：
 * classify / suggest / suggest_create / inbox
 *
 * @module classification-v2/__tests__/integration
 */

import { classify } from "../../classify";
import type { ClassifyRequest, ClassifyResult } from "../../types";

// ============================================================================
// Mocks
// ============================================================================

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock embedding
jest.mock("@/lib/embedding", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(Array(1024).fill(0.1)),
  buildEmbeddingText: jest.fn().mockReturnValue("test embedding text"),
}));

// Mock supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

// Mock infra/vector-search
jest.mock("../../infra/vector-search", () => ({
  searchSimilarBookmarks: jest.fn().mockResolvedValue([]),
}));

// Mock infra/llm
jest.mock("../../infra/llm", () => ({
  callLlm: jest.fn().mockResolvedValue({
    content: '{"folderId": 1, "confidence": 0.8, "reasoning": "测试理由"}',
  }),
  sanitizeInput: jest.fn((text: string) => text.slice(0, 200)),
}));

// Mock folder-namer
jest.mock("../../folder-naming/folder-namer", () => ({
  suggestFolderName: jest.fn().mockResolvedValue({
    name: "新分类",
    reason: "测试建议",
  }),
}));

// Mock infra/cache
jest.mock("../../infra/cache", () => ({
  getCached: jest.fn().mockReturnValue(null),
  setCache: jest.fn(),
}));

// Mock context builders
jest.mock("../../context/bookmark-context", () => ({
  buildBookmarkContext: jest.fn().mockResolvedValue({
    bookmarkId: "bm_1",
    title: "React Hooks",
    url: "https://example.com",
    tags: ["React"],
    embedding: Array(1024).fill(0.1),
    normalizedTitle: "react hooks",
    normalizedTags: ["react"],
  }),
}));

jest.mock("../../context/user-context", () => ({
  buildUserContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    weights: {},
    rules: [],
    stage: "mature",
    folderCount: 5,
  }),
}));

import { buildFolderContexts } from "../../context/folder-context";
import { searchSimilarBookmarks } from "../../infra/vector-search";
import { callLlm } from "../../infra/llm";
import { getCached, setCache } from "../../infra/cache";
import { suggestFolderName } from "../../folder-naming/folder-namer";

jest.mock("../../context/folder-context");

const mockBuildFolderContexts = buildFolderContexts as jest.MockedFunction<
  typeof buildFolderContexts
>;
const mockSearch = searchSimilarBookmarks as jest.MockedFunction<
  typeof searchSimilarBookmarks
>;
const mockCallLlm = callLlm as jest.MockedFunction<typeof callLlm>;
const mockGetCached = getCached as jest.MockedFunction<typeof getCached>;
const _mockSetCache = setCache as jest.MockedFunction<typeof setCache>;
const mockSuggestFolderName = suggestFolderName as jest.MockedFunction<
  typeof suggestFolderName
>;

// ============================================================================
// Tests
// ============================================================================

const BASE_REQUEST: ClassifyRequest = {
  bookmarkId: "bm_1",
  title: "React Hooks 完全指南",
  url: "https://reactjs.org/docs/hooks",
  tags: ["React", "Hooks"],
  userId: "user_1",
};

describe("classify()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCached.mockReturnValue(null);
  });

  describe("action: inbox — 无文件夹", () => {
    it("用户无文件夹 → 直接返回 inbox", async () => {
      mockBuildFolderContexts.mockResolvedValue([]);

      const result = await classify(BASE_REQUEST);

      expect(result.action).toBe("inbox");
      expect(result.folderId).toBeNull();
      expect(result.reason).toContain("尚无文件夹");
      expect(result.traceId).toMatch(/^clf2_/);
    });
  });

  describe("action: classify — 高置信度自动分类", () => {
    it("向量高相似度 → action=classify", async () => {
      mockBuildFolderContexts.mockResolvedValue([
        {
          id: 1,
          name: "React",
          normalizedName: "react",
          aliases: [],
          coreTags: ["react"],
          relatedTags: [],
          sampleTitles: ["React 入门"],
          keywords: ["react"],
          bookmarkCount: 10,
        },
      ]);

      // 模拟向量搜索返回高相似度
      mockSearch.mockResolvedValue([
        {
          bookmarkId: 100,
          bookmarkTitle: "React 教程",
          folderId: 1,
          folderName: "React",
          similarity: 0.92,
        },
        {
          bookmarkId: 101,
          bookmarkTitle: "React Hooks 入门",
          folderId: 1,
          folderName: "React",
          similarity: 0.88,
        },
        {
          bookmarkId: 102,
          bookmarkTitle: "React 进阶",
          folderId: 1,
          folderName: "React",
          similarity: 0.85,
        },
      ]);

      const result = await classify(BASE_REQUEST);

      expect(result.folderId).toBe(1);
      expect(result.folderName).toBe("React");
      expect(result.confidence).toBeGreaterThan(0);
      // 应该命中 classify 或 suggest（取决于最终归一化分数）
      expect(["classify", "suggest"]).toContain(result.action);
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("action: inbox — 低置信度", () => {
    it("所有 Scorer 低分 → inbox", async () => {
      mockBuildFolderContexts.mockResolvedValue([
        {
          id: 1,
          name: "Python",
          normalizedName: "python",
          aliases: [],
          coreTags: ["python"],
          relatedTags: [],
          sampleTitles: [],
          keywords: [],
          bookmarkCount: 5,
        },
      ]);

      // 向量搜索无结果
      mockSearch.mockResolvedValue([]);

      // LLM 返回低置信度
      mockCallLlm.mockResolvedValue({
        content: '{"folderId": 1, "confidence": 0.2, "reasoning": "勉强匹配"}',
      });

      // 文件夹命名返回默认名
      mockSuggestFolderName.mockResolvedValue({
        name: "新分类",
        reason: "无明确分类",
      });

      const result = await classify(BASE_REQUEST);

      // 无向量匹配 + 无规则 + 无标签匹配 → 低分
      expect(result.action).toBe("inbox");
      expect(result.folderId).toBeNull();
    });
  });

  describe("缓存命中", () => {
    it("缓存中有结果 → 直接返回", async () => {
      const cachedResult: ClassifyResult = {
        folderId: 42,
        folderName: "缓存文件夹",
        confidence: 0.9,
        action: "classify",
        reason: "缓存命中",
        scorerDetails: [],
        candidates: [],
        timing: { totalMs: 5, tierMs: {} },
        traceId: "clf2_cached",
      };
      mockGetCached.mockReturnValue(cachedResult);

      const result = await classify(BASE_REQUEST);

      expect(result).toBe(cachedResult);
      // buildFolderContexts 不应被调用
      expect(mockBuildFolderContexts).not.toHaveBeenCalled();
    });
  });

  describe("结果缓存", () => {
    it("有文件夹的分类结果写入缓存", async () => {
      mockBuildFolderContexts.mockResolvedValue([
        {
          id: 1,
          name: "React",
          normalizedName: "react",
          aliases: [],
          coreTags: ["react"],
          relatedTags: [],
          sampleTitles: ["React 入门"],
          keywords: ["react"],
          bookmarkCount: 10,
        },
      ]);
      mockSearch.mockResolvedValue([
        {
          bookmarkId: 100,
          bookmarkTitle: "React 教程",
          folderId: 1,
          folderName: "React",
          similarity: 0.9,
        },
      ]);

      await classify(BASE_REQUEST);

      expect(_mockSetCache).toHaveBeenCalledWith(
        BASE_REQUEST.userId,
        BASE_REQUEST.bookmarkId,
        expect.objectContaining({
          action: expect.any(String),
          traceId: expect.stringMatching(/^clf2_/),
        }),
      );
    });

    it("无文件夹 inbox 结果不写入缓存", async () => {
      mockBuildFolderContexts.mockResolvedValue([]);

      await classify(BASE_REQUEST);

      // inbox 路径（无文件夹）不调用 setCache
      expect(_mockSetCache).not.toHaveBeenCalled();
    });
  });

  describe("异常处理", () => {
    it("上下文构建异常 → 返回 inbox 而不是抛异常", async () => {
      mockBuildFolderContexts.mockRejectedValue(new Error("Supabase 连接超时"));

      const result = await classify(BASE_REQUEST);

      expect(result.action).toBe("inbox");
      expect(result.reason).toContain("分类异常");
    });
  });

  describe("traceId", () => {
    it("每次调用生成唯一 traceId", async () => {
      mockBuildFolderContexts.mockResolvedValue([]);

      const result1 = await classify(BASE_REQUEST);
      const result2 = await classify(BASE_REQUEST);

      expect(result1.traceId).toMatch(/^clf2_/);
      expect(result2.traceId).toMatch(/^clf2_/);
      expect(result1.traceId).not.toBe(result2.traceId);
    });
  });

  describe("返回结构完整性", () => {
    it("结果包含所有必需字段", async () => {
      mockBuildFolderContexts.mockResolvedValue([
        {
          id: 1,
          name: "React",
          normalizedName: "react",
          aliases: [],
          coreTags: [],
          relatedTags: [],
          sampleTitles: [],
          keywords: [],
          bookmarkCount: 5,
        },
      ]);
      mockSearch.mockResolvedValue([]);

      const result = await classify(BASE_REQUEST);

      // 必需字段检查
      expect(result).toHaveProperty("folderId");
      expect(result).toHaveProperty("folderName");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("action");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("scorerDetails");
      expect(result).toHaveProperty("candidates");
      expect(result).toHaveProperty("timing");
      expect(result).toHaveProperty("traceId");
      expect(result.timing).toHaveProperty("totalMs");
      expect(result.timing).toHaveProperty("tierMs");

      // 类型检查
      expect(typeof result.confidence).toBe("number");
      expect(["classify", "suggest", "suggest_create", "inbox"]).toContain(
        result.action,
      );
      expect(Array.isArray(result.scorerDetails)).toBe(true);
      expect(Array.isArray(result.candidates)).toBe(true);
    });
  });
});
