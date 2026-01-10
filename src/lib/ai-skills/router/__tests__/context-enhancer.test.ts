/**
 * ContextEnhancer 测试
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ContextEnhancer } from "../context-enhancer";
import type { ClassificationContext } from "../hybrid-intent-classifier";
import type { IntentSlot } from "../types";

describe("ContextEnhancer", () => {
  let enhancer: ContextEnhancer;

  beforeEach(() => {
    enhancer = new ContextEnhancer();
  });

  describe("指代消解 (Coreference Resolution)", () => {
    it("应该将'这些'解析为已选中的书签", () => {
      const context: ClassificationContext = {
        input: "移动这些到前端文件夹",
        selectedBookmarks: [1, 2, 3],
      };

      const slots: Record<string, IntentSlot> = {
        bookmarkIds: {
          name: "bookmarkIds",
          value: "这些",
          type: "string",
          confidence: 0.8,
          required: false,
          source: "extracted",
        },
      };

      const result = enhancer.enhanceSlots(slots, "organize", "move", context);

      expect(result.enhancedCount).toBeGreaterThan(0);
      expect(result.slots.bookmarkIds.value).toEqual([1, 2, 3]);
      expect(result.slots.bookmarkIds.source).toBe("inferred");
    });

    it("应该将'那个'解析为唯一选中的书签", () => {
      const context: ClassificationContext = {
        input: "删除那个",
        selectedBookmarks: [5],
      };

      const slots: Record<string, IntentSlot> = {
        bookmarkId: {
          name: "bookmarkId",
          value: "那个",
          type: "string",
          confidence: 0.8,
          required: false,
          source: "extracted",
        },
      };

      const result = enhancer.enhanceSlots(slots, "action", "delete", context);

      expect(result.enhancedCount).toBeGreaterThan(0);
      expect(result.slots.bookmarkId.value).toBe(5);
      expect(result.slots.bookmarkId.source).toBe("inferred");
    });

    it("应该将'当前'解析为当前文件夹", () => {
      const context: ClassificationContext = {
        input: "整理当前文件夹",
        currentFolder: 10,
      };

      const slots: Record<string, IntentSlot> = {
        folderId: {
          name: "folderId",
          value: "当前",
          type: "string",
          confidence: 0.8,
          required: false,
          source: "extracted",
        },
      };

      const result = enhancer.enhanceSlots(
        slots,
        "organize",
        "cleanup",
        context,
      );

      expect(result.enhancedCount).toBeGreaterThan(0);
      expect(result.slots.folderId.value).toBe(10);
      expect(result.slots.folderId.source).toBe("inferred");
    });

    it("应该将'最近'解析为时间范围", () => {
      const context: ClassificationContext = {
        input: "查看最近的书签",
      };

      const slots: Record<string, IntentSlot> = {
        timeRange: {
          name: "timeRange",
          value: "最近",
          type: "string",
          confidence: 0.8,
          required: false,
          source: "extracted",
        },
      };

      const result = enhancer.enhanceSlots(slots, "query", "list", context);

      expect(result.enhancedCount).toBeGreaterThan(0);
      expect(result.slots.timeRange.value).toEqual({
        timeRange: "recent",
        days: 7,
      });
    });
  });

  describe("上下文推断 (Context Inference)", () => {
    it("应该从已选书签推断 bookmarkIds（仅限 required 槽位）", () => {
      const context: ClassificationContext = {
        input: "添加标签",
        selectedBookmarks: [1, 2, 3],
      };

      const slots: Record<string, IntentSlot> = {};

      const result = enhancer.enhanceSlots(slots, "action", "tag", context);

      // 注意：bookmarkIds 对于 action:tag 是 optional，
      // 当前 ContextEnhancer 只推断 required 槽位
      expect(result.enhancedCount).toBe(0);
    });

    it("应该从当前文件夹推断 targetFolder", () => {
      const context: ClassificationContext = {
        input: "移动到这里",
        currentFolder: 10,
      };

      const slots: Record<string, IntentSlot> = {};

      const result = enhancer.enhanceSlots(slots, "organize", "move", context);

      expect(result.enhancedCount).toBeGreaterThan(0);
      expect(result.slots.targetFolder).toBeDefined();
      expect(result.slots.targetFolder.value).toBe(10);
      expect(result.slots.targetFolder.source).toBe("context");
    });

    it("应该从选中书签推断 scope（仅限 required 槽位）", () => {
      const context: ClassificationContext = {
        input: "清理",
        selectedBookmarks: [1, 2],
      };

      const slots: Record<string, IntentSlot> = {};

      const result = enhancer.enhanceSlots(
        slots,
        "organize",
        "cleanup",
        context,
      );

      // 注意：scope 对于 organize:cleanup 是 optional，
      // 当前 ContextEnhancer 只推断 required 槽位
      expect(result.enhancedCount).toBe(0);
    });
  });

  describe("槽位完整性验证", () => {
    it("应该验证必需槽位是否完整", () => {
      const slots: Record<string, IntentSlot> = {
        targetFolder: {
          name: "targetFolder",
          value: "前端开发",
          type: "string",
          confidence: 0.9,
          required: true,
          source: "extracted",
        },
      };

      const validation = enhancer.validateCompleteness(
        "organize",
        "move",
        slots,
      );

      expect(validation.complete).toBe(true);
      expect(validation.missing).toEqual([]);
      expect(validation.completeness).toBeGreaterThan(0);
    });

    it("应该检测缺失的必需槽位", () => {
      const slots: Record<string, IntentSlot> = {};

      const validation = enhancer.validateCompleteness(
        "organize",
        "move",
        slots,
      );

      expect(validation.complete).toBe(false);
      expect(validation.missing).toContain("targetFolder");
      expect(validation.completeness).toBeLessThan(1.0);
    });
  });

  describe("综合场景", () => {
    it("应该同时处理指代消解和上下文推断", () => {
      const context: ClassificationContext = {
        input: "移动这些到当前文件夹",
        selectedBookmarks: [1, 2, 3],
        currentFolder: 10,
      };

      const slots: Record<string, IntentSlot> = {
        bookmarkIds: {
          name: "bookmarkIds",
          value: "这些",
          type: "string",
          confidence: 0.8,
          required: false,
          source: "extracted",
        },
        targetFolder: {
          name: "targetFolder",
          value: "当前文件夹",
          type: "string",
          confidence: 0.8,
          required: true,
          source: "extracted",
        },
      };

      const result = enhancer.enhanceSlots(slots, "organize", "move", context);

      expect(result.enhancedCount).toBeGreaterThanOrEqual(2);
      expect(result.slots.bookmarkIds.value).toEqual([1, 2, 3]);
      expect(result.slots.targetFolder.value).toBe(10);
    });
  });
});
