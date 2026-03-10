/**
 * 智能分类 v5.0 - T1 纠正器测试
 */

import { T1Corrector } from "./t1-corrector";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { ClassificationRequest, T0Result, T1Result } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock LLMCaller
const mockLLMCaller = {
  callLLM: jest.fn(),
} as any;

describe("T1Corrector", () => {
  let corrector: T1Corrector;

  beforeEach(() => {
    jest.clearAllMocks();
    corrector = new T1Corrector(mockLogger, mockLLMCaller);
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

  const mockT0Result: T0Result = {
    folderId: 1,
    confidence: 0.65,
    candidates: [
      {
        folderId: 1,
        folderName: "Folder 1",
        similarity: 0.85,
      },
      {
        folderId: 2,
        folderName: "Folder 2",
        similarity: 0.75,
      },
    ],
    needsT1: true,
    t1Reason: "low_confidence",
    latencyMs: 450,
  };

  const mockT1Result: T1Result = {
    folderId: 2,
    confidence: 0.92,
    reasoning: "Based on content analysis, Folder 2 is more appropriate",
    latencyMs: 3500,
  };

  describe("构造函数", () => {
    it("应该正确初始化", () => {
      expect(corrector).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ service: "T1Corrector" });
    });
  });

  describe("correct", () => {
    it("应该成功执行T1纠正", async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result).toEqual(mockT1Result);
      expect(mockLLMCaller.callLLM).toHaveBeenCalledWith({
        bookmark: mockRequest,
        candidates: [
          {
            folderId: 1,
            folderName: "Folder 1",
            score: 0.85,
            keywordTags: [],
            sampleBookmarks: [],
          },
          {
            folderId: 2,
            folderName: "Folder 2",
            score: 0.75,
            keywordTags: [],
            sampleBookmarks: [],
          },
        ],
      });
    });

    it("应该记录开始日志", async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, mockT0Result);

      expect(mockLogger.info).toHaveBeenCalledWith("开始T1纠正", {
        bookmarkId: "bookmark-1",
        t0FolderId: 1,
        t0Confidence: 0.65,
        t1Reason: "low_confidence",
      });
    });

    it("应该记录完成日志", async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, mockT0Result);

      expect(mockLogger.info).toHaveBeenCalledWith("T1纠正完成", {
        bookmarkId: "bookmark-1",
        t1FolderId: 2,
        t1Confidence: 0.92,
        latencyMs: 3500,
      });
    });

    it("应该正确转换候选列表格式", async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, mockT0Result);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toEqual([
        {
          folderId: 1,
          folderName: "Folder 1",
          score: 0.85,
          keywordTags: [],
          sampleBookmarks: [],
        },
        {
          folderId: 2,
          folderName: "Folder 2",
          score: 0.75,
          keywordTags: [],
          sampleBookmarks: [],
        },
      ]);
    });

    it("应该处理向量冲突触发的T1纠正", async () => {
      const t0ResultWithConflict: T0Result = {
        ...mockT0Result,
        t1Reason: "vector_conflict",
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultWithConflict);

      expect(mockLogger.info).toHaveBeenCalledWith("开始T1纠正", {
        bookmarkId: "bookmark-1",
        t0FolderId: 1,
        t0Confidence: 0.65,
        t1Reason: "vector_conflict",
      });
    });

    it("应该处理手动请求触发的T1纠正", async () => {
      const t0ResultWithManual: T0Result = {
        ...mockT0Result,
        t1Reason: "manual_request",
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultWithManual);

      expect(mockLogger.info).toHaveBeenCalledWith("开始T1纠正", {
        bookmarkId: "bookmark-1",
        t0FolderId: 1,
        t0Confidence: 0.65,
        t1Reason: "manual_request",
      });
    });

    it("应该传播LLM调用错误", async () => {
      const error = new Error("LLM API Error");
      mockLLMCaller.callLLM.mockRejectedValueOnce(error);

      await expect(
        corrector.correct(mockRequest, mockT0Result),
      ).rejects.toThrow("LLM API Error");
    });

    it("应该处理空候选列表", async () => {
      const t0ResultEmpty: T0Result = {
        ...mockT0Result,
        candidates: [],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultEmpty);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toEqual([]);
    });

    it("应该处理单个候选", async () => {
      const t0ResultSingle: T0Result = {
        ...mockT0Result,
        candidates: [
          {
            folderId: 1,
            folderName: "Folder 1",
            similarity: 0.85,
          },
        ],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultSingle);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toHaveLength(1);
    });

    it("应该处理多个候选", async () => {
      const t0ResultMultiple: T0Result = {
        ...mockT0Result,
        candidates: [
          { folderId: 1, folderName: "Folder 1", similarity: 0.85 },
          { folderId: 2, folderName: "Folder 2", similarity: 0.75 },
          { folderId: 3, folderName: "Folder 3", similarity: 0.65 },
          { folderId: 4, folderName: "Folder 4", similarity: 0.55 },
          { folderId: 5, folderName: "Folder 5", similarity: 0.45 },
        ],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultMultiple);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toHaveLength(5);
    });
  });

  describe("T1 纠正 - 边界情况", () => {
    it("应该处理极低置信度的 T0 结果", async () => {
      const t0ResultLowConfidence: T0Result = {
        ...mockT0Result,
        confidence: 0.1,
        t1Reason: "low_confidence",
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultLowConfidence);

      expect(mockLogger.info).toHaveBeenCalledWith("开始T1纠正", {
        bookmarkId: "bookmark-1",
        t0FolderId: 1,
        t0Confidence: 0.1,
        t1Reason: "low_confidence",
      });
    });

    it("应该处理接近阈值的置信度", async () => {
      const t0ResultBorderline: T0Result = {
        ...mockT0Result,
        confidence: 0.84, // 刚好低于 0.85 阈值
        t1Reason: "low_confidence",
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultBorderline);

      expect(mockLogger.info).toHaveBeenCalledWith("开始T1纠正", {
        bookmarkId: "bookmark-1",
        t0FolderId: 1,
        t0Confidence: 0.84,
        t1Reason: "low_confidence",
      });
    });

    it("应该处理 T1 返回与 T0 相同的文件夹", async () => {
      const t1ResultSameFolder: T1Result = {
        folderId: 1, // 与 T0 结果相同
        confidence: 0.95,
        reasoning: "After analysis, the original classification is correct",
        latencyMs: 2800,
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(t1ResultSameFolder);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result.folderId).toBe(1);
      expect(result.confidence).toBe(0.95);
    });

    it("应该处理空推理文本", async () => {
      const t1ResultNoReasoning: T1Result = {
        folderId: 2,
        confidence: 0.88,
        reasoning: "",
        latencyMs: 2500,
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(t1ResultNoReasoning);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result.reasoning).toBe("");
    });

    it("应该处理长推理文本", async () => {
      const longReasoning = "A".repeat(2000); // 2000 字符的推理
      const t1ResultLongReasoning: T1Result = {
        folderId: 2,
        confidence: 0.9,
        reasoning: longReasoning,
        latencyMs: 4000,
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(t1ResultLongReasoning);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result.reasoning).toBe(longReasoning);
      expect(result.reasoning.length).toBe(2000);
    });

    it("应该处理极高置信度的 T1 结果", async () => {
      const t1ResultHighConfidence: T1Result = {
        folderId: 2,
        confidence: 0.99,
        reasoning: "Very certain about this classification",
        latencyMs: 1500,
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(t1ResultHighConfidence);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result.confidence).toBe(0.99);
    });

    it("应该处理极短延迟的 T1 响应", async () => {
      const t1ResultFast: T1Result = {
        folderId: 2,
        confidence: 0.85,
        reasoning: "Quick decision",
        latencyMs: 100,
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(t1ResultFast);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result.latencyMs).toBe(100);
    });

    it("应该处理超长延迟的 T1 响应", async () => {
      const t1ResultSlow: T1Result = {
        folderId: 2,
        confidence: 0.95,
        reasoning: "Complex analysis took time",
        latencyMs: 9000, // 9 秒
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(t1ResultSlow);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result.latencyMs).toBe(9000);
    });

    it("应该正确传递包含特殊字符的书签信息", async () => {
      const specialRequest: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-special",
        title: 'Test <script>alert("xss")</script>',
        description: "Description with \"quotes\" and 'apostrophes'",
        summary: "Summary with emoji 🚀 and unicode 中文",
        tags: ["tag-with-dash", "tag_with_underscore", "tag.with.dots"],
        url: "https://example.com/path?query=value&other=<test>",
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(specialRequest, mockT0Result);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.bookmark.title).toBe(
        'Test <script>alert("xss")</script>',
      );
      expect(callArgs.bookmark.summary).toBe(
        "Summary with emoji 🚀 and unicode 中文",
      );
    });

    it("应该处理候选分数为零的情况", async () => {
      const t0ResultZeroScore: T0Result = {
        ...mockT0Result,
        candidates: [{ folderId: 1, folderName: "Folder 1", similarity: 0 }],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultZeroScore);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates[0].score).toBe(0);
    });

    it("应该处理候选分数为 1 的情况", async () => {
      const t0ResultPerfectScore: T0Result = {
        ...mockT0Result,
        candidates: [{ folderId: 1, folderName: "Folder 1", similarity: 1.0 }],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultPerfectScore);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates[0].score).toBe(1.0);
    });

    it("应该处理相同分数的候选", async () => {
      const t0ResultSameScores: T0Result = {
        ...mockT0Result,
        candidates: [
          { folderId: 1, folderName: "Folder 1", similarity: 0.75 },
          { folderId: 2, folderName: "Folder 2", similarity: 0.75 },
          { folderId: 3, folderName: "Folder 3", similarity: 0.75 },
        ],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultSameScores);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toHaveLength(3);
      expect(
        callArgs.candidates.every((c: { score: number }) => c.score === 0.75),
      ).toBe(true);
    });

    it("应该处理无描述和摘要的请求", async () => {
      const minimalRequest: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-minimal",
        title: "Minimal Bookmark",
        url: "https://example.com",
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(minimalRequest, mockT0Result);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.bookmark.description).toBeUndefined();
      expect(callArgs.bookmark.summary).toBeUndefined();
    });

    it("应该处理候选的文件夹名称包含特殊字符", async () => {
      const t0ResultSpecialNames: T0Result = {
        ...mockT0Result,
        candidates: [
          {
            folderId: 1,
            folderName: "技术文档 / Technical Docs",
            similarity: 0.85,
          },
          {
            folderId: 2,
            folderName: "AI & ML (人工智能)",
            similarity: 0.75,
          },
        ],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultSpecialNames);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates[0].folderName).toBe(
        "技术文档 / Technical Docs",
      );
      expect(callArgs.candidates[1].folderName).toBe("AI & ML (人工智能)");
    });
  });

  describe("T1 纠正 - 错误处理", () => {
    it("应该处理网络超时错误", async () => {
      const timeoutError = new Error("Request timeout after 30000ms");
      mockLLMCaller.callLLM.mockRejectedValueOnce(timeoutError);

      await expect(
        corrector.correct(mockRequest, mockT0Result),
      ).rejects.toThrow("Request timeout after 30000ms");
    });

    it("应该处理速率限制错误", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      mockLLMCaller.callLLM.mockRejectedValueOnce(rateLimitError);

      await expect(
        corrector.correct(mockRequest, mockT0Result),
      ).rejects.toThrow("Rate limit exceeded");
    });

    it("应该处理无效响应格式错误", async () => {
      const invalidFormatError = new Error("Invalid LLM response format");
      mockLLMCaller.callLLM.mockRejectedValueOnce(invalidFormatError);

      await expect(
        corrector.correct(mockRequest, mockT0Result),
      ).rejects.toThrow("Invalid LLM response format");
    });

    it("应该处理服务不可用错误", async () => {
      const serviceError = new Error("LLM service unavailable");
      mockLLMCaller.callLLM.mockRejectedValueOnce(serviceError);

      await expect(
        corrector.correct(mockRequest, mockT0Result),
      ).rejects.toThrow("LLM service unavailable");
    });
  });
});
