/**
 * 智能分类 v5.0 - 文件夹建议器测试
 */

import { FolderSuggester } from "./folder-suggester";
import type { FolderStats, UserStats } from "./folder-suggester";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { GardenerConfig } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("FolderSuggester", () => {
  let suggester: FolderSuggester;
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
    suggester = new FolderSuggester(mockLogger, config);
  });

  const createFolderStats = (
    overrides?: Partial<FolderStats>,
  ): FolderStats => ({
    folderId: "folder-1",
    folderName: "Test Folder",
    bookmarkCount: 10,
    lastUsedAt: new Date(),
    averageConfidence: 0.85,
    userCorrectionCount: 1,
    ...overrides,
  });

  const createUserStats = (overrides?: Partial<UserStats>): UserStats => ({
    totalFolders: 10,
    totalBookmarks: 100,
    averageBookmarksPerFolder: 10,
    ...overrides,
  });

  describe("构造函数", () => {
    it("应该正确初始化", () => {
      expect(suggester).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "FolderSuggester",
      });
    });
  });

  describe("analyze", () => {
    it("健康文件夹应该返回 healthy 状态", () => {
      const folderStats = createFolderStats();
      const userStats = createUserStats();

      const result = suggester.analyze(folderStats, userStats);

      expect(result.healthStatus).toBe("healthy");
      expect(result.issues).toHaveLength(0);
      expect(result.priority).toBe(0);
    });

    it("应该检测过度集中", () => {
      const folderStats = createFolderStats({
        bookmarkCount: 50, // 50/100 = 50%
      });
      const userStats = createUserStats({
        totalBookmarks: 100,
      });

      const result = suggester.analyze(folderStats, userStats);

      const concentrationIssue = result.issues.find(
        (issue) => issue.type === "over_concentrated",
      );
      expect(concentrationIssue).toBeDefined();
      expect(concentrationIssue!.severity).toBeGreaterThan(0);
    });

    it("应该检测低使用率", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 天前

      const folderStats = createFolderStats({
        lastUsedAt: oldDate,
      });
      const userStats = createUserStats();

      const result = suggester.analyze(folderStats, userStats);

      const lowUsageIssue = result.issues.find(
        (issue) => issue.type === "low_usage",
      );
      expect(lowUsageIssue).toBeDefined();
    });

    it("应该检测命名不一致", () => {
      const folderStats = createFolderStats({
        folderName: "  Test Folder!!  ", // 前后空格 + 特殊字符
      });
      const userStats = createUserStats();

      const result = suggester.analyze(folderStats, userStats);

      const namingIssue = result.issues.find(
        (issue) => issue.type === "naming_inconsistent",
      );
      expect(namingIssue).toBeDefined();
    });

    it("应该检测低置信度", () => {
      const folderStats = createFolderStats({
        averageConfidence: 0.65, // 低于 0.7
      });
      const userStats = createUserStats();

      const result = suggester.analyze(folderStats, userStats);

      const confidenceIssue = result.issues.find(
        (issue) => issue.type === "duplicate_content",
      );
      expect(confidenceIssue).toBeDefined();
    });

    it("应该检测高纠正率", () => {
      const folderStats = createFolderStats({
        bookmarkCount: 10,
        userCorrectionCount: 3, // 30% 纠正率
      });
      const userStats = createUserStats();

      const result = suggester.analyze(folderStats, userStats);

      const correctionIssue = result.issues.find(
        (issue) => issue.type === "duplicate_content",
      );
      expect(correctionIssue).toBeDefined();
    });

    it("多个问题应该返回 warning 或 critical 状态", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const folderStats = createFolderStats({
        lastUsedAt: oldDate,
        averageConfidence: 0.65,
        folderName: "  Bad Name!!  ",
      });
      const userStats = createUserStats();

      const result = suggester.analyze(folderStats, userStats);

      expect(result.issues.length).toBeGreaterThan(1);
      expect(["warning", "critical"]).toContain(result.healthStatus);
      expect(result.priority).toBeGreaterThan(0);
    });
  });

  describe("analyzeBatch", () => {
    it("应该批量分析文件夹", () => {
      const folderStatsList = [
        createFolderStats({ folderId: "folder-1" }),
        createFolderStats({ folderId: "folder-2" }),
        createFolderStats({ folderId: "folder-3" }),
      ];
      const userStats = createUserStats();

      const results = suggester.analyzeBatch(folderStatsList, userStats);

      expect(results).toHaveLength(3);
      expect(results[0].folderId).toBeDefined();
    });

    it("应该检测过度分散", () => {
      const folderStatsList = [
        createFolderStats({ folderId: "folder-1", bookmarkCount: 1 }),
        createFolderStats({ folderId: "folder-2", bookmarkCount: 1 }),
        createFolderStats({ folderId: "folder-3", bookmarkCount: 1 }),
      ];
      const userStats = createUserStats({
        totalFolders: 60, // 60 文件夹 / 100 书签 = 0.6 > 0.5
        totalBookmarks: 100,
      });

      const results = suggester.analyzeBatch(folderStatsList, userStats);

      // 所有文件夹都应该有过度分散警告
      results.forEach((result) => {
        const dispersedIssue = result.issues.find(
          (issue) => issue.type === "over_dispersed",
        );
        expect(dispersedIssue).toBeDefined();
      });
    });

    it("应该按优先级排序", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const folderStatsList = [
        createFolderStats({ folderId: "folder-1" }), // 健康
        createFolderStats({
          folderId: "folder-2",
          lastUsedAt: oldDate,
          averageConfidence: 0.65,
        }), // 有问题
        createFolderStats({ folderId: "folder-3" }), // 健康
      ];
      const userStats = createUserStats();

      const results = suggester.analyzeBatch(folderStatsList, userStats);

      // 第一个应该是有问题的文件夹
      expect(results[0].folderId).toBe("folder-2");
      expect(results[0].priority).toBeGreaterThan(results[1].priority);
    });
  });
});
