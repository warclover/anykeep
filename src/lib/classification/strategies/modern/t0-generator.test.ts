/**
 * 智能分类 v5.0 - T0 生成器测试
 */

import { T0Generator } from "./t0-generator";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { IEmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";
import type { ClassificationRequest } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock Embedding Service
const mockEmbeddingService = {
  generateEmbedding: jest
    .fn()
    .mockResolvedValue({ embedding: new Array(1024).fill(0.1) }),
} as unknown as IEmbeddingService & { generateEmbedding: jest.Mock };

// Mock L0 Matcher
const mockL0Matcher = {
  match: jest.fn(),
} as any;

// Mock Hybrid Retriever
const mockHybridRetriever = {
  retrieve: jest.fn(),
} as any;

// Mock LLM Caller
const mockLLMCaller = {
  shouldCallLLM: jest.fn(),
} as any;

describe("T0Generator", () => {
  let generator: T0Generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new T0Generator(
      mockLogger,
      mockEmbeddingService,
      mockL0Matcher,
      mockHybridRetriever,
      mockLLMCaller,
    );
  });

  const createMockRequest = (): ClassificationRequest => ({
    userId: "user-1",
    bookmarkId: "bookmark-1",
    title: "Test Bookmark",
    url: "https://example.com",
  });

  describe("generate", () => {
    it("L0规则匹配成功时应该直接返回", async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: true,
        folderId: 1,
        confidence: 0.95,
      });

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.folderId).toBe(1);
      expect(result.confidence).toBe(0.95);
      expect(result.needsT1).toBe(false);
      expect(mockHybridRetriever.retrieve).not.toHaveBeenCalled();
    });

    it("L0规则未匹配时应该使用混合检索", async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: false,
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        {
          folderId: 2,
          folderName: "Folder 2",
          fusedScore: 0.85,
        },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.folderId).toBe(2);
      expect(result.confidence).toBe(0.85);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(mockHybridRetriever.retrieve).toHaveBeenCalled();
    });

    it("应该正确判断是否需要T1纠正", async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: false,
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        {
          folderId: 3,
          folderName: "Folder 3",
          fusedScore: 0.7, // 低置信度
        },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(true);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.needsT1).toBe(true);
      expect(result.t1Reason).toBeDefined();
    });
  });

  describe("T0 生成 - 边界情况", () => {
    it("应该处理多个候选结果", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: 1, folderName: "Folder 1", fusedScore: 0.9 },
        { folderId: 2, folderName: "Folder 2", fusedScore: 0.85 },
        { folderId: 3, folderName: "Folder 3", fusedScore: 0.8 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.folderId).toBe(1);
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates[0].similarity).toBe(0.9);
      expect(result.candidates[1].similarity).toBe(0.85);
      expect(result.candidates[2].similarity).toBe(0.8);
    });

    it("应该在检索结果为空时降级到收件箱", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });
      mockHybridRetriever.retrieve.mockResolvedValueOnce([]);

      const request = createMockRequest();

      const result = await generator.generate(request);

      expect(result.folderId).toBe(0); // 0 or null represents inbox
      expect(result.confidence).toBe(0);
    });

    it("应该正确计算延迟时间", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: 1, folderName: "Folder 1", fusedScore: 0.9 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe("number");
    });

    it("L0匹配成功时应该返回正确的候选列表", async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: true,
        folderId: 10,
        confidence: 0.98,
      });

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].folderId).toBe(10);
      expect(result.candidates[0].similarity).toBe(0.98);
    });

    it("应该正确处理包含描述和摘要的请求", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce({
        embedding: new Array(1024).fill(0.1),
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.9 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = {
        ...createMockRequest(),
        description: "A detailed description",
        summary: "Brief summary",
        tags: ["tag1", "tag2"],
      };

      await generator.generate(request);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining("Test Bookmark"),
      );
    });

    it("应该传递标题到混合检索器用于名称护栏", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce({
        embedding: new Array(1024).fill(0.1),
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.9 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      await generator.generate(request);

      // v5.1: 验证传递了标题参数
      expect(mockHybridRetriever.retrieve).toHaveBeenCalledWith(
        "user-1",
        expect.any(Array),
        expect.any(Array),
        "Test Bookmark", // 标题参数
      );
    });

    it("应该在低置信度时返回 low_confidence 作为 T1 原因", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.6 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(true);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.needsT1).toBe(true);
      expect(result.t1Reason).toBe("low_confidence");
    });

    it("应该在向量冲突时返回 vector_conflict 作为 T1 原因", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      // 两个候选分数差距小于 0.1，触发 vector_conflict
      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.85 },
        { folderId: "folder-2", folderName: "Folder 2", fusedScore: 0.82 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(true);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.needsT1).toBe(true);
      expect(result.t1Reason).toBe("vector_conflict");
    });

    it("应该记录开始生成日志", async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: true,
        folderId: "folder-1",
        confidence: 0.95,
      });

      const request = createMockRequest();
      await generator.generate(request);

      expect(mockLogger.info).toHaveBeenCalledWith("开始T0生成", {
        bookmarkId: "bookmark-1",
      });
    });

    it("应该记录L0匹配成功日志", async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: true,
        folderId: "folder-l0",
        confidence: 0.95,
      });

      const request = createMockRequest();
      await generator.generate(request);

      expect(mockLogger.info).toHaveBeenCalledWith("L0规则匹配成功", {
        folderId: "folder-l0",
        latencyMs: expect.any(Number),
      });
    });

    it("应该记录T0生成完成日志", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.9 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      await generator.generate(request);

      expect(mockLogger.info).toHaveBeenCalledWith("T0生成完成", {
        folderId: "folder-1",
        confidence: 0.9,
        needsT1: false,
        latencyMs: expect.any(Number),
      });
    });

    it("应该正确处理 embedding 服务返回的结构化响应", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      // 模拟返回结构化的 embedding 响应
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce({
        embedding: new Array(1024).fill(0.2),
        model: "text-embedding-ada-002",
        usage: { promptTokens: 10, totalTokens: 10 },
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.9 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.folderId).toBe("folder-1");
    });

    it("应该处理超长文本截断到 8000 字符", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: "folder-1", folderName: "Folder 1", fusedScore: 0.9 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      // 创建一个超长标题
      const longTitle = "A".repeat(10000);
      const request = {
        ...createMockRequest(),
        title: longTitle,
      };

      await generator.generate(request);

      // 验证传递给 embedding 服务的文本被截断
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.any(String),
      );

      const calledWith =
        mockEmbeddingService.generateEmbedding.mock.calls[0][0];
      expect(calledWith.length).toBeLessThanOrEqual(8000);
    });

    it("应该正确传递 T0 结果给 LLM Caller 判断", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        { folderId: 1, folderName: "Folder 1", fusedScore: 0.9 },
        { folderId: 2, folderName: "Folder 2", fusedScore: 0.7 },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      await generator.generate(request);

      expect(mockLLMCaller.shouldCallLLM).toHaveBeenCalledWith({
        folderId: 1,
        confidence: 0.9,
        candidates: [
          { folderId: 1, folderName: "Folder 1", similarity: 0.9 },
          { folderId: 2, folderName: "Folder 2", similarity: 0.7 },
        ],
        needsT1: false,
        latencyMs: 0,
      });
    });
  });

  describe("T0 生成 - 错误处理", () => {
    it("应该在 embedding 服务失败时抛出错误", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(
        new Error("Embedding service unavailable"),
      );

      const request = createMockRequest();

      await expect(generator.generate(request)).rejects.toThrow(
        "Embedding service unavailable",
      );
    });

    it("应该在混合检索失败时抛出错误", async () => {
      mockL0Matcher.match.mockReturnValueOnce({ matched: false });

      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce({
        embedding: new Array(1024).fill(0.1),
      });

      mockHybridRetriever.retrieve.mockRejectedValueOnce(
        new Error("Vector search failed"),
      );

      const request = createMockRequest();

      await expect(generator.generate(request)).rejects.toThrow(
        "Vector search failed",
      );
    });
  });
});
