/**
 * 智能分类 v5.0 - Feature Flag 测试
 */

import {
  FeatureFlagService,
  RolloutStage,
  getFeatureFlag,
  resetFeatureFlag,
} from "./feature-flag";
import type { FeatureFlagConfig } from "./feature-flag";

describe("FeatureFlagService", () => {
  describe("构造函数", () => {
    it("应该使用默认配置初始化", () => {
      const service = new FeatureFlagService();
      const config = service.getConfig();

      expect(config.stage).toBe(RolloutStage.DISABLED);
      expect(config.percentage).toBe(0);
      expect(config.whitelist).toEqual([]);
      expect(config.blacklist).toEqual([]);
      expect(config.enabled).toBe(false);
    });

    it("应该使用自定义配置初始化", () => {
      const customConfig: Partial<FeatureFlagConfig> = {
        stage: RolloutStage.CANARY,
        percentage: 5,
        whitelist: ["user-1", "user-2"],
        blacklist: ["user-3"],
        enabled: true,
      };

      const service = new FeatureFlagService(customConfig);
      const config = service.getConfig();

      expect(config.stage).toBe(RolloutStage.CANARY);
      expect(config.percentage).toBe(5);
      expect(config.whitelist).toEqual(["user-1", "user-2"]);
      expect(config.blacklist).toEqual(["user-3"]);
      expect(config.enabled).toBe(true);
    });

    it("应该合并部分自定义配置与默认配置", () => {
      const partialConfig: Partial<FeatureFlagConfig> = {
        enabled: true,
        percentage: 20,
      };

      const service = new FeatureFlagService(partialConfig);
      const config = service.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.percentage).toBe(20);
      expect(config.stage).toBe(RolloutStage.DISABLED); // 默认值
      expect(config.whitelist).toEqual([]); // 默认值
      expect(config.blacklist).toEqual([]); // 默认值
    });
  });

  describe("isEnabledForUser", () => {
    describe("全局开关控制", () => {
      it("当 enabled=false 时，所有用户都应该被禁用", () => {
        const service = new FeatureFlagService({
          enabled: false,
          percentage: 100,
          whitelist: ["user-1"],
        });

        expect(service.isEnabledForUser("user-1")).toBe(false);
        expect(service.isEnabledForUser("user-2")).toBe(false);
      });

      it("当 enabled=true 时，应该根据其他规则判断", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 100,
        });

        expect(service.isEnabledForUser("user-1")).toBe(true);
      });
    });

    describe("黑名单控制", () => {
      it("黑名单用户应该被禁用，即使在白名单中", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 100,
          whitelist: ["user-1"],
          blacklist: ["user-1"],
        });

        expect(service.isEnabledForUser("user-1")).toBe(false);
      });

      it("黑名单用户应该被禁用，即使百分比为100%", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 100,
          blacklist: ["user-blocked"],
        });

        expect(service.isEnabledForUser("user-blocked")).toBe(false);
      });

      it("不在黑名单的用户应该正常判断", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 100,
          blacklist: ["user-blocked"],
        });

        expect(service.isEnabledForUser("user-normal")).toBe(true);
      });
    });

    describe("白名单控制", () => {
      it("白名单用户应该始终启用", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 0,
          whitelist: ["user-vip"],
        });

        expect(service.isEnabledForUser("user-vip")).toBe(true);
      });

      it("白名单用户应该启用，即使百分比为0%", () => {
        const service = new FeatureFlagService({
          enabled: true,
          stage: RolloutStage.DISABLED,
          percentage: 0,
          whitelist: ["user-tester"],
        });

        expect(service.isEnabledForUser("user-tester")).toBe(true);
      });

      it("不在白名单的用户应该根据百分比判断", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 0,
          whitelist: ["user-vip"],
        });

        expect(service.isEnabledForUser("user-normal")).toBe(false);
      });
    });

    describe("百分比分桶控制", () => {
      it("DISABLED 阶段 (0%) 应该禁用所有非白名单用户", () => {
        const service = new FeatureFlagService({
          enabled: true,
          stage: RolloutStage.DISABLED,
          percentage: 0,
        });

        // 测试多个用户
        const users = ["user-1", "user-2", "user-3", "user-4", "user-5"];
        const results = users.map((userId) => service.isEnabledForUser(userId));

        expect(results.every((result) => result === false)).toBe(true);
      });

      it("CANARY 阶段 (5%) 应该启用约5%的用户", () => {
        const service = new FeatureFlagService({
          enabled: true,
          stage: RolloutStage.CANARY,
          percentage: 5,
        });

        // 测试100个用户
        const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
        const enabledCount = users.filter((userId) =>
          service.isEnabledForUser(userId),
        ).length;

        // 允许一定误差范围（0-10%）
        expect(enabledCount).toBeGreaterThanOrEqual(0);
        expect(enabledCount).toBeLessThanOrEqual(10);
      });

      it("EARLY 阶段 (20%) 应该启用约20%的用户", () => {
        const service = new FeatureFlagService({
          enabled: true,
          stage: RolloutStage.EARLY,
          percentage: 20,
        });

        const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
        const enabledCount = users.filter((userId) =>
          service.isEnabledForUser(userId),
        ).length;

        // 允许一定误差范围（15-25%）
        expect(enabledCount).toBeGreaterThanOrEqual(15);
        expect(enabledCount).toBeLessThanOrEqual(25);
      });

      it("MAJORITY 阶段 (50%) 应该启用约50%的用户", () => {
        const service = new FeatureFlagService({
          enabled: true,
          stage: RolloutStage.MAJORITY,
          percentage: 50,
        });

        const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
        const enabledCount = users.filter((userId) =>
          service.isEnabledForUser(userId),
        ).length;

        // 允许一定误差范围（40-60%）- MD5 哈希分布可能有一定偏差
        expect(enabledCount).toBeGreaterThanOrEqual(40);
        expect(enabledCount).toBeLessThanOrEqual(60);
      });

      it("FULL 阶段 (100%) 应该启用所有用户", () => {
        const service = new FeatureFlagService({
          enabled: true,
          stage: RolloutStage.FULL,
          percentage: 100,
        });

        const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
        const results = users.map((userId) => service.isEnabledForUser(userId));

        expect(results.every((result) => result === true)).toBe(true);
      });
    });

    describe("用户分桶一致性", () => {
      it("同一用户多次调用应该返回相同结果", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 50,
        });

        const userId = "user-consistent";
        const result1 = service.isEnabledForUser(userId);
        const result2 = service.isEnabledForUser(userId);
        const result3 = service.isEnabledForUser(userId);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });

      it("不同用户应该有不同的分桶结果", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 50,
        });

        const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
        const results = users.map((userId) => service.isEnabledForUser(userId));

        // 应该有一些 true 和一些 false
        const trueCount = results.filter((r) => r === true).length;
        const falseCount = results.filter((r) => r === false).length;

        expect(trueCount).toBeGreaterThan(0);
        expect(falseCount).toBeGreaterThan(0);
      });
    });

    describe("边界情况", () => {
      it("应该处理空字符串用户ID", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 50,
        });

        expect(() => service.isEnabledForUser("")).not.toThrow();
      });

      it("应该处理特殊字符用户ID", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 50,
        });

        const specialIds = [
          "user@example.com",
          "user-with-dash",
          "user_with_underscore",
          "user.with.dots",
          "user+tag@example.com",
          "用户中文",
          "user🚀emoji",
        ];

        specialIds.forEach((userId) => {
          expect(() => service.isEnabledForUser(userId)).not.toThrow();
        });
      });

      it("应该处理极长用户ID", () => {
        const service = new FeatureFlagService({
          enabled: true,
          percentage: 50,
        });

        const longUserId = "user-" + "a".repeat(1000);
        expect(() => service.isEnabledForUser(longUserId)).not.toThrow();
      });
    });
  });

  describe("updateConfig", () => {
    it("应该更新部分配置", () => {
      const service = new FeatureFlagService({
        enabled: false,
        percentage: 0,
      });

      service.updateConfig({
        enabled: true,
        percentage: 50,
      });

      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.percentage).toBe(50);
    });

    it("应该保留未更新的配置", () => {
      const service = new FeatureFlagService({
        enabled: true,
        percentage: 20,
        whitelist: ["user-1"],
        blacklist: ["user-2"],
      });

      service.updateConfig({
        percentage: 50,
      });

      const config = service.getConfig();
      expect(config.enabled).toBe(true); // 保留
      expect(config.percentage).toBe(50); // 更新
      expect(config.whitelist).toEqual(["user-1"]); // 保留
      expect(config.blacklist).toEqual(["user-2"]); // 保留
    });

    it("应该允许更新白名单和黑名单", () => {
      const service = new FeatureFlagService();

      service.updateConfig({
        whitelist: ["user-a", "user-b"],
        blacklist: ["user-c"],
      });

      const config = service.getConfig();
      expect(config.whitelist).toEqual(["user-a", "user-b"]);
      expect(config.blacklist).toEqual(["user-c"]);
    });
  });

  describe("setStage", () => {
    it("应该设置 DISABLED 阶段", () => {
      const service = new FeatureFlagService();
      service.setStage(RolloutStage.DISABLED);

      const config = service.getConfig();
      expect(config.stage).toBe(RolloutStage.DISABLED);
      expect(config.percentage).toBe(0);
    });

    it("应该设置 CANARY 阶段", () => {
      const service = new FeatureFlagService();
      service.setStage(RolloutStage.CANARY);

      const config = service.getConfig();
      expect(config.stage).toBe(RolloutStage.CANARY);
      expect(config.percentage).toBe(5);
    });

    it("应该设置 EARLY 阶段", () => {
      const service = new FeatureFlagService();
      service.setStage(RolloutStage.EARLY);

      const config = service.getConfig();
      expect(config.stage).toBe(RolloutStage.EARLY);
      expect(config.percentage).toBe(20);
    });

    it("应该设置 MAJORITY 阶段", () => {
      const service = new FeatureFlagService();
      service.setStage(RolloutStage.MAJORITY);

      const config = service.getConfig();
      expect(config.stage).toBe(RolloutStage.MAJORITY);
      expect(config.percentage).toBe(50);
    });

    it("应该设置 FULL 阶段", () => {
      const service = new FeatureFlagService();
      service.setStage(RolloutStage.FULL);

      const config = service.getConfig();
      expect(config.stage).toBe(RolloutStage.FULL);
      expect(config.percentage).toBe(100);
    });

    it("阶段切换应该立即生效", () => {
      const service = new FeatureFlagService({
        enabled: true,
        stage: RolloutStage.DISABLED,
        percentage: 0,
      });

      // 初始状态：所有用户禁用
      expect(service.isEnabledForUser("user-1")).toBe(false);

      // 切换到 FULL
      service.setStage(RolloutStage.FULL);

      // 应该立即启用
      expect(service.isEnabledForUser("user-1")).toBe(true);
    });
  });

  describe("白名单管理", () => {
    it("应该添加用户到白名单", () => {
      const service = new FeatureFlagService();
      service.addToWhitelist("user-1");

      const config = service.getConfig();
      expect(config.whitelist).toContain("user-1");
    });

    it("应该避免重复添加", () => {
      const service = new FeatureFlagService();
      service.addToWhitelist("user-1");
      service.addToWhitelist("user-1");

      const config = service.getConfig();
      expect(config.whitelist.filter((id) => id === "user-1").length).toBe(1);
    });

    it("应该从白名单移除用户", () => {
      const service = new FeatureFlagService({
        whitelist: ["user-1", "user-2"],
      });

      service.removeFromWhitelist("user-1");

      const config = service.getConfig();
      expect(config.whitelist).not.toContain("user-1");
      expect(config.whitelist).toContain("user-2");
    });

    it("移除不存在的用户不应该报错", () => {
      const service = new FeatureFlagService();
      expect(() => service.removeFromWhitelist("non-existent")).not.toThrow();
    });

    it("白名单变更应该立即生效", () => {
      const service = new FeatureFlagService({
        enabled: true,
        percentage: 0,
      });

      // 初始状态：用户禁用
      expect(service.isEnabledForUser("user-vip")).toBe(false);

      // 添加到白名单
      service.addToWhitelist("user-vip");

      // 应该立即启用
      expect(service.isEnabledForUser("user-vip")).toBe(true);

      // 从白名单移除
      service.removeFromWhitelist("user-vip");

      // 应该立即禁用
      expect(service.isEnabledForUser("user-vip")).toBe(false);
    });
  });

  describe("黑名单管理", () => {
    it("应该添加用户到黑名单", () => {
      const service = new FeatureFlagService();
      service.addToBlacklist("user-blocked");

      const config = service.getConfig();
      expect(config.blacklist).toContain("user-blocked");
    });

    it("应该避免重复添加", () => {
      const service = new FeatureFlagService();
      service.addToBlacklist("user-blocked");
      service.addToBlacklist("user-blocked");

      const config = service.getConfig();
      expect(
        config.blacklist.filter((id) => id === "user-blocked").length,
      ).toBe(1);
    });

    it("应该从黑名单移除用户", () => {
      const service = new FeatureFlagService({
        blacklist: ["user-1", "user-2"],
      });

      service.removeFromBlacklist("user-1");

      const config = service.getConfig();
      expect(config.blacklist).not.toContain("user-1");
      expect(config.blacklist).toContain("user-2");
    });

    it("移除不存在的用户不应该报错", () => {
      const service = new FeatureFlagService();
      expect(() => service.removeFromBlacklist("non-existent")).not.toThrow();
    });

    it("黑名单变更应该立即生效", () => {
      const service = new FeatureFlagService({
        enabled: true,
        percentage: 100,
      });

      // 初始状态：用户启用
      expect(service.isEnabledForUser("user-bad")).toBe(true);

      // 添加到黑名单
      service.addToBlacklist("user-bad");

      // 应该立即禁用
      expect(service.isEnabledForUser("user-bad")).toBe(false);

      // 从黑名单移除
      service.removeFromBlacklist("user-bad");

      // 应该立即启用
      expect(service.isEnabledForUser("user-bad")).toBe(true);
    });
  });

  describe("getConfig", () => {
    it("应该返回配置的副本", () => {
      const service = new FeatureFlagService({
        whitelist: ["user-1"],
      });

      const config1 = service.getConfig();
      const config2 = service.getConfig();

      // 应该是不同的对象
      expect(config1).not.toBe(config2);

      // 但内容相同
      expect(config1).toEqual(config2);
    });

    it("修改返回的配置不应该影响内部状态", () => {
      const service = new FeatureFlagService({
        whitelist: ["user-1"],
      });

      const config = service.getConfig();
      config.whitelist.push("user-2");

      const newConfig = service.getConfig();
      expect(newConfig.whitelist).toEqual(["user-1"]);
    });
  });

  describe("getStats", () => {
    it("应该返回正确的统计信息", () => {
      const service = new FeatureFlagService({
        stage: RolloutStage.CANARY,
        percentage: 5,
        whitelist: ["user-1", "user-2"],
        blacklist: ["user-3"],
        enabled: true,
      });

      const stats = service.getStats();

      expect(stats.stage).toBe(RolloutStage.CANARY);
      expect(stats.percentage).toBe(5);
      expect(stats.whitelistCount).toBe(2);
      expect(stats.blacklistCount).toBe(1);
      expect(stats.enabled).toBe(true);
    });

    it("应该处理空白名单和黑名单", () => {
      const service = new FeatureFlagService();
      const stats = service.getStats();

      expect(stats.whitelistCount).toBe(0);
      expect(stats.blacklistCount).toBe(0);
    });
  });

  describe("全局单例", () => {
    beforeEach(() => {
      resetFeatureFlag();
      // 清理环境变量
      delete process.env.CLASSIFICATION_V5_STAGE;
      delete process.env.CLASSIFICATION_V5_ENABLED;
    });

    afterEach(() => {
      resetFeatureFlag();
    });

    it("getFeatureFlag 应该返回单例实例", () => {
      const instance1 = getFeatureFlag();
      const instance2 = getFeatureFlag();

      expect(instance1).toBe(instance2);
    });

    it("应该从环境变量加载配置", () => {
      process.env.CLASSIFICATION_V5_STAGE = RolloutStage.CANARY;
      process.env.CLASSIFICATION_V5_ENABLED = "true";

      const instance = getFeatureFlag();
      const config = instance.getConfig();

      expect(config.stage).toBe(RolloutStage.CANARY);
      expect(config.percentage).toBe(5);
      expect(config.enabled).toBe(true);
    });

    it("环境变量未设置时应该使用默认值", () => {
      const instance = getFeatureFlag();
      const config = instance.getConfig();

      expect(config.stage).toBe(RolloutStage.DISABLED);
      expect(config.percentage).toBe(0);
      expect(config.enabled).toBe(false);
    });

    it("resetFeatureFlag 应该清除单例", () => {
      const instance1 = getFeatureFlag();
      instance1.updateConfig({ percentage: 50 });

      resetFeatureFlag();

      const instance2 = getFeatureFlag();
      const config = instance2.getConfig();

      // 应该是新实例，配置重置
      expect(config.percentage).toBe(0);
    });

    it("应该处理无效的环境变量值", () => {
      process.env.CLASSIFICATION_V5_STAGE = "invalid-stage" as any;
      process.env.CLASSIFICATION_V5_ENABLED = "not-a-boolean";

      const instance = getFeatureFlag();
      const config = instance.getConfig();

      // 应该使用默认值
      expect(config.enabled).toBe(false);
    });
  });

  describe("灰度发布场景", () => {
    it("场景1: 从 DISABLED 到 CANARY 的升级", () => {
      const service = new FeatureFlagService({
        enabled: true,
        stage: RolloutStage.DISABLED,
        percentage: 0,
      });

      // 初始状态：所有用户禁用
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      const disabledCount = users.filter(
        (u) => !service.isEnabledForUser(u),
      ).length;
      expect(disabledCount).toBe(100);

      // 升级到 CANARY (5%)
      service.setStage(RolloutStage.CANARY);

      const enabledCount = users.filter((u) =>
        service.isEnabledForUser(u),
      ).length;
      expect(enabledCount).toBeGreaterThan(0);
      expect(enabledCount).toBeLessThanOrEqual(10);
    });

    it("场景2: 紧急回滚到 DISABLED", () => {
      const service = new FeatureFlagService({
        enabled: true,
        stage: RolloutStage.MAJORITY,
        percentage: 50,
      });

      // 当前状态：50% 用户启用
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      const beforeCount = users.filter((u) =>
        service.isEnabledForUser(u),
      ).length;
      expect(beforeCount).toBeGreaterThan(40);

      // 紧急回滚
      service.setStage(RolloutStage.DISABLED);

      // 所有用户应该被禁用
      const afterCount = users.filter((u) =>
        service.isEnabledForUser(u),
      ).length;
      expect(afterCount).toBe(0);
    });

    it("场景3: 白名单用户优先体验", () => {
      const service = new FeatureFlagService({
        enabled: true,
        stage: RolloutStage.DISABLED,
        percentage: 0,
        whitelist: ["vip-user-1", "vip-user-2"],
      });

      // 白名单用户应该启用
      expect(service.isEnabledForUser("vip-user-1")).toBe(true);
      expect(service.isEnabledForUser("vip-user-2")).toBe(true);

      // 普通用户应该禁用
      expect(service.isEnabledForUser("normal-user")).toBe(false);
    });

    it("场景4: 黑名单用户紧急屏蔽", () => {
      const service = new FeatureFlagService({
        enabled: true,
        stage: RolloutStage.FULL,
        percentage: 100,
      });

      const problematicUser = "user-with-issue";

      // 初始状态：用户启用
      expect(service.isEnabledForUser(problematicUser)).toBe(true);

      // 发现问题，加入黑名单
      service.addToBlacklist(problematicUser);

      // 应该立即禁用
      expect(service.isEnabledForUser(problematicUser)).toBe(false);

      // 其他用户不受影响
      expect(service.isEnabledForUser("other-user")).toBe(true);
    });

    it("场景5: 逐步扩大灰度范围", () => {
      const service = new FeatureFlagService({
        enabled: true,
      });

      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      // CANARY (5%)
      service.setStage(RolloutStage.CANARY);
      const canaryCount = users.filter((u) =>
        service.isEnabledForUser(u),
      ).length;

      // EARLY (20%)
      service.setStage(RolloutStage.EARLY);
      const earlyCount = users.filter((u) =>
        service.isEnabledForUser(u),
      ).length;

      // MAJORITY (50%)
      service.setStage(RolloutStage.MAJORITY);
      const majorityCount = users.filter((u) =>
        service.isEnabledForUser(u),
      ).length;

      // FULL (100%)
      service.setStage(RolloutStage.FULL);
      const fullCount = users.filter((u) => service.isEnabledForUser(u)).length;

      // 验证逐步增长
      expect(canaryCount).toBeLessThan(earlyCount);
      expect(earlyCount).toBeLessThan(majorityCount);
      expect(majorityCount).toBeLessThan(fullCount);
      expect(fullCount).toBe(100);
    });
  });
});
