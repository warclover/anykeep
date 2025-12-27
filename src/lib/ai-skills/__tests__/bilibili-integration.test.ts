/**
 * B站字幕提取 AI 增强 - 集成测试
 *
 * 验证 Bilibili 相关功能与 AI Agent 的完整集成：
 * 1. IntentClassifier 正确识别 B站字幕相关意图
 * 2. ModeSelector 正确映射到 bilibili_transcript Skill
 * 3. UnifiedEngine 正确注册 BilibiliTranscriptSkill
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { IntentClassifier } from "../router/intent-classifier";
import { ModeSelector } from "../router/mode-selector";
import { ComplexityEvaluator } from "../router/complexity-evaluator";
import { unifiedEngine } from "../engine/unified-engine";
import { bilibiliTranscriptSkill } from "../skills/bilibili-transcript";
import type { IntentClassification, RequestContext } from "../router/types";

describe("Bilibili Transcript AI Enhancement Integration", () => {
  const classifier = new IntentClassifier();
  const evaluator = new ComplexityEvaluator();
  const selector = new ModeSelector();

  // 测试用上下文
  const mockContext: RequestContext = {
    userId: "test-user-id",
    conversationId: "test-conv-id",
    totalBookmarks: 100,
    totalFolders: 5,
  };

  describe("Intent Classification", () => {
    it("should classify 'B站视频提取字幕' as create:bilibili_transcript", async () => {
      const result = await classifier.classify("B站视频提取字幕");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("bilibili_transcript");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should classify 'bilibili视频字幕' as create:bilibili_transcript", async () => {
      const result = await classifier.classify("bilibili视频字幕");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("bilibili_transcript");
    });

    it("should classify '提取B站字幕' as create:bilibili_transcript", async () => {
      const result = await classifier.classify("提取B站字幕");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("bilibili_transcript");
    });

    it("should classify '视频转文字稿' as create:bilibili_transcript", async () => {
      const result = await classifier.classify("视频转文字稿");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("bilibili_transcript");
    });

    it("should classify 'bilibili转文字' as create:bilibili_transcript", async () => {
      const result = await classifier.classify("bilibili转文字");

      expect(result.type).toBe("create");
      expect(result.subType).toBe("bilibili_transcript");
    });
  });

  describe("Mode Selection", () => {
    it("should route create:bilibili_transcript to bilibili_transcript skill", async () => {
      const intent = await classifier.classify("B站视频提取字幕");
      const complexity = await evaluator.evaluate(intent, mockContext);

      const result = selector.select(intent, complexity);
      const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

      expect(result.mode).toBe("orchestration");
      expect(suggestedSkill).toBe("bilibili_transcript");
    });

    it("should route with explicit intent structure", async () => {
      // 模拟 create:bilibili_transcript 意图（使用正确的类型结构）
      const intent: IntentClassification = {
        type: "create",
        subType: "bilibili_transcript",
        confidence: 0.9,
        entities: [],
        requiresMultiStep: true,
        hasDeliverableExpectation: true,
        source: "rule",
      };

      const complexity = await evaluator.evaluate(intent, mockContext);
      const result = selector.select(intent, complexity);
      const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

      expect(result.mode).toBe("orchestration");
      expect(suggestedSkill).toBe("bilibili_transcript");
    });
  });

  describe("UnifiedEngine Registration", () => {
    beforeAll(() => {
      // 注册 BilibiliTranscriptSkill（如果尚未注册）
      const registeredSkills = unifiedEngine.getRegisteredOrchestrationSkills();
      const hasBilibiliTranscript = registeredSkills.some(
        (skill) => skill.id === "bilibili_transcript",
      );

      if (!hasBilibiliTranscript) {
        unifiedEngine.registerOrchestrationSkill(bilibiliTranscriptSkill);
      }
    });

    it("should have bilibili_transcript skill registered", () => {
      const skills = unifiedEngine.getRegisteredOrchestrationSkills();
      const bilibiliSkill = skills.find((s) => s.id === "bilibili_transcript");

      expect(bilibiliSkill).toBeDefined();
      expect(bilibiliSkill?.name).toBe("B站字幕提取");
    });

    it("should find bilibili_transcript skill by ID", () => {
      // 使用内部方法查找 skill
      const skills = unifiedEngine.getRegisteredOrchestrationSkills();
      const found = skills.some((s) => s.id === "bilibili_transcript");

      expect(found).toBe(true);
    });
  });

  describe("BilibiliTranscriptSkill Metadata", () => {
    it("should have correct metadata", () => {
      expect(bilibiliTranscriptSkill.metadata.id).toBe("bilibili_transcript");
      expect(bilibiliTranscriptSkill.metadata.name).toBe("B站字幕提取");
      expect(bilibiliTranscriptSkill.metadata.category).toBe("understanding");
    });

    it("should have correct steps defined", () => {
      expect(bilibiliTranscriptSkill.metadata.steps).toHaveLength(6);

      const stepIds = bilibiliTranscriptSkill.metadata.steps.map((s) => s.id);
      expect(stepIds).toContain("parse");
      expect(stepIds).toContain("fetch_info");
      expect(stepIds).toContain("fetch_subtitle");
      expect(stepIds).toContain("download");
      expect(stepIds).toContain("format");
      expect(stepIds).toContain("save");
    });

    it("should have correct capabilities", () => {
      expect(bilibiliTranscriptSkill.metadata.capabilities).toContain(
        "bilibili-subtitle",
      );
      expect(bilibiliTranscriptSkill.metadata.capabilities).toContain(
        "video-transcript",
      );
      expect(bilibiliTranscriptSkill.metadata.capabilities).toContain(
        "multi-format-export",
      );
    });
  });

  describe("End-to-End Intent to Skill Flow", () => {
    const testCases = [
      {
        input: "帮我把B站视频字幕提取出来",
        expectedType: "create",
        expectedSubType: "bilibili_transcript",
        expectedSkill: "bilibili_transcript",
      },
      {
        input: "bilibili视频转文字",
        expectedType: "create",
        expectedSubType: "bilibili_transcript",
        expectedSkill: "bilibili_transcript",
      },
      {
        input: "提取视频字幕",
        expectedType: "create",
        expectedSubType: "bilibili_transcript",
        expectedSkill: "bilibili_transcript",
      },
    ];

    test.each(testCases)(
      'should route "$input" to $expectedSkill skill',
      async ({ input, expectedType, expectedSubType, expectedSkill }) => {
        const intent = await classifier.classify(input);
        const complexity = await evaluator.evaluate(intent, mockContext);
        const _mode = selector.select(intent, complexity);
        const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

        expect(intent.type).toBe(expectedType);
        expect(intent.subType).toBe(expectedSubType);
        expect(suggestedSkill).toBe(expectedSkill);
      },
    );
  });
});
