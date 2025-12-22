/**
 * SkillRegistry 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { z } from "zod";
import { SkillRegistry } from "../core/skill-registry";
import { BaseSkill } from "../core/base-skill";
import type { SkillMetadata, SkillContext } from "../core/types";

// ============================================
// 测试用 Mock Skills
// ============================================

class MockSearchSkill extends BaseSkill<
  { query: string },
  { results: string[] }
> {
  metadata: SkillMetadata = {
    id: "search",
    name: "Search Skill",
    description: "Search bookmarks",
    category: "utility",
    version: "1.0.0",
    author: "Test",
    capabilities: ["search", "semantic-search"],
  };

  inputSchema = z.object({ query: z.string() });
  outputSchema = z.object({ results: z.array(z.string()) });

  protected async executeInternal(input: {
    query: string;
  }): Promise<{ results: string[] }> {
    return { results: [`Result for: ${input.query}`] };
  }
}

class MockClassifySkill extends BaseSkill<
  { content: string },
  { category: string }
> {
  metadata: SkillMetadata = {
    id: "classify",
    name: "Classify Skill",
    description: "Classify content",
    category: "understanding",
    version: "1.0.0",
    author: "Test",
    capabilities: ["classification", "ai"],
  };

  inputSchema = z.object({ content: z.string() });
  outputSchema = z.object({ category: z.string() });

  protected async executeInternal(_input: {
    content: string;
  }): Promise<{ category: string }> {
    return { category: "tech" };
  }
}

class MockSummarySkill extends BaseSkill<
  { text: string },
  { summary: string }
> {
  metadata: SkillMetadata = {
    id: "summary",
    name: "Summary Skill",
    description: "Summarize content",
    category: "understanding",
    version: "1.0.0",
    author: "Test",
    capabilities: ["summarization", "ai"],
  };

  inputSchema = z.object({ text: z.string() });
  outputSchema = z.object({ summary: z.string() });

  protected async executeInternal(input: {
    text: string;
  }): Promise<{ summary: string }> {
    return { summary: input.text.substring(0, 100) };
  }
}

// ============================================
// 测试套件
// ============================================

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    // 获取单例并清空
    registry = SkillRegistry.getInstance();
    registry.clear();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("getInstance", () => {
    it("should return the same instance", () => {
      const instance1 = SkillRegistry.getInstance();
      const instance2 = SkillRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("register", () => {
    it("should register a skill", () => {
      const skill = new MockSearchSkill();
      registry.register(skill);

      expect(registry.has("search")).toBe(true);
      expect(registry.get("search")).toBe(skill);
    });

    it("should register skill with disabled option", () => {
      const skill = new MockSearchSkill();
      registry.register(skill, { enabled: false });

      const registration = registry.getRegistration("search");
      expect(registration?.enabled).toBe(false);
    });

    it("should overwrite existing skill with same id", () => {
      const skill1 = new MockSearchSkill();
      const skill2 = new MockSearchSkill();

      registry.register(skill1);
      registry.register(skill2);

      expect(registry.get("search")).toBe(skill2);
    });
  });

  describe("unregister", () => {
    it("should unregister a skill", () => {
      const skill = new MockSearchSkill();
      registry.register(skill);

      const result = registry.unregister("search");

      expect(result).toBe(true);
      expect(registry.has("search")).toBe(false);
    });

    it("should return false for non-existent skill", () => {
      const result = registry.unregister("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("get", () => {
    it("should return skill by id", () => {
      const skill = new MockSearchSkill();
      registry.register(skill);

      expect(registry.get("search")).toBe(skill);
    });

    it("should return undefined for non-existent skill", () => {
      expect(registry.get("non-existent")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered skill", () => {
      registry.register(new MockSearchSkill());

      expect(registry.has("search")).toBe(true);
    });

    it("should return false for non-existent skill", () => {
      expect(registry.has("non-existent")).toBe(false);
    });
  });

  describe("enable/disable", () => {
    it("should enable a skill", () => {
      const skill = new MockSearchSkill();
      registry.register(skill, { enabled: false });

      const result = registry.enable("search");

      expect(result).toBe(true);
      expect(registry.getRegistration("search")?.enabled).toBe(true);
    });

    it("should disable a skill", () => {
      const skill = new MockSearchSkill();
      registry.register(skill);

      const result = registry.disable("search");

      expect(result).toBe(true);
      expect(registry.getRegistration("search")?.enabled).toBe(false);
    });

    it("should return false for non-existent skill", () => {
      expect(registry.enable("non-existent")).toBe(false);
      expect(registry.disable("non-existent")).toBe(false);
    });
  });

  describe("getAll", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
      registry.register(new MockSummarySkill(), { enabled: false });
    });

    it("should return all skills", () => {
      const skills = registry.getAll();

      expect(skills).toHaveLength(3);
    });

    it("should return only enabled skills when enabledOnly is true", () => {
      const skills = registry.getAll({ enabledOnly: true });

      expect(skills).toHaveLength(2);
      expect(skills.find((s) => s.metadata.id === "summary")).toBeUndefined();
    });
  });

  describe("getByCategory", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
      registry.register(new MockSummarySkill());
    });

    it("should return skills by category", () => {
      const utilitySkills = registry.getByCategory("utility");
      const understandingSkills = registry.getByCategory("understanding");

      expect(utilitySkills).toHaveLength(1);
      expect(utilitySkills[0].metadata.id).toBe("search");
      expect(understandingSkills).toHaveLength(2);
    });

    it("should respect enabledOnly option", () => {
      registry.disable("classify");

      const skills = registry.getByCategory("understanding", {
        enabledOnly: true,
      });

      expect(skills).toHaveLength(1);
      expect(skills[0].metadata.id).toBe("summary");
    });
  });

  describe("getByCapability", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
      registry.register(new MockSummarySkill());
    });

    it("should return skills by capability", () => {
      const searchSkills = registry.getByCapability("search");
      const aiSkills = registry.getByCapability("ai");

      expect(searchSkills).toHaveLength(1);
      expect(aiSkills).toHaveLength(2);
    });
  });

  describe("search", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
      registry.register(new MockSummarySkill());
    });

    it("should search by skill id", () => {
      const results = registry.search("search");

      expect(results).toHaveLength(1);
      expect(results[0].metadata.id).toBe("search");
    });

    it("should search by skill name", () => {
      const results = registry.search("Classify");

      expect(results).toHaveLength(1);
      expect(results[0].metadata.id).toBe("classify");
    });

    it("should search by description", () => {
      const results = registry.search("content");

      expect(results).toHaveLength(2); // classify and summary
    });

    it("should search by capability", () => {
      const results = registry.search("semantic");

      expect(results).toHaveLength(1);
      expect(results[0].metadata.id).toBe("search");
    });

    it("should be case-insensitive", () => {
      const results = registry.search("SEARCH");

      expect(results).toHaveLength(1);
    });
  });

  describe("exportAsTools", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
      registry.register(new MockSummarySkill(), { enabled: false });
    });

    it("should export all enabled skills as tools", () => {
      const tools = registry.exportAsTools();

      expect(Object.keys(tools)).toHaveLength(2);
      expect(tools.search).toBeDefined();
      expect(tools.classify).toBeDefined();
      expect(tools.summary).toBeUndefined(); // disabled
    });

    it("should export specific skills by id", () => {
      const tools = registry.exportAsTools(["search"]);

      expect(Object.keys(tools)).toHaveLength(1);
      expect(tools.search).toBeDefined();
    });

    it("should accept context provider", () => {
      const context: SkillContext = { userId: "test-user" };
      const contextProvider = () => context;

      const tools = registry.exportAsTools(["search"], contextProvider);

      expect(tools.search).toBeDefined();
    });

    it("should skip non-existent skill ids", () => {
      const tools = registry.exportAsTools(["search", "non-existent"]);

      expect(Object.keys(tools)).toHaveLength(1);
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
      registry.register(new MockSummarySkill(), { enabled: false });
    });

    it("should return correct statistics", () => {
      const stats = registry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.byCategory.utility).toBe(1);
      expect(stats.byCategory.understanding).toBe(1); // only enabled ones
    });
  });

  describe("listMetadata", () => {
    beforeEach(() => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());
    });

    it("should return metadata list", () => {
      const metadata = registry.listMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        version: expect.any(String),
        capabilities: expect.any(Array),
        requiresConfirmation: expect.any(Boolean),
      });
    });
  });

  describe("clear", () => {
    it("should clear all registered skills", () => {
      registry.register(new MockSearchSkill());
      registry.register(new MockClassifySkill());

      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
    });
  });
});
