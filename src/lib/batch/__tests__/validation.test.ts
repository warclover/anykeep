/**
 * 批量操作验证 Schema 单元测试
 * @description 测试 batchTagsSchema 的验证逻辑和安全防护
 */

import { batchTagsSchema, BATCH_LIMITS } from "../validation";

describe("batchTagsSchema", () => {
  describe("action 字段验证", () => {
    it("接受 'add' 操作", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["test"],
      });
      expect(result.success).toBe(true);
    });

    it("接受 'remove' 操作", () => {
      const result = batchTagsSchema.safeParse({
        action: "remove",
        bookmarkIds: [1],
        tags: ["test"],
      });
      expect(result.success).toBe(true);
    });

    it("拒绝无效操作类型", () => {
      const result = batchTagsSchema.safeParse({
        action: "invalid",
        bookmarkIds: [1],
        tags: ["test"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bookmarkIds 字段验证", () => {
    it("接受有效的书签 ID 数组", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1, 2, 3],
        tags: ["test"],
      });
      expect(result.success).toBe(true);
    });

    it("拒绝空的书签 ID 数组", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [],
        tags: ["test"],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("请至少选择一个书签");
      }
    });

    it("拒绝超过 200 个书签 ID", () => {
      const tooManyIds = Array.from({ length: 201 }, (_, i) => i + 1);
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: tooManyIds,
        tags: ["test"],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("单次最多操作 200 个书签");
      }
    });

    it("接受恰好 200 个书签 ID", () => {
      const maxIds = Array.from({ length: 200 }, (_, i) => i + 1);
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: maxIds,
        tags: ["test"],
      });
      expect(result.success).toBe(true);
    });

    it("拒绝非正整数的书签 ID", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [0, -1, 1.5],
        tags: ["test"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("tags 字段验证", () => {
    it("接受有效的标签数组", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["标签1", "标签2"],
      });
      expect(result.success).toBe(true);
    });

    it("拒绝空的标签数组", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("请至少选择一个标签");
      }
    });

    it("拒绝超过 20 个标签", () => {
      const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: tooManyTags,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("单次最多操作 20 个标签");
      }
    });

    it("拒绝超过 50 字符的标签", () => {
      const longTag = "a".repeat(51);
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: [longTag],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("标签最长 50 个字符");
      }
    });

    it("接受恰好 50 字符的标签", () => {
      const maxLengthTag = "a".repeat(50);
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: [maxLengthTag],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("XSS 防护验证", () => {
    it("拒绝包含 < 字符的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["<script>alert(1)</script>"],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("特殊字符");
      }
    });

    it("拒绝包含 > 字符的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["tag>test"],
      });
      expect(result.success).toBe(false);
    });

    it("拒绝包含单引号的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["tag'injection"],
      });
      expect(result.success).toBe(false);
    });

    it("拒绝包含双引号的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ['tag"injection'],
      });
      expect(result.success).toBe(false);
    });

    it("拒绝包含 & 字符的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["tag&amp;test"],
      });
      expect(result.success).toBe(false);
    });

    it("接受不包含危险字符的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["正常标签", "normal-tag", "tag_123", "标签 空格"],
      });
      expect(result.success).toBe(true);
    });

    it("拒绝纯空白字符的标签", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        tags: ["   "],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("标签不能为纯空白");
      }
    });
  });

  describe("边界条件", () => {
    it("接受完整的有效请求", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1, 2, 3, 4, 5],
        tags: ["工作", "学习", "待读"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("add");
        expect(result.data.bookmarkIds).toHaveLength(5);
        expect(result.data.tags).toHaveLength(3);
      }
    });

    it("拒绝缺少必填字段的请求", () => {
      const result = batchTagsSchema.safeParse({
        action: "add",
        bookmarkIds: [1],
        // missing tags
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("BATCH_LIMITS 常量", () => {
  it("定义了正确的限制值", () => {
    expect(BATCH_LIMITS.MAX_BOOKMARKS).toBe(200);
    expect(BATCH_LIMITS.MAX_TAGS).toBe(20);
    expect(BATCH_LIMITS.MAX_TAG_LENGTH).toBe(50);
  });
});
