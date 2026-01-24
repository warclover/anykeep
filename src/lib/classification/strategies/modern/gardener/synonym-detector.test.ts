/**
 * 智能分类 v5.0 - 同义词检测器测试
 */

import { SynonymDetector } from "./synonym-detector";
import type { FolderInfo } from "./synonym-detector";
import type { LoggerService } from "../shared/logger";
import type { IEmbeddingService } from "../shared/embedding";
import type { GardenerConfig } from "./types";

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
  generateEmbedding: jest.fn(),
} as any;

describe("SynonymDetector", () => {
  let detector: SynonymDetector;
  let config: GardenerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      thresholds: {
        t0ConfidenceThreshold: 0.85,
        vectorConflictThreshold: 0.15,
        minThreshold: 0.7,
        maxThreshold: 0.95,
      },
      synonymSimilarityThreshold: 0.85,
      overDispersedThreshold: 0.5,
      overConcentratedThreshold: 0.4,
      lowUsageDays: 90,
    };
    detector = new SynonymDetector(mockLogger, mockEmbeddingService, config);
  });

  const createFolderInfo = (overrides?: Partial<FolderInfo>): FolderInfo => ({
    folderId: "folder-1",
    folderName: "Test Folder",
    bookmarkCount: 10,
    ...overrides,
  });

  describe("构造函数", () => {
    it("应该正确初始化", () => {
      expect(detector).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "SynonymDetector",
      });
    });
  });

  describe("detect", () => {
    it("文件夹数量不足时应该返回空数组", async () => {
      const folders = [createFolderInfo()];

      const result = await detector.detect(folders);

      expect(result).toEqual([]);
    });

    it("应该检测高相似度的同义词组", async () => {
      const folders = [
        createFolderInfo({
          folderId: "folder-1",
          folderName: "JavaScript",
          bookmarkCount: 20,
        }),
        createFolderInfo({
          folderId: "folder-2",
          folderName: "JS",
          bookmarkCount: 10,
        }),
      ];

      // Mock 高相似度向量
      (mockEmbeddingService.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0.95, 0.1, 0.05]);

      const result = await detector.detect(folders);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].primaryFolderId).toBe("folder-1"); // 书签多的作为主文件夹
      expect(result[0].synonyms).toHaveLength(1);
      expect(result[0].synonyms[0].folderId).toBe("folder-2");
    });

    it("应该忽略低相似度的文件夹", async () => {
      const folders = [
        createFolderInfo({
          folderId: "folder-1",
          folderName: "JavaScript",
          bookmarkCount: 20,
        }),
        createFolderInfo({
          folderId: "folder-2",
          folderName: "Python",
          bookmarkCount: 10,
        }),
      ];

      // Mock 低相似度向量
      (mockEmbeddingService.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0, 1, 0]);

      const result = await detector.detect(folders);

      expect(result).toEqual([]);
    });

    it("应该处理向量生成失败", async () => {
      const folders = [
        createFolderInfo({ folderId: "folder-1" }),
        createFolderInfo({ folderId: "folder-2" }),
      ];

      (mockEmbeddingService.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockRejectedValueOnce(new Error("Embedding failed"));

      const result = await detector.detect(folders);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("应该按书签数量选择主文件夹", async () => {
      const folders = [
        createFolderInfo({
          folderId: "folder-1",
          folderName: "JS",
          bookmarkCount: 5,
        }),
        createFolderInfo({
          folderId: "folder-2",
          folderName: "JavaScript",
          bookmarkCount: 20,
        }),
      ];

      (mockEmbeddingService.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0.95, 0.1, 0.05]);

      const result = await detector.detect(folders);

      expect(result[0].primaryFolderId).toBe("folder-2"); // 书签多的
    });

    it("应该建议合并高相似度的文件夹", async () => {
      const folders = [
        createFolderInfo({
          folderId: "folder-1",
          folderName: "JavaScript",
          bookmarkCount: 20,
        }),
        createFolderInfo({
          folderId: "folder-2",
          folderName: "JS",
          bookmarkCount: 10,
        }),
      ];

      // Mock 非常高的相似度（>0.95）
      (mockEmbeddingService.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0.98, 0.01, 0.01]);

      const result = await detector.detect(folders);

      expect(result[0].suggestedAction).toBe("merge");
    });

    it("应该建议重命名中等相似度的文件夹", async () => {
      const folders = [
        createFolderInfo({
          folderId: "folder-1",
          folderName: "JavaScript",
          bookmarkCount: 20,
        }),
        createFolderInfo({
          folderId: "folder-2",
          folderName: "JS Development",
          bookmarkCount: 10,
        }),
      ];

      // Mock 中等相似度（0.85-0.95）
      (mockEmbeddingService.generateEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0.9, 0.05, 0.05]);

      const result = await detector.detect(folders);

      expect(result[0].suggestedAction).toBe("rename");
    });
  });
});
