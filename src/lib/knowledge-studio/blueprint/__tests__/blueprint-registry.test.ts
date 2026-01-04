/**
 * BlueprintRegistry 单元测试
 *
 * 测试 Story 1.3 的验收标准：
 * - AC1: 提供 register(blueprint) 方法注册蓝图
 * - AC2: 提供 getAll() 方法获取所有蓝图
 * - AC3: 提供 getById(id) 方法按 ID 获取蓝图
 * - AC4: 提供 getByTier(tier) 方法按权限层级过滤
 * - AC5: 提供 getByCategory(category) 方法按分类过滤
 * - AC6: 使用单例模式确保全局唯一
 */

import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import type { OrchestrationStreamChunk } from "../../../ai-skills/output/types";
import {
  EnhancedBlueprintEngine,
  EnhancedBlueprintInputSchema,
  type BlueprintExecutionContext,
} from "../enhanced-blueprint-engine";
import { BlueprintRegistry, getBlueprintRegistry } from "../blueprint-registry";
import type {
  BriefingQuestion,
  BriefingConfig,
  EnhancedBlueprintInput,
  StructuredOutput,
  BlueprintOutline,
  BlueprintTier,
  TargetUserGroup,
} from "../types";

// ============================================================
// Mock Blueprint Implementations
// ============================================================

interface TestOutput extends StructuredOutput {
  title: string;
  content: string;
}

/**
 * 基础测试蓝图
 */
class MockBlueprint extends EnhancedBlueprintEngine<TestOutput> {
  readonly blueprintId: string;
  readonly displayName: string;
  readonly description = "测试蓝图描述";
  readonly icon = "🧪";
  readonly tier: BlueprintTier;
  readonly targetUsers: TargetUserGroup[] = ["developer"];
  readonly creditsCost = 2; // Story 8.1: Default credits cost
  readonly category:
    | "geek"
    | "creator"
    | "business"
    | "tech"
    | "classic"
    | "custom";
  readonly priority?: number;
  readonly isNew?: boolean;

  // Use the base class schema for compatibility
  readonly inputSchema = EnhancedBlueprintInputSchema;

  readonly outputSchema = z.object({
    version: z.string(),
    generatedAt: z.date(),
    blueprintId: z.string(),
    title: z.string(),
    content: z.string(),
  });

  readonly briefingConfig: BriefingConfig = {
    enabled: false,
    maxQuestions: 1,
    questions: [],
  };

  constructor(options: {
    id: string;
    name: string;
    tier?: BlueprintTier;
    category?: "geek" | "creator" | "business" | "tech" | "classic" | "custom";
    priority?: number;
    isNew?: boolean;
  }) {
    super();
    this.blueprintId = options.id;
    this.displayName = options.name;
    this.tier = options.tier ?? "free";
    this.category = options.category ?? "custom";
    this.priority = options.priority;
    this.isNew = options.isNew;
  }

  getBriefingQuestions(): BriefingQuestion[] {
    return [];
  }

  async *generateOutline(
    _context: BlueprintExecutionContext,
    _input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    return {
      title: "测试大纲",
      summary: "测试摘要",
      nodes: [],
      totalEstimatedWords: 0,
      generatedBy: "test",
    };
  }

  getOutputSchema(): JSONSchema7 {
    return { type: "object" };
  }

  protected async *generateContent(
    _context: BlueprintExecutionContext,
    _input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    return "测试内容";
  }

  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<TestOutput> {
    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: "测试标题",
      content: rawContent,
    };
  }
}

// ============================================================
// Test Suites
// ============================================================

describe("BlueprintRegistry", () => {
  beforeEach(() => {
    // 每个测试前重置单例
    BlueprintRegistry.resetInstance();
  });

  describe("AC6: 单例模式", () => {
    it("should return the same instance when getInstance is called multiple times", () => {
      const instance1 = BlueprintRegistry.getInstance();
      const instance2 = BlueprintRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetInstance", () => {
      const instance1 = BlueprintRegistry.getInstance();
      BlueprintRegistry.resetInstance();
      const instance2 = BlueprintRegistry.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it("should provide getBlueprintRegistry helper function", () => {
      const instance = getBlueprintRegistry();

      expect(instance).toBe(BlueprintRegistry.getInstance());
    });
  });

  describe("AC1: register() 方法", () => {
    it("should register a blueprint successfully", () => {
      const registry = BlueprintRegistry.getInstance();
      const blueprint = new MockBlueprint({ id: "test-1", name: "测试蓝图1" });

      registry.register(blueprint);

      expect(registry.size).toBe(1);
      expect(registry.has("test-1")).toBe(true);
    });

    it("should throw error when registering duplicate ID", () => {
      const registry = BlueprintRegistry.getInstance();
      const blueprint1 = new MockBlueprint({ id: "test-1", name: "测试蓝图1" });
      const blueprint2 = new MockBlueprint({ id: "test-1", name: "测试蓝图2" });

      registry.register(blueprint1);

      expect(() => registry.register(blueprint2)).toThrow(
        'Blueprint with ID "test-1" is already registered',
      );
    });

    it("should allow registering multiple different blueprints", () => {
      const registry = BlueprintRegistry.getInstance();
      const blueprints = [
        new MockBlueprint({ id: "test-1", name: "测试蓝图1" }),
        new MockBlueprint({ id: "test-2", name: "测试蓝图2" }),
        new MockBlueprint({ id: "test-3", name: "测试蓝图3" }),
      ];

      blueprints.forEach((bp) => registry.register(bp));

      expect(registry.size).toBe(3);
    });
  });

  describe("AC2: getAll() 方法", () => {
    it("should return empty array when no blueprints registered", () => {
      const registry = BlueprintRegistry.getInstance();

      expect(registry.getAll()).toEqual([]);
    });

    it("should return all registered blueprints", () => {
      const registry = BlueprintRegistry.getInstance();
      const blueprints = [
        new MockBlueprint({ id: "test-1", name: "测试蓝图1" }),
        new MockBlueprint({ id: "test-2", name: "测试蓝图2" }),
      ];

      blueprints.forEach((bp) => registry.register(bp));

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it("should sort blueprints by priority", () => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(
        new MockBlueprint({ id: "test-3", name: "优先级3", priority: 3 }),
      );
      registry.register(
        new MockBlueprint({ id: "test-1", name: "优先级1", priority: 1 }),
      );
      registry.register(
        new MockBlueprint({ id: "test-2", name: "优先级2", priority: 2 }),
      );
      registry.register(
        new MockBlueprint({ id: "test-none", name: "无优先级" }),
      );

      const all = registry.getAll();

      expect(all[0].blueprintId).toBe("test-1");
      expect(all[1].blueprintId).toBe("test-2");
      expect(all[2].blueprintId).toBe("test-3");
      expect(all[3].blueprintId).toBe("test-none");
    });
  });

  describe("AC3: getById() 方法", () => {
    it("should return blueprint by ID", () => {
      const registry = BlueprintRegistry.getInstance();
      const blueprint = new MockBlueprint({ id: "test-1", name: "测试蓝图1" });

      registry.register(blueprint);

      const found = registry.getById("test-1");
      expect(found).toBe(blueprint);
    });

    it("should return undefined for non-existent ID", () => {
      const registry = BlueprintRegistry.getInstance();

      const found = registry.getById("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("AC4: getByTier() 方法", () => {
    beforeEach(() => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(
        new MockBlueprint({ id: "free-1", name: "Free蓝图1", tier: "free" }),
      );
      registry.register(
        new MockBlueprint({ id: "free-2", name: "Free蓝图2", tier: "free" }),
      );
      registry.register(
        new MockBlueprint({ id: "pro-1", name: "Pro蓝图1", tier: "pro" }),
      );
      registry.register(
        new MockBlueprint({
          id: "enterprise-1",
          name: "Enterprise蓝图1",
          tier: "enterprise",
        }),
      );
    });

    it("should filter blueprints by free tier", () => {
      const registry = BlueprintRegistry.getInstance();

      const freeBlueprints = registry.getByTier("free");

      expect(freeBlueprints).toHaveLength(2);
      freeBlueprints.forEach((bp) => expect(bp.tier).toBe("free"));
    });

    it("should filter blueprints by pro tier", () => {
      const registry = BlueprintRegistry.getInstance();

      const proBlueprints = registry.getByTier("pro");

      expect(proBlueprints).toHaveLength(1);
      expect(proBlueprints[0].blueprintId).toBe("pro-1");
    });

    it("should filter blueprints by enterprise tier", () => {
      const registry = BlueprintRegistry.getInstance();

      const enterpriseBlueprints = registry.getByTier("enterprise");

      expect(enterpriseBlueprints).toHaveLength(1);
      expect(enterpriseBlueprints[0].blueprintId).toBe("enterprise-1");
    });
  });

  describe("AC5: getByCategory() 方法", () => {
    beforeEach(() => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(
        new MockBlueprint({
          id: "geek-1",
          name: "极客蓝图1",
          category: "geek",
        }),
      );
      registry.register(
        new MockBlueprint({
          id: "geek-2",
          name: "极客蓝图2",
          category: "geek",
        }),
      );
      registry.register(
        new MockBlueprint({
          id: "creator-1",
          name: "创作者蓝图1",
          category: "creator",
        }),
      );
      registry.register(
        new MockBlueprint({
          id: "business-1",
          name: "商业蓝图1",
          category: "business",
        }),
      );
    });

    it("should filter blueprints by geek category", () => {
      const registry = BlueprintRegistry.getInstance();

      const geekBlueprints = registry.getByCategory("geek");

      expect(geekBlueprints).toHaveLength(2);
      geekBlueprints.forEach((bp) => expect(bp.category).toBe("geek"));
    });

    it("should filter blueprints by creator category", () => {
      const registry = BlueprintRegistry.getInstance();

      const creatorBlueprints = registry.getByCategory("creator");

      expect(creatorBlueprints).toHaveLength(1);
      expect(creatorBlueprints[0].blueprintId).toBe("creator-1");
    });

    it("should return empty array for category with no blueprints", () => {
      const registry = BlueprintRegistry.getInstance();

      const techBlueprints = registry.getByCategory("tech");

      expect(techBlueprints).toHaveLength(0);
    });
  });

  describe("辅助方法", () => {
    it("should unregister a blueprint", () => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(new MockBlueprint({ id: "test-1", name: "测试蓝图1" }));

      expect(registry.has("test-1")).toBe(true);

      const result = registry.unregister("test-1");

      expect(result).toBe(true);
      expect(registry.has("test-1")).toBe(false);
    });

    it("should return false when unregistering non-existent blueprint", () => {
      const registry = BlueprintRegistry.getInstance();

      const result = registry.unregister("non-existent");

      expect(result).toBe(false);
    });

    it("should clear all blueprints", () => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(new MockBlueprint({ id: "test-1", name: "测试蓝图1" }));
      registry.register(new MockBlueprint({ id: "test-2", name: "测试蓝图2" }));

      registry.clear();

      expect(registry.size).toBe(0);
    });

    it("should get all metadata", () => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(
        new MockBlueprint({ id: "test-1", name: "测试蓝图1", tier: "free" }),
      );
      registry.register(
        new MockBlueprint({ id: "test-2", name: "测试蓝图2", tier: "pro" }),
      );

      const metadata = registry.getAllMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata[0].blueprintId).toBeDefined();
      expect(metadata[0].displayName).toBeDefined();
      expect(metadata[0].tier).toBeDefined();
    });

    it("should filter by multiple conditions", () => {
      const registry = BlueprintRegistry.getInstance();
      registry.register(
        new MockBlueprint({
          id: "test-1",
          name: "测试1",
          tier: "free",
          category: "geek",
          isNew: true,
        }),
      );
      registry.register(
        new MockBlueprint({
          id: "test-2",
          name: "测试2",
          tier: "free",
          category: "geek",
          isNew: false,
        }),
      );
      registry.register(
        new MockBlueprint({
          id: "test-3",
          name: "测试3",
          tier: "pro",
          category: "geek",
          isNew: true,
        }),
      );

      const filtered = registry.filter({
        tier: "free",
        category: "geek",
        isNew: true,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].blueprintId).toBe("test-1");
    });
  });

  // ============================================================
  // Story 1.4: 蓝图权限分层测试
  // ============================================================

  describe("Story 1.4: 蓝图权限分层", () => {
    beforeEach(() => {
      const registry = BlueprintRegistry.getInstance();
      // 注册不同层级的蓝图
      registry.register(
        new MockBlueprint({ id: "free-1", name: "Free蓝图1", tier: "free" }),
      );
      registry.register(
        new MockBlueprint({ id: "free-2", name: "Free蓝图2", tier: "free" }),
      );
      registry.register(
        new MockBlueprint({ id: "pro-1", name: "Pro蓝图1", tier: "pro" }),
      );
      registry.register(
        new MockBlueprint({ id: "pro-2", name: "Pro蓝图2", tier: "pro" }),
      );
      registry.register(
        new MockBlueprint({
          id: "enterprise-1",
          name: "Enterprise蓝图",
          tier: "enterprise",
        }),
      );
    });

    describe("getAccessibleBlueprints()", () => {
      it("should return only free blueprints for free users", () => {
        const registry = BlueprintRegistry.getInstance();

        const accessible = registry.getAccessibleBlueprints("free");

        expect(accessible).toHaveLength(2);
        accessible.forEach((bp) => expect(bp.tier).toBe("free"));
      });

      it("should return free and pro blueprints for pro users", () => {
        const registry = BlueprintRegistry.getInstance();

        const accessible = registry.getAccessibleBlueprints("pro");

        expect(accessible).toHaveLength(4);
        accessible.forEach((bp) => expect(["free", "pro"]).toContain(bp.tier));
      });

      it("should return all blueprints for enterprise users", () => {
        const registry = BlueprintRegistry.getInstance();

        const accessible = registry.getAccessibleBlueprints("enterprise");

        expect(accessible).toHaveLength(5);
      });
    });

    describe("getLockedBlueprints()", () => {
      it("should return pro and enterprise blueprints for free users", () => {
        const registry = BlueprintRegistry.getInstance();

        const locked = registry.getLockedBlueprints("free");

        expect(locked).toHaveLength(3);
        locked.forEach((bp) =>
          expect(["pro", "enterprise"]).toContain(bp.tier),
        );
      });

      it("should return only enterprise blueprints for pro users", () => {
        const registry = BlueprintRegistry.getInstance();

        const locked = registry.getLockedBlueprints("pro");

        expect(locked).toHaveLength(1);
        expect(locked[0].tier).toBe("enterprise");
      });

      it("should return empty array for enterprise users", () => {
        const registry = BlueprintRegistry.getInstance();

        const locked = registry.getLockedBlueprints("enterprise");

        expect(locked).toHaveLength(0);
      });
    });

    describe("canAccess()", () => {
      it("should return true for accessible blueprints", () => {
        const registry = BlueprintRegistry.getInstance();

        expect(registry.canAccess("free-1", "free")).toBe(true);
        expect(registry.canAccess("free-1", "pro")).toBe(true);
        expect(registry.canAccess("pro-1", "pro")).toBe(true);
        expect(registry.canAccess("enterprise-1", "enterprise")).toBe(true);
      });

      it("should return false for locked blueprints", () => {
        const registry = BlueprintRegistry.getInstance();

        expect(registry.canAccess("pro-1", "free")).toBe(false);
        expect(registry.canAccess("enterprise-1", "free")).toBe(false);
        expect(registry.canAccess("enterprise-1", "pro")).toBe(false);
      });

      it("should return false for non-existent blueprints", () => {
        const registry = BlueprintRegistry.getInstance();

        expect(registry.canAccess("non-existent", "enterprise")).toBe(false);
      });
    });

    describe("getAccessInfo()", () => {
      it("should return access info for accessible blueprint", () => {
        const registry = BlueprintRegistry.getInstance();

        const info = registry.getAccessInfo("free-1", "pro");

        expect(info).toBeDefined();
        expect(info?.canAccess).toBe(true);
        expect(info?.currentTier).toBe("pro");
        expect(info?.requiredTier).toBe("free");
        expect(info?.upgradeMessage).toBeUndefined();
      });

      it("should return access info with upgrade message for locked blueprint", () => {
        const registry = BlueprintRegistry.getInstance();

        const info = registry.getAccessInfo("pro-1", "free");

        expect(info).toBeDefined();
        expect(info?.canAccess).toBe(false);
        expect(info?.currentTier).toBe("free");
        expect(info?.requiredTier).toBe("pro");
        expect(info?.upgradeMessage).toContain("专业版");
      });

      it("should return undefined for non-existent blueprint", () => {
        const registry = BlueprintRegistry.getInstance();

        const info = registry.getAccessInfo("non-existent", "free");

        expect(info).toBeUndefined();
      });
    });

    describe("getAllWithAccessInfo()", () => {
      it("should return all blueprints with access info", () => {
        const registry = BlueprintRegistry.getInstance();

        const allWithInfo = registry.getAllWithAccessInfo("free");

        expect(allWithInfo).toHaveLength(5);

        // 验证 free 蓝图可访问
        const freeBps = allWithInfo.filter(
          (item) => item.blueprint.tier === "free",
        );
        freeBps.forEach((item) => {
          expect(item.accessInfo.canAccess).toBe(true);
        });

        // 验证 pro/enterprise 蓝图锁定
        const lockedBps = allWithInfo.filter(
          (item) => item.blueprint.tier !== "free",
        );
        lockedBps.forEach((item) => {
          expect(item.accessInfo.canAccess).toBe(false);
          expect(item.accessInfo.upgradeMessage).toBeDefined();
        });
      });
    });
  });
});
