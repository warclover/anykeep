/**
 * TTS Skill Agent 集成测试
 *
 * 验证 Agent 正确调用 TTS Skill 的完整流程：
 * - 意图分类 → 路由选择 → Skill 执行
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { IntentClassifier } from "../../../router/intent-classifier";
import { ModeSelector } from "../../../router/mode-selector";
import { SKILL_MAPPINGS } from "../../../config/skill-mappings";
import { ttsSynthesisSkill } from "../tts-synthesis.skill";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("TTS Skill Agent Integration", () => {
  describe("Intent Classification", () => {
    let classifier: IntentClassifier;

    beforeEach(() => {
      classifier = new IntentClassifier();
    });

    it("should classify '朗读书签' as TTS intent", async () => {
      const result = await classifier.classify("朗读书签 123");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("tts");
    });

    it("should classify '语音播放' as TTS intent", async () => {
      const result = await classifier.classify("语音播放这篇文章");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("tts");
    });

    it("should classify '听一下摘要' as TTS intent", async () => {
      const result = await classifier.classify("听一下这个摘要");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("tts");
    });

    it("should classify 'TTS' command as TTS intent", async () => {
      const result = await classifier.classify("tts 123");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("tts");
    });

    it("should classify '念一下' as TTS intent", async () => {
      const result = await classifier.classify("念一下这篇文章");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("tts");
    });

    it("should classify '读给我听' as TTS intent", async () => {
      const result = await classifier.classify("把这个读给我听");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("tts");
    });
  });

  describe("Skill Mapping", () => {
    it("should have TTS skill mapping configured", () => {
      const ttsMapping = SKILL_MAPPINGS.find((m) => m.key === "create:tts");

      expect(ttsMapping).toBeDefined();
      expect(ttsMapping?.skillId).toBe("tts_synthesis");
      expect(ttsMapping?.mode).toBe("orchestration");
      expect(ttsMapping?.enabled).toBe(true);
    });
  });

  describe("Mode Selection", () => {
    let modeSelector: ModeSelector;

    beforeEach(() => {
      modeSelector = new ModeSelector();
    });

    it("should select orchestration mode for TTS intent with medium complexity", () => {
      const intent = {
        type: "create" as const,
        subType: "tts",
        complexity: "medium" as const,
        confidence: 0.9,
        entities: [],
        hasDeliverableExpectation: true,
        requiresMultiStep: false,
        source: "rule" as const,
      };

      const complexity = {
        level: "medium" as const,
        score: 50,
        factors: [],
        estimatedSteps: 3,
        estimatedDurationMs: 5000,
      };

      const result = modeSelector.select(intent, complexity);
      const skillId = modeSelector.getSuggestedSkill(intent, complexity);

      expect(result.mode).toBe("orchestration");
      expect(skillId).toBe("tts_synthesis");
    });

    it("should fallback to atomic mode for simple complexity", () => {
      const intent = {
        type: "create" as const,
        subType: "tts",
        complexity: "simple" as const,
        confidence: 0.9,
        entities: [],
        hasDeliverableExpectation: true,
        requiresMultiStep: false,
        source: "rule" as const,
      };

      const complexity = {
        level: "simple" as const,
        score: 20,
        factors: [],
        estimatedSteps: 1,
        estimatedDurationMs: 1000,
      };

      const result = modeSelector.select(intent, complexity);

      // Simple complexity defaults to atomic mode for faster response
      expect(result.mode).toBe("atomic");
    });
  });

  describe("Skill Metadata", () => {
    it("should have correct metadata", () => {
      expect(ttsSynthesisSkill.metadata.id).toBe("tts_synthesis");
      expect(ttsSynthesisSkill.metadata.name).toBe("语音朗读助手");
      expect(ttsSynthesisSkill.metadata.category).toBe("understanding");
      expect(ttsSynthesisSkill.metadata.deliverableTypes).toContain("audio");
    });

    it("should have correct steps defined", () => {
      expect(ttsSynthesisSkill.metadata.steps).toHaveLength(5);
      expect(ttsSynthesisSkill.metadata.steps![0].id).toBe("parse");
      expect(ttsSynthesisSkill.metadata.steps![1].id).toBe("fetch");
      expect(ttsSynthesisSkill.metadata.steps![2].id).toBe("prepare");
      expect(ttsSynthesisSkill.metadata.steps![3].id).toBe("synthesize");
      expect(ttsSynthesisSkill.metadata.steps![4].id).toBe("deliver");
    });
  });

  describe("Input Parsing", () => {
    const mockContext = {
      userId: "test-user",
      conversationId: "test-conv",
      message: "",
      params: {},
    };

    it("should parse bookmark ID from message", async () => {
      const result = await ttsSynthesisSkill.parseInput(
        "朗读书签 456",
        mockContext as Parameters<typeof ttsSynthesisSkill.parseInput>[1],
      );

      expect(result.bookmarkId).toBe(456);
    });

    it("should parse content type from message", async () => {
      const result = await ttsSynthesisSkill.parseInput(
        "朗读书签 123 的要点",
        mockContext as Parameters<typeof ttsSynthesisSkill.parseInput>[1],
      );

      expect(result.contentType).toBe("keypoints");
    });

    it("should parse voice gender from message", async () => {
      const result = await ttsSynthesisSkill.parseInput(
        "用女声朗读书签 123",
        mockContext as Parameters<typeof ttsSynthesisSkill.parseInput>[1],
      );

      expect(result.voiceGender).toBe("female");
    });

    it("should parse speed from message", async () => {
      const result = await ttsSynthesisSkill.parseInput(
        "1.5倍速朗读书签 123",
        mockContext as Parameters<typeof ttsSynthesisSkill.parseInput>[1],
      );

      expect(result.speed).toBe(1.5);
    });
  });

  describe("Schema Validation", () => {
    it("should validate input schema", () => {
      const validInput = {
        bookmarkId: 123,
        contentType: "summary",
        speed: 1.0,
      };

      const result = ttsSynthesisSkill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid input", () => {
      const invalidInput = {
        bookmarkId: -1, // Invalid: must be positive
        contentType: "invalid",
      };

      const result = ttsSynthesisSkill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should validate output schema", () => {
      const validOutput = {
        audioBase64: "dGVzdA==",
        format: "mp3",
        durationSec: 10,
        charCount: 100,
        bookmarkTitle: "Test",
        contentType: "summary",
        requestId: "req-123",
      };

      const result = ttsSynthesisSkill.outputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });
});
