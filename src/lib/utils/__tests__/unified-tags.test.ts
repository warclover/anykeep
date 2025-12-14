/**
 * Unified Tags Utility Tests
 * 统一标签工具函数测试
 */

import {
  getMergedTags,
  getUnifiedTags,
  getPreferredTags,
  hasTags,
  hasUserTags,
  getTagCount,
  limitTags,
  formatTagsForDisplay,
} from "../unified-tags";

describe("unified-tags", () => {
  describe("getMergedTags", () => {
    it("should return empty array when no tags", () => {
      const result = getMergedTags({});
      expect(result).toEqual([]);
    });

    it("should return user_tags when only user_tags exist", () => {
      const result = getMergedTags({ user_tags: ["React", "前端"] });
      expect(result).toEqual(["React", "前端"]);
    });

    it("should return ai_tags when only ai_tags exist", () => {
      const result = getMergedTags({ ai_tags: ["JavaScript", "Web"] });
      expect(result).toEqual(["JavaScript", "Web"]);
    });

    it("should merge tags with user_tags priority (no duplicates)", () => {
      const result = getMergedTags({
        user_tags: ["React", "前端"],
        ai_tags: ["React", "JavaScript"], // React is duplicate
      });
      expect(result).toEqual(["React", "前端", "JavaScript"]);
    });

    it("should handle null values", () => {
      const result = getMergedTags({
        user_tags: null,
        ai_tags: ["AI"],
      });
      expect(result).toEqual(["AI"]);
    });
  });

  describe("getUnifiedTags", () => {
    it("should return empty array when no tags", () => {
      const result = getUnifiedTags({});
      expect(result).toEqual([]);
    });

    it("should mark user-only tags correctly", () => {
      const result = getUnifiedTags({ user_tags: ["前端"] });
      expect(result).toEqual([{ value: "前端", source: "user" }]);
    });

    it("should mark ai-only tags correctly", () => {
      const result = getUnifiedTags({ ai_tags: ["JavaScript"] });
      expect(result).toEqual([{ value: "JavaScript", source: "ai" }]);
    });

    it("should mark overlapping tags as 'both'", () => {
      const result = getUnifiedTags({
        user_tags: ["React", "前端"],
        ai_tags: ["React", "JavaScript"],
      });
      expect(result).toEqual([
        { value: "React", source: "both" },
        { value: "前端", source: "user" },
        { value: "JavaScript", source: "ai" },
      ]);
    });
  });

  describe("getPreferredTags", () => {
    it("should return user_tags if available", () => {
      const result = getPreferredTags({
        user_tags: ["用户标签"],
        ai_tags: ["AI标签"],
      });
      expect(result).toEqual(["用户标签"]);
    });

    it("should return ai_tags if no user_tags", () => {
      const result = getPreferredTags({
        user_tags: [],
        ai_tags: ["AI标签"],
      });
      expect(result).toEqual(["AI标签"]);
    });

    it("should return empty array if no tags", () => {
      const result = getPreferredTags({});
      expect(result).toEqual([]);
    });
  });

  describe("hasTags", () => {
    it("should return false when no tags", () => {
      expect(hasTags({})).toBe(false);
      expect(hasTags({ ai_tags: [], user_tags: [] })).toBe(false);
      expect(hasTags({ ai_tags: null, user_tags: null })).toBe(false);
    });

    it("should return true when has ai_tags", () => {
      expect(hasTags({ ai_tags: ["tag1"] })).toBe(true);
    });

    it("should return true when has user_tags", () => {
      expect(hasTags({ user_tags: ["tag1"] })).toBe(true);
    });

    it("should return true when has both", () => {
      expect(hasTags({ ai_tags: ["ai"], user_tags: ["user"] })).toBe(true);
    });
  });

  describe("hasUserTags", () => {
    it("should return false when no user_tags", () => {
      expect(hasUserTags({})).toBe(false);
      expect(hasUserTags({ user_tags: null })).toBe(false);
      expect(hasUserTags({ user_tags: [] })).toBe(false);
    });

    it("should return true when has user_tags", () => {
      expect(hasUserTags({ user_tags: ["tag1"] })).toBe(true);
    });
  });

  describe("getTagCount", () => {
    it("should return 0 when no tags", () => {
      expect(getTagCount({})).toBe(0);
    });

    it("should count unique tags", () => {
      expect(
        getTagCount({
          user_tags: ["React", "前端"],
          ai_tags: ["React", "JavaScript"],
        }),
      ).toBe(3); // React, 前端, JavaScript (React deduplicated)
    });
  });

  describe("limitTags", () => {
    it("should return all tags if under limit", () => {
      const result = limitTags(["a", "b"], 5);
      expect(result).toEqual({ visible: ["a", "b"], remaining: 0 });
    });

    it("should truncate and return remaining count", () => {
      const result = limitTags(["a", "b", "c", "d", "e"], 3);
      expect(result).toEqual({ visible: ["a", "b", "c"], remaining: 2 });
    });

    it("should handle empty array", () => {
      const result = limitTags([], 3);
      expect(result).toEqual({ visible: [], remaining: 0 });
    });
  });

  describe("formatTagsForDisplay", () => {
    it("should format tags with default options", () => {
      const result = formatTagsForDisplay(["React", "Vue"]);
      expect(result).toBe("#React #Vue");
    });

    it("should limit tags and show remaining count", () => {
      const result = formatTagsForDisplay(["a", "b", "c", "d", "e"], {
        limit: 2,
      });
      expect(result).toBe("#a #b +3");
    });

    it("should use custom prefix and separator", () => {
      const result = formatTagsForDisplay(["React", "Vue"], {
        prefix: "@",
        separator: ", ",
      });
      expect(result).toBe("@React, @Vue");
    });

    it("should handle empty array", () => {
      const result = formatTagsForDisplay([]);
      expect(result).toBe("");
    });
  });
});
