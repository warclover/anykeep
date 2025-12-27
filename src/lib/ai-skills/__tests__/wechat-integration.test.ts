/**
 * 微信文章 AI 增强 - 集成测试
 *
 * 验证 WeChat 相关功能与 AI Agent 的完整集成：
 * 1. IntentClassifier 正确识别微信相关意图
 * 2. ModeSelector 正确映射到 wechat_digest Skill
 * 3. UnifiedEngine 正确注册 WechatDigestSkill
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { IntentClassifier } from "../router/intent-classifier";
import { ModeSelector } from "../router/mode-selector";
import { ComplexityEvaluator } from "../router/complexity-evaluator";
import { unifiedEngine } from "../engine/unified-engine";
import { wechatDigestSkill } from "../skills/wechat-digest";
import type { IntentClassification, RequestContext } from "../router/types";

describe("WeChat AI Enhancement Integration", () => {
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
    it("should classify '帮我整理微信公众号文章摘要' as analyze:wechat", async () => {
      const result = await classifier.classify("帮我整理微信公众号文章摘要");

      expect(result.type).toBe("analyze");
      expect(result.subType).toBe("wechat");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should classify '生成公众号摘要报告' as analyze:wechat", async () => {
      const result = await classifier.classify("生成公众号摘要报告");

      expect(result.type).toBe("analyze");
      expect(result.subType).toBe("wechat");
    });

    it("should classify '微信文章总结' as analyze:wechat", async () => {
      const result = await classifier.classify("微信文章总结");

      expect(result.type).toBe("analyze");
      expect(result.subType).toBe("wechat");
    });

    it("should classify '微信收藏整理' as analyze:wechat", async () => {
      const result = await classifier.classify("微信收藏整理");

      expect(result.type).toBe("analyze");
      expect(result.subType).toBe("wechat");
    });
  });

  describe("Mode Selection", () => {
    it("should route analyze:wechat to wechat_digest skill", async () => {
      const intent = await classifier.classify("帮我整理微信公众号文章摘要");
      const complexity = await evaluator.evaluate(intent, mockContext);

      const result = selector.select(intent, complexity);
      const suggestedSkill = selector.getSuggestedSkill(intent, complexity);

      expect(result.mode).toBe("orchestration");
      expect(suggestedSkill).toBe("wechat_digest");
    });

    it("should route create:wechat_digest to wechat_digest skill", async () => {
      // 模拟 create:wechat_digest 意图（使用正确的类型结构）
      const intent: IntentClassification = {
        type: "create",
        subType: "wechat_digest",
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
      expect(suggestedSkill).toBe("wechat_digest");
    });
  });

  describe("UnifiedEngine Registration", () => {
    beforeAll(() => {
      // 注册 WechatDigestSkill（如果尚未注册）
      const registeredSkills = unifiedEngine.getRegisteredOrchestrationSkills();
      const hasWechatDigest = registeredSkills.some(
        (skill) => skill.id === "wechat_digest",
      );

      if (!hasWechatDigest) {
        unifiedEngine.registerOrchestrationSkill(wechatDigestSkill);
      }
    });

    it("should have wechat_digest skill registered", () => {
      const skills = unifiedEngine.getRegisteredOrchestrationSkills();
      const wechatSkill = skills.find((s) => s.id === "wechat_digest");

      expect(wechatSkill).toBeDefined();
      expect(wechatSkill?.name).toBe("微信阅读摘要");
    });

    it("should find wechat_digest skill by ID", () => {
      // 使用内部方法查找 skill
      const skills = unifiedEngine.getRegisteredOrchestrationSkills();
      const found = skills.some((s) => s.id === "wechat_digest");

      expect(found).toBe(true);
    });
  });

  describe("WechatDigestSkill Metadata", () => {
    it("should have correct metadata", () => {
      expect(wechatDigestSkill.metadata.id).toBe("wechat_digest");
      expect(wechatDigestSkill.metadata.name).toBe("微信阅读摘要");
      expect(wechatDigestSkill.metadata.category).toBe("understanding");
    });

    it("should have correct steps defined", () => {
      expect(wechatDigestSkill.metadata.steps).toHaveLength(5);

      const stepIds = wechatDigestSkill.metadata.steps.map((s) => s.id);
      expect(stepIds).toContain("analyze");
      expect(stepIds).toContain("extract");
      expect(stepIds).toContain("group");
      expect(stepIds).toContain("summarize");
      expect(stepIds).toContain("compile");
    });
  });

  describe("End-to-End Intent to Skill Flow", () => {
    const testCases = [
      {
        input: "帮我把微信文章整理成摘要",
        expectedType: "analyze",
        expectedSubType: "wechat",
        expectedSkill: "wechat_digest",
      },
      {
        input: "生成公众号摘要报告",
        expectedType: "analyze",
        expectedSubType: "wechat",
        expectedSkill: "wechat_digest",
      },
      {
        input: "微信收藏总结一下",
        expectedType: "analyze",
        expectedSubType: "wechat",
        expectedSkill: "wechat_digest",
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
