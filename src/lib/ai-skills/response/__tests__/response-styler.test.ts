/**
 * ResponseStyler 测试
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { ResponseStyler } from "../index";
import {
  createResponseStyler,
  BANNED_PHRASES,
  detectBannedPhrases,
  removeBannedPhrases,
  getResponseTemplate,
  renderTemplate,
  getFollowUpSuggestions,
} from "../index";

describe("style-config", () => {
  describe("BANNED_PHRASES", () => {
    it("should have at least 20 banned phrases", () => {
      expect(BANNED_PHRASES.length).toBeGreaterThanOrEqual(20);
    });

    it("should include common mechanical phrases", () => {
      expect(BANNED_PHRASES).toContain("根据您的请求");
      expect(BANNED_PHRASES).toContain("我将为您");
      expect(BANNED_PHRASES).toContain("作为AI助手");
    });
  });

  describe("detectBannedPhrases", () => {
    it("should detect banned phrases in text", () => {
      const text = "根据您的请求，我将为您查找相关内容";
      const detected = detectBannedPhrases(text);

      expect(detected).toContain("根据您的请求");
      expect(detected).toContain("我将为您");
    });

    it("should return empty array for clean text", () => {
      const text = "找到 5 篇相关内容";
      const detected = detectBannedPhrases(text);

      expect(detected).toEqual([]);
    });
  });

  describe("removeBannedPhrases", () => {
    it("should remove banned phrases from text", () => {
      const text = "根据您的请求，找到了以下内容";
      const cleaned = removeBannedPhrases(text);

      expect(cleaned).not.toContain("根据您的请求");
      expect(cleaned).toContain("找到了以下内容");
    });

    it("should clean up extra whitespace after removal", () => {
      const text = "好的，我  来帮您查找";
      const cleaned = removeBannedPhrases(text);

      expect(cleaned).not.toMatch(/\s{2,}/);
    });
  });

  describe("getResponseTemplate", () => {
    it("should return template for query:search", () => {
      const template = getResponseTemplate("query", "search");

      expect(template).not.toBeNull();
      expect(template?.intentType).toBe("query");
      expect(template?.subType).toBe("search");
    });

    it("should return null for unknown type", () => {
      const template = getResponseTemplate("unknown" as never);

      expect(template).toBeNull();
    });
  });

  describe("renderTemplate", () => {
    it("should replace variables in template", () => {
      const template = "找到 {count} 篇相关内容";
      const rendered = renderTemplate(template, { count: 5 });

      expect(rendered).toBe("找到 5 篇相关内容");
    });

    it("should replace multiple variables", () => {
      const template = "{period}收藏了 {count} 篇";
      const rendered = renderTemplate(template, { period: "本周", count: 12 });

      expect(rendered).toBe("本周收藏了 12 篇");
    });
  });

  describe("getFollowUpSuggestions", () => {
    it("should return suggestions for query:search", () => {
      const suggestions = getFollowUpSuggestions("query", "search");

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty("text");
      expect(suggestions[0]).toHaveProperty("action");
    });

    it("should return default suggestions for chitchat", () => {
      const suggestions = getFollowUpSuggestions("chitchat");

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("should return fallback suggestions for unknown type", () => {
      const suggestions = getFollowUpSuggestions("unknown" as never);

      // 应该返回默认的闲聊建议
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});

describe("ResponseStyler", () => {
  let styler: ResponseStyler;

  beforeEach(() => {
    styler = createResponseStyler();
  });

  describe("format", () => {
    it("should detect banned phrases in response", () => {
      const result = styler.format(
        "根据您的请求，我找到了 5 篇文章",
        "query",
        "search",
      );

      expect(result.detectedBannedPhrases).toContain("根据您的请求");
    });

    it("should remove banned phrases when autoRemove is enabled", () => {
      const result = styler.format(
        "根据您的请求，找到了相关内容",
        "query",
        "search",
      );

      expect(result.bannedPhrasesRemoved).toBe(true);
      expect(result.styledText).not.toContain("根据您的请求");
    });

    it("should apply template when variables provided", () => {
      const result = styler.format("原始文本", "query", "search", { count: 5 });

      expect(result.templateApplied).toBe(true);
      expect(result.styledText).toBe("找到 5 篇相关内容：");
    });

    it("should add follow-up suggestions", () => {
      const result = styler.format("找到内容", "query", "search");

      expect(result.followUpSuggestions.length).toBeGreaterThan(0);
    });

    it("should limit follow-up suggestions count", () => {
      const customStyler = createResponseStyler({
        maxFollowUpSuggestions: 2,
      });

      const result = customStyler.format("找到内容", "query", "search");

      expect(result.followUpSuggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe("quickFormat", () => {
    it("should remove banned phrases", () => {
      const result = styler.quickFormat("根据您的请求，这是结果");

      expect(result).not.toContain("根据您的请求");
    });

    it("should preserve clean text", () => {
      const result = styler.quickFormat("找到 5 篇文章");

      expect(result).toBe("找到 5 篇文章");
    });
  });

  describe("generateFromTemplate", () => {
    it("should generate response from template", () => {
      const result = styler.generateFromTemplate("query", "search", {
        count: 10,
      });

      expect(result).toBe("找到 10 篇相关内容：");
    });

    it("should return null when template not found", () => {
      const result = styler.generateFromTemplate("unknown" as never);

      expect(result).toBeNull();
    });

    it("should return null when variables incomplete", () => {
      // 使用需要多个变量的模板，只提供部分
      const result = styler.generateFromTemplate("analyze", "insight", {
        period: "本周",
        // 缺少 count, topTopic, topCount
      });

      expect(result).toBeNull();
    });
  });

  describe("getSuggestions", () => {
    it("should return suggestions for valid intent", () => {
      const suggestions = styler.getSuggestions("query", "search");

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("should respect maxFollowUpSuggestions config", () => {
      const customStyler = createResponseStyler({
        maxFollowUpSuggestions: 1,
      });

      const suggestions = customStyler.getSuggestions("query", "search");

      expect(suggestions.length).toBeLessThanOrEqual(1);
    });
  });

  describe("detectProblems", () => {
    it("should detect banned phrases", () => {
      const problems = styler.detectProblems("作为AI助手，我来帮您");

      expect(problems.length).toBeGreaterThan(0);
      expect(problems).toContain("作为AI助手");
    });

    it("should return empty for clean text", () => {
      const problems = styler.detectProblems("找到 5 篇文章");

      expect(problems).toEqual([]);
    });
  });

  describe("validate", () => {
    it("should validate clean response as valid", () => {
      const result = styler.validate("找到 5 篇相关文章");

      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("should detect banned phrases as issue", () => {
      const result = styler.validate("根据您的请求，找到了内容");

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should detect empty response as issue", () => {
      const result = styler.validate("   ");

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes("空"))).toBe(true);
    });

    it("should detect long response as issue", () => {
      const longText = "a".repeat(2500);
      const result = styler.validate(longText);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes("过长"))).toBe(true);
    });
  });

  describe("configuration", () => {
    it("should be able to update config", () => {
      styler.updateConfig({ maxFollowUpSuggestions: 5 });

      const config = styler.getConfig();
      expect(config.maxFollowUpSuggestions).toBe(5);
    });

    it("should disable banned phrase detection when configured", () => {
      const customStyler = createResponseStyler({
        enableBannedPhraseDetection: false,
      });

      const result = customStyler.format("根据您的请求", "query");

      expect(result.detectedBannedPhrases).toEqual([]);
    });

    it("should disable auto removal when configured", () => {
      const customStyler = createResponseStyler({
        enableBannedPhraseDetection: true,
        autoRemoveBannedPhrases: false,
      });

      const result = customStyler.format("根据您的请求，内容", "query");

      expect(result.detectedBannedPhrases.length).toBeGreaterThan(0);
      expect(result.bannedPhrasesRemoved).toBe(false);
      expect(result.styledText).toContain("根据您的请求");
    });

    it("should disable follow-up suggestions when configured", () => {
      const customStyler = createResponseStyler({
        enableFollowUpSuggestions: false,
      });

      const result = customStyler.format("内容", "query", "search");

      expect(result.followUpSuggestions).toEqual([]);
    });
  });

  describe("getBannedPhrases", () => {
    it("should return copy of banned phrases list", () => {
      const phrases = styler.getBannedPhrases();

      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases).toEqual(BANNED_PHRASES);
    });
  });
});

describe("Integration scenarios", () => {
  const styler = createResponseStyler();

  describe("search response styling", () => {
    it("should transform mechanical search response to natural", () => {
      const mechanical =
        "根据您的请求，我已经为您搜索了关于AI的内容，找到了以下5篇文章";
      const result = styler.format(mechanical, "query", "search", { count: 5 });

      expect(result.styledText).toBe("找到 5 篇相关内容：");
      expect(result.bannedPhrasesRemoved).toBe(true);
      expect(result.followUpSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe("count response styling", () => {
    it("should use template for count response", () => {
      const result = styler.format("统计结果", "query", "count", {
        count: 128,
      });

      expect(result.styledText).toBe("共 128 条收藏");
    });
  });

  describe("organize response styling", () => {
    it("should provide action suggestions for organize", () => {
      const result = styler.format("整理方案已生成", "organize", "cleanup");

      expect(
        result.followUpSuggestions.some((s) => s.text === "执行整理"),
      ).toBe(true);
    });
  });
});
