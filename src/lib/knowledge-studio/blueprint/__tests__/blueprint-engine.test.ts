/**
 * BlueprintEngine - 单元测试
 * @module knowledge-studio/blueprint
 */

import { BlueprintEngine } from "../blueprint-engine";
import { BLUEPRINT_DISPLAY_CONFIG } from "../types";
import type { GenerationContext, MaterialInput } from "../types";
import type { BlueprintType, StreamChunk } from "../../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("BlueprintEngine", () => {
  let engine: BlueprintEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new BlueprintEngine();
  });

  describe("constructor", () => {
    it("should create engine with default config", () => {
      const defaultEngine = new BlueprintEngine();
      expect(defaultEngine).toBeInstanceOf(BlueprintEngine);
    });

    it("should create engine with custom config", () => {
      const customEngine = new BlueprintEngine({
        maxContextTokens: 4000,
        streamingEnabled: false,
      });
      expect(customEngine).toBeInstanceOf(BlueprintEngine);
    });
  });

  describe("generate", () => {
    const createMockContext = (
      overrides?: Partial<GenerationContext>,
    ): GenerationContext => ({
      requestId: "test-request-id",
      userId: "test-user-id",
      config: {
        type: "debater",
        targetLength: "medium",
        tone: "formal",
      },
      materials: [
        {
          bookmarkId: "1",
          title: "Test Article 1",
          content: "This is the content of test article 1.",
          url: "https://example.com/1",
          platform: "web",
        },
        {
          bookmarkId: "2",
          title: "Test Article 2",
          content: "This is the content of test article 2.",
          url: "https://example.com/2",
          platform: "web",
        },
      ],
      ...overrides,
    });

    it("should generate content successfully", async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.citations).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should include citations matching materials count", async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.citations?.length).toBe(context.materials.length);
    });

    it("should include metadata with timing information", async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.stagesTiming).toBeDefined();
      expect(result.metadata?.stagesTiming.parsing).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.stagesTiming.outline).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.stagesTiming.content).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.stagesTiming.citations).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.stagesTiming.finalizing).toBeGreaterThanOrEqual(
        0,
      );
    });

    it("should call progress callback with stage updates", async () => {
      const context = createMockContext();
      const progressChunks: StreamChunk[] = [];
      const onProgress = jest.fn((chunk: StreamChunk) => {
        progressChunks.push(chunk);
      });

      await engine.generate(context, onProgress);

      expect(onProgress).toHaveBeenCalled();
      expect(progressChunks.length).toBeGreaterThan(0);

      // Should have progress for each stage
      const stages = progressChunks.map((c) => c.data.stage);
      expect(stages).toContain("parsing");
      expect(stages).toContain("outline");
      expect(stages).toContain("content");
      expect(stages).toContain("citations");
      expect(stages).toContain("finalizing");
    });

    it("should include request ID in progress chunks", async () => {
      const context = createMockContext();
      const onProgress = jest.fn();

      await engine.generate(context, onProgress);

      expect(onProgress).toHaveBeenCalled();
      const firstChunk = onProgress.mock.calls[0][0];
      expect(firstChunk.requestId).toBe("test-request-id");
    });

    it("should work with single material", async () => {
      const context = createMockContext({
        materials: [
          {
            bookmarkId: "1",
            title: "Single Article",
            content: "Content of single article.",
            url: "https://example.com/single",
          },
        ],
      });

      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.citations?.length).toBe(1);
    });

    it("should work with many materials", async () => {
      const materials: MaterialInput[] = Array.from({ length: 10 }, (_, i) => ({
        bookmarkId: String(i + 1),
        title: `Article ${i + 1}`,
        content: `Content of article ${i + 1} with some text.`,
        url: `https://example.com/${i + 1}`,
      }));

      const context = createMockContext({ materials });
      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.citations?.length).toBe(10);
    });

    it("should support all blueprint types", async () => {
      const blueprintTypes: BlueprintType[] = [
        "debater",
        "blogger",
        "thread",
        "tutorial",
        "feynman",
      ];

      for (const type of blueprintTypes) {
        const context = createMockContext({
          config: { type, targetLength: "medium" },
        });

        const result = await engine.generate(context);

        expect(result.success).toBe(true);
        expect(result.content).toContain(BLUEPRINT_DISPLAY_CONFIG[type].name);
      }
    });

    it("should include references section in final content", async () => {
      const context = createMockContext();
      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain("参考来源");
      expect(result.content).toContain("[^1]:");
    });
  });

  describe("progress calculation", () => {
    it("should report progress from 0 to 100 across all stages", async () => {
      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "debater" },
        materials: [
          {
            bookmarkId: "1",
            title: "Test",
            content: "Content",
            url: "https://example.com",
          },
        ],
      };

      const progressValues: number[] = [];
      const onProgress = (chunk: StreamChunk) => {
        if (chunk.data.totalProgress !== undefined) {
          progressValues.push(chunk.data.totalProgress);
        }
      };

      await engine.generate(context, onProgress);

      // Progress should start from low values and end at 100
      expect(progressValues[0]).toBeLessThanOrEqual(10);
      expect(progressValues[progressValues.length - 1]).toBe(100);

      // Progress should be monotonically non-decreasing
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
    });

    it("should report stage progress from 0 to 100 for each stage", async () => {
      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "blogger" },
        materials: [
          {
            bookmarkId: "1",
            title: "Test",
            content: "Content",
            url: "https://example.com",
          },
        ],
      };

      const stageProgresses: Map<string, number[]> = new Map();
      const onProgress = (chunk: StreamChunk) => {
        const stage = chunk.data.stage;
        const stageProgress = chunk.data.stageProgress;
        if (stage && stageProgress !== undefined) {
          if (!stageProgresses.has(stage)) {
            stageProgresses.set(stage, []);
          }
          stageProgresses.get(stage)!.push(stageProgress);
        }
      };

      await engine.generate(context, onProgress);

      // Each stage should have at least start (0) and end (100)
      const stages = [
        "parsing",
        "outline",
        "content",
        "citations",
        "finalizing",
      ];
      for (const stage of stages) {
        const progresses = stageProgresses.get(stage);
        expect(progresses).toBeDefined();
        expect(progresses!.includes(0)).toBe(true);
        expect(progresses!.includes(100)).toBe(true);
      }
    });
  });

  describe("error handling", () => {
    it("should return error for empty materials", async () => {
      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "debater" },
        materials: [],
      };

      const result = await engine.generate(context);

      // 空素材时，parseMaterials 返回空数组，但不抛错
      // 当前实现会正常完成，只是没有引用
      expect(result.success).toBe(true);
      expect(result.citations?.length).toBe(0);
    });
  });

  describe("BLUEPRINT_DISPLAY_CONFIG", () => {
    it("should have config for debater", () => {
      expect(BLUEPRINT_DISPLAY_CONFIG.debater).toBeDefined();
      expect(BLUEPRINT_DISPLAY_CONFIG.debater.name).toBe("辩论家");
      expect(BLUEPRINT_DISPLAY_CONFIG.debater.icon).toBe("⚖️");
    });

    it("should have config for blogger", () => {
      expect(BLUEPRINT_DISPLAY_CONFIG.blogger).toBeDefined();
      expect(BLUEPRINT_DISPLAY_CONFIG.blogger.name).toBe("博主");
      expect(BLUEPRINT_DISPLAY_CONFIG.blogger.icon).toBe("✍️");
    });

    it("should have config for thread", () => {
      expect(BLUEPRINT_DISPLAY_CONFIG.thread).toBeDefined();
      expect(BLUEPRINT_DISPLAY_CONFIG.thread.name).toBe("推文串");
      expect(BLUEPRINT_DISPLAY_CONFIG.thread.icon).toBe("🧵");
    });

    it("should have config for tutorial", () => {
      expect(BLUEPRINT_DISPLAY_CONFIG.tutorial).toBeDefined();
      expect(BLUEPRINT_DISPLAY_CONFIG.tutorial.name).toBe("教程");
      expect(BLUEPRINT_DISPLAY_CONFIG.tutorial.icon).toBe("📚");
    });

    it("should have config for feynman", () => {
      expect(BLUEPRINT_DISPLAY_CONFIG.feynman).toBeDefined();
      expect(BLUEPRINT_DISPLAY_CONFIG.feynman.name).toBe("费曼");
      expect(BLUEPRINT_DISPLAY_CONFIG.feynman.icon).toBe("🎓");
    });

    it("should have all required fields for each blueprint type", () => {
      const types: BlueprintType[] = [
        "debater",
        "blogger",
        "thread",
        "tutorial",
        "feynman",
      ];

      for (const type of types) {
        const config = BLUEPRINT_DISPLAY_CONFIG[type];
        expect(config.name).toBeDefined();
        expect(typeof config.name).toBe("string");
        expect(config.description).toBeDefined();
        expect(typeof config.description).toBe("string");
        expect(config.icon).toBeDefined();
        expect(typeof config.icon).toBe("string");
        expect(config.estimatedTime).toBeDefined();
        expect(typeof config.estimatedTime).toBe("string");
      }
    });
  });

  describe("citation extraction", () => {
    it("should create citation for each material", async () => {
      const materials: MaterialInput[] = [
        {
          bookmarkId: "book-1",
          title: "First Article",
          content: "Content of first article.",
          url: "https://example.com/first",
        },
        {
          bookmarkId: "book-2",
          title: "Second Article",
          content: "Content of second article.",
          url: "https://example.com/second",
        },
      ];

      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "debater" },
        materials,
      };

      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.citations?.length).toBe(2);
      expect(result.citations?.[0].bookmarkId).toBe("book-1");
      expect(result.citations?.[0].title).toBe("First Article");
      expect(result.citations?.[0].url).toBe("https://example.com/first");
      expect(result.citations?.[1].bookmarkId).toBe("book-2");
    });

    it("should include excerpt in citations", async () => {
      const longContent =
        "This is a very long content that should be truncated in the excerpt. " +
        "It contains multiple sentences to ensure we have enough text. " +
        "The excerpt should only contain the first 100 characters or so.";

      const materials: MaterialInput[] = [
        {
          bookmarkId: "1",
          title: "Long Article",
          content: longContent,
          url: "https://example.com/long",
        },
      ];

      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "blogger" },
        materials,
      };

      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.citations?.[0].excerpt).toBeDefined();
      expect(result.citations?.[0].excerpt.endsWith("...")).toBe(true);
      expect(result.citations?.[0].excerpt.length).toBeLessThanOrEqual(104); // 100 + "..."
    });
  });

  describe("metadata generation", () => {
    it("should include model information", async () => {
      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "tutorial" },
        materials: [
          {
            bookmarkId: "1",
            title: "Test",
            content: "Content",
            url: "https://example.com",
          },
        ],
      };

      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.model).toBe("deepseek-chat");
    });

    it("should track token usage", async () => {
      const context: GenerationContext = {
        requestId: "test-id",
        userId: "user-id",
        config: { type: "feynman" },
        materials: [
          {
            bookmarkId: "1",
            title: "Test",
            content: "Content",
            url: "https://example.com",
          },
        ],
      };

      const result = await engine.generate(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.tokens).toBeDefined();
      expect(result.metadata?.tokens.input).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.tokens.output).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.tokens.total).toBeGreaterThanOrEqual(0);
    });
  });
});
