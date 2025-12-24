/**
 * BatchOrganizeSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import {
  BatchOrganizeSkill,
  batchOrganizeSkill,
} from "../batch-organize.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import { ORGANIZE_ACTION_CONFIG, DEFAULT_ORGANIZE_CONFIG } from "../types";
import type { OrganizeAction } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() =>
            Promise.resolve({
              data: [],
              error: null,
            }),
          ),
        })),
      })),
    })),
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("BatchOrganizeSkill", () => {
  let skill: BatchOrganizeSkill;

  beforeEach(() => {
    skill = new BatchOrganizeSkill();
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("batch_organize");
      expect(skill.metadata.name).toBe("智能整理助手");
      expect(skill.metadata.category).toBe("utility");
    });

    it("should have deliverable types", () => {
      expect(skill.metadata.deliverableTypes).toBeDefined();
      expect(skill.metadata.deliverableTypes).toContain("list");
      expect(skill.metadata.deliverableTypes).toContain("report");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(6);
      expect(skill.metadata.steps![0].id).toBe("collect");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("auto-categorize");
      expect(skill.metadata.capabilities).toContain("auto-tag");
      expect(skill.metadata.capabilities).toContain("duplicate-detection");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse organize actions from message", async () => {
      const categorizeResult = await skill.parseInput(
        "帮我整理书签",
        mockContext,
      );
      expect(categorizeResult.actions).toContain("auto-categorize");

      const tagResult = await skill.parseInput("批量打标签", mockContext);
      expect(tagResult.actions).toContain("auto-tag");

      const duplicateResult = await skill.parseInput(
        "清理重复书签",
        mockContext,
      );
      expect(duplicateResult.actions).toContain("clean-duplicates");

      const archiveResult = await skill.parseInput("归档旧内容", mockContext);
      expect(archiveResult.actions).toContain("archive-old");
    });

    it("should have at least one action", async () => {
      const result = await skill.parseInput("整理我的书签", mockContext);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it("should include scope in result", async () => {
      const result = await skill.parseInput("整理书签", mockContext);
      expect(result.scope).toBeDefined();
    });

    it("should have confirmation requirement", async () => {
      const result = await skill.parseInput("整理书签", mockContext);
      expect(result.requireConfirmation).toBeDefined();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(batchOrganizeSkill).toBeInstanceOf(BatchOrganizeSkill);
      expect(batchOrganizeSkill.metadata.id).toBe("batch_organize");
    });
  });

  describe("schemas", () => {
    it("should have valid input schema", () => {
      expect(skill.inputSchema).toBeDefined();
    });

    it("should have valid output schema", () => {
      expect(skill.outputSchema).toBeDefined();
    });
  });
});

describe("ORGANIZE_ACTION_CONFIG", () => {
  it("should have all required actions", () => {
    const actions: OrganizeAction[] = [
      "auto-categorize",
      "auto-tag",
      "clean-duplicates",
      "archive-old",
      "validate-urls",
    ];
    actions.forEach((action) => {
      expect(ORGANIZE_ACTION_CONFIG[action]).toBeDefined();
      expect(ORGANIZE_ACTION_CONFIG[action].name).toBeDefined();
      expect(ORGANIZE_ACTION_CONFIG[action].description).toBeDefined();
    });
  });

  it("should have icons for each action", () => {
    const actions: OrganizeAction[] = [
      "auto-categorize",
      "auto-tag",
      "clean-duplicates",
      "archive-old",
      "validate-urls",
    ];
    actions.forEach((action) => {
      expect(ORGANIZE_ACTION_CONFIG[action].icon).toBeDefined();
    });
  });
});

describe("DEFAULT_ORGANIZE_CONFIG", () => {
  it("should have required fields", () => {
    expect(DEFAULT_ORGANIZE_CONFIG.requireConfirmation).toBeDefined();
    expect(DEFAULT_ORGANIZE_CONFIG.autoExecute).toBeDefined();
    expect(DEFAULT_ORGANIZE_CONFIG.scope).toBeDefined();
  });
});
