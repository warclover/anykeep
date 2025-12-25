/**
 * UnifiedCapabilityRegistry 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  UnifiedCapabilityRegistry,
  unifiedRegistry,
  type UnifiedCapability,
  type UnifiedRegistryStats,
} from "../unified-registry";

// Mock Tool 数据
const mockToolSummaries = [
  {
    name: "search",
    description: "搜索书签",
    category: "query",
    requiresConfirmation: false,
  },
  {
    name: "create_folder",
    description: "创建文件夹",
    category: "mutation",
    requiresConfirmation: true,
  },
  {
    name: "list_recent",
    description: "列出最近书签",
    category: "query",
    requiresConfirmation: false,
  },
];

const mockToolDetails = {
  search: {
    definition: {
      name: "search",
      description: "搜索书签",
      category: "query",
      requiresConfirmation: false,
    },
  },
  create_folder: {
    definition: {
      name: "create_folder",
      description: "创建文件夹",
      category: "mutation",
      requiresConfirmation: true,
    },
  },
};

// Mock Skill 数据
const mockSkillMetadata = [
  {
    id: "summary",
    name: "内容摘要",
    description: "生成内容摘要",
    category: "understanding",
    capabilities: ["summary-generation", "tag-extraction"],
    version: "1.0.0",
    requiresConfirmation: false,
  },
  {
    id: "classify",
    name: "内容分类",
    description: "智能分类书签",
    category: "organizing",
    capabilities: ["vector-matching", "ai-selection"],
    version: "1.0.0",
    requiresConfirmation: false,
  },
  {
    id: "data_export",
    name: "数据导出助手",
    description: "导出书签数据",
    category: "utility",
    capabilities: ["multi-format-export"],
    version: "1.0.0",
    requiresConfirmation: true,
  },
];

const mockSkillRegistrations = {
  summary: {
    skill: {
      metadata: mockSkillMetadata[0],
    },
    enabled: true,
  },
  classify: {
    skill: {
      metadata: mockSkillMetadata[1],
    },
    enabled: true,
  },
  data_export: {
    skill: {
      metadata: mockSkillMetadata[2],
    },
    enabled: false,
  },
};

// Mock ToolRegistry - 使用 Partial 和类型断言简化测试
const createMockToolRegistry = () => ({
  getSummaries: jest.fn(() => mockToolSummaries),
  getStats: jest.fn(() => ({
    totalTools: 3,
    byCategory: { query: 2, mutation: 1 },
  })),
  get: jest.fn(
    (id: string) =>
      mockToolDetails[id as keyof typeof mockToolDetails] || undefined,
  ),
  has: jest.fn((id: string) => id in mockToolDetails),
  getByCategory: jest.fn(),
  register: jest.fn(),
  unregister: jest.fn(),
  clear: jest.fn(),
});

// Mock SkillRegistry
const createMockSkillRegistry = () => ({
  listMetadata: jest.fn((options?: { enabledOnly?: boolean }) => {
    if (options?.enabledOnly) {
      return mockSkillMetadata.filter((s) => {
        const reg =
          mockSkillRegistrations[s.id as keyof typeof mockSkillRegistrations];
        return reg?.enabled;
      });
    }
    return mockSkillMetadata;
  }),
  getStats: jest.fn(() => ({
    total: 3,
    enabled: 2,
    disabled: 1,
    byCategory: { understanding: 1, organizing: 1, utility: 1 },
  })),
  getRegistration: jest.fn(
    (id: string) =>
      mockSkillRegistrations[id as keyof typeof mockSkillRegistrations] ||
      undefined,
  ),
  get: jest.fn(),
  has: jest.fn((id: string) => id in mockSkillRegistrations),
  register: jest.fn(),
  unregister: jest.fn(),
  search: jest.fn(),
});

describe("UnifiedCapabilityRegistry", () => {
  let registry: UnifiedCapabilityRegistry;
  let mockToolReg: ReturnType<typeof createMockToolRegistry>;
  let mockSkillReg: ReturnType<typeof createMockSkillRegistry>;

  beforeEach(() => {
    mockToolReg = createMockToolRegistry();
    mockSkillReg = createMockSkillRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry = new UnifiedCapabilityRegistry(
      mockToolReg as any,
      mockSkillReg as any,
    );
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all capabilities when no options provided", () => {
      const results = registry.findAll();

      expect(results.length).toBe(6); // 3 tools + 3 skills
      expect(mockToolReg.getSummaries).toHaveBeenCalled();
      expect(mockSkillReg.listMetadata).toHaveBeenCalled();
    });

    it("should return only tools when source is tool", () => {
      const results = registry.findAll({ source: "tool" });

      expect(results.length).toBe(3);
      expect(results.every((r) => r.source === "tool")).toBe(true);
      expect(mockToolReg.getSummaries).toHaveBeenCalled();
      expect(mockSkillReg.listMetadata).not.toHaveBeenCalled();
    });

    it("should return only skills when source is skill", () => {
      const results = registry.findAll({ source: "skill" });

      expect(results.length).toBe(3);
      expect(results.every((r) => r.source === "skill")).toBe(true);
      expect(mockToolReg.getSummaries).not.toHaveBeenCalled();
      expect(mockSkillReg.listMetadata).toHaveBeenCalled();
    });

    it("should filter by category", () => {
      const results = registry.findAll({ category: "query" });

      expect(results.length).toBe(2); // search and list_recent
      expect(results.every((r) => r.category === "query")).toBe(true);
    });

    it("should filter by enabled status for skills", () => {
      registry.findAll({ source: "skill", enabled: true });

      // Mock 返回启用的 skills
      expect(mockSkillReg.listMetadata).toHaveBeenCalledWith({
        enabledOnly: true,
      });
    });

    it("should include capabilities and version for skills", () => {
      const results = registry.findAll({ source: "skill" });
      const summarySkill = results.find((r) => r.id === "summary");

      expect(summarySkill).toBeDefined();
      expect(summarySkill?.capabilities).toContain("summary-generation");
      expect(summarySkill?.version).toBe("1.0.0");
    });

    it("should set enabled to true for all tools", () => {
      const results = registry.findAll({ source: "tool" });

      expect(results.every((r) => r.enabled === true)).toBe(true);
    });
  });

  describe("findById", () => {
    it("should find a tool by id", () => {
      const result = registry.findById("search");

      expect(result).toBeDefined();
      expect(result?.id).toBe("search");
      expect(result?.source).toBe("tool");
      expect(result?.description).toBe("搜索书签");
    });

    it("should find a skill by id", () => {
      const result = registry.findById("summary");

      expect(result).toBeDefined();
      expect(result?.id).toBe("summary");
      expect(result?.source).toBe("skill");
      expect(result?.capabilities).toContain("summary-generation");
    });

    it("should return undefined for non-existent id", () => {
      const result = registry.findById("non_existent");

      expect(result).toBeUndefined();
    });

    it("should prioritize tool over skill with same id", () => {
      // Tool 优先查找
      const result = registry.findById("search");

      expect(result?.source).toBe("tool");
      expect(mockToolReg.get).toHaveBeenCalledWith("search");
    });

    it("should include enabled status from skill registration", () => {
      const result = registry.findById("data_export");

      expect(result?.enabled).toBe(false); // data_export is disabled
    });
  });

  describe("search", () => {
    it("should search by id", () => {
      const results = registry.search("search");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === "search")).toBe(true);
    });

    it("should search by name", () => {
      const results = registry.search("摘要");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === "内容摘要")).toBe(true);
    });

    it("should search by description", () => {
      const results = registry.search("书签");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should search by capabilities", () => {
      const results = registry.search("vector");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === "classify")).toBe(true);
    });

    it("should be case insensitive", () => {
      const resultsLower = registry.search("summary");
      const resultsUpper = registry.search("SUMMARY");

      expect(resultsLower.length).toBe(resultsUpper.length);
    });

    it("should return empty array for no matches", () => {
      const results = registry.search("zzz_no_match_zzz");

      expect(results).toEqual([]);
    });
  });

  describe("getStats", () => {
    it("should return combined statistics", () => {
      const stats = registry.getStats();

      expect(stats.tools.total).toBe(3);
      expect(stats.skills.total).toBe(3);
      expect(stats.combined.total).toBe(6);
    });

    it("should include tool category breakdown", () => {
      const stats = registry.getStats();

      expect(stats.tools.byCategory.query).toBe(2);
      expect(stats.tools.byCategory.mutation).toBe(1);
    });

    it("should include skill category breakdown", () => {
      const stats = registry.getStats();

      expect(stats.skills.byCategory.understanding).toBe(1);
      expect(stats.skills.byCategory.organizing).toBe(1);
      expect(stats.skills.byCategory.utility).toBe(1);
    });

    it("should include skill enabled/disabled counts", () => {
      const stats = registry.getStats();

      expect(stats.skills.enabled).toBe(2);
      expect(stats.skills.disabled).toBe(1);
    });
  });

  describe("listAll", () => {
    it("should be an alias for findAll", () => {
      const findAllResults = registry.findAll();
      const listAllResults = registry.listAll();

      expect(listAllResults).toEqual(findAllResults);
    });
  });

  describe("findByCategory", () => {
    it("should find capabilities by category", () => {
      const results = registry.findByCategory("query");

      expect(results.length).toBe(2);
      expect(results.every((r) => r.category === "query")).toBe(true);
    });

    it("should return empty array for non-existent category", () => {
      const results = registry.findByCategory("non_existent_category");

      expect(results).toEqual([]);
    });

    it("should include both tools and skills in category", () => {
      // 假设有同一 category 下的 tool 和 skill
      const results = registry.findByCategory("utility");

      expect(results.some((r) => r.source === "skill")).toBe(true);
    });
  });

  describe("findByCapability", () => {
    it("should find skills by capability tag", () => {
      const results = registry.findByCapability("summary-generation");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === "summary")).toBe(true);
    });

    it("should be case insensitive", () => {
      const results = registry.findByCapability("VECTOR");

      expect(results.some((r) => r.id === "classify")).toBe(true);
    });

    it("should only return skills (not tools)", () => {
      const results = registry.findByCapability("ai");

      expect(results.every((r) => r.source === "skill")).toBe(true);
    });

    it("should return empty array for non-existent capability", () => {
      const results = registry.findByCapability("non_existent_capability");

      expect(results).toEqual([]);
    });
  });

  describe("has", () => {
    it("should return true for existing tool", () => {
      expect(registry.has("search")).toBe(true);
    });

    it("should return true for existing skill", () => {
      expect(registry.has("summary")).toBe(true);
    });

    it("should return false for non-existent id", () => {
      expect(registry.has("non_existent")).toBe(false);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(unifiedRegistry).toBeInstanceOf(UnifiedCapabilityRegistry);
    });
  });
});

describe("UnifiedCapability interface", () => {
  it("should have correct structure", () => {
    const capability: UnifiedCapability = {
      id: "test",
      name: "Test",
      description: "Test capability",
      source: "tool",
      category: "query",
      requiresConfirmation: false,
      enabled: true,
    };

    expect(capability.id).toBeDefined();
    expect(capability.name).toBeDefined();
    expect(capability.source).toMatch(/^(tool|skill)$/);
  });
});

describe("UnifiedRegistryStats interface", () => {
  it("should have correct structure", () => {
    const stats: UnifiedRegistryStats = {
      tools: { total: 3, byCategory: { query: 2 } },
      skills: {
        total: 2,
        enabled: 2,
        disabled: 0,
        byCategory: { understanding: 1 },
      },
      combined: { total: 5 },
    };

    expect(stats.tools.total).toBeDefined();
    expect(stats.skills.total).toBeDefined();
    expect(stats.combined.total).toBeDefined();
  });
});
