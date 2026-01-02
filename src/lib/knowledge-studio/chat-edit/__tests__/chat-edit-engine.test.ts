/**
 * ChatEditEngine - 单元测试
 * @module knowledge-studio/chat-edit
 */

import { ChatEditEngine } from "../chat-edit-engine";
import { DEFAULT_SLIDING_WINDOW_CONFIG, EDIT_MODE_CONFIG } from "../types";
import type { ChatTurn } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("ChatEditEngine", () => {
  let engine: ChatEditEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new ChatEditEngine();
  });

  describe("buildContext", () => {
    const testParagraphs = [
      "这是第一段。",
      "这是第二段，包含更多内容。",
      "这是第三段。",
      "这是第四段。",
      "这是第五段。",
    ];

    it("should build context for middle paragraph", () => {
      const context = engine.buildContext(testParagraphs, 2);

      expect(context.paragraph.index).toBe(2);
      expect(context.paragraph.content).toBe("这是第三段。");
      // contextParagraphs = 1, 所以只包含前 1 段（第二段）
      expect(context.surroundingContext.before).toContain("第二段");
      expect(context.surroundingContext.after).toContain("第四段");
    });

    it("should build context for first paragraph", () => {
      const context = engine.buildContext(testParagraphs, 0);

      expect(context.paragraph.index).toBe(0);
      expect(context.paragraph.content).toBe("这是第一段。");
      expect(context.surroundingContext.before).toBe("");
      expect(context.surroundingContext.after).toContain("第二段");
    });

    it("should build context for last paragraph", () => {
      const context = engine.buildContext(testParagraphs, 4);

      expect(context.paragraph.index).toBe(4);
      expect(context.paragraph.content).toBe("这是第五段。");
      // contextParagraphs = 1, 所以只包含前 1 段（第四段）
      expect(context.surroundingContext.before).toContain("第四段");
      expect(context.surroundingContext.after).toBe("");
    });

    it("should include existing turns in context", () => {
      const existingTurns: ChatTurn[] = [
        {
          id: "1",
          role: "user",
          content: "请扩展这段内容",
          timestamp: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "已扩展内容",
          timestamp: new Date(),
        },
      ];

      const context = engine.buildContext(testParagraphs, 2, existingTurns);

      expect(context.recentTurns.length).toBe(2);
      expect(context.recentTurns[0].role).toBe("user");
    });

    it("should calculate word count correctly", () => {
      const context = engine.buildContext(testParagraphs, 1);

      expect(context.paragraph.wordCount).toBeGreaterThan(0);
    });
  });

  describe("addTurn", () => {
    it("should add user turn", () => {
      const existingTurns: ChatTurn[] = [];
      const newTurns = engine.addTurn(existingTurns, "user", "请简化这段");

      expect(newTurns.length).toBe(1);
      expect(newTurns[0].role).toBe("user");
      expect(newTurns[0].content).toBe("请简化这段");
      expect(newTurns[0].id).toBeDefined();
      expect(newTurns[0].timestamp).toBeInstanceOf(Date);
    });

    it("should add assistant turn with edit result", () => {
      const existingTurns: ChatTurn[] = [];
      const newTurns = engine.addTurn(
        existingTurns,
        "assistant",
        "已完成编辑",
        { before: "原文", after: "修改后" },
      );

      expect(newTurns.length).toBe(1);
      expect(newTurns[0].role).toBe("assistant");
      expect(newTurns[0].editResult?.before).toBe("原文");
      expect(newTurns[0].editResult?.after).toBe("修改后");
    });

    it("should preserve existing turns", () => {
      const existingTurns: ChatTurn[] = [
        {
          id: "1",
          role: "user",
          content: "第一条消息",
          timestamp: new Date(),
        },
      ];

      const newTurns = engine.addTurn(existingTurns, "assistant", "回复");

      expect(newTurns.length).toBe(2);
      expect(newTurns[0].content).toBe("第一条消息");
      expect(newTurns[1].content).toBe("回复");
    });
  });

  describe("generateDiff", () => {
    it("should generate diff for simple change", () => {
      const before = "这是原始内容。";
      const after = "这是修改后的内容。";

      const diff = engine.generateDiff(before, after);

      expect(diff.before).toBe(before);
      expect(diff.after).toBe(after);
      expect(diff.changes.length).toBeGreaterThan(0);
    });

    it("should detect unchanged lines", () => {
      const before = "第一行\n第二行\n第三行";
      const after = "第一行\n修改的第二行\n第三行";

      const diff = engine.generateDiff(before, after);

      expect(diff.stats.unchanged).toBeGreaterThan(0);
      expect(diff.stats.added).toBeGreaterThan(0);
      expect(diff.stats.removed).toBeGreaterThan(0);
    });

    it("should handle empty before content", () => {
      const before = "";
      const after = "新内容";

      const diff = engine.generateDiff(before, after);

      expect(diff.before).toBe("");
      expect(diff.after).toBe("新内容");
      expect(diff.stats.added).toBeGreaterThanOrEqual(1);
    });

    it("should handle identical content", () => {
      const content = "相同的内容";

      const diff = engine.generateDiff(content, content);

      expect(diff.stats.added).toBe(0);
      expect(diff.stats.removed).toBe(0);
      expect(diff.stats.unchanged).toBe(1);
    });
  });

  describe("DEFAULT_SLIDING_WINDOW_CONFIG", () => {
    it("should have maxRecentTurns", () => {
      expect(DEFAULT_SLIDING_WINDOW_CONFIG.maxRecentTurns).toBeDefined();
      expect(typeof DEFAULT_SLIDING_WINDOW_CONFIG.maxRecentTurns).toBe(
        "number",
      );
    });

    it("should have contextParagraphs", () => {
      expect(DEFAULT_SLIDING_WINDOW_CONFIG.contextParagraphs).toBeDefined();
      expect(typeof DEFAULT_SLIDING_WINDOW_CONFIG.contextParagraphs).toBe(
        "number",
      );
    });

    it("should have maxSummaryTokens", () => {
      expect(DEFAULT_SLIDING_WINDOW_CONFIG.maxSummaryTokens).toBeDefined();
      expect(typeof DEFAULT_SLIDING_WINDOW_CONFIG.maxSummaryTokens).toBe(
        "number",
      );
    });
  });

  describe("EDIT_MODE_CONFIG", () => {
    it("should have rewrite mode config", () => {
      expect(EDIT_MODE_CONFIG.rewrite).toBeDefined();
      expect(EDIT_MODE_CONFIG.rewrite.name).toBe("重写");
    });

    it("should have expand mode config", () => {
      expect(EDIT_MODE_CONFIG.expand).toBeDefined();
      expect(EDIT_MODE_CONFIG.expand.name).toBe("扩展");
    });

    it("should have simplify mode config", () => {
      expect(EDIT_MODE_CONFIG.simplify).toBeDefined();
      expect(EDIT_MODE_CONFIG.simplify.name).toBe("简化");
    });

    it("should have tone mode config", () => {
      expect(EDIT_MODE_CONFIG.tone).toBeDefined();
      expect(EDIT_MODE_CONFIG.tone.name).toBe("调整语气");
    });

    it("should have custom mode config", () => {
      expect(EDIT_MODE_CONFIG.custom).toBeDefined();
      expect(EDIT_MODE_CONFIG.custom.name).toBe("自定义");
    });
  });
});
