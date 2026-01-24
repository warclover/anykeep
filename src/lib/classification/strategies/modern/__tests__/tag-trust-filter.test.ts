/**
 * 标签可信度过滤器单元测试
 *
 * @module @/lib/classification/v5/classification-pipeline/__tests__/tag-trust-filter.test
 */

import {
  TagTrustFilter,
  TagSourceLevel,
  GLOBAL_STOP_TAGS,
  TAG_SOURCE_WEIGHTS,
} from "../tag-trust-filter";

describe("TagTrustFilter", () => {
  let filter: TagTrustFilter;

  beforeEach(() => {
    filter = new TagTrustFilter();
  });

  describe("filterAndWeight", () => {
    it("should filter global stop tags", () => {
      const tags = ["前端", "article", "home", "vue"];
      const weighted = filter.filterAndWeight(tags, TagSourceLevel.B);

      const filtered = weighted.filter((wt) => wt.isFiltered);
      expect(filtered.map((f) => f.tag)).toContain("article");
      expect(filtered.map((f) => f.tag)).toContain("home");

      const passed = weighted.filter((wt) => !wt.isFiltered);
      expect(passed.map((p) => p.tag)).toContain("前端");
      expect(passed.map((p) => p.tag)).toContain("vue");
    });

    it("should apply source level weights", () => {
      const tag = "前端";

      const levelS = filter.filterAndWeight([tag], TagSourceLevel.S)[0];
      const levelB = filter.filterAndWeight([tag], TagSourceLevel.B)[0];
      const levelC = filter.filterAndWeight([tag], TagSourceLevel.C)[0];

      expect(levelS.weight).toBe(1.0);
      expect(levelB.weight).toBe(0.8);
      expect(levelC.weight).toBe(0.3);
    });

    it("should filter too short tags", () => {
      const tags = ["a", "前端"];
      const weighted = filter.filterAndWeight(tags, TagSourceLevel.S);

      const filtered = weighted.filter((wt) => wt.isFiltered);
      expect(filtered.length).toBe(1);
      expect(filtered[0].filterReason).toBe("too_short");
    });

    it("should filter too long tags", () => {
      const longTag = "a".repeat(51);
      const weighted = filter.filterAndWeight([longTag], TagSourceLevel.S);

      expect(weighted[0].isFiltered).toBe(true);
      expect(weighted[0].filterReason).toBe("too_long");
    });

    it("should apply length penalty for short tags", () => {
      const shortTag = "AI"; // 2 chars, should have 0.5 penalty
      const normalTag = "React"; // 5 chars, no penalty

      const shortResult = filter.filterAndWeight(
        [shortTag],
        TagSourceLevel.S,
      )[0];
      const normalResult = filter.filterAndWeight(
        [normalTag],
        TagSourceLevel.S,
      )[0];

      // Short tag: 1.0 * 0.5 = 0.5
      expect(shortResult.weight).toBe(0.5);
      // Normal tag: 1.0 * 1.0 = 1.0
      expect(normalResult.weight).toBe(1.0);
    });

    it("should apply length penalty for long tags", () => {
      const longTag = "a".repeat(35); // 35 chars, should have 0.7 penalty
      const weighted = filter.filterAndWeight([longTag], TagSourceLevel.S);

      expect(weighted[0].weight).toBe(0.7);
    });
  });

  describe("blacklist", () => {
    it("should filter blacklisted tags", () => {
      const userId = "user1";
      const folderId = "folder1";
      const tag = "误分类标签";

      filter.addToBlacklist(userId, folderId, tag);

      const weighted = filter.filterAndWeight(
        [tag, "正常标签"],
        TagSourceLevel.S,
        userId,
        folderId,
      );

      const filtered = weighted.filter((wt) => wt.isFiltered);
      expect(filtered.length).toBe(1);
      expect(filtered[0].tag).toBe(tag);
      expect(filtered[0].filterReason).toBe("user_blacklist");
    });

    it("should not filter blacklist for different user", () => {
      const tag = "测试标签";
      filter.addToBlacklist("user1", "folder1", tag);

      const weighted = filter.filterAndWeight(
        [tag],
        TagSourceLevel.S,
        "user2",
        "folder1",
      );

      expect(weighted[0].isFiltered).toBe(false);
    });

    it("should not filter blacklist for different folder", () => {
      const tag = "测试标签";
      filter.addToBlacklist("user1", "folder1", tag);

      const weighted = filter.filterAndWeight(
        [tag],
        TagSourceLevel.S,
        "user1",
        "folder2",
      );

      expect(weighted[0].isFiltered).toBe(false);
    });

    it("should remove from blacklist", () => {
      const userId = "user1";
      const folderId = "folder1";
      const tag = "测试标签";

      filter.addToBlacklist(userId, folderId, tag);
      filter.removeFromBlacklist(userId, folderId, tag);

      const weighted = filter.filterAndWeight(
        [tag],
        TagSourceLevel.S,
        userId,
        folderId,
      );

      expect(weighted[0].isFiltered).toBe(false);
    });
  });

  describe("getUsableTags", () => {
    it("should return only usable tags", () => {
      const tags = ["前端", "article", "home", "vue"];
      const weighted = filter.filterAndWeight(tags, TagSourceLevel.S);
      const usable = filter.getUsableTags(weighted);

      expect(usable.length).toBe(2);
      expect(usable.map((u) => u.tag)).toContain("前端");
      expect(usable.map((u) => u.tag)).toContain("vue");
    });
  });

  describe("getDirectMatchableTags", () => {
    it("should exclude Level C tags", () => {
      const tags = ["前端", "vue"];

      const levelSWeighted = filter.filterAndWeight(tags, TagSourceLevel.S);
      const levelCWeighted = filter.filterAndWeight(tags, TagSourceLevel.C);

      const levelSMatchable = filter.getDirectMatchableTags(levelSWeighted);
      const levelCMatchable = filter.getDirectMatchableTags(levelCWeighted);

      expect(levelSMatchable.length).toBe(2);
      expect(levelCMatchable.length).toBe(0); // Level C tags excluded
    });
  });

  describe("getFilterStats", () => {
    it("should return correct filter statistics", () => {
      const tags = ["前端", "article", "home", "vue", "a"];
      const weighted = filter.filterAndWeight(tags, TagSourceLevel.S);
      const stats = filter.getFilterStats(weighted);

      expect(stats.total).toBe(5);
      expect(stats.passed).toBe(2); // 前端, vue
      expect(stats.filtered).toBe(3); // article, home, a
      expect(stats.byReason["global_stop_tag"]).toBe(2);
      expect(stats.byReason["too_short"]).toBe(1);
    });
  });

  describe("customStopTags", () => {
    it("should filter custom stop tags", () => {
      const customTag = "自定义停用词";
      filter.addCustomStopTag(customTag);

      const weighted = filter.filterAndWeight([customTag], TagSourceLevel.S);

      expect(weighted[0].isFiltered).toBe(true);
      expect(weighted[0].filterReason).toBe("global_stop_tag");
    });

    it("should remove custom stop tags", () => {
      const customTag = "自定义停用词";
      filter.addCustomStopTag(customTag);
      filter.removeCustomStopTag(customTag);

      const weighted = filter.filterAndWeight([customTag], TagSourceLevel.S);

      expect(weighted[0].isFiltered).toBe(false);
    });
  });

  describe("GLOBAL_STOP_TAGS", () => {
    it("should contain common SEO spam words", () => {
      expect(GLOBAL_STOP_TAGS.has("article")).toBe(true);
      expect(GLOBAL_STOP_TAGS.has("home")).toBe(true);
      expect(GLOBAL_STOP_TAGS.has("best")).toBe(true);
      expect(GLOBAL_STOP_TAGS.has("tutorial")).toBe(true);
      expect(GLOBAL_STOP_TAGS.has("首页")).toBe(true);
      expect(GLOBAL_STOP_TAGS.has("教程")).toBe(true);
    });
  });

  describe("TAG_SOURCE_WEIGHTS", () => {
    it("should have correct weights", () => {
      expect(TAG_SOURCE_WEIGHTS[TagSourceLevel.S]).toBe(1.0);
      expect(TAG_SOURCE_WEIGHTS[TagSourceLevel.B]).toBe(0.8);
      expect(TAG_SOURCE_WEIGHTS[TagSourceLevel.C]).toBe(0.3);
    });
  });
});
