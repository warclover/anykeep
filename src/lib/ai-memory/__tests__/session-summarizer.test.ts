/**
 * 会话摘要生成器测试
 *
 * @module @/lib/ai-memory/__tests__/session-summarizer.test
 */

import {
  generateSimpleSummary,
  type SessionMessage,
} from "../session-summarizer";

// =============================================================================
// Mock 设置
// =============================================================================

// Mock Feature Flags
jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_CROSS_SESSION_MEMORY: true,
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

// =============================================================================
// generateSimpleSummary 测试
// =============================================================================

describe("generateSimpleSummary", () => {
  describe("基本功能", () => {
    it("应该从最后一条用户消息生成摘要", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "帮我搜索关于 React 的文章" },
        { role: "assistant", content: "找到 15 篇相关文章" },
        { role: "user", content: "把前5篇添加到技术文件夹" },
        { role: "assistant", content: "已完成" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.summary).toBe("把前5篇添加到技术文件夹");
    });

    it("应该在摘要过长时截断", () => {
      const longContent = "a".repeat(150);
      const messages: SessionMessage[] = [
        { role: "user", content: longContent },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.summary.length).toBeLessThanOrEqual(100);
      expect(summary.summary).toMatch(/\.\.\.$/);
    });

    it("应该处理空会话", () => {
      const messages: SessionMessage[] = [];

      const summary = generateSimpleSummary(messages);

      expect(summary.summary).toBe("空会话");
    });

    it("应该处理只有助手消息的会话", () => {
      const messages: SessionMessage[] = [
        { role: "assistant", content: "您好，有什么可以帮您？" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.summary).toBe("空会话");
    });
  });

  describe("意图提取", () => {
    it("应该提取搜索意图", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "帮我搜索关于 AI 的文章" },
        { role: "assistant", content: "找到了" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents).toContain("搜索内容");
    });

    it("应该提取整理意图", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "帮我整理一下收藏夹" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents).toContain("整理收藏");
    });

    it("应该提取标签管理意图", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "给这些书签打上技术标签" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents).toContain("标签管理");
    });

    it("应该提取导出意图", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "导出我的收藏为 CSV" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents).toContain("数据导出");
    });

    it("应该提取删除意图", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "删除过期的书签" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents).toContain("删除操作");
    });

    it("应该提取多个意图", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "搜索技术文章然后整理到文件夹" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents).toContain("搜索内容");
      expect(summary.key_intents).toContain("整理收藏");
    });

    it("应该限制意图数量最多5个", () => {
      const messages: SessionMessage[] = [
        {
          role: "user",
          content:
            "搜索文章然后整理分类打标签导出备份删除旧的统计分析移动文件创建新的",
        },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_intents.length).toBeLessThanOrEqual(5);
    });
  });

  describe("操作提取", () => {
    it("应该提取搜索操作", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "搜索文章" },
        { role: "assistant", content: "找到了 15 条搜索结果" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_actions).toContain("搜索");
    });

    it("应该提取添加标签操作", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "打标签" },
        { role: "assistant", content: "已添加标签" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_actions).toContain("添加标签");
    });

    it("应该提取移动操作", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "移动文件" },
        { role: "assistant", content: "已移动到技术文件夹" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_actions).toContain("移动");
    });

    it("应该提取删除操作", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "删除" },
        { role: "assistant", content: "已删除 5 条书签" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_actions).toContain("删除");
    });

    it("应该提取导出操作", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "导出" },
        { role: "assistant", content: "导出完成，共 100 条" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_actions).toContain("导出");
    });

    it("应该提取统计操作", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "统计" },
        { role: "assistant", content: "您共有 500 条收藏" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.key_actions).toContain("统计");
    });
  });

  describe("返回结构", () => {
    it("应该返回完整的摘要结构", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "测试消息" },
        { role: "assistant", content: "收到" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary).toHaveProperty("summary");
      expect(summary).toHaveProperty("key_intents");
      expect(summary).toHaveProperty("key_actions");
      expect(summary).toHaveProperty("user_feedback");
      expect(summary).toHaveProperty("pending_tasks");
      expect(summary).toHaveProperty("learned_preferences");
    });

    it("应该默认返回 neutral 反馈", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "测试" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.user_feedback).toBe("neutral");
    });

    it("应该返回空的 pending_tasks", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "测试" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.pending_tasks).toEqual([]);
    });

    it("应该返回 undefined 的 learned_preferences", () => {
      const messages: SessionMessage[] = [
        { role: "user", content: "测试" },
        { role: "assistant", content: "好的" },
      ];

      const summary = generateSimpleSummary(messages);

      expect(summary.learned_preferences).toBeUndefined();
    });
  });
});

// =============================================================================
// 边界条件测试
// =============================================================================

describe("边界条件", () => {
  it("应该处理只有一条用户消息", () => {
    const messages: SessionMessage[] = [{ role: "user", content: "你好" }];

    const summary = generateSimpleSummary(messages);

    expect(summary.summary).toBe("你好");
  });

  it("应该处理空内容消息", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "" },
      { role: "assistant", content: "" },
    ];

    const summary = generateSimpleSummary(messages);

    // 空内容时应该返回空会话
    expect(summary.summary).toBeTruthy();
  });

  it("应该处理特殊字符", () => {
    const messages: SessionMessage[] = [
      { role: "user", content: "搜索 <script>alert('xss')</script>" },
      { role: "assistant", content: "找到了" },
    ];

    const summary = generateSimpleSummary(messages);

    expect(summary.summary).toContain("<script>");
  });

  it("应该处理非常长的对话", () => {
    const messages: SessionMessage[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({ role: "user", content: `用户消息 ${i}` });
      messages.push({ role: "assistant", content: `助手回复 ${i}` });
    }

    const summary = generateSimpleSummary(messages);

    expect(summary).toBeDefined();
    expect(summary.summary).toBe("用户消息 99");
  });
});
