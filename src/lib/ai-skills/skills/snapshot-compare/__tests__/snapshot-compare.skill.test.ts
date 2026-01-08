/**
 * SnapshotCompareSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import {
  SnapshotCompareSkill,
  snapshotCompareSkill,
} from "../snapshot-compare.skill";
import type { SkillContext } from "../../../core/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock compareSnapshotsTool
jest.mock("@/lib/ai-agent/tools/snapshot/compare-snapshots.tool", () => ({
  compareSnapshotsTool: {
    execute: jest.fn(),
  },
}));

// Import after mock to get the mocked version
import { compareSnapshotsTool } from "@/lib/ai-agent/tools/snapshot/compare-snapshots.tool";

const mockExecute = compareSnapshotsTool.execute as jest.MockedFunction<
  typeof compareSnapshotsTool.execute
>;

describe("SnapshotCompareSkill", () => {
  let skill: SnapshotCompareSkill;

  beforeEach(() => {
    skill = new SnapshotCompareSkill();
    jest.clearAllMocks();

    // 默认 mock 返回值
    mockExecute.mockResolvedValue({
      success: true,
      data: {
        hasSignificantChanges: true,
        summary: "页面内容有较大更新",
        stats: {
          addedLines: 10,
          removedLines: 5,
          totalChanges: 15,
          similarityScore: 0.85,
        },
      },
    } as never);
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("snapshot_compare");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("快照对比分析");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("utility");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toContain("compare");
      expect(skill.metadata.capabilities).toContain("highlight");
      expect(skill.metadata.capabilities).toContain("notify");
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input with snapshotId only", () => {
      const input = { snapshotId: 1 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate correct input with compareWithSnapshotId", () => {
      const input = { snapshotId: 1, compareWithSnapshotId: 2 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate correct input with versionNumber", () => {
      const input = { snapshotId: 1, versionNumber: 3 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject missing snapshotId", () => {
      const input = { compareWithSnapshotId: 2 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("outputSchema", () => {
    it("should validate correct output", () => {
      const output = {
        hasChanges: true,
        changeType: "major",
        summary: "内容有较大更新",
        similarityScore: 0.85,
        stats: {
          addedLines: 10,
          removedLines: 5,
        },
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should validate all change types", () => {
      const changeTypes = ["major", "minor", "none"];

      for (const changeType of changeTypes) {
        const output = {
          hasChanges: changeType !== "none",
          changeType,
          summary: "Test",
          similarityScore: 0.9,
          stats: { addedLines: 0, removedLines: 0 },
        };
        const result = skill.outputSchema.safeParse(output);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("execute", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should execute successfully", async () => {
      const input = { snapshotId: 1 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.hasChanges).toBe(true);
      expect(result.data.changeType).toBe("major");
      expect(result.data.similarityScore).toBe(0.85);
    });

    it("should call tool with correct parameters", async () => {
      const input = { snapshotId: 1, compareWithSnapshotId: 2 };
      await skill.execute(input, mockContext);

      expect(mockExecute).toHaveBeenCalledWith(
        {
          snapshotId: 1,
          compareWithSnapshotId: 2,
          versionNumber: undefined,
        },
        { userId: "test-user-id" },
      );
    });

    it("should return minor change type for small changes", async () => {
      mockExecute.mockResolvedValue({
        success: true,
        data: {
          hasSignificantChanges: false,
          summary: "页面有小幅更新",
          stats: {
            addedLines: 2,
            removedLines: 1,
            totalChanges: 3,
            similarityScore: 0.95,
          },
        },
      } as never);

      const input = { snapshotId: 1 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.changeType).toBe("minor");
    });

    it("should return none change type for no changes", async () => {
      mockExecute.mockResolvedValue({
        success: true,
        data: {
          hasSignificantChanges: false,
          summary: "页面无变化",
          stats: {
            addedLines: 0,
            removedLines: 0,
            totalChanges: 0,
            similarityScore: 1.0,
          },
        },
      } as never);

      const input = { snapshotId: 1 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.changeType).toBe("none");
    });

    it("should handle tool errors", async () => {
      mockExecute.mockResolvedValue({
        success: false,
        error: "快照不存在",
      } as never);

      const input = { snapshotId: 999 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("快照不存在");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(snapshotCompareSkill).toBeInstanceOf(SnapshotCompareSkill);
      expect(snapshotCompareSkill.metadata.id).toBe("snapshot_compare");
    });
  });
});
