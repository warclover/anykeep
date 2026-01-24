/**
 * 智能分类 v5.0 - 懒更新机制测试
 */

import { LazyUpdater } from "./lazy-updater";
import type { LoggerService } from "../shared/logger";
import type { FolderProfile } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("LazyUpdater", () => {
  let updater: LazyUpdater;

  beforeEach(() => {
    jest.clearAllMocks();
    updater = new LazyUpdater(mockLogger);
  });

  const createMockProfile = (
    overrides?: Partial<FolderProfile>,
  ): FolderProfile => ({
    id: 1,
    userId: "user-1",
    folderId: 1,
    contentEmbedding: [],
    behaviorEmbedding: [],
    alphaCoefficient: 0.5,
    lastUpdatedAt: new Date(),
    bookmarkCount: 50,
    needsUpdate: false,
    avgClassificationScore: 0.9,
    totalClassifications: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("shouldUpdate", () => {
    it("手动触发时应该返回 true", () => {
      const profile = createMockProfile({ needsUpdate: true });
      const result = updater.shouldUpdate(profile, 50);

      expect(result.shouldUpdate).toBe(true);
      expect(result.reason).toBe("manual_trigger");
    });

    it("超过时间阈值时应该返回 true", () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 天前
      const profile = createMockProfile({ lastUpdatedAt: oldDate });
      const result = updater.shouldUpdate(profile, 50);

      expect(result.shouldUpdate).toBe(true);
      expect(result.reason).toBe("time_threshold");
      expect(result.details?.daysSinceUpdate).toBeGreaterThan(7);
    });

    it("新增书签超过阈值时应该返回 true", () => {
      const profile = createMockProfile({ bookmarkCount: 50 });
      const result = updater.shouldUpdate(profile, 65); // 新增 15 条

      expect(result.shouldUpdate).toBe(true);
      expect(result.reason).toBe("bookmark_threshold");
      expect(result.details?.newBookmarksCount).toBe(15);
    });

    it("准确率下降时应该返回 true", () => {
      const profile = createMockProfile({ avgClassificationScore: 0.8 }); // <0.85
      const result = updater.shouldUpdate(profile, 50);

      expect(result.shouldUpdate).toBe(true);
      expect(result.reason).toBe("accuracy_drop");
      expect(result.details?.currentAccuracy).toBe(0.8);
    });

    it("所有条件都不满足时应该返回 false", () => {
      const profile = createMockProfile({
        lastUpdatedAt: new Date(), // 刚更新
        bookmarkCount: 50,
        avgClassificationScore: 0.9, // 高准确率
        needsUpdate: false,
      });
      const result = updater.shouldUpdate(profile, 55); // 只新增 5 条

      expect(result.shouldUpdate).toBe(false);
      expect(result.reason).toBe("none");
    });

    it("应该支持自定义配置", () => {
      const customUpdater = new LazyUpdater(mockLogger, {
        timeThresholdDays: 3,
        newBookmarksThreshold: 5,
        accuracyThreshold: 0.9,
      });

      const profile = createMockProfile({
        lastUpdatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 天前
      });
      const result = customUpdater.shouldUpdate(profile, 50);

      expect(result.shouldUpdate).toBe(true);
      expect(result.reason).toBe("time_threshold");
    });
  });
});
