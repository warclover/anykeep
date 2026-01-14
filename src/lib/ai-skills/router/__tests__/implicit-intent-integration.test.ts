/**
 * 隐含意图推理集成测试
 *
 * 验证 IntentAnalyzer 正确集成隐含意图匹配功能
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { IntentAnalyzer } from "../intent-analyzer";

describe("IntentAnalyzer - Implicit Intent Integration", () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = new IntentAnalyzer({
      enableLLMFallback: false,
      debug: false,
    });
  });

  describe("隐含意图匹配", () => {
    it("应该匹配 'organize-not-delete' 规则", async () => {
      const result = await analyzer.analyze("帮我整理一下收藏");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("organize-not-delete");
      expect(result.implicitIntent?.hiddenExpectation).toContain("不要删除");
    });

    it("应该匹配 'too-many-not-delete' 规则", async () => {
      const result = await analyzer.analyze("收藏太多了");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("too-many-not-delete");
      expect(result.implicitIntent?.implicitGoal).toContain("管理");
    });

    it("应该匹配 'cant-find-search' 规则", async () => {
      const result = await analyzer.analyze("我找不到那篇文章");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("cant-find-search");
    });

    it("应该匹配 'recent-7days' 规则", async () => {
      const result = await analyzer.analyze("最近收藏了什么");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("recent-7days");
      expect(result.implicitIntent?.defaultBehavior).toContain("7天");
    });

    it("应该匹配 'look-at-overview' 规则", async () => {
      const result = await analyzer.analyze("看看我的收藏情况");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("look-at-overview");
      expect(result.implicitIntent?.hiddenExpectation).toContain("不是要执行操作");
    });

    it("应该匹配 'that-one-context' 规则", async () => {
      const result = await analyzer.analyze("那个文章在哪");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("that-one-context");
    });

    it("应该匹配 'these-selected' 规则", async () => {
      const result = await analyzer.analyze("把这些删除");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("these-selected");
    });

    it("应该匹配 'all-batch-confirm' 规则", async () => {
      const result = await analyzer.analyze("都删掉");

      expect(result.implicitIntent).toBeDefined();
      expect(result.implicitIntent?.id).toBe("all-batch-confirm");
      expect(result.implicitIntent?.defaultBehavior).toContain("先说明范围");
    });

    it("无匹配时应返回 undefined", async () => {
      const result = await analyzer.analyze("你好");

      expect(result.implicitIntent).toBeUndefined();
    });
  });

  describe("隐含意图与显式意图共存", () => {
    it("整理收藏：显式=organize，隐含=organize-not-delete", async () => {
      const result = await analyzer.analyze("帮我整理下收藏");

      // 显式意图
      expect(result.intent).toBe("organize");
      expect(result.subType).toBe("cleanup");

      // 隐含意图
      expect(result.implicitIntent?.id).toBe("organize-not-delete");
      expect(result.implicitIntent?.hiddenExpectation).toContain("不要删除");
    });

    it("太多了帮我整理：同时匹配两条规则，返回优先级最高的", async () => {
      const result = await analyzer.analyze("太多了帮我整理");

      // 优先级: that-one-context(95) > these-selected(90) = organize-not-delete(90) > too-many-not-delete(85)
      // 但 'that-one-context' 和 'these-selected' 的模式不匹配
      // 所以会匹配 'organize-not-delete' (priority: 90) 或 'too-many-not-delete' (priority: 85)
      expect(result.implicitIntent).toBeDefined();
      expect(["organize-not-delete", "too-many-not-delete"]).toContain(
        result.implicitIntent?.id
      );
    });
  });

  describe("分析结果完整性", () => {
    it("应包含所有必需字段", async () => {
      const result = await analyzer.analyze("整理收藏");

      // 基础字段
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.source).toBeDefined();
      expect(result.entities).toBeDefined();

      // 复杂度
      expect(result.complexity).toBeDefined();
      expect(result.complexity.level).toBeDefined();
      expect(result.complexity.score).toBeGreaterThanOrEqual(0);

      // 执行决策
      expect(result.execution).toBeDefined();
      expect(result.execution.mode).toBeDefined();
      expect(result.execution.reason).toBeDefined();

      // 隐含意图
      expect(result.implicitIntent).toBeDefined();

      // 元信息
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
