/**
 * 智能分类 v5.0 - LLM 调用器测试
 */

import { LLMCaller } from "./llm-caller";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { LLMService } from "@/lib/classification/infrastructure/shared-services/llm";
import type { T0Result, LLMCallRequest } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock LLM Service
const mockLLMService: LLMService = {
  classify: jest.fn(),
} as any;

describe("LLMCaller", () => {
  let caller: LLMCaller;

  beforeEach(() => {
    jest.clearAllMocks();
    // 使用测试特定的配置，以便与测试用例中的数值匹配
    caller = new LLMCaller(mockLogger, mockLLMService, {
      lowConfidenceThreshold: 0.75,
      vectorConflictThreshold: 0.1,
      highConfidenceThreshold: 0.85,
      highConfidenceGap: 0.1,
    });
  });

  const createMockT0Result = (overrides?: Partial<T0Result>): T0Result => ({
    folderId: 1,
    confidence: 0.8,
    candidates: [
      { folderId: 1, folderName: "Folder 1", similarity: 0.9 },
      { folderId: 2, folderName: "Folder 2", similarity: 0.7 },
    ],
    needsT1: false,
    latencyMs: 100,
    ...overrides,
  });

  describe("shouldCallLLM", () => {
    it("用户手动请求时应该返回 true", () => {
      const t0Result = createMockT0Result({ confidence: 0.9 });
      expect(caller.shouldCallLLM(t0Result, true)).toBe(true);
    });

    it("低置信度时应该返回 true", () => {
      const t0Result = createMockT0Result({ confidence: 0.7 }); // <0.75
      expect(caller.shouldCallLLM(t0Result)).toBe(true);
    });

    it("向量冲突时应该返回 true", () => {
      const t0Result = createMockT0Result({
        confidence: 0.8,
        candidates: [
          { folderId: 1, folderName: "Folder 1", similarity: 0.85 },
          { folderId: 2, folderName: "Folder 2", similarity: 0.82 }, // 差距<0.1
        ],
      });
      expect(caller.shouldCallLLM(t0Result)).toBe(true);
    });

    it("所有条件都不满足时应该返回 false", () => {
      const t0Result = createMockT0Result({
        confidence: 0.9,
        candidates: [
          { folderId: 1, folderName: "Folder 1", similarity: 0.9 },
          { folderId: 2, folderName: "Folder 2", similarity: 0.7 }, // 差距>0.1
        ],
      });
      expect(caller.shouldCallLLM(t0Result)).toBe(false);
    });
  });

  describe("callLLM", () => {
    it("应该成功调用LLM并返回结果", async () => {
      const mockResponse = {
        folderId: 1,
        confidence: 0.95,
        reasoning: "Test reasoning",
      };

      (mockLLMService.classify as jest.Mock).mockResolvedValueOnce(
        mockResponse,
      );

      const request: LLMCallRequest = {
        bookmark: {
          userId: "user-1",
          bookmarkId: "bookmark-1",
          title: "Test Bookmark",
          url: "https://example.com",
        },
        candidates: [{ folderId: 1, folderName: "Folder 1", score: 0.9 }],
      };

      const result = await caller.callLLM(request);

      expect(result.folderId).toBe(1);
      expect(result.confidence).toBe(0.95);
      expect(result.reasoning).toBe("Test reasoning");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockLLMService.classify).toHaveBeenCalled();
    });
  });
});
