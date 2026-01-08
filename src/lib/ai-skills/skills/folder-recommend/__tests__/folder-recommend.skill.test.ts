/**
 * FolderRecommendSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import {
  FolderRecommendSkill,
  folderRecommendSkill,
} from "../folder-recommend.skill";
import type { SkillContext } from "../../../core/types";

// Mock FolderServiceAdapter
const mockAnalyzeAndRecommend = jest.fn();

jest.mock("../../../adapters/folder-service.adapter", () => ({
  getFolderServiceAdapter: jest.fn(() => ({
    analyzeAndRecommend: mockAnalyzeAndRecommend,
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

describe("FolderRecommendSkill", () => {
  let skill: FolderRecommendSkill;

  beforeEach(() => {
    skill = new FolderRecommendSkill();
    jest.clearAllMocks();

    // 默认 mock 返回值
    mockAnalyzeAndRecommend.mockResolvedValue({
      recommendations: [
        {
          folderId: 1,
          folderName: "技术文章",
          suggestNew: false,
          reason: "内容匹配度高",
          confidence: 85,
          matchingBookmarkCount: 5,
        },
      ],
      currentFolderCount: 5,
      unclassifiedCount: 10,
    });
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("folder_recommend");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("文件夹智能推荐");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("organizing");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toContain("analyze");
      expect(skill.metadata.capabilities).toContain("recommend");
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = { maxRecommendations: 5 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should use default maxRecommendations", () => {
      const input = {};
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxRecommendations).toBe(5);
      }
    });

    it("should reject maxRecommendations below 1", () => {
      const input = { maxRecommendations: 0 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject maxRecommendations above 10", () => {
      const input = { maxRecommendations: 15 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("outputSchema", () => {
    it("should validate correct output", () => {
      const output = {
        recommendations: [
          {
            name: "技术文章",
            isNew: false,
            folderId: 1,
            reason: "匹配度高",
            matchingBookmarkCount: 5,
            confidence: 85,
          },
        ],
        currentFolderCount: 10,
        unclassifiedCount: 5,
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("execute", () => {
    const mockContext: SkillContext = {
      userId: "test-user-id",
      traceId: "test-trace-id",
    };

    it("should execute successfully", async () => {
      const input = { maxRecommendations: 5 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.recommendations).toHaveLength(1);
      expect(result.data.recommendations[0].matchingBookmarkCount).toBe(5);
      expect(result.data.currentFolderCount).toBe(5);
      expect(result.data.unclassifiedCount).toBe(10);
    });

    it("should correctly pass matchingBookmarkCount from adapter", async () => {
      mockAnalyzeAndRecommend.mockResolvedValue({
        recommendations: [
          {
            folderId: 1,
            folderName: "技术文章",
            suggestNew: false,
            reason: "匹配度高",
            confidence: 90,
            matchingBookmarkCount: 12,
          },
          {
            folderId: null,
            folderName: "新建文件夹",
            suggestNew: true,
            reason: "建议新建",
            confidence: 75,
            matchingBookmarkCount: 3,
          },
        ],
        currentFolderCount: 5,
        unclassifiedCount: 15,
      });

      const input = { maxRecommendations: 5 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.recommendations).toHaveLength(2);
      expect(result.data.recommendations[0].matchingBookmarkCount).toBe(12);
      expect(result.data.recommendations[1].matchingBookmarkCount).toBe(3);
    });

    it("should call adapter with correct parameters", async () => {
      const input = { maxRecommendations: 3 };
      await skill.execute(input, mockContext);

      expect(mockAnalyzeAndRecommend).toHaveBeenCalledWith("test-user-id", 3);
    });

    it("should handle empty recommendations", async () => {
      mockAnalyzeAndRecommend.mockResolvedValue({
        recommendations: [],
        currentFolderCount: 5,
        unclassifiedCount: 0,
      });

      const input = { maxRecommendations: 5 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.recommendations).toHaveLength(0);
    });

    it("should handle adapter errors", async () => {
      mockAnalyzeAndRecommend.mockRejectedValue(new Error("Database error"));

      const input = { maxRecommendations: 5 };
      const result = await skill.execute(input, mockContext);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("Database error");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(folderRecommendSkill).toBeInstanceOf(FolderRecommendSkill);
      expect(folderRecommendSkill.metadata.id).toBe("folder_recommend");
    });
  });
});
