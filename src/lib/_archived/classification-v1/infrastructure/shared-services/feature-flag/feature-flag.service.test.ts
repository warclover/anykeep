/**
 * 智能分类 v5.0 - FeatureFlag Service 测试
 */

import { FeatureFlagService } from "./feature-flag.service";
import type { LoggerService } from "../logger";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("FeatureFlagService", () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    jest.clearAllMocks();

    // 重置环境变量
    delete process.env.CLASSIFICATION_V5_ENABLED;
    delete process.env.CLASSIFICATION_V5_ROLLOUT_PERCENTAGE;
    delete process.env.CLASSIFICATION_V5_WHITELIST;
    delete process.env.CLASSIFICATION_V5_BLACKLIST;
  });

  describe("构造函数", () => {
    it("应该成功创建实例（默认配置）", () => {
      service = new FeatureFlagService(mockLogger);

      expect(service).toBeInstanceOf(FeatureFlagService);
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "FeatureFlagService",
      });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("应该从环境变量读取配置", () => {
      process.env.CLASSIFICATION_V5_ENABLED = "true";
      process.env.CLASSIFICATION_V5_ROLLOUT_PERCENTAGE = "50";
      process.env.CLASSIFICATION_V5_WHITELIST = "user1,user2";
      process.env.CLASSIFICATION_V5_BLACKLIST = "user3";

      service = new FeatureFlagService(mockLogger);
      const config = service.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.rolloutPercentage).toBe(50);
      expect(config.whitelist).toEqual(["user1", "user2"]);
      expect(config.blacklist).toEqual(["user3"]);
    });

    it("应该接受自定义配置", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 100,
        whitelist: ["test-user"],
        blacklist: [],
      });

      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.rolloutPercentage).toBe(100);
    });
  });

  describe("isV5Enabled", () => {
    it("全局禁用时应该返回 false", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: false,
        rolloutPercentage: 100,
        whitelist: [],
        blacklist: [],
      });

      expect(service.isV5Enabled("any-user")).toBe(false);
    });

    it("黑名单用户应该返回 false", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 100,
        whitelist: [],
        blacklist: ["blocked-user"],
      });

      expect(service.isV5Enabled("blocked-user")).toBe(false);
    });

    it("白名单用户应该返回 true", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 0,
        whitelist: ["vip-user"],
        blacklist: [],
      });

      expect(service.isV5Enabled("vip-user")).toBe(true);
    });

    it("黑名单优先级高于白名单", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 100,
        whitelist: ["conflict-user"],
        blacklist: ["conflict-user"],
      });

      expect(service.isV5Enabled("conflict-user")).toBe(false);
    });

    it("灰度百分比应该正确工作", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 50,
        whitelist: [],
        blacklist: [],
      });

      // 测试多个用户，统计启用比例
      const testUsers = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      const enabledCount = testUsers.filter((userId) =>
        service.isV5Enabled(userId),
      ).length;

      // 允许一定的误差范围（40-60%）
      expect(enabledCount).toBeGreaterThanOrEqual(40);
      expect(enabledCount).toBeLessThanOrEqual(60);
    });

    it("同一用户多次检查应该返回相同结果", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 50,
        whitelist: [],
        blacklist: [],
      });

      const userId = "consistent-user";
      const result1 = service.isV5Enabled(userId);
      const result2 = service.isV5Enabled(userId);
      const result3 = service.isV5Enabled(userId);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe("checkV5Enabled", () => {
    it("应该返回详细的检查结果", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 100,
        whitelist: [],
        blacklist: [],
      });

      const result = service.checkV5Enabled("test-user");

      expect(result).toHaveProperty("enabled");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("userHash");
    });

    it("应该返回正确的禁用原因", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: false,
        rolloutPercentage: 100,
        whitelist: [],
        blacklist: [],
      });

      const result = service.checkV5Enabled("test-user");
      expect(result.reason).toBe("disabled");
    });

    it("应该返回正确的黑名单原因", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 100,
        whitelist: [],
        blacklist: ["blocked-user"],
      });

      const result = service.checkV5Enabled("blocked-user");
      expect(result.reason).toBe("blacklisted");
    });

    it("应该返回正确的白名单原因", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: true,
        rolloutPercentage: 0,
        whitelist: ["vip-user"],
        blacklist: [],
      });

      const result = service.checkV5Enabled("vip-user");
      expect(result.reason).toBe("whitelisted");
    });
  });

  describe("updateConfig", () => {
    it("应该能够更新配置", () => {
      service = new FeatureFlagService(mockLogger, {
        enabled: false,
        rolloutPercentage: 0,
        whitelist: [],
        blacklist: [],
      });

      service.updateConfig({
        enabled: true,
        rolloutPercentage: 100,
      });

      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.rolloutPercentage).toBe(100);
    });
  });
});
