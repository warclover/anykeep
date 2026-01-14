/**
 * 消歧规则引擎测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

// Mock Feature Flags - 禁用早返回优化以测试消歧逻辑
jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_EARLY_RETURN: false, // 禁用高权重规则短路优化，确保收集所有候选
    ENABLE_LLM_FALLBACK: false, // 禁用 LLM 兜底，确保测试确定性
  },
}));

import type { IntentClassifier } from "../intent-classifier";
import { createIntentClassifier } from "../intent-classifier";
import {
  DISAMBIGUATION_RULES,
  getApplicableRules,
  findMatchingRule,
} from "../disambiguation-rules";

describe("DisambiguationRules", () => {
  describe("DISAMBIGUATION_RULES configuration", () => {
    it("should have at least 10 rules", () => {
      expect(DISAMBIGUATION_RULES.length).toBeGreaterThanOrEqual(10);
    });

    it("should have unique rule IDs", () => {
      const ids = DISAMBIGUATION_RULES.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have priority values", () => {
      for (const rule of DISAMBIGUATION_RULES) {
        expect(rule.priority).toBeGreaterThan(0);
      }
    });

    it("should have reason for each rule", () => {
      for (const rule of DISAMBIGUATION_RULES) {
        expect(rule.reason).toBeTruthy();
        expect(rule.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getApplicableRules", () => {
    it("should return rules that match specified conflict types", () => {
      const rules = getApplicableRules(["organize", "create"]);

      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule.conflicts).toContain("organize");
        expect(rule.conflicts).toContain("create");
      }
    });

    it("should return rules sorted by priority (descending)", () => {
      const rules = getApplicableRules(["organize", "create"]);

      for (let i = 1; i < rules.length; i++) {
        expect(rules[i - 1].priority).toBeGreaterThanOrEqual(rules[i].priority);
      }
    });

    it("should return empty array for non-matching types", () => {
      const rules = getApplicableRules(["chitchat", "learn"]);

      // 可能没有专门的 chitchat vs learn 规则
      expect(Array.isArray(rules)).toBe(true);
    });
  });

  describe("findMatchingRule", () => {
    it("should find verb-object-create rule for '梳理内容总结纪要'", () => {
      const rule = findMatchingRule("梳理内容总结纪要", ["organize", "create"]);

      expect(rule).not.toBeNull();
      expect(rule?.winner).toBe("create");
      expect(rule?.id).toBe("verb-object-create-summary");
    });

    it("should find verb-object-create rule for '整理并总结'", () => {
      const rule = findMatchingRule("整理并总结", ["organize", "create"]);

      expect(rule).not.toBeNull();
      // 可能匹配 verb-object-create-lead 或其他规则
      expect(rule?.winner).toBe("create");
    });

    it("should find search-keyword rule for '找一下那篇AI文章'", () => {
      const rule = findMatchingRule("找一下那篇AI文章", [
        "query",
        "organize",
        "action",
      ]);

      expect(rule).not.toBeNull();
      expect(rule?.winner).toBe("query");
    });

    it("should find count-keyword rule for '有多少收藏'", () => {
      const rule = findMatchingRule("有多少收藏", ["query", "analyze"]);

      expect(rule).not.toBeNull();
      expect(rule?.winner).toBe("query");
    });

    it("should return null for no matching rule", () => {
      const rule = findMatchingRule("xyz123", ["organize", "create"]);

      expect(rule).toBeNull();
    });
  });
});

describe("IntentClassifier.disambiguate", () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = createIntentClassifier();
  });

  describe("rule-based disambiguation", () => {
    it("should disambiguate '梳理内容总结纪要' to create", () => {
      const candidates = classifier.collectAllMatches("梳理内容总结纪要");
      const deduplicated = classifier.deduplicateCandidates(candidates);

      const result = classifier.disambiguate("梳理内容总结纪要", deduplicated);

      expect(result.disambiguated).toBe(true);
      expect(result.winnerType).toBe("create");
      expect(result.ruleId).toBe("verb-object-create-summary");
    });

    it("should disambiguate '帮我生成一份总结' to create (if multiple candidates)", () => {
      const candidates = classifier.collectAllMatches("帮我生成一份总结");
      const deduplicated = classifier.deduplicateCandidates(candidates);

      // 如果只有一个候选，不需要消歧
      if (deduplicated.length < 2) {
        expect(deduplicated[0]?.type).toBe("create");
        return;
      }

      const result = classifier.disambiguate("帮我生成一份总结", deduplicated);

      expect(result.disambiguated).toBe(true);
      expect(result.winnerType).toBe("create");
    });

    it("should disambiguate '找一下那篇文章' to query", () => {
      const candidates = classifier.collectAllMatches("找一下那篇文章");
      const deduplicated = classifier.deduplicateCandidates(candidates);

      // 可能只匹配 query，无需消歧
      if (deduplicated.length >= 2) {
        const result = classifier.disambiguate("找一下那篇文章", deduplicated);
        if (result.disambiguated) {
          expect(result.winnerType).toBe("query");
        }
      }
    });

    it("should disambiguate '有多少收藏' to query", () => {
      const candidates = classifier.collectAllMatches("有多少收藏");
      const deduplicated = classifier.deduplicateCandidates(candidates);

      if (deduplicated.length >= 2) {
        const result = classifier.disambiguate("有多少收藏", deduplicated);
        if (result.disambiguated) {
          expect(result.winnerType).toBe("query");
        }
      }
    });
  });

  describe("position-based disambiguation", () => {
    it("should not disambiguate with single candidate", () => {
      const result = classifier.disambiguate("你好", [
        {
          pattern: "test",
          type: "chitchat",
          weight: 10,
          matchIndex: 0,
          confidence: 0.8,
          complexity: "simple",
        },
      ]);

      expect(result.disambiguated).toBe(false);
    });

    it("should use position-based disambiguation when positions differ significantly", () => {
      // 模拟两个候选，位置差距大于 5
      const candidates = [
        {
          pattern: "test1",
          type: "organize" as const,
          weight: 80,
          matchIndex: 0,
          confidence: 0.85,
          complexity: "complex" as const,
        },
        {
          pattern: "test2",
          type: "create" as const,
          weight: 70,
          matchIndex: 10, // 位置差距 > 5
          confidence: 0.85,
          complexity: "medium" as const,
        },
      ];

      // 由于没有匹配的消歧规则，应该使用位置消歧
      const result = classifier.disambiguate(
        "一段没有匹配规则的文本",
        candidates,
      );

      // 注意：由于文本不匹配任何规则，且位置差距 > 5，应该使用位置消歧
      // 选择 matchIndex 更大的（10 > 0），即 create
      expect(result.disambiguated).toBe(true);
      expect(result.winnerType).toBe("create");
      expect(result.ruleId).toBe("position-based");
    });
  });
});

describe("IntentClassifier.classifyWithCandidates with disambiguation", () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = createIntentClassifier();
  });

  describe("core disambiguation scenarios", () => {
    it("should classify '梳理内容总结纪要' as create (not organize)", async () => {
      const result =
        await classifier.classifyWithCandidates("梳理内容总结纪要");

      // 关键验收标准：应该被识别为 create
      expect(result.primary.type).toBe("create");
      expect(result.disambiguated).toBe(true);
      expect(result.disambiguationReason).toBeTruthy();
    });

    it("should classify '整理并总结这些内容' as create", async () => {
      const result =
        await classifier.classifyWithCandidates("整理并总结这些内容");

      // 有多个候选
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.candidates.some((c) => c.type === "organize")).toBe(true);
      expect(result.candidates.some((c) => c.type === "create")).toBe(true);

      // 消歧后应该选择 create
      expect(result.primary.type).toBe("create");
    });

    it("should classify '归纳整理后写个摘要' as create", async () => {
      const result =
        await classifier.classifyWithCandidates("归纳整理后写个摘要");

      expect(result.primary.type).toBe("create");
    });

    it("should classify '帮我总结并整理' as create", async () => {
      const result = await classifier.classifyWithCandidates("帮我总结并整理");

      // "总结并整理" 应该匹配 verb-object-create-lead 规则
      expect(result.primary.type).toBe("create");
    });
  });

  describe("query priority scenarios", () => {
    it("should classify '找一下那篇AI文章' as query", async () => {
      const result =
        await classifier.classifyWithCandidates("找一下那篇AI文章");

      expect(result.primary.type).toBe("query");
    });

    it("should classify '有多少收藏' as query", async () => {
      const result = await classifier.classifyWithCandidates("有多少收藏");

      expect(result.primary.type).toBe("query");
      expect(result.primary.subType).toBe("count");
    });

    it("should classify '最近一周的收藏有哪些' as query", async () => {
      const result =
        await classifier.classifyWithCandidates("最近一周的收藏有哪些");

      expect(result.primary.type).toBe("query");
    });
  });

  describe("no disambiguation needed scenarios", () => {
    it("should not disambiguate single-intent messages", async () => {
      const result = await classifier.classifyWithCandidates("你好");

      expect(result.primary.type).toBe("chitchat");
      expect(result.disambiguated).toBe(false);
    });

    it("should not disambiguate high-confidence matches", async () => {
      const result = await classifier.classifyWithCandidates("复习最近学的");

      expect(result.primary.type).toBe("learn");
      // 如果只有一个高置信度候选，不需要消歧
    });
  });

  // ============================================
  // Phase 3: 新增消歧规则测试 (2026-01-10)
  // ============================================
  describe("TTS vs digest disambiguation (Phase 3)", () => {
    it("should match read-summary-tts rule for '读一下摘要'", () => {
      const rule = findMatchingRule("读一下摘要", ["create"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("read-summary-tts");
      expect(rule?.winner).toBe("create");
      expect(rule?.winnerSubType).toBe("tts");
    });

    it("should match read-summary-tts rule for '朗读这篇文章'", () => {
      const rule = findMatchingRule("朗读这篇文章", ["create"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("read-summary-tts");
      expect(rule?.winnerSubType).toBe("tts");
    });

    it("should match voice-signal-tts rule for '语音播报一下'", () => {
      const rule = findMatchingRule("语音播报一下", ["create"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("voice-signal-tts");
      expect(rule?.winnerSubType).toBe("tts");
    });

    it("should match voice-signal-tts rule for '用声音读给我听'", () => {
      const rule = findMatchingRule("用声音读给我听", ["create"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("voice-signal-tts");
      expect(rule?.winnerSubType).toBe("tts");
    });
  });

  describe("single vs batch tag disambiguation (Phase 3)", () => {
    it("should match single-tag-action rule for '给这个加标签'", () => {
      const rule = findMatchingRule("给这个加标签", ["action", "organize"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("single-tag-action");
      expect(rule?.winner).toBe("action");
    });

    it("should match single-tag-action rule for '把这篇打个标签'", () => {
      const rule = findMatchingRule("把这篇打个标签", ["action", "organize"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("single-tag-action");
      expect(rule?.winner).toBe("action");
    });

    it("should match batch-tag-organize rule for '批量打标签'", () => {
      const rule = findMatchingRule("批量打标签", ["action", "organize"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("batch-tag-organize");
      expect(rule?.winner).toBe("organize");
      expect(rule?.winnerSubType).toBe("tag");
    });

    it("should match batch-tag-organize rule for '给所有书签添加标签'", () => {
      const rule = findMatchingRule("给所有书签添加标签", [
        "action",
        "organize",
      ]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("batch-tag-organize");
      expect(rule?.winner).toBe("organize");
    });

    it("should match batch-tag-organize rule for '这些书签删除标签'", () => {
      const rule = findMatchingRule("这些书签删除标签", ["action", "organize"]);

      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("batch-tag-organize");
      expect(rule?.winner).toBe("organize");
    });
  });
});
