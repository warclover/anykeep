/**
 * 智能分类 v5.0 - 混合检索器测试
 */

import { HybridRetriever } from "./hybrid-retriever";
import type { LoggerService } from "../shared/logger";
import type { VectorSearchService } from "../shared/vector-search";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock VectorSearch
const mockVectorSearch: VectorSearchService = {
  search: jest.fn(),
} as any;

describe("HybridRetriever", () => {
  let retriever: HybridRetriever;

  beforeEach(() => {
    jest.clearAllMocks();
    retriever = new HybridRetriever(mockLogger, mockVectorSearch);
  });

  describe("retrieve", () => {
    it("应该成功执行混合检索", async () => {
      const contentResults = [
        { folderId: "folder-1", folderName: "Folder 1", similarity: 0.9 },
        { folderId: "folder-2", folderName: "Folder 2", similarity: 0.8 },
      ];

      const behaviorResults = [
        { folderId: "folder-2", folderName: "Folder 2", similarity: 0.85 },
        { folderId: "folder-3", folderName: "Folder 3", similarity: 0.75 },
      ];

      (mockVectorSearch.search as jest.Mock)
        .mockResolvedValueOnce(contentResults)
        .mockResolvedValueOnce(behaviorResults);

      const results = await retriever.retrieve(
        "user-1",
        new Array(1024).fill(0.1),
        new Array(1024).fill(0.2),
      );

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("folderId");
      expect(results[0]).toHaveProperty("fusedScore");
      expect(mockVectorSearch.search).toHaveBeenCalledTimes(2);
    });

    it("RRF 融合应该正确计算分数", async () => {
      const contentResults = [
        { folderId: "folder-1", folderName: "Folder 1", similarity: 0.9 },
      ];

      const behaviorResults = [
        { folderId: "folder-1", folderName: "Folder 1", similarity: 0.8 },
      ];

      (mockVectorSearch.search as jest.Mock)
        .mockResolvedValueOnce(contentResults)
        .mockResolvedValueOnce(behaviorResults);

      const results = await retriever.retrieve(
        "user-1",
        new Array(1024).fill(0.1),
        new Array(1024).fill(0.2),
      );

      // 同一文件夹在两个结果中都出现，融合分数应该更高
      expect(results[0].folderId).toBe("folder-1");
      expect(results[0].fusedScore).toBeGreaterThan(0);
    });
  });
});
