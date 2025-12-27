/**
 * 链接健康检测 Skill 集成测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import { LinkHealthCheckSkill } from "../link-health-check.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";

// Mock dependencies
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: "test-check-id" },
      error: null,
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("LinkHealthCheckSkill", () => {
  let skill: LinkHealthCheckSkill;

  beforeEach(() => {
    skill = new LinkHealthCheckSkill();
    mockFetch.mockReset();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("link_health_check");
      expect(skill.metadata.name).toBe("链接健康检测");
      expect(skill.metadata.category).toBe("utility");
      expect(skill.metadata.steps).toHaveLength(5);
    });

    it("should have required capabilities", () => {
      expect(skill.metadata.capabilities).toContain("batch-check");
      expect(skill.metadata.capabilities).toContain("error-classification");
      expect(skill.metadata.capabilities).toContain("wayback-lookup");
      expect(skill.metadata.capabilities).toContain("fix-suggestions");
    });

    it("should have correct output formats", () => {
      expect(skill.metadata.outputFormats).toContain("markdown");
      expect(skill.metadata.outputFormats).toContain("json");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: {},
    };

    it("should parse scope from message", async () => {
      const input1 = await skill.parseInput("检查选中的链接", mockContext);
      expect(input1.scope).toBe("selected");

      const input2 = await skill.parseInput("检查文件夹内的链接", mockContext);
      expect(input2.scope).toBe("folder");

      const input3 = await skill.parseInput("检查所有链接", mockContext);
      expect(input3.scope).toBe("all");
    });

    it("should parse wayback option", async () => {
      const input1 = await skill.parseInput(
        "检查链接，不需要归档",
        mockContext,
      );
      expect(input1.includeWayback).toBe(false);

      const input2 = await skill.parseInput("检查链接", mockContext);
      expect(input2.includeWayback).toBe(true);
    });

    it("should parse timeout option", async () => {
      const input = await skill.parseInput("检查链接，20秒超时", mockContext);
      expect(input.timeout).toBe(20000);
    });

    it("should cap timeout at max value", async () => {
      const input = await skill.parseInput("检查链接，60秒超时", mockContext);
      expect(input.timeout).toBe(30000); // MAX_TIMEOUT_MS
    });

    it("should parse concurrency option", async () => {
      const input = await skill.parseInput("检查链接，并发 8", mockContext);
      expect(input.concurrency).toBe(8);
    });

    it("should cap concurrency at max value", async () => {
      const input = await skill.parseInput("检查链接，并发 100", mockContext);
      expect(input.concurrency).toBe(10); // MAX_CONCURRENCY
    });

    it("should return default values", async () => {
      const input = await skill.parseInput("检查链接健康", mockContext);
      expect(input.scope).toBe("all");
      expect(input.includeWayback).toBe(true);
      expect(input.timeout).toBe(10000);
      expect(input.concurrency).toBe(5);
    });
  });

  describe("executeStream", () => {
    const createMockContext = (
      _bookmarks: Array<{ id: number; url: string; title: string }> = [],
    ): OrchestrationContext => ({
      userId: "test-user",
      params: {
        scope: "all",
        includeWayback: true,
        timeout: 5000,
        concurrency: 2,
      },
    });

    beforeEach(() => {
      // Mock Supabase to return bookmarks
      const { createClient } = require("@/lib/supabase/server");
      createClient.mockResolvedValue({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "bookmarks") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [
                  { id: 1, url: "https://example.com", title: "Test 1" },
                  { id: 2, url: "https://notfound.com", title: "Test 2" },
                ],
                error: null,
              }),
            };
          }
          return {
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: "test-check-id" },
              error: null,
            }),
          };
        }),
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
    });

    it("should emit progress chunks", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const progressChunks = chunks.filter((c) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);
    });

    it("should emit text chunks", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);
    });

    it("should emit deliverable", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");
      expect(deliverableChunks.length).toBe(1);
      expect(deliverableChunks[0].data.type).toBe("report");
    });

    it("should emit done chunk", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const doneChunks = chunks.filter((c) => c.type === "done");
      expect(doneChunks.length).toBe(1);
      expect(doneChunks[0].data.success).toBe(true);
    });

    it("should handle empty bookmarks", async () => {
      const { createClient } = require("@/lib/supabase/server");
      createClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.some((c) => c.data.text.includes("没有找到"))).toBe(
        true,
      );
    });

    it("should emit confirmation for failed links", async () => {
      // Mock one healthy, one failed
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, redirected: false })
        .mockResolvedValueOnce({ ok: false, status: 404, redirected: false });

      // Mock Wayback
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          archived_snapshots: { closest: { available: false } },
        }),
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const confirmationChunks = chunks.filter(
        (c) => c.type === "confirmation",
      );
      expect(confirmationChunks.length).toBe(1);
      expect(confirmationChunks[0].data.title).toContain("失效链接");
    });

    it("should emit suggestions", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        redirected: false,
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const suggestionChunks = chunks.filter((c) => c.type === "suggestions");
      expect(suggestionChunks.length).toBe(1);
      expect(suggestionChunks[0].data.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle errors gracefully", async () => {
      const { createClient } = require("@/lib/supabase/server");
      createClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });

      const context = createMockContext();
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const errorChunks = chunks.filter((c) => c.type === "error");
      expect(errorChunks.length).toBe(1);

      const doneChunks = chunks.filter((c) => c.type === "done");
      expect(doneChunks[0].data.success).toBe(false);
    });

    it("should respect cancellation", async () => {
      mockFetch.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { ok: true, status: 200, redirected: false };
      });

      const context: OrchestrationContext = {
        userId: "test-user",
        params: {
          scope: "all",
          includeWayback: false,
          timeout: 5000,
          concurrency: 1,
        },
        cancellationToken: {
          isCancelled: true,
          onCancel: jest.fn(),
          throwIfCancelled: jest.fn(),
        },
      };

      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      const cancelledChunks = chunks.filter((c) => c.type === "cancelled");
      expect(cancelledChunks.length).toBe(1);
    });
  });

  describe("inputSchema validation", () => {
    it("should validate correct input", () => {
      const result = skill.inputSchema.safeParse({
        scope: "all",
        includeWayback: true,
        timeout: 10000,
        concurrency: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject folder scope without folderId", () => {
      const result = skill.inputSchema.safeParse({
        scope: "folder",
        includeWayback: true,
      });
      expect(result.success).toBe(false);
    });

    it("should reject selected scope without bookmarkIds", () => {
      const result = skill.inputSchema.safeParse({
        scope: "selected",
        includeWayback: true,
      });
      expect(result.success).toBe(false);
    });

    it("should accept folder scope with folderId", () => {
      const result = skill.inputSchema.safeParse({
        scope: "folder",
        folderId: 123,
        includeWayback: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept selected scope with bookmarkIds", () => {
      const result = skill.inputSchema.safeParse({
        scope: "selected",
        bookmarkIds: [1, 2, 3],
        includeWayback: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid timeout", () => {
      const result = skill.inputSchema.safeParse({
        scope: "all",
        timeout: 500, // Below minimum
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid concurrency", () => {
      const result = skill.inputSchema.safeParse({
        scope: "all",
        concurrency: 100, // Above maximum
      });
      expect(result.success).toBe(false);
    });
  });
});
