/**
 * 智能分类 v5.0 - Gardener 主服务测试
 */

import { GardenerService } from "./gardener.service";
import type { ClassificationStats } from "./threshold-adapter";
import type { FolderStats, UserStats } from "./folder-suggester";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { IEmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";

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
  generateEmbedding: jest.fn().mockResolvedValue(new Array(1024).fill(0.1)),
} as any;

describe("GardenerService", () => {
  let service: GardenerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GardenerService(mockLogger, mockEmbeddingService);
  });

  const mockClassificationStats: ClassificationStats = {
    totalClassifications: 100,
    correctClassifications: 85,
    t1Corrections: 12,
    userCorrections: 5,
    averageConfidence: 0.88,
  };

  const mockFolderStats: FolderStats[] = [
    {
      folderId: "folder-1",
      folderName: "JavaScript",
      bookmarkCount: 20,
      lastUsedAt: new Date(),
      averageConfidence: 0.85,
      userCorrectionCount: 2,
    },
    {
      folderId: "folder-2",
      folderName: "  Python!!  ",
      bookmarkCount: 15,
      lastUsedAt: new Date(),
      averageConfidence: 0.82,
      userCorrectionCount: 1,
    },
  ];

  const mockUserStats: UserStats = {
    totalFolders: 10,
    totalBookmarks: 100,
    averageBookmarksPerFolder: 10,
  };

  describe("构造函数", () => {
    it("应该正确初始化", () => {
      expect(service).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "Gardener",
      });
    });

    it("应该使用默认配置", () => {
      const config = service.getConfig();

      expect(config.thresholds.t0ConfidenceThreshold).toBe(0.85);
      expect(config.synonymSimilarityThreshold).toBe(0.85);
      expect(config.overDispersedThreshold).toBe(0.5);
      expect(config.overConcentratedThreshold).toBe(0.4);
      expect(config.lowUsageDays).toBe(90);
    });

    it("应该支持自定义配置", () => {
      const customService = new GardenerService(
        mockLogger,
        mockEmbeddingService,
        {
          thresholds: {
            t0ConfidenceThreshold: 0.9,
            vectorConflictThreshold: 0.2,
            minThreshold: 0.75,
            maxThreshold: 0.98,
          },
          synonymSimilarityThreshold: 0.9,
          overDispersedThreshold: 0.6,
          overConcentratedThreshold: 0.5,
          lowUsageDays: 60,
        },
      );

      const config = customService.getConfig();
      expect(config.thresholds.t0ConfidenceThreshold).toBe(0.9);
      expect(config.synonymSimilarityThreshold).toBe(0.9);
    });
  });

  describe("generateReport", () => {
    it("应该生成完整的 Gardener 报告", async () => {
      const report = await service.generateReport(
        mockClassificationStats,
        mockFolderStats,
        mockUserStats,
      );

      expect(report).toBeDefined();
      expect(report.folderSuggestions).toBeDefined();
      expect(report.synonymGroups).toBeDefined();
      expect(report.namingSuggestions).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it("应该包含文件夹建议", async () => {
      const report = await service.generateReport(
        mockClassificationStats,
        mockFolderStats,
        mockUserStats,
      );

      expect(report.folderSuggestions).toHaveLength(2);
      expect(report.folderSuggestions[0].folderId).toBeDefined();
    });

    it("应该包含命名建议", async () => {
      const report = await service.generateReport(
        mockClassificationStats,
        mockFolderStats,
        mockUserStats,
      );

      // folder-2 的名称需要修复
      expect(report.namingSuggestions.length).toBeGreaterThan(0);
      const pythonSuggestion = report.namingSuggestions.find(
        (s) => s.folderId === "folder-2",
      );
      expect(pythonSuggestion).toBeDefined();
      expect(pythonSuggestion!.suggestedName).toBe("Python");
    });

    it("应该记录日志", async () => {
      await service.generateReport(
        mockClassificationStats,
        mockFolderStats,
        mockUserStats,
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        "开始生成 Gardener 报告",
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Gardener 报告生成完成",
        expect.any(Object),
      );
    });
  });

  describe("applyThresholdAdjustment", () => {
    it("应该应用阈值调整", () => {
      const adjustment = {
        currentThreshold: 0.85,
        suggestedThreshold: 0.8,
        reason: "Test adjustment",
        confidence: 0.9,
        supportingData: {
          totalClassifications: 100,
          averageAccuracy: 0.92,
          t1CorrectionRate: 0.08,
          userCorrectionRate: 0.03,
        },
      };

      service.applyThresholdAdjustment(adjustment);

      const config = service.getConfig();
      expect(config.thresholds.t0ConfidenceThreshold).toBe(0.8);
    });
  });

  describe("getConfig", () => {
    it("应该返回当前配置", () => {
      const config = service.getConfig();

      expect(config).toBeDefined();
      expect(config.thresholds).toBeDefined();
      expect(config.synonymSimilarityThreshold).toBeDefined();
    });
  });
});
