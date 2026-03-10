/**
 * 标签标准化器单元测试
 *
 * @module @/lib/classification/v5/classification-pipeline/__tests__/tag-normalizer.test
 */

import { tagNormalizer } from "../tag-normalizer";

describe("TagNormalizer", () => {
  describe("normalize", () => {
    it("should normalize Vue.js to vuejs", () => {
      expect(tagNormalizer.normalize("Vue.js")).toBe("vuejs");
      expect(tagNormalizer.normalize("VueJS")).toBe("vuejs");
      expect(tagNormalizer.normalize("vue.js")).toBe("vuejs");
    });

    it("should normalize Next.js to nextjs", () => {
      expect(tagNormalizer.normalize("Next.js")).toBe("nextjs");
      expect(tagNormalizer.normalize("NextJS")).toBe("nextjs");
      expect(tagNormalizer.normalize("next.js")).toBe("nextjs");
    });

    it("should normalize C++ to cpp", () => {
      expect(tagNormalizer.normalize("C++")).toBe("cpp");
      expect(tagNormalizer.normalize("c++")).toBe("cpp");
    });

    it("should normalize C# to csharp", () => {
      expect(tagNormalizer.normalize("C#")).toBe("csharp");
      expect(tagNormalizer.normalize("c#")).toBe("csharp");
    });

    it("should normalize Node.js to nodejs", () => {
      expect(tagNormalizer.normalize("Node.js")).toBe("nodejs");
      expect(tagNormalizer.normalize("NodeJS")).toBe("nodejs");
      expect(tagNormalizer.normalize("node.js")).toBe("nodejs");
    });

    it("should normalize React Native to reactnative", () => {
      expect(tagNormalizer.normalize("React Native")).toBe("reactnative");
      expect(tagNormalizer.normalize("react-native")).toBe("reactnative");
      expect(tagNormalizer.normalize("react_native")).toBe("reactnative");
    });

    it("should handle Chinese characters", () => {
      expect(tagNormalizer.normalize("前端开发")).toBe("前端开发");
      expect(tagNormalizer.normalize("独立开发与产品策略")).toBe(
        "独立开发与产品策略",
      );
    });

    it("should remove special characters", () => {
      expect(tagNormalizer.normalize("Hello World!")).toBe("helloworld");
      expect(tagNormalizer.normalize("test@example")).toBe("testexample");
    });

    it("should handle empty and invalid input", () => {
      expect(tagNormalizer.normalize("")).toBe("");
      expect(tagNormalizer.normalize("   ")).toBe("");
    });
  });

  describe("areEquivalent", () => {
    it("should return true for normalized equal tags", () => {
      expect(tagNormalizer.areEquivalent("Vue.js", "vuejs")).toBe(true);
      expect(tagNormalizer.areEquivalent("Next.js", "NextJS")).toBe(true);
    });

    it("should return true for synonyms", () => {
      expect(tagNormalizer.areEquivalent("javascript", "js")).toBe(true);
      expect(tagNormalizer.areEquivalent("typescript", "ts")).toBe(true);
      expect(tagNormalizer.areEquivalent("golang", "go")).toBe(true);
    });

    it("should return false for non-equivalent tags", () => {
      expect(tagNormalizer.areEquivalent("react", "vue")).toBe(false);
      expect(tagNormalizer.areEquivalent("java", "javascript")).toBe(false);
    });

    it("should handle empty input", () => {
      expect(tagNormalizer.areEquivalent("", "test")).toBe(false);
      expect(tagNormalizer.areEquivalent("test", "")).toBe(false);
    });
  });

  describe("getAllVariants", () => {
    it("should return all variants including synonyms", () => {
      const result = tagNormalizer.getAllVariants("javascript");
      expect(result.normalized).toBe("javascript");
      expect(result.variants).toContain("javascript");
      expect(result.variants).toContain("js");
    });

    it("should handle tags without synonyms", () => {
      const result = tagNormalizer.getAllVariants("custom-tag");
      expect(result.normalized).toBe("customtag");
      expect(result.variants).toContain("customtag");
    });
  });

  describe("normalizeAndDedupe", () => {
    it("should normalize and deduplicate tags", () => {
      const tags = ["Vue.js", "vuejs", "VueJS", "react"];
      const result = tagNormalizer.normalizeAndDedupe(tags);
      expect(result).toEqual(["vuejs", "react"]);
    });
  });

  describe("expandWithVariants", () => {
    it("should expand tags with all variants", () => {
      const tags = ["javascript"];
      const result = tagNormalizer.expandWithVariants(tags);
      expect(result).toContain("javascript");
      expect(result).toContain("js");
    });
  });

  describe("calculateSimilarity", () => {
    it("should return 1.0 for exact match", () => {
      expect(tagNormalizer.calculateSimilarity("react", "react")).toBe(1.0);
    });

    it("should return 0.95 for synonyms", () => {
      expect(tagNormalizer.calculateSimilarity("javascript", "js")).toBe(0.95);
    });

    it("should return ratio-based score for partial match", () => {
      // "react" (5 chars) includes in "reactnative" (11 chars)
      // ratio = 5/11 ≈ 0.45, score = 0.45 * 0.8 ≈ 0.36
      const score = tagNormalizer.calculateSimilarity("react", "reactnative");
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.5);
    });

    it("should return 0 for non-matching tags", () => {
      expect(tagNormalizer.calculateSimilarity("react", "angular")).toBe(0);
    });
  });
});
