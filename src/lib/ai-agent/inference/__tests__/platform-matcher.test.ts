/**
 * 平台信号匹配器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  PlatformMatcher,
  platformMatcher,
  PLATFORM_PERSONA_RULES,
} from "../platform-matcher";

describe("PlatformMatcher", () => {
  describe("match", () => {
    it("should match arxiv.org to phd and researcher personas", () => {
      const signals = platformMatcher.match({ "arxiv.org": 20 }, 20);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].type).toBe("platform");
      expect(signals[0].source).toBe("arxiv.org");
      expect(signals[0].personas).toContain("phd");
    });

    it("should match 36kr.com to pm persona", () => {
      const signals = platformMatcher.match({ "36kr.com": 30 }, 30);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].personas).toContain("pm");
    });

    it("should match github.com to developer personas", () => {
      const signals = platformMatcher.match({ "github.com": 50 }, 50);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].personas).toContain("indie_dev");
    });

    it("should return empty array for unknown platforms", () => {
      const signals = platformMatcher.match({ "unknown-domain.xyz": 10 }, 10);

      expect(signals).toHaveLength(0);
    });

    it("should handle multiple platforms", () => {
      const signals = platformMatcher.match(
        {
          "arxiv.org": 15,
          "github.com": 25,
          "36kr.com": 10,
        },
        50,
      );

      expect(signals.length).toBe(3);
    });

    it("should weight signals by bookmark count", () => {
      const signals = platformMatcher.match({ "arxiv.org": 100 }, 100);

      expect(signals[0].count).toBe(100);
      expect(signals[0].weight).toBe(1); // 100/100 = 1
    });

    it("should match mbalib.com to consultant persona", () => {
      const signals = platformMatcher.match({ "mbalib.com": 20 }, 20);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].personas).toContain("consultant");
    });

    it("should match cnki.net to teacher persona", () => {
      const signals = platformMatcher.match({ "cnki.net": 25 }, 25);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].personas).toContain("teacher");
    });

    it("should return empty for zero totalBookmarks", () => {
      const signals = platformMatcher.match({ "github.com": 0 }, 0);

      expect(signals).toHaveLength(0);
    });

    it("should calculate correct weight ratio", () => {
      const signals = platformMatcher.match({ "github.com": 25 }, 100);

      expect(signals[0].weight).toBe(0.25); // 25/100 = 0.25
    });
  });

  describe("PLATFORM_PERSONA_RULES", () => {
    it("should have rules for arxiv.org", () => {
      expect(PLATFORM_PERSONA_RULES["arxiv.org"]).toBeDefined();
      expect(PLATFORM_PERSONA_RULES["arxiv.org"].length).toBeGreaterThan(0);
    });

    it("should have rules for common platforms", () => {
      const commonPlatforms = [
        "github.com",
        "zhihu.com",
        "bilibili.com",
        "mp.weixin.qq.com",
      ];

      for (const platform of commonPlatforms) {
        expect(PLATFORM_PERSONA_RULES[platform]).toBeDefined();
      }
    });

    it("should have valid weight values (0-1)", () => {
      for (const [, rules] of Object.entries(PLATFORM_PERSONA_RULES)) {
        for (const rule of rules) {
          expect(rule.weight).toBeGreaterThan(0);
          expect(rule.weight).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe("createPlatformMatcher", () => {
    it("should create a new instance", () => {
      const matcher = new PlatformMatcher();
      expect(matcher).toBeInstanceOf(PlatformMatcher);
    });
  });

  describe("isKnownPlatform", () => {
    it("should return true for known platforms", () => {
      expect(platformMatcher.isKnownPlatform("github.com")).toBe(true);
      expect(platformMatcher.isKnownPlatform("arxiv.org")).toBe(true);
    });

    it("should return false for unknown platforms", () => {
      expect(platformMatcher.isKnownPlatform("unknown.xyz")).toBe(false);
    });
  });

  describe("getKnownPlatforms", () => {
    it("should return array of platforms", () => {
      const platforms = platformMatcher.getKnownPlatforms();
      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms.length).toBeGreaterThan(20);
    });
  });
});
