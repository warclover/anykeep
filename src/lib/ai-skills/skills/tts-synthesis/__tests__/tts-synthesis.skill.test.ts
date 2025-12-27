/**
 * TTS 语音朗读 Skill 测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { TTSSynthesisSkill } from "../tts-synthesis.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";

// Mock dependencies
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn(),
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

jest.mock("@/lib/tts", () => ({
  getTTSService: jest.fn().mockReturnValue({
    isAvailable: jest.fn().mockReturnValue({ available: true }),
    getDefaultVoice: jest.fn().mockReturnValue("longxiaochun"),
    synthesize: jest.fn().mockResolvedValue({
      audio: new ArrayBuffer(100),
      format: "mp3",
      durationSec: 5.5,
      charCount: 100,
      requestId: "test-request-id",
    }),
  }),
  TTSError: class TTSError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TTSError";
    }
  },
}));

describe("TTSSynthesisSkill", () => {
  let skill: TTSSynthesisSkill;

  beforeEach(() => {
    skill = new TTSSynthesisSkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("tts_synthesis");
      expect(skill.metadata.name).toBe("语音朗读助手");
      expect(skill.metadata.category).toBe("understanding");
      expect(skill.metadata.deliverableTypes).toContain("audio");
      expect(skill.metadata.outputFormats).toContain("audio");
      expect(skill.metadata.steps).toHaveLength(5);
    });

    it("should have all required step definitions", () => {
      const stepNames = skill.metadata.steps.map((s) => s.name);
      expect(stepNames).toContain("解析请求");
      expect(stepNames).toContain("获取摘要");
      expect(stepNames).toContain("准备文本");
      expect(stepNames).toContain("合成语音");
      expect(stepNames).toContain("输出音频");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse bookmark ID from message", async () => {
      const result = await skill.parseInput("朗读书签 123", mockContext);
      expect(result.bookmarkId).toBe(123);
    });

    it("should parse bookmark ID with colon format", async () => {
      const result = await skill.parseInput("朗读 ID:456", mockContext);
      expect(result.bookmarkId).toBe(456);
    });

    it("should default to summary content type", async () => {
      const result = await skill.parseInput("朗读书签 123", mockContext);
      expect(result.contentType).toBe("summary");
    });

    it("should parse tldr content type", async () => {
      const result = await skill.parseInput("一句话朗读书签 123", mockContext);
      expect(result.contentType).toBe("tldr");
    });

    it("should parse keypoints content type", async () => {
      const result = await skill.parseInput("朗读书签 123 的要点", mockContext);
      expect(result.contentType).toBe("keypoints");
    });

    it("should parse all content type", async () => {
      const result = await skill.parseInput("完整朗读书签 123", mockContext);
      expect(result.contentType).toBe("all");
    });

    it("should parse fast speed request", async () => {
      const result = await skill.parseInput("快点朗读书签 123", mockContext);
      expect(result.speed).toBe(1.3);
    });

    it("should parse slow speed request", async () => {
      const result = await skill.parseInput("慢点朗读书签 123", mockContext);
      expect(result.speed).toBe(0.8);
    });

    it("should parse custom speed", async () => {
      const result = await skill.parseInput(
        "1.5 倍速朗读书签 123",
        mockContext,
      );
      expect(result.speed).toBe(1.5);
    });

    it("should clamp speed to valid range", async () => {
      const result = await skill.parseInput("3 倍速朗读书签 123", mockContext);
      expect(result.speed).toBe(2.0);
    });

    it("should parse female voice gender", async () => {
      const result = await skill.parseInput("女声朗读书签 123", mockContext);
      expect(result.voiceGender).toBe("female");
    });

    it("should parse male voice gender", async () => {
      const result = await skill.parseInput("男声朗读书签 123", mockContext);
      expect(result.voiceGender).toBe("male");
    });
  });

  describe("executeStream", () => {
    const createMockContext = (
      bookmarkId: number,
      contentType = "summary",
    ): OrchestrationContext => ({
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        bookmarkId,
        contentType,
      },
    });

    async function collectChunks(
      generator: AsyncGenerator<OrchestrationStreamChunk>,
    ): Promise<OrchestrationStreamChunk[]> {
      const chunks: OrchestrationStreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
      return chunks;
    }

    it("should fail when bookmarkId is missing", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: { bookmarkId: 0 },
      };

      const chunks = await collectChunks(skill.executeStream(context));

      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect((doneChunk as { data: { success: boolean } }).data.success).toBe(
        false,
      );
    });

    it("should fail when bookmark not found", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      });

      const context = createMockContext(999);
      const chunks = await collectChunks(skill.executeStream(context));

      const textChunks = chunks.filter((c) => c.type === "text");
      const errorText = textChunks.find((c) =>
        (c.data as { text: string }).text.includes("书签不存在"),
      );
      expect(errorText).toBeDefined();
    });

    it("should fail when bookmark has no AI summary", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 123, title: "Test Bookmark", ai_summary: null },
          error: null,
        }),
      });

      const context = createMockContext(123);
      const chunks = await collectChunks(skill.executeStream(context));

      const textChunks = chunks.filter((c) => c.type === "text");
      const errorText = textChunks.find((c) =>
        (c.data as { text: string }).text.includes("暂无 AI 摘要"),
      );
      expect(errorText).toBeDefined();
    });

    it("should successfully synthesize audio when all conditions are met", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 123,
            title: "Test Bookmark",
            ai_summary: "This is a test summary for TTS synthesis.",
          },
          error: null,
        }),
      });

      const context = createMockContext(123);
      const chunks = await collectChunks(skill.executeStream(context));

      // Should have deliverable chunk
      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();
      expect((deliverableChunk as { data: { type: string } }).data.type).toBe(
        "audio",
      );

      // Should have done chunk with success
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect((doneChunk as { data: { success: boolean } }).data.success).toBe(
        true,
      );
    });

    it("should emit progress updates during execution", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 123,
            title: "Test Bookmark",
            ai_summary: "Test summary",
          },
          error: null,
        }),
      });

      const context = createMockContext(123);
      const chunks = await collectChunks(skill.executeStream(context));

      const progressChunks = chunks.filter((c) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);

      // Check that progress increases
      const percentages = progressChunks.map(
        (c) => (c.data as { percent: number }).percent,
      );
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }
    });
  });

  describe("prepareText", () => {
    // Access private method through any type for testing
    const prepareText = (
      skill: TTSSynthesisSkill,
      bookmark: { title: string; ai_summary: string | null },
      contentType: string,
    ) => {
      return (
        skill as unknown as { prepareText: typeof prepareText }
      ).prepareText(bookmark, contentType);
    };

    // Valid structured summary format requires both tldr and key_points
    const createStructuredSummary = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        tldr: "This is a TLDR summary",
        key_points: ["Point 1", "Point 2", "Point 3"],
        keywords: ["test", "keyword"],
        sentiment: "neutral",
        reading_time: 5,
        ...overrides,
      });

    it("should prepare TLDR text", () => {
      const bookmark = {
        title: "Test",
        ai_summary: createStructuredSummary({ tldr: "This is TLDR" }),
      };
      const text = prepareText(skill, bookmark, "tldr");
      expect(text).toContain("This is TLDR");
    });

    it("should prepare keypoints text with numbering", () => {
      const bookmark = {
        title: "Test",
        ai_summary: createStructuredSummary({
          key_points: ["Point 1", "Point 2", "Point 3"],
        }),
      };
      const text = prepareText(skill, bookmark, "keypoints");
      expect(text).toContain("第1点");
      expect(text).toContain("第2点");
      expect(text).toContain("第3点");
    });

    it("should prepare all content with title", () => {
      const bookmark = {
        title: "Test Title",
        ai_summary: createStructuredSummary({
          tldr: "TLDR content",
          key_points: ["Point 1"],
        }),
      };
      const text = prepareText(skill, bookmark, "all");
      expect(text).toContain("标题：Test Title");
    });

    it("should fall back to display summary for non-structured summary", () => {
      const bookmark = {
        title: "Test",
        ai_summary: "This is a plain text summary",
      };
      const text = prepareText(skill, bookmark, "summary");
      expect(text).toContain("This is a plain text summary");
    });

    it("should return empty string for null summary", () => {
      const bookmark = {
        title: "Test",
        ai_summary: null,
      };
      const text = prepareText(skill, bookmark, "summary");
      expect(text).toBe("");
    });
  });
});
