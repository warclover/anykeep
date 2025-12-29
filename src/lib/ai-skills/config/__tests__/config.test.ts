/**
 * 意图→Skill 映射配置测试
 *
 * @version 2.0.0
 * @since 2025-12-27
 */

import {
  INTENT_PATTERNS,
  SORTED_PATTERNS,
  getCompiledPattern,
  clearPatternCache,
} from "../intent-patterns";
import {
  SKILL_MAPPINGS,
  EXPLICIT_TOOL_MAPPINGS,
  buildMappingIndex,
  findMapping,
  findExplicitTool,
  getMappingIndex,
  resetMappingIndex,
} from "../skill-mappings";
import type { SkillMapping } from "../types";

describe("Intent Patterns", () => {
  describe("INTENT_PATTERNS", () => {
    it("should have at least 20 patterns", () => {
      expect(INTENT_PATTERNS.length).toBeGreaterThanOrEqual(20);
    });

    it("should have all required fields", () => {
      for (const pattern of INTENT_PATTERNS) {
        expect(pattern.type).toBeDefined();
        expect(pattern.subType).toBeDefined();
        expect(pattern.pattern).toBeDefined();
        expect(pattern.weight).toBeGreaterThanOrEqual(0);
        expect(pattern.weight).toBeLessThanOrEqual(100);
        expect(pattern.complexity).toMatch(/^(simple|medium|complex)$/);
      }
    });

    it("should have unique type:subType combinations", () => {
      const keys = INTENT_PATTERNS.map((p) => `${p.type}:${p.subType}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it("should cover all intent types", () => {
      const types = new Set(INTENT_PATTERNS.map((p) => p.type));
      expect(types.has("query")).toBe(true);
      expect(types.has("action")).toBe(true);
      expect(types.has("organize")).toBe(true);
      expect(types.has("analyze")).toBe(true);
      expect(types.has("learn")).toBe(true);
      expect(types.has("create")).toBe(true);
      expect(types.has("chitchat")).toBe(true);
    });
  });

  describe("SORTED_PATTERNS", () => {
    it("should be sorted by weight descending", () => {
      for (let i = 1; i < SORTED_PATTERNS.length; i++) {
        expect(SORTED_PATTERNS[i - 1].weight).toBeGreaterThanOrEqual(
          SORTED_PATTERNS[i].weight,
        );
      }
    });

    it("should have same length as INTENT_PATTERNS", () => {
      expect(SORTED_PATTERNS.length).toBe(INTENT_PATTERNS.length);
    });
  });

  describe("getCompiledPattern", () => {
    beforeEach(() => {
      clearPatternCache();
    });

    it("should compile pattern to regex", () => {
      const regex = getCompiledPattern("复习|回顾");
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test("复习")).toBe(true);
      expect(regex.test("回顾")).toBe(true);
      expect(regex.test("学习")).toBe(false);
    });

    it("should cache compiled patterns", () => {
      const pattern = "搜索|查找";
      const regex1 = getCompiledPattern(pattern);
      const regex2 = getCompiledPattern(pattern);
      expect(regex1).toBe(regex2); // 同一个引用
    });

    it("should be case insensitive", () => {
      const regex = getCompiledPattern("hello");
      expect(regex.test("Hello")).toBe(true);
      expect(regex.test("HELLO")).toBe(true);
    });
  });

  describe("pattern matching", () => {
    it("should match learn:review patterns", () => {
      const pattern = INTENT_PATTERNS.find(
        (p) => p.type === "learn" && p.subType === "review",
      );
      expect(pattern).toBeDefined();

      const regex = getCompiledPattern(pattern!.pattern);
      expect(regex.test("帮我复习一下")).toBe(true);
      expect(regex.test("回顾今天的内容")).toBe(true);
      expect(regex.test("温习功课")).toBe(true);
    });

    it("should match organize:cleanup patterns", () => {
      const pattern = INTENT_PATTERNS.find(
        (p) => p.type === "organize" && p.subType === "cleanup",
      );
      expect(pattern).toBeDefined();

      const regex = getCompiledPattern(pattern!.pattern);
      expect(regex.test("整理一下收藏")).toBe(true);
      expect(regex.test("清理收藏夹")).toBe(true);
    });

    it("should match query:search patterns", () => {
      const pattern = INTENT_PATTERNS.find(
        (p) => p.type === "query" && p.subType === "search",
      );
      expect(pattern).toBeDefined();

      const regex = getCompiledPattern(pattern!.pattern);
      expect(regex.test("搜索Python")).toBe(true);
      expect(regex.test("找一下React")).toBe(true);
      expect(regex.test("查资料")).toBe(true);
    });
  });
});

describe("Skill Mappings", () => {
  beforeEach(() => {
    resetMappingIndex();
  });

  describe("SKILL_MAPPINGS", () => {
    it("should have at least 20 mappings", () => {
      expect(SKILL_MAPPINGS.length).toBeGreaterThanOrEqual(20);
    });

    it("should have all required fields", () => {
      for (const mapping of SKILL_MAPPINGS) {
        expect(mapping.key).toBeDefined();
        expect(mapping.skillId).toBeDefined();
        expect(mapping.name).toBeDefined();
        expect(mapping.mode).toMatch(/^(atomic|orchestration)$/);
        expect(typeof mapping.enabled).toBe("boolean");
      }
    });

    it("should have valid key format", () => {
      for (const mapping of SKILL_MAPPINGS) {
        // 格式: intent:subtype, 允许字母、下划线和星号
        expect(mapping.key).toMatch(/^[a-z]+:[a-z_*]+$/);
      }
    });

    it("should have orchestration skills for complex intents", () => {
      const learnReview = SKILL_MAPPINGS.find((m) => m.key === "learn:review");
      expect(learnReview?.mode).toBe("orchestration");

      const organizeCleanup = SKILL_MAPPINGS.find(
        (m) => m.key === "organize:cleanup",
      );
      expect(organizeCleanup?.mode).toBe("orchestration");
    });

    it("should have atomic skills for simple intents", () => {
      const querySearch = SKILL_MAPPINGS.find((m) => m.key === "query:search");
      expect(querySearch?.mode).toBe("atomic");
    });
  });

  describe("EXPLICIT_TOOL_MAPPINGS", () => {
    it("should have at least 5 tools", () => {
      expect(EXPLICIT_TOOL_MAPPINGS.length).toBeGreaterThanOrEqual(5);
    });

    it("should have all required fields", () => {
      for (const tool of EXPLICIT_TOOL_MAPPINGS) {
        expect(tool.toolId).toBeDefined();
        expect(tool.skillId).toBeDefined();
        expect(tool.mode).toMatch(/^(atomic|orchestration)$/);
      }
    });

    it("should have unique toolIds", () => {
      const toolIds = EXPLICIT_TOOL_MAPPINGS.map((t) => t.toolId);
      const uniqueIds = new Set(toolIds);
      expect(uniqueIds.size).toBe(toolIds.length);
    });
  });

  describe("buildMappingIndex", () => {
    it("should build index from mappings", () => {
      const index = buildMappingIndex(SKILL_MAPPINGS);
      expect(index).toBeInstanceOf(Map);
      expect(index.size).toBeGreaterThan(0);
    });

    it("should only include enabled mappings", () => {
      const testMappings: SkillMapping[] = [
        {
          key: "test:a",
          skillId: "skill_a",
          name: "A",
          mode: "atomic",
          enabled: true,
        },
        {
          key: "test:b",
          skillId: "skill_b",
          name: "B",
          mode: "atomic",
          enabled: false,
        },
      ];

      const index = buildMappingIndex(testMappings);
      expect(index.has("test:a")).toBe(true);
      expect(index.has("test:b")).toBe(false);
    });

    it("should keep highest priority mapping for duplicate keys", () => {
      const testMappings: SkillMapping[] = [
        {
          key: "test:x",
          skillId: "low",
          name: "Low",
          mode: "atomic",
          enabled: true,
          priority: 10,
        },
        {
          key: "test:x",
          skillId: "high",
          name: "High",
          mode: "atomic",
          enabled: true,
          priority: 100,
        },
      ];

      const index = buildMappingIndex(testMappings);
      expect(index.get("test:x")?.skillId).toBe("high");
    });
  });

  describe("findMapping", () => {
    let index: Map<string, SkillMapping>;

    beforeEach(() => {
      index = getMappingIndex();
    });

    it("should find exact match", () => {
      const mapping = findMapping(index, "learn", "review");
      expect(mapping).not.toBeNull();
      expect(mapping?.skillId).toBe("knowledge_review");
    });

    it("should find wildcard match when no exact match", () => {
      const mapping = findMapping(index, "organize", "unknown_subtype");
      expect(mapping).not.toBeNull();
      expect(mapping?.key).toBe("organize:*");
    });

    it("should return null when no match", () => {
      const mapping = findMapping(index, "nonexistent", "type");
      expect(mapping).toBeNull();
    });

    it("should prefer exact match over wildcard", () => {
      const exactMapping = findMapping(index, "organize", "cleanup");
      const wildcardMapping = findMapping(index, "organize", "nonexistent");

      expect(exactMapping?.key).toBe("organize:cleanup");
      expect(wildcardMapping?.key).toBe("organize:*");
    });
  });

  describe("findExplicitTool", () => {
    it("should find tool by id", () => {
      const tool = findExplicitTool("search");
      expect(tool).toBeDefined();
      expect(tool?.skillId).toBe("search");
      expect(tool?.mode).toBe("atomic");
    });

    it("should return undefined for unknown tool", () => {
      const tool = findExplicitTool("nonexistent");
      expect(tool).toBeUndefined();
    });

    it("should find orchestration tools", () => {
      const tool = findExplicitTool("organize");
      expect(tool).toBeDefined();
      expect(tool?.mode).toBe("orchestration");
    });
  });

  describe("getMappingIndex", () => {
    it("should return singleton instance", () => {
      const index1 = getMappingIndex();
      const index2 = getMappingIndex();
      expect(index1).toBe(index2);
    });

    it("should reset when resetMappingIndex called", () => {
      const index1 = getMappingIndex();
      resetMappingIndex();
      const index2 = getMappingIndex();
      expect(index1).not.toBe(index2);
    });
  });
});

describe("Integration", () => {
  it("should have matching patterns and mappings for key intents", () => {
    const keyIntents = [
      { type: "learn", subType: "review" },
      { type: "organize", subType: "cleanup" },
      { type: "analyze", subType: "insight" },
      { type: "query", subType: "search" },
    ];

    for (const { type, subType } of keyIntents) {
      // 检查模式存在
      const pattern = INTENT_PATTERNS.find(
        (p) => p.type === type && p.subType === subType,
      );
      expect(pattern).toBeDefined();

      // 检查映射存在
      const mapping = findMapping(getMappingIndex(), type, subType);
      expect(mapping).not.toBeNull();
    }
  });

  it("should have higher weight for complex intents", () => {
    const complexPatterns = INTENT_PATTERNS.filter(
      (p) => p.complexity === "complex",
    );
    const simplePatterns = INTENT_PATTERNS.filter(
      (p) => p.complexity === "simple",
    );

    const avgComplexWeight =
      complexPatterns.reduce((sum, p) => sum + p.weight, 0) /
      complexPatterns.length;
    const avgSimpleWeight =
      simplePatterns.reduce((sum, p) => sum + p.weight, 0) /
      simplePatterns.length;

    expect(avgComplexWeight).toBeGreaterThan(avgSimpleWeight);
  });
});
