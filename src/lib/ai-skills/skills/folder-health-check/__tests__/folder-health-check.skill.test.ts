/**
 * FolderHealthCheckSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import {
  FolderHealthCheckSkill,
  folderHealthCheckSkill,
} from "../folder-health-check.skill";
import type { OrchestrationContext } from "../../../orchestration/types";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    }),
  ),
}));

// Mock FolderHealthService
const mockCheckHealth = jest.fn();

jest.mock("@/lib/folder/health/folder-health.service", () => ({
  FolderHealthService: jest.fn().mockImplementation(() => ({
    checkHealth: mockCheckHealth,
  })),
}));

// Mock repositories
jest.mock("@/lib/folder/profile", () => ({
  FolderProfileRepository: jest.fn(),
  SuggestionRepository: jest.fn(),
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

describe("FolderHealthCheckSkill", () => {
  let skill: FolderHealthCheckSkill;

  beforeEach(() => {
    skill = new FolderHealthCheckSkill();
    jest.clearAllMocks();

    // 默认 mock 返回值
    mockCheckHealth.mockResolvedValue({
      status: "healthy",
      totalFolders: 10,
      healthyFolders: 8,
      foldersNeedingAttention: 2,
      mergeSuggestions: [],
      splitSuggestions: [],
    });
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("folder_health_check");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("文件夹健康检查");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("organizing");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toContain("diagnose");
      expect(skill.metadata.capabilities).toContain("suggest");
      expect(skill.metadata.capabilities).toContain("action");
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(3);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "scan",
        "diagnose",
        "suggest",
      ]);
    });
  });

  describe("inputSchema", () => {
    it("should validate empty input", () => {
      const input = {};
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("outputSchema", () => {
    it("should validate correct output", () => {
      const output = {
        status: "healthy",
        totalFolders: 10,
        healthyFolders: 8,
        mergeSuggestionsCount: 1,
        splitSuggestionsCount: 1,
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should validate all status types", () => {
      const statuses = ["healthy", "needs_attention", "critical"];

      for (const status of statuses) {
        const output = {
          status,
          totalFolders: 10,
          healthyFolders: 8,
          mergeSuggestionsCount: 0,
          splitSuggestionsCount: 0,
        };
        const result = skill.outputSchema.safeParse(output);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse empty message", async () => {
      const result = await skill.parseInput("检查文件夹", mockContext);
      expect(result).toEqual({});
    });
  });

  describe("executeStream", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user-id",
      conversationId: "test-conv",
      params: {},
    };

    it("should yield progress chunks", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      // 应该有进度报告
      const progressChunks = chunks.filter((c: any) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);
    });

    it("should yield deliverable chunk", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      // 应该有交付物
      const deliverableChunks = chunks.filter(
        (c: any) => c.type === "deliverable",
      );
      expect(deliverableChunks.length).toBeGreaterThan(0);
    });

    it("should yield text chunk with summary", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      // 应该有文本摘要
      const textChunks = chunks.filter((c: any) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);

      const textContent = (textChunks[0] as any).data.text;
      expect(textContent).toContain("文件夹健康状态");
    });

    it("should yield done chunk", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      // 应该以 done 结束
      const lastChunk = chunks[chunks.length - 1] as any;
      expect(lastChunk.type).toBe("done");
    });

    it("should handle needs_attention status", async () => {
      mockCheckHealth.mockResolvedValue({
        status: "needs_attention",
        totalFolders: 10,
        healthyFolders: 5,
        foldersNeedingAttention: 5,
        mergeSuggestions: [
          { sourceId: 1, targetId: 2, reason: "相似", similarity: 0.9 },
        ],
        splitSuggestions: [],
      });

      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c: any) => c.type === "text");
      const textContent = (textChunks[0] as any).data.text;
      expect(textContent).toContain("⚠️");
    });

    it("should handle critical status", async () => {
      mockCheckHealth.mockResolvedValue({
        status: "critical",
        totalFolders: 10,
        healthyFolders: 2,
        foldersNeedingAttention: 8,
        mergeSuggestions: [],
        splitSuggestions: [],
      });

      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c: any) => c.type === "text");
      const textContent = (textChunks[0] as any).data.text;
      expect(textContent).toContain("🔴");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(folderHealthCheckSkill).toBeInstanceOf(FolderHealthCheckSkill);
      expect(folderHealthCheckSkill.metadata.id).toBe("folder_health_check");
    });
  });
});
