/**
 * 标签建议生成步骤测试
 *
 * @module ai-skills/skills/batch-organize/steps/tag.test
 * @version 1.0.0
 * @since 2026-01-10
 */

import { generateTagSuggestions } from "../steps/tag.step";
import type { BookmarkRow } from "../steps/types";

describe("generateTagSuggestions", () => {
  describe("基于 AI 标签推荐", () => {
    it("should suggest AI tags when available", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "React教程",
          url: "https://example.com/react",
          platform: "default",
          ai_tags: ["React", "前端", "JavaScript"],
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).toContain("React");
      expect(suggestions[0].confidence).toBe(0.85);
    });

    it("should filter out existing user tags", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "React教程",
          url: "https://example.com/react",
          platform: "default",
          ai_tags: ["React", "前端", "JavaScript"],
          user_tags: ["React"],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).not.toContain("React");
      expect(suggestions[0].suggestedTags).toContain("前端");
    });

    it("should skip bookmarks with enough user tags", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "React教程",
          url: "https://example.com/react",
          platform: "default",
          ai_tags: ["React", "前端"],
          user_tags: ["技术", "学习"],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe("基于内容特征生成标签", () => {
    it("should generate platform-based tags when no AI tags", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "有趣的文章",
          url: "https://mp.weixin.qq.com/s/xxx",
          platform: "wechat",
          ai_tags: null,
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).toContain("公众号");
      expect(suggestions[0].confidence).toBe(0.65);
    });

    it("should generate keyword-based tags from title", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "JavaScript ES6 新特性详解",
          url: "https://example.com/js-es6",
          platform: "default",
          ai_tags: null,
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).toContain("JavaScript");
    });

    it("should generate tags for bilibili platform", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "好看的视频",
          url: "https://www.bilibili.com/video/xxx",
          platform: "bilibili",
          ai_tags: null,
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).toContain("视频");
    });

    it("should generate tags for github platform with code content", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "awesome-react",
          url: "https://github.com/awesome/react",
          platform: "github",
          ai_tags: null,
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).toContain("代码");
    });

    it("should use default tag when no platform or keyword match", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "普通网页",
          url: "https://example.com/page",
          platform: "unknown",
          ai_tags: null,
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedTags).toContain("收藏");
    });
  });

  describe("混合场景", () => {
    it("should handle bookmarks with and without AI tags", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "React教程",
          url: "https://example.com/react",
          platform: "default",
          ai_tags: ["React", "前端"],
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          title: "Python学习资料",
          url: "https://example.com/python",
          platform: "default",
          ai_tags: null,
          user_tags: [],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      expect(suggestions).toHaveLength(2);
      // 第一个使用 AI 标签
      expect(suggestions.find((s) => s.bookmarkId === 1)?.confidence).toBe(
        0.85,
      );
      // 第二个使用内容生成
      expect(suggestions.find((s) => s.bookmarkId === 2)?.confidence).toBe(
        0.65,
      );
    });

    it("should not suggest tags already in user_tags", () => {
      const bookmarks: BookmarkRow[] = [
        {
          id: 1,
          title: "JavaScript文章",
          url: "https://example.com/js",
          platform: "default",
          ai_tags: null,
          user_tags: ["JavaScript"],
          ai_summary: null,
          folder_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const suggestions = generateTagSuggestions(bookmarks);

      // 只有一个 user_tag，还需要建议
      expect(suggestions).toHaveLength(1);
      // 但不应该重复推荐 JavaScript
      expect(suggestions[0].suggestedTags).not.toContain("JavaScript");
    });
  });
});
