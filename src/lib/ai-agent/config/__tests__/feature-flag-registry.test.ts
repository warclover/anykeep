/**
 * Feature Flags 治理机制测试
 *
 * @module @/lib/ai-agent/config/__tests__/feature-flag-registry
 */

import {
  FEATURE_FLAG_REGISTRY,
  FEATURE_FLAG_REGISTRY_BY_NAME,
  getFeatureFlagDefinition,
  validateFeatureFlags,
  getFeatureFlagStats,
  getFeatureFlagsByModule,
  getUnintegratedFlags,
  generateFeatureFlagReport,
} from "../feature-flag-registry";
import type { FeatureFlags } from "../feature-flags";

describe("feature-flag-registry", () => {
  describe("FEATURE_FLAG_REGISTRY", () => {
    it("应该包含所有已定义的 Feature Flags", () => {
      expect(FEATURE_FLAG_REGISTRY.length).toBeGreaterThan(50);
    });

    it("每个 Flag 定义应该有必需字段", () => {
      for (const def of FEATURE_FLAG_REGISTRY) {
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.module).toBeDefined();
        expect(def.phase).toBeDefined();
        expect(def.integrationPoints).toBeDefined();
        expect(Array.isArray(def.integrationPoints)).toBe(true);
      }
    });

    it("Flag 名称应该唯一", () => {
      const names = FEATURE_FLAG_REGISTRY.map((def) => def.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("集成点应该有有效的类型", () => {
      const validTypes = ["check", "inject", "execute"];

      for (const def of FEATURE_FLAG_REGISTRY) {
        for (const point of def.integrationPoints) {
          expect(validTypes).toContain(point.type);
          expect(point.file).toBeDefined();
          expect(point.location).toBeDefined();
        }
      }
    });

    it("阶段应该是有效值", () => {
      const validPhases = ["stable", "beta", "alpha", "deprecated"];

      for (const def of FEATURE_FLAG_REGISTRY) {
        expect(validPhases).toContain(def.phase);
      }
    });

    it("模块应该是有效值", () => {
      const validModules = [
        "core",
        "task-understanding",
        "context",
        "memory",
        "react",
        "persona",
        "rag",
        "workflow",
        "safety",
        "intent",
        "proactive",
      ];

      for (const def of FEATURE_FLAG_REGISTRY) {
        expect(validModules).toContain(def.module);
      }
    });

    it("依赖的 Flag 应该存在于注册表中", () => {
      const allNames = new Set(FEATURE_FLAG_REGISTRY.map((def) => def.name));

      for (const def of FEATURE_FLAG_REGISTRY) {
        if (def.dependencies) {
          for (const dep of def.dependencies) {
            expect(allNames.has(dep)).toBe(true);
          }
        }
      }
    });
  });

  describe("FEATURE_FLAG_REGISTRY_BY_NAME", () => {
    it("应该包含所有 Flags", () => {
      expect(FEATURE_FLAG_REGISTRY_BY_NAME.size).toBe(
        FEATURE_FLAG_REGISTRY.length,
      );
    });

    it("应该能通过名称查找 Flag", () => {
      const def = FEATURE_FLAG_REGISTRY_BY_NAME.get("ENABLE_DYNAMIC_CONTEXT");
      expect(def).toBeDefined();
      expect(def?.name).toBe("ENABLE_DYNAMIC_CONTEXT");
    });
  });

  describe("getFeatureFlagDefinition", () => {
    it("应该返回存在的 Flag 定义", () => {
      const def = getFeatureFlagDefinition("ENABLE_DYNAMIC_CONTEXT");
      expect(def).toBeDefined();
      expect(def?.name).toBe("ENABLE_DYNAMIC_CONTEXT");
      expect(def?.module).toBe("context");
    });

    it("应该为不存在的 Flag 返回 undefined", () => {
      // @ts-expect-error - 测试不存在的 Flag
      const def = getFeatureFlagDefinition("NONEXISTENT_FLAG");
      expect(def).toBeUndefined();
    });
  });

  describe("validateFeatureFlags", () => {
    it("应该返回验证结果", () => {
      const result = validateFeatureFlags();

      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("stats");
    });

    it("统计信息应该包含所有字段", () => {
      const result = validateFeatureFlags();

      expect(result.stats).toHaveProperty("totalFlags");
      expect(result.stats).toHaveProperty("enabledFlags");
      expect(result.stats).toHaveProperty("integratedFlags");
      expect(result.stats).toHaveProperty("deprecatedFlags");
      expect(result.stats).toHaveProperty("integrationRate");
    });

    it("集成率应该在 0-100 之间", () => {
      const result = validateFeatureFlags();

      expect(result.stats.integrationRate).toBeGreaterThanOrEqual(0);
      expect(result.stats.integrationRate).toBeLessThanOrEqual(100);
    });

    it("totalFlags 应该等于注册表长度", () => {
      const result = validateFeatureFlags();
      expect(result.stats.totalFlags).toBe(FEATURE_FLAG_REGISTRY.length);
    });

    it("enabledFlags 应该 <= totalFlags", () => {
      const result = validateFeatureFlags();
      expect(result.stats.enabledFlags).toBeLessThanOrEqual(
        result.stats.totalFlags,
      );
    });

    it("integratedFlags 应该 <= enabledFlags", () => {
      const result = validateFeatureFlags();
      expect(result.stats.integratedFlags).toBeLessThanOrEqual(
        result.stats.enabledFlags,
      );
    });
  });

  describe("getFeatureFlagStats", () => {
    it("应该返回统计信息", () => {
      const stats = getFeatureFlagStats();

      expect(stats.totalFlags).toBeGreaterThan(0);
      expect(typeof stats.enabledFlags).toBe("number");
      expect(typeof stats.integratedFlags).toBe("number");
      expect(typeof stats.deprecatedFlags).toBe("number");
      expect(typeof stats.integrationRate).toBe("number");
    });
  });

  describe("getFeatureFlagsByModule", () => {
    it("应该按模块分组返回 Flags", () => {
      const grouped = getFeatureFlagsByModule();

      expect(grouped.size).toBeGreaterThan(0);

      // 验证每个模块都有 Flags
      for (const [module, flags] of grouped) {
        expect(flags.length).toBeGreaterThan(0);
        for (const flag of flags) {
          expect(flag.module).toBe(module);
        }
      }
    });

    it("应该包含所有模块", () => {
      const grouped = getFeatureFlagsByModule();

      expect(grouped.has("core")).toBe(true);
      expect(grouped.has("context")).toBe(true);
      expect(grouped.has("task-understanding")).toBe(true);
    });

    it("分组后的总数应该等于注册表长度", () => {
      const grouped = getFeatureFlagsByModule();

      let totalCount = 0;
      for (const flags of grouped.values()) {
        totalCount += flags.length;
      }

      expect(totalCount).toBe(FEATURE_FLAG_REGISTRY.length);
    });
  });

  describe("getUnintegratedFlags", () => {
    it("应该返回未集成的 Flags 数组", () => {
      const unintegrated = getUnintegratedFlags();

      expect(Array.isArray(unintegrated)).toBe(true);

      // 所有返回的 Flags 应该没有集成点
      for (const flag of unintegrated) {
        expect(flag.integrationPoints.length).toBe(0);
        expect(flag.phase).not.toBe("deprecated");
      }
    });

    it("废弃的 Flags 不应该在未集成列表中", () => {
      const unintegrated = getUnintegratedFlags();

      for (const flag of unintegrated) {
        expect(flag.phase).not.toBe("deprecated");
      }
    });
  });

  describe("generateFeatureFlagReport", () => {
    it("应该生成 Markdown 格式的报告", () => {
      const report = generateFeatureFlagReport();

      expect(report).toContain("# Feature Flags 报告");
      expect(report).toContain("## 统计概览");
      expect(report).toContain("## 按模块分组");
    });

    it("报告应该包含统计数据", () => {
      const report = generateFeatureFlagReport();

      expect(report).toContain("总 Flags 数");
      expect(report).toContain("已启用");
      expect(report).toContain("已集成");
      expect(report).toContain("集成率");
    });

    it("报告应该包含表格", () => {
      const report = generateFeatureFlagReport();

      expect(report).toContain("| Flag |");
      expect(report).toContain("| 指标 |");
    });
  });

  describe("废弃的 Flags", () => {
    it("ENABLE_HYBRID_INTENT_CLASSIFIER 应该标记为废弃", () => {
      const def = getFeatureFlagDefinition("ENABLE_HYBRID_INTENT_CLASSIFIER");

      expect(def).toBeDefined();
      expect(def?.phase).toBe("deprecated");
      expect(def?.integrationPoints.length).toBe(0);
    });
  });

  describe("依赖关系", () => {
    it("画像相关 Flags 应该依赖 ENABLE_MULTI_PERSONA", () => {
      const personaFlags = [
        "ENABLE_PERSONA_INFERENCE",
        "ENABLE_PERSONA_PROMPTS",
        "ENABLE_PERSONA_INTENT_BOOST",
        "ENABLE_PERSONA_SETTINGS_UI",
      ];

      for (const flagName of personaFlags) {
        const def = getFeatureFlagDefinition(
          flagName as keyof typeof FeatureFlags,
        );
        expect(def?.dependencies).toContain("ENABLE_MULTI_PERSONA");
      }
    });

    it("工作流相关 Flags 应该依赖 ENABLE_WORKFLOW_SYSTEM", () => {
      const workflowFlags = [
        "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
        "ENABLE_WORKFLOW_RECOMMENDATIONS",
        "ENABLE_WORKFLOW_NOTIFICATIONS",
      ];

      for (const flagName of workflowFlags) {
        const def = getFeatureFlagDefinition(
          flagName as keyof typeof FeatureFlags,
        );
        expect(def?.dependencies).toContain("ENABLE_WORKFLOW_SYSTEM");
      }
    });
  });

  describe("集成点验证", () => {
    it("核心 Flags 应该有集成点", () => {
      const coreFlags = [
        "ENABLE_DYNAMIC_CONTEXT",
        "ENABLE_MODEL_TIERING",
        "ENABLE_REACT_PROMPT",
        "ENABLE_REASONING",
      ];

      for (const flagName of coreFlags) {
        const def = getFeatureFlagDefinition(
          flagName as keyof typeof FeatureFlags,
        );
        expect(def?.integrationPoints.length).toBeGreaterThan(0);
      }
    });

    it("任务理解层 Flags 应该有集成点", () => {
      const taskFlags = [
        "ENABLE_TASK_UNDERSTANDING",
        "ENABLE_SMART_DEFAULTS",
        "ENABLE_ZERO_TAKEOVER",
        "ENABLE_CONFIDENCE_TIERING",
        "ENABLE_IMPLICIT_INTENT",
        "ENABLE_ENHANCED_CONFIDENCE",
      ];

      for (const flagName of taskFlags) {
        const def = getFeatureFlagDefinition(
          flagName as keyof typeof FeatureFlags,
        );
        expect(def?.integrationPoints.length).toBeGreaterThan(0);
      }
    });
  });
});
