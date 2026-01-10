/**
 * IntentDisambiguator 单元测试
 *
 * 测试意图消歧器的核心功能：
 * - 消歧判定规则
 * - 消歧问题生成
 * - 上下文过滤
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { IntentDisambiguator } from "../intent-disambiguator";
import {
  createIntentDisambiguator,
  type IntentMatch,
} from "../intent-disambiguator";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================
// 测试辅助函数
// ============================================

function createMockMatch(overrides: Partial<IntentMatch> = {}): IntentMatch {
  return {
    type: "organize",
    subType: "cleanup",
    confidence: 0.7,
    alternatives: [],
    ...overrides,
  };
}

// ============================================
// 测试套件
// ============================================

describe("IntentDisambiguator", () => {
  let disambiguator: IntentDisambiguator;

  beforeEach(() => {
    disambiguator = createIntentDisambiguator();
  });

  describe("needsDisambiguation", () => {
    it("should return false for high confidence", () => {
      const match = createMockMatch({ confidence: 0.9 });
      expect(disambiguator.needsDisambiguation(match)).toBe(false);
    });

    it("should return false for low confidence without strong alternatives", () => {
      const match = createMockMatch({
        confidence: 0.6,
        alternatives: [{ type: "action", subType: "delete", confidence: 0.3 }],
      });
      expect(disambiguator.needsDisambiguation(match)).toBe(false);
    });

    it("should return true for medium confidence with strong alternative", () => {
      const match = createMockMatch({
        confidence: 0.65,
        alternatives: [{ type: "action", subType: "delete", confidence: 0.6 }],
      });
      expect(disambiguator.needsDisambiguation(match)).toBe(true);
    });

    it("should return false for very low confidence", () => {
      const match = createMockMatch({
        confidence: 0.4,
        alternatives: [{ type: "action", subType: "delete", confidence: 0.35 }],
      });
      expect(disambiguator.needsDisambiguation(match)).toBe(false);
    });

    it("should return false when no alternatives", () => {
      const match = createMockMatch({ confidence: 0.65, alternatives: [] });
      expect(disambiguator.needsDisambiguation(match)).toBe(false);
    });

    it("should return false when alternatives undefined", () => {
      const match = createMockMatch({
        confidence: 0.65,
        alternatives: undefined,
      });
      expect(disambiguator.needsDisambiguation(match)).toBe(false);
    });
  });

  describe("generateDisambiguationQuestion", () => {
    it("should generate question with primary intent option", () => {
      const match = createMockMatch({
        type: "organize",
        subType: "cleanup",
        confidence: 0.65,
      });

      const question = disambiguator.generateDisambiguationQuestion(match);

      expect(question.type).toBe("disambiguation");
      expect(question.question).toContain("不太确定");
      expect(question.options.length).toBeGreaterThan(0);
      expect(question.options[0].value).toBe("organize:cleanup");
    });

    it("should include alternatives in options", () => {
      const match = createMockMatch({
        type: "organize",
        subType: "cleanup",
        confidence: 0.65,
        alternatives: [
          { type: "action", subType: "delete", confidence: 0.6 },
          { type: "organize", subType: "dedupe", confidence: 0.55 },
        ],
      });

      const question = disambiguator.generateDisambiguationQuestion(match);

      expect(question.options.length).toBe(3);
      expect(question.options[1].value).toBe("action:delete");
      expect(question.options[2].value).toBe("organize:dedupe");
    });

    it("should limit alternatives to 2", () => {
      const match = createMockMatch({
        type: "organize",
        subType: "cleanup",
        confidence: 0.65,
        alternatives: [
          { type: "action", subType: "delete", confidence: 0.6 },
          { type: "organize", subType: "dedupe", confidence: 0.55 },
          { type: "action", subType: "move", confidence: 0.5 },
          { type: "action", subType: "tag", confidence: 0.45 },
        ],
      });

      const question = disambiguator.generateDisambiguationQuestion(match);

      // Primary + 2 alternatives = 3 max
      expect(question.options.length).toBe(3);
    });

    it("should exclude duplicate intents from alternatives", () => {
      const match = createMockMatch({
        type: "organize",
        subType: "cleanup",
        confidence: 0.65,
        alternatives: [
          { type: "organize", subType: "cleanup", confidence: 0.64 }, // Same as primary
          { type: "action", subType: "delete", confidence: 0.6 },
        ],
      });

      const question = disambiguator.generateDisambiguationQuestion(match);

      // Should not include duplicate
      const values = question.options.map((o) => o.value);
      const uniqueValues = [...new Set(values)];
      expect(values.length).toBe(uniqueValues.length);
    });

    it("should set allowCustomInput to true", () => {
      const match = createMockMatch();
      const question = disambiguator.generateDisambiguationQuestion(match);

      expect(question.allowCustomInput).toBe(true);
    });

    it("should set default timeout", () => {
      const match = createMockMatch();
      const question = disambiguator.generateDisambiguationQuestion(match);

      expect(question.timeout).toBe(30000);
    });
  });

  describe("filterByContext", () => {
    it("should filter out selection-required actions when no selection", () => {
      const alternatives = [
        { type: "action" as const, subType: "delete", confidence: 0.6 },
        { type: "action" as const, subType: "move", confidence: 0.55 },
        { type: "query" as const, subType: "search", confidence: 0.5 },
      ];

      const filtered = disambiguator.filterByContext(alternatives, {
        hasSelection: false,
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].subType).toBe("search");
    });

    it("should keep selection-required actions when has selection", () => {
      const alternatives = [
        { type: "action" as const, subType: "delete", confidence: 0.6 },
        { type: "action" as const, subType: "move", confidence: 0.55 },
        { type: "query" as const, subType: "search", confidence: 0.5 },
      ];

      const filtered = disambiguator.filterByContext(alternatives, {
        hasSelection: true,
      });

      expect(filtered.length).toBe(3);
    });

    it("should filter out refine actions when no recent search", () => {
      const alternatives = [
        { type: "refine" as const, subType: "filter", confidence: 0.6 },
        { type: "query" as const, subType: "search", confidence: 0.55 },
      ];

      const filtered = disambiguator.filterByContext(alternatives, {
        hasRecentSearch: false,
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe("query");
    });

    it("should keep refine actions when has recent search", () => {
      const alternatives = [
        { type: "refine" as const, subType: "filter", confidence: 0.6 },
        { type: "query" as const, subType: "search", confidence: 0.55 },
      ];

      const filtered = disambiguator.filterByContext(alternatives, {
        hasRecentSearch: true,
      });

      expect(filtered.length).toBe(2);
    });
  });

  describe("parseDisambiguationChoice", () => {
    it("should parse valid choice with subType", () => {
      const result = disambiguator.parseDisambiguationChoice("action:delete");

      expect(result).toEqual({ type: "action", subType: "delete" });
    });

    it("should parse choice with wildcard subType", () => {
      const result = disambiguator.parseDisambiguationChoice("organize:*");

      expect(result).toEqual({ type: "organize", subType: undefined });
    });

    it("should return null for invalid format", () => {
      const result = disambiguator.parseDisambiguationChoice("invalid");

      expect(result).toBeNull();
    });
  });

  describe("getIntentLabel", () => {
    it("should return correct label for known intents", () => {
      const label = disambiguator.getIntentLabel("action", "delete");
      expect(label).toBe("删除书签");
    });

    it("should return type default label for unknown subtype", () => {
      const label = disambiguator.getIntentLabel("action", "unknown");
      expect(label).toBe("操作");
    });

    it("should return type name for unknown type", () => {
      const label = disambiguator.getIntentLabel("unknown" as any);
      expect(label).toBe("unknown");
    });
  });

  describe("getIntentDescription", () => {
    it("should return description for known intents", () => {
      const description = disambiguator.getIntentDescription(
        "action",
        "delete",
      );
      expect(description).toContain("删除");
    });

    it("should return default description for unknown intents", () => {
      const description = disambiguator.getIntentDescription(
        "action",
        "unknown",
      );
      expect(description).toContain("操作");
    });
  });

  describe("inferFromInputPattern", () => {
    it("should infer delete intent from input", () => {
      const candidates = [
        { type: "organize" as const, subType: "cleanup", confidence: 0.6 },
        { type: "action" as const, subType: "delete", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "删除这个",
        candidates,
      );

      expect(result?.type).toBe("action");
      expect(result?.subType).toBe("delete");
    });

    it("should infer search intent from input", () => {
      const candidates = [
        { type: "organize" as const, subType: "cleanup", confidence: 0.6 },
        { type: "query" as const, subType: "search", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "找一下 React",
        candidates,
      );

      expect(result?.type).toBe("query");
      expect(result?.subType).toBe("search");
    });

    it("should infer organize intent from input", () => {
      const candidates = [
        { type: "action" as const, subType: "delete", confidence: 0.6 },
        { type: "organize" as const, subType: "cleanup", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "整理一下",
        candidates,
      );

      expect(result?.type).toBe("organize");
    });

    it("should infer export intent from input", () => {
      const candidates = [
        { type: "query" as const, subType: "list", confidence: 0.6 },
        { type: "create" as const, subType: "export", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "导出为 Markdown",
        candidates,
      );

      expect(result?.type).toBe("create");
      expect(result?.subType).toBe("export");
    });

    it("should infer count intent from input", () => {
      const candidates = [
        { type: "query" as const, subType: "list", confidence: 0.6 },
        { type: "query" as const, subType: "count", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "有多少收藏",
        candidates,
      );

      expect(result?.type).toBe("query");
      expect(result?.subType).toBe("count");
    });

    it("should return null when no pattern matches", () => {
      const candidates = [
        { type: "organize" as const, subType: "cleanup", confidence: 0.6 },
        { type: "action" as const, subType: "delete", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "随便说说",
        candidates,
      );

      expect(result).toBeNull();
    });

    it("should return null when matched type not in candidates", () => {
      const candidates = [
        { type: "organize" as const, subType: "cleanup", confidence: 0.6 },
        { type: "chitchat" as const, subType: "general", confidence: 0.55 },
      ];

      const result = disambiguator.inferFromInputPattern(
        "删除这个",
        candidates,
      );

      expect(result).toBeNull();
    });
  });

  describe("Configuration", () => {
    it("should respect custom confidence thresholds", () => {
      const customDisambiguator = createIntentDisambiguator({
        minConfidenceForDisambiguation: 0.4,
        maxConfidenceForDisambiguation: 0.8,
        alternativeConfidenceGap: 0.05,
      });

      // Should trigger disambiguation at 0.45 with close alternative
      const match = createMockMatch({
        confidence: 0.45,
        alternatives: [{ type: "action", subType: "delete", confidence: 0.42 }],
      });

      expect(customDisambiguator.needsDisambiguation(match)).toBe(true);
    });

    it("should respect custom timeout", () => {
      const customDisambiguator = createIntentDisambiguator({
        timeout: 60000,
      });

      const match = createMockMatch();
      const question =
        customDisambiguator.generateDisambiguationQuestion(match);

      expect(question.timeout).toBe(60000);
    });
  });
});
