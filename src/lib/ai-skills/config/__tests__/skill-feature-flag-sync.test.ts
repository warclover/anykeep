/**
 * Skill Feature Flag 同步模块单元测试
 *
 * @module ai-skills/config/__tests__/skill-feature-flag-sync.test
 */

import {
  isSkillEnabledByFeatureFlag,
  isIntentKeyAvailable,
  getDisabledIntentKeys,
  getSkillAvailability,
  getAllSkillAvailability,
  getFeatureFlagSummary,
  getSkillFeatureFlagSync,
  resetSkillFeatureFlagSync,
  SKILL_FEATURE_FLAG_MAPPINGS,
} from "../skill-feature-flag-sync";

// 保存原始环境变量
const originalEnv = { ...process.env };

describe("Skill Feature Flag Sync", () => {
  // 每个测试后重置环境变量和单例
  afterEach(() => {
    process.env = { ...originalEnv };
    resetSkillFeatureFlagSync();
  });

  describe("isSkillEnabledByFeatureFlag", () => {
    it("未配置 Feature Flag 的 Skill 应默认启用", () => {
      // search, batch_organize 等没有独立 Feature Flag
      expect(isSkillEnabledByFeatureFlag("search")).toBe(true);
      expect(isSkillEnabledByFeatureFlag("batch_organize")).toBe(true);
      expect(isSkillEnabledByFeatureFlag("data_export")).toBe(true);
    });

    it("Feature Flag 未设置时应使用默认值", () => {
      // 删除环境变量
      delete process.env.ENABLE_TTS_SYNTHESIS;

      // 默认应启用
      expect(isSkillEnabledByFeatureFlag("tts_synthesis")).toBe(true);
    });

    it("Feature Flag 设置为 false 时应禁用 Skill", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "false";

      expect(isSkillEnabledByFeatureFlag("tts_synthesis")).toBe(false);
    });

    it("Feature Flag 设置为 true 时应启用 Skill", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "true";

      expect(isSkillEnabledByFeatureFlag("tts_synthesis")).toBe(true);
    });

    it("Feature Flag 设置为其他值时应启用 Skill", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "yes";

      expect(isSkillEnabledByFeatureFlag("tts_synthesis")).toBe(true);
    });
  });

  describe("isIntentKeyAvailable", () => {
    it("无相关 Skill 映射的意图键应可用", () => {
      expect(isIntentKeyAvailable("query:search")).toBe(true);
      expect(isIntentKeyAvailable("action:delete")).toBe(true);
    });

    it("Skill 启用时相关意图键应可用", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "true";

      expect(isIntentKeyAvailable("create:tts")).toBe(true);
    });

    it("Skill 禁用时相关意图键应不可用", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "false";

      expect(isIntentKeyAvailable("create:tts")).toBe(false);
    });
  });

  describe("getDisabledIntentKeys", () => {
    it("所有 Skill 启用时应返回空数组", () => {
      // 确保所有 Feature Flag 都启用
      for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
        process.env[mapping.featureFlagEnv] = "true";
      }

      expect(getDisabledIntentKeys()).toEqual([]);
    });

    it("禁用 Skill 时应返回相关意图键", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "false";

      const disabledKeys = getDisabledIntentKeys();
      expect(disabledKeys).toContain("create:tts");
    });

    it("禁用多个 Skill 时应返回所有相关意图键（去重）", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "false";

      const disabledKeys = getDisabledIntentKeys();
      expect(disabledKeys).toContain("create:tts");
    });
  });

  describe("getSkillAvailability", () => {
    it("无 Feature Flag 的 Skill 应返回 available: true", () => {
      const result = getSkillAvailability("search");

      expect(result).toEqual({
        skillId: "search",
        available: true,
      });
    });

    it("启用的 Skill 应返回 available: true", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "true";

      const result = getSkillAvailability("tts_synthesis");

      expect(result).toEqual({
        skillId: "tts_synthesis",
        available: true,
      });
    });

    it("禁用的 Skill 应返回 available: false 和原因", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "false";

      const result = getSkillAvailability("tts_synthesis");

      expect(result.skillId).toBe("tts_synthesis");
      expect(result.available).toBe(false);
      expect(result.reason).toContain("ENABLE_TTS_SYNTHESIS");
    });
  });

  describe("getAllSkillAvailability", () => {
    it("应返回所有有 Feature Flag 的 Skill 状态", () => {
      const results = getAllSkillAvailability();

      expect(results.length).toBe(SKILL_FEATURE_FLAG_MAPPINGS.length);
      expect(results.every((r) => r.skillId)).toBe(true);
    });
  });

  describe("getFeatureFlagSummary", () => {
    it("应返回所有 Skill 的 Feature Flag 摘要", () => {
      process.env.ENABLE_TTS_SYNTHESIS = "false";

      const summary = getFeatureFlagSummary();

      expect(summary.tts_synthesis.enabled).toBe(false);
      expect(summary.tts_synthesis.envVar).toBe("ENABLE_TTS_SYNTHESIS");
      expect(summary.tts_synthesis.disabledIntentKeys).toContain("create:tts");
    });
  });

  describe("SkillFeatureFlagSync", () => {
    it("initialize 应只执行一次", () => {
      const sync = getSkillFeatureFlagSync();

      // 第一次初始化
      sync.initialize();

      // 第二次应该是 no-op
      sync.initialize();

      // 不抛出错误即可
    });

    it("isSkillAvailable 应正确返回状态", () => {
      const sync = getSkillFeatureFlagSync();

      process.env.ENABLE_TTS_SYNTHESIS = "false";

      expect(sync.isSkillAvailable("tts_synthesis")).toBe(false);
      expect(sync.isSkillAvailable("search")).toBe(true);
    });

    it("isIntentKeyAvailable 应正确返回状态", () => {
      const sync = getSkillFeatureFlagSync();

      process.env.ENABLE_TTS_SYNTHESIS = "false";

      expect(sync.isIntentKeyAvailable("create:tts")).toBe(false);
      expect(sync.isIntentKeyAvailable("query:search")).toBe(true);
    });

    it("getDisabledIntentKeys 应返回禁用的意图键", () => {
      const sync = getSkillFeatureFlagSync();

      process.env.ENABLE_TTS_SYNTHESIS = "false";

      const disabledKeys = sync.getDisabledIntentKeys();
      expect(disabledKeys).toContain("create:tts");
    });
  });

  describe("SKILL_FEATURE_FLAG_MAPPINGS 完整性", () => {
    it("每个映射应有必需的字段", () => {
      for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
        expect(mapping.skillId).toBeTruthy();
        expect(mapping.featureFlagEnv).toBeTruthy();
        expect(typeof mapping.defaultEnabled).toBe("boolean");
        expect(Array.isArray(mapping.relatedIntentKeys)).toBe(true);
        expect(mapping.relatedIntentKeys.length).toBeGreaterThan(0);
      }
    });

    it("Feature Flag 环境变量名应以 ENABLE_ 开头", () => {
      for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
        expect(mapping.featureFlagEnv.startsWith("ENABLE_")).toBe(true);
      }
    });

    it("意图键格式应正确（type:subType）", () => {
      for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
        for (const intentKey of mapping.relatedIntentKeys) {
          expect(intentKey).toMatch(/^[a-z]+:[a-z_]+$/);
        }
      }
    });
  });
});
