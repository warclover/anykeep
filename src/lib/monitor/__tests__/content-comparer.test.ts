/**
 * 内容对比服务单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  compareContent,
  hasContentChanged,
  isSignificantChange,
  shouldSendNotification,
} from "../content-comparer";

describe("content-comparer", () => {
  describe("compareContent", () => {
    it("相同内容应该返回无变化", () => {
      const content = "Hello World\nThis is line 2";
      const result = compareContent(content, content);

      expect(result.hasChanged).toBe(false);
      expect(result.similarityScore).toBe(100);
      expect(result.changeSummary).toContain("无变化");
    });

    it("完全不同的内容应该返回重大变更", () => {
      const oldContent = "Hello World";
      const newContent = "Goodbye Moon";
      const result = compareContent(oldContent, newContent);

      expect(result.hasChanged).toBe(true);
      expect(result.similarityScore).toBeLessThan(50);
      expect(result.changeSummary).toContain("重大变更");
    });

    it("新增行应该正确计数", () => {
      const oldContent = "Line 1\nLine 2";
      const newContent = "Line 1\nLine 2\nLine 3";
      const result = compareContent(oldContent, newContent);

      expect(result.hasChanged).toBe(true);
      expect(result.addedLines).toBeGreaterThan(0);
      expect(result.changeSummary).toContain("新增");
    });

    it("删除行应该正确计数", () => {
      const oldContent = "Line 1\nLine 2\nLine 3";
      const newContent = "Line 1\nLine 2";
      const result = compareContent(oldContent, newContent);

      expect(result.hasChanged).toBe(true);
      expect(result.removedLines).toBeGreaterThan(0);
      expect(result.changeSummary).toContain("删除");
    });

    it("空字符串应该正确处理", () => {
      const result = compareContent("", "");
      expect(result.hasChanged).toBe(false);
      expect(result.similarityScore).toBe(100);
    });

    it("从空到有内容应该视为变更", () => {
      const result = compareContent("", "New content");
      expect(result.hasChanged).toBe(true);
      expect(result.addedLines).toBeGreaterThan(0);
    });

    it("从有内容到空应该视为变更", () => {
      const result = compareContent("Old content", "");
      expect(result.hasChanged).toBe(true);
      expect(result.removedLines).toBeGreaterThan(0);
    });

    it("微小变更应该返回正确等级", () => {
      // 95%+ 相似度
      const oldContent =
        "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10";
      const newContent =
        "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10 modified";
      const result = compareContent(oldContent, newContent);

      expect(result.hasChanged).toBe(true);
      // 相似度应该较高但不是100%
      expect(result.similarityScore).toBeGreaterThan(80);
    });

    it("显著变更应该返回正确等级", () => {
      const oldContent = "Line 1\nLine 2\nLine 3";
      const newContent = "Line 1\nCompletely different\nAnother change";
      const result = compareContent(oldContent, newContent);

      expect(result.hasChanged).toBe(true);
      // 相似度应该在50-80之间
      expect(result.similarityScore).toBeLessThan(80);
    });
  });

  describe("hasContentChanged", () => {
    it("相同哈希应该返回false", () => {
      const hash = "abc123";
      expect(hasContentChanged(hash, hash)).toBe(false);
    });

    it("不同哈希应该返回true", () => {
      expect(hasContentChanged("abc123", "def456")).toBe(true);
    });

    it("null旧哈希应该返回true", () => {
      expect(hasContentChanged(null, "abc123")).toBe(true);
    });

    it("null新哈希应该返回true", () => {
      expect(hasContentChanged("abc123", null)).toBe(true);
    });

    it("两个null应该返回true", () => {
      expect(hasContentChanged(null, null)).toBe(true);
    });
  });

  describe("isSignificantChange", () => {
    it("相似度>=80应该不是显著变更", () => {
      expect(isSignificantChange(100)).toBe(false);
      expect(isSignificantChange(90)).toBe(false);
      expect(isSignificantChange(80)).toBe(false);
    });

    it("相似度<80应该是显著变更", () => {
      expect(isSignificantChange(79)).toBe(true);
      expect(isSignificantChange(50)).toBe(true);
      expect(isSignificantChange(0)).toBe(true);
    });
  });

  describe("shouldSendNotification", () => {
    it("通知禁用时应该返回false", () => {
      expect(shouldSendNotification(50, false)).toBe(false);
    });

    it("非显著变更且通知启用应该返回false", () => {
      expect(shouldSendNotification(90, true)).toBe(false);
      expect(shouldSendNotification(80, true)).toBe(false);
    });

    it("显著变更且通知启用应该返回true", () => {
      expect(shouldSendNotification(79, true)).toBe(true);
      expect(shouldSendNotification(50, true)).toBe(true);
    });

    it("边界值测试", () => {
      // 80 不是显著变更
      expect(shouldSendNotification(80, true)).toBe(false);
      // 79 是显著变更
      expect(shouldSendNotification(79, true)).toBe(true);
    });
  });
});
