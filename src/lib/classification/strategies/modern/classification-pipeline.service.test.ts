/**
 * 智能分类 v5.0 - ClassificationPipeline 主服务测试
 */

import { ClassificationPipelineService } from "./classification-pipeline.service";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { IEmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";
import type { VectorSearchService } from "@/lib/classification/infrastructure/shared-services/vector-search";
import type { LLMService } from "@/lib/classification/infrastructure/shared-services/llm";
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
const mockEmbeddingService: IEmbeddingService = {
  generateEmbedding: jest
    .fn()
    .mockResolvedValue({ embedding: new Array(1024).fill(0.1) }),
} as any;

// Mock Vector Search Service
const mockVectorSearch: VectorSearchService = {
  search: jest.fn().mockResolvedValue([
    {
      folderId: "folder-1",
      folderName: "Folder 1",
      similarity: 0.85,
    },
    {
      folderId: "folder-2",
      folderName: "Folder 2",
      similarity: 0.75,
    },
  ]),
} as any;

// Mock LLM Service
const mockLLMService: LLMService = {
  chat: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      folderId: "folder-2",
      confidence: 0.92,
      reasoning: "Based on content analysis",
    }),
  }),
} as any;

describe("ClassificationPipelineService", () => {
  let service: ClassificationPipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassificationPipelineService(
      mockLogger,
      mockEmbeddingService,
      mockVectorSearch,
      mockLLMService,
    );
  });

  const mockRequest: ClassificationRequest = {
    userId: "user-1",
    bookmarkId: "bookmark-1",
    title: "Test Bookmark",
    description: "Test Description",
    summary: "Test Summary",
    tags: ["tag1", "tag2"],
    url: "https://example.com",
  };

  describe("构造函数", () => {
    it("应该正确初始化", () => {
      expect(service).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "ClassificationPipeline",
      });
    });

    it("应该使用默认配置", () => {
      const defaultService = new ClassificationPipelineService(
        mockLogger,
        mockEmbeddingService,
        mockVectorSearch,
        mockLLMService,
      );

      expect(defaultService).toBeDefined();
    });

    it("应该支持自定义配置", () => {
      const customService = new ClassificationPipelineService(
        mockLogger,
        mockEmbeddingService,
        mockVectorSearch,
        mockLLMService,
        {
          t0ConfidenceThreshold: 0.9,
          vectorConflictThreshold: 0.2,
          hybridWeights: {
            content: 0.8,
            behavior: 0.2,
          },
          rrfK: 50,
        },
      );

      expect(customService).toBeDefined();
    });
  });

  describe("classify", () => {
    it("应该成功执行分类（T0 高置信度）", async () => {
      const result = await service.classify(mockRequest);

      expect(result).toBeDefined();
      expect(result.folderId).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.totalLatencyMs).toBeGreaterThan(0);
      expect(result.t0LatencyMs).toBeGreaterThan(0);
    });

    it("应该记录开始日志", async () => {
      await service.classify(mockRequest);

      expect(mockLogger.info).toHaveBeenCalledWith("开始分类", {
        bookmarkId: "bookmark-1",
        userId: "user-1",
        title: "Test Bookmark",
      });
    });

    it("应该调用 Embedding Service", async () => {
      await service.classify(mockRequest);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it("应该调用 Vector Search", async () => {
      await service.classify(mockRequest);

      expect(mockVectorSearch.search).toHaveBeenCalled();
    });

    it("应该处理 L0 规则匹配成功的情况", async () => {
      // L0 规则匹配会在 URL 包含特定域名时触发
      const githubRequest: ClassificationRequest = {
        ...mockRequest,
        url: "https://github.com/user/repo",
      };

      const result = await service.classify(githubRequest);

      expect(result).toBeDefined();
      expect(result.usedT1).toBe(false);
      expect(result.totalLatencyMs).toBeLessThan(100); // L0 应该很快
    });

    it("应该处理错误情况", async () => {
      (
        mockEmbeddingService.generateEmbedding as jest.Mock
      ).mockRejectedValueOnce(new Error("Embedding failed"));

      await expect(service.classify(mockRequest)).rejects.toThrow("分类失败");
    });
  });

  describe("classifyBatch", () => {
    it("应该成功执行批量分类", async () => {
      const requests = [
        mockRequest,
        { ...mockRequest, bookmarkId: "bookmark-2" },
        { ...mockRequest, bookmarkId: "bookmark-3" },
      ];

      const results = await service.classifyBatch(requests);

      expect(results).toHaveLength(3);
      expect(results[0].folderId).toBeDefined();
      expect(results[1].folderId).toBeDefined();
      expect(results[2].folderId).toBeDefined();
    });

    it("应该记录批量分类日志", async () => {
      const requests = [
        mockRequest,
        { ...mockRequest, bookmarkId: "bookmark-2" },
      ];

      await service.classifyBatch(requests);

      expect(mockLogger.info).toHaveBeenCalledWith("开始批量分类", {
        count: 2,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "批量分类完成",
        expect.objectContaining({
          total: 2,
          success: 2,
          failure: 0,
        }),
      );
    });
  });
});
