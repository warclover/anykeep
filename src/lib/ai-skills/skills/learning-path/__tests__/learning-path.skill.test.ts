/**
 * LearningPathSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { LearningPathSkill, learningPathSkill } from "../learning-path.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import {
  DIFFICULTY_CONFIG,
  DEFAULT_LEARNING_PATH_CONFIG,
  generatePathId,
  generateNodeId,
} from "../types";
import type { LearningPathInput } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
                ),
              })),
            })),
            contains: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
                ),
              })),
            })),
            or: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
                ),
              })),
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
              ),
            })),
          })),
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

describe("LearningPathSkill", () => {
  let skill: LearningPathSkill;

  beforeEach(() => {
    skill = new LearningPathSkill();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("learning_path");
      expect(skill.metadata.name).toBe("学习路径助手");
      expect(skill.metadata.category).toBe("understanding");
      expect(skill.metadata.deliverableTypes).toContain("document");
      expect(skill.metadata.deliverableTypes).toContain("report");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(4);
      expect(skill.metadata.steps![0].id).toBe("analyze");
      expect(skill.metadata.steps![3].id).toBe("complete");
    });

    it("should have required capabilities", () => {
      expect(skill.metadata.capabilities).toContain("path-creation");
      expect(skill.metadata.capabilities).toContain("progress-tracking");
      expect(skill.metadata.capabilities).toContain("learning-suggestions");
      expect(skill.metadata.capabilities).toContain("statistics");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should support multiple output formats", () => {
      expect(skill.metadata.outputFormats).toContain("markdown");
      expect(skill.metadata.outputFormats).toContain("json");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse create action from message", async () => {
      const createResult = await skill.parseInput(
        "创建一个学习路径",
        mockContext,
      );
      expect(createResult.action).toBe("create");

      const generateResult = await skill.parseInput(
        "生成前端开发路径",
        mockContext,
      );
      expect(generateResult.action).toBe("create");

      const planResult = await skill.parseInput(
        "制定 AI 学习计划",
        mockContext,
      );
      expect(planResult.action).toBe("create");
    });

    it("should parse progress action from message", async () => {
      const progressResult = await skill.parseInput(
        "更新学习进度",
        mockContext,
      );
      expect(progressResult.action).toBe("progress");

      const completeResult = await skill.parseInput(
        "完成这个节点",
        mockContext,
      );
      expect(completeResult.action).toBe("progress");
    });

    it("should parse analyze action from message", async () => {
      const analyzeResult = await skill.parseInput("分析学习数据", mockContext);
      expect(analyzeResult.action).toBe("analyze");

      const statsResult = await skill.parseInput("查看统计报告", mockContext);
      expect(statsResult.action).toBe("analyze");
    });

    it("should parse suggest action from message", async () => {
      const suggestResult = await skill.parseInput("给我一些建议", mockContext);
      expect(suggestResult.action).toBe("suggest");

      const nextResult = await skill.parseInput("下一步推荐", mockContext);
      expect(nextResult.action).toBe("suggest");
    });

    it("should default to suggest action", async () => {
      const defaultResult = await skill.parseInput("帮我学习", mockContext);
      expect(defaultResult.action).toBe("suggest");
    });

    it("should parse topic from create message", async () => {
      const result = await skill.parseInput(
        "创建一个学习前端开发的路径",
        mockContext,
      );
      expect(result.action).toBe("create");
      expect(result.createOptions?.topic).toBeDefined();
    });

    it("should parse difficulty from message", async () => {
      const beginnerResult = await skill.parseInput(
        "创建一个入门学习路径",
        mockContext,
      );
      expect(beginnerResult.createOptions?.difficulty).toBe("beginner");

      const advancedResult = await skill.parseInput(
        "创建一个高级进阶路径",
        mockContext,
      );
      expect(advancedResult.createOptions?.difficulty).toBe("advanced");
    });

    it("should parse estimated days from message", async () => {
      const result = await skill.parseInput(
        "创建一个 14 天的学习路径",
        mockContext,
      );
      expect(result.createOptions?.estimatedDays).toBe(14);
    });
  });

  describe("DIFFICULTY_CONFIG", () => {
    it("should have correct beginner config", () => {
      expect(DIFFICULTY_CONFIG.beginner.name).toBe("入门");
      expect(DIFFICULTY_CONFIG.beginner.icon).toBe("🌱");
      expect(DIFFICULTY_CONFIG.beginner.estimatedMinutesPerNode).toBe(10);
    });

    it("should have correct intermediate config", () => {
      expect(DIFFICULTY_CONFIG.intermediate.name).toBe("进阶");
      expect(DIFFICULTY_CONFIG.intermediate.icon).toBe("🌿");
      expect(DIFFICULTY_CONFIG.intermediate.estimatedMinutesPerNode).toBe(20);
    });

    it("should have correct advanced config", () => {
      expect(DIFFICULTY_CONFIG.advanced.name).toBe("高级");
      expect(DIFFICULTY_CONFIG.advanced.icon).toBe("🌳");
      expect(DIFFICULTY_CONFIG.advanced.estimatedMinutesPerNode).toBe(30);
    });

    it("should have correct mixed config", () => {
      expect(DIFFICULTY_CONFIG.mixed.name).toBe("混合");
      expect(DIFFICULTY_CONFIG.mixed.icon).toBe("🎯");
      expect(DIFFICULTY_CONFIG.mixed.estimatedMinutesPerNode).toBe(15);
    });
  });

  describe("DEFAULT_LEARNING_PATH_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_LEARNING_PATH_CONFIG.difficulty).toBe("intermediate");
      expect(DEFAULT_LEARNING_PATH_CONFIG.estimatedDays).toBe(7);
      expect(DEFAULT_LEARNING_PATH_CONFIG.minutesPerDay).toBe(30);
      expect(DEFAULT_LEARNING_PATH_CONFIG.nodesPerMilestone).toBe(5);
    });
  });

  describe("generatePathId", () => {
    it("should generate path ID with correct prefix", () => {
      const id = generatePathId();
      expect(id).toMatch(/^path_\d+_[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generatePathId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("generateNodeId", () => {
    it("should generate node ID with correct prefix", () => {
      const id = generateNodeId();
      expect(id).toMatch(/^node_\d+_[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateNodeId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("inputSchema", () => {
    it("should validate valid create input", () => {
      const validInput: LearningPathInput = {
        action: "create",
        createOptions: {
          topic: "前端开发",
          description: "学习前端开发基础",
          difficulty: "beginner",
          estimatedDays: 14,
        },
      };

      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should validate valid progress input", () => {
      const validInput: LearningPathInput = {
        action: "progress",
        pathId: "path_123",
        progressOptions: {
          nodeId: "node_456",
          status: "completed",
          note: "完成了这个节点",
          rating: 5,
        },
      };

      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid action", () => {
      const invalidInput = { action: "delete" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid difficulty", () => {
      const invalidInput = {
        action: "create",
        createOptions: { topic: "test", difficulty: "expert" },
      };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid estimated days", () => {
      const tooLow = {
        action: "create",
        createOptions: { topic: "test", estimatedDays: 0 },
      };
      expect(skill.inputSchema.safeParse(tooLow).success).toBe(false);

      const tooHigh = {
        action: "create",
        createOptions: { topic: "test", estimatedDays: 100 },
      };
      expect(skill.inputSchema.safeParse(tooHigh).success).toBe(false);
    });

    it("should reject invalid node status", () => {
      const invalidInput = {
        action: "progress",
        progressOptions: { nodeId: "node_1", status: "done" },
      };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid rating", () => {
      const tooLow = {
        action: "progress",
        progressOptions: { nodeId: "node_1", status: "completed", rating: 0 },
      };
      expect(skill.inputSchema.safeParse(tooLow).success).toBe(false);

      const tooHigh = {
        action: "progress",
        progressOptions: { nodeId: "node_1", status: "completed", rating: 6 },
      };
      expect(skill.inputSchema.safeParse(tooHigh).success).toBe(false);
    });

    it("should accept valid input with bookmark IDs", () => {
      const inputWithBookmarks: LearningPathInput = {
        action: "create",
        createOptions: {
          topic: "AI 学习",
          bookmarkIds: [1, 2, 3, 4, 5],
        },
      };

      const result = skill.inputSchema.safeParse(inputWithBookmarks);
      expect(result.success).toBe(true);
    });
  });

  describe("singleton export", () => {
    it("should export a singleton instance", () => {
      expect(learningPathSkill).toBeInstanceOf(LearningPathSkill);
      expect(learningPathSkill.metadata.id).toBe("learning_path");
    });
  });
});
