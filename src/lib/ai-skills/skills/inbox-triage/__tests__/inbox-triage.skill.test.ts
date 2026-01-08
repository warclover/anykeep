/**
 * InboxTriageSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { InboxTriageSkill, inboxTriageSkill } from "../inbox-triage.skill";
import type { OrchestrationContext } from "../../../orchestration/types";

// Mock Supabase
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
    }),
  ),
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

describe("InboxTriageSkill", () => {
  let skill: InboxTriageSkill;

  beforeEach(() => {
    skill = new InboxTriageSkill();
    jest.clearAllMocks();

    // 设置 Supabase 链式调用 mock
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockImplementation((field: string) => {
      if (field === "user_id") {
        return { is: mockIs };
      }
      return { data: [], error: null };
    });
    mockIs.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({
      data: [
        {
          id: 1,
          title: "React 入门",
          url: "https://example.com/1",
          platform: "juejin",
          user_tags: ["前端"],
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          title: "Vue 教程",
          url: "https://example.com/2",
          platform: "juejin",
          user_tags: ["前端"],
          created_at: new Date().toISOString(),
        },
        {
          id: 3,
          title: "Node.js 指南",
          url: "https://example.com/3",
          platform: "zhihu",
          user_tags: ["后端"],
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("inbox_triage");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("收件箱智能分拣");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("organizing");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toContain("analyze");
      expect(skill.metadata.capabilities).toContain("suggest");
      expect(skill.metadata.capabilities).toContain("batch-action");
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(4);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "scan",
        "cluster",
        "suggest",
        "prepare",
      ]);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = { autoExecute: false, maxItems: 50 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should use default values", () => {
      const input = {};
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.autoExecute).toBe(false);
        expect(result.data.maxItems).toBe(50);
      }
    });

    it("should reject maxItems below 1", () => {
      const input = { maxItems: 0 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject maxItems above 200", () => {
      const input = { maxItems: 300 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept excludeFolderIds", () => {
      const input = { excludeFolderIds: [1, 2, 3] };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("outputSchema", () => {
    it("should validate correct output", () => {
      const output = {
        totalScanned: 10,
        clustersFound: 3,
        suggestionsGenerated: 5,
        executedCount: 2,
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should accept optional executedCount", () => {
      const output = {
        totalScanned: 10,
        clustersFound: 3,
        suggestionsGenerated: 5,
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse default message", async () => {
      const result = await skill.parseInput("整理收件箱", mockContext);
      expect(result.autoExecute).toBe(false);
      expect(result.maxItems).toBe(50);
    });

    it("should detect auto execute request", async () => {
      const result = await skill.parseInput("自动整理收件箱", mockContext);
      expect(result.autoExecute).toBe(true);
    });

    it("should detect item count", async () => {
      const result = await skill.parseInput("整理最近100条收藏", mockContext);
      expect(result.maxItems).toBe(100);
    });
  });

  describe("executeStream", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user-id",
      conversationId: "test-conv",
      params: { autoExecute: false, maxItems: 50, excludeFolderIds: [] },
    };

    it("should yield progress chunks", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const progressChunks = chunks.filter((c: any) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);
    });

    it("should yield deliverable chunk with suggestions", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

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

      const textChunks = chunks.filter((c: any) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);
    });

    it("should yield done chunk", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1] as any;
      expect(lastChunk.type).toBe("done");
    });

    it("should handle empty inbox", async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c: any) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);
    });

    it("should call supabase methods", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      expect(mockFrom).toHaveBeenCalledWith("bookmarks");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(inboxTriageSkill).toBeInstanceOf(InboxTriageSkill);
      expect(inboxTriageSkill.metadata.id).toBe("inbox_triage");
    });
  });
});
