/**
 * IntentAnalyzer 单元测试
 *
 * 测试覆盖：
 * - 意图分类 (7 种意图类型)
 * - 复杂度评估 (simple/medium/complex)
 * - 模式选择 (atomic/orchestration)
 * - 实体提取 (time/quantity/topic/platform/folder)
 * - 消歧规则 (高优先级规则验证)
 *
 * @version 1.0.0
 * @since 2026-01-05
 */

import type { AnalysisResult as _AnalysisResult } from "../intent-analyzer";
import {
  IntentAnalyzer,
  createIntentAnalyzer,
  intentAnalyzer,
  // 向后兼容导出
  IntentClassifier,
  createIntentClassifier,
  intentClassifier,
} from "../intent-analyzer";

describe("IntentAnalyzer", () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = createIntentAnalyzer();
  });

  // ============================================
  // 1. 意图分类测试
  // ============================================

  describe("意图分类 (Intent Classification)", () => {
    describe("query 意图", () => {
      it("应正确分类数量查询", async () => {
        const result = await analyzer.analyze("我有多少收藏");

        expect(result.intent).toBe("query");
        expect(result.subType).toBe("count");
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.source).toBe("rule");
      });

      it("应正确分类列表查询", async () => {
        const result = await analyzer.analyze("列出最近的收藏");

        expect(result.intent).toBe("query");
        expect(result.subType).toBe("list");
      });

      it("应正确分类搜索查询", async () => {
        const result = await analyzer.analyze("搜索关于 React 的内容");

        expect(result.intent).toBe("query");
        expect(result.subType).toBe("search");
      });

      it("应正确分类解释查询", async () => {
        const result = await analyzer.analyze("什么是React");

        expect(result.intent).toBe("query");
        expect(result.subType).toBe("explain");
      });

      it("应正确分类掌握度统计查询", async () => {
        const result = await analyzer.analyze("我掌握了多少");

        expect(result.intent).toBe("query");
        expect(result.subType).toBe("mastery_stats");
      });

      it("应正确分类帮助查询", async () => {
        const result = await analyzer.analyze("帮助");

        expect(result.intent).toBe("chitchat");
        expect(result.subType).toBe("help");
      });
    });

    describe("action 意图", () => {
      it("应正确分类移动操作", async () => {
        const result = await analyzer.analyze("把这些移动到学习文件夹");

        expect(result.intent).toBe("action");
        expect(result.subType).toBe("move");
      });

      it("应正确分类删除操作", async () => {
        const result = await analyzer.analyze("删除这个书签");

        expect(result.intent).toBe("action");
        expect(result.subType).toBe("delete");
      });

      it("应正确分类标签操作", async () => {
        const result = await analyzer.analyze("给这些添加标签");

        expect(result.intent).toBe("action");
        expect(result.subType).toBe("tag");
      });

      it("应正确分类保存操作", async () => {
        const result = await analyzer.analyze("收藏一下这个链接");

        expect(result.intent).toBe("action");
        expect(result.subType).toBe("save");
      });
    });

    describe("organize 意图", () => {
      it("应正确分类整理操作", async () => {
        const result = await analyzer.analyze("整理书签");

        expect(result.intent).toBe("organize");
        expect(result.subType).toBe("cleanup");
        expect(result.requiresMultiStep).toBe(true);
      });

      it("应正确分类分类操作", async () => {
        const result = await analyzer.analyze("自动分类所有未归类的");

        expect(result.intent).toBe("organize");
        expect(result.subType).toBe("classify");
      });

      it("应正确分类去重操作", async () => {
        const result = await analyzer.analyze("去重");

        expect(result.intent).toBe("organize");
        expect(result.subType).toBe("dedupe");
      });

      it("应正确分类过期清理", async () => {
        const result = await analyzer.analyze("处理失效链接");

        expect(result.intent).toBe("organize");
        expect(result.subType).toBe("expire");
      });
    });

    describe("learn 意图", () => {
      it("应正确分类复习请求", async () => {
        const result = await analyzer.analyze("复习这些内容");

        expect(result.intent).toBe("learn");
        expect(result.subType).toBe("review");
      });

      it("应正确分类主动复习启动", async () => {
        const result = await analyzer.analyze("开始今日复习");

        expect(result.intent).toBe("learn");
        expect(result.subType).toBe("active_recall_start");
      });

      it("应正确分类面试准备", async () => {
        const result = await analyzer.analyze("准备前端面试");

        expect(result.intent).toBe("learn");
        expect(result.subType).toBe("interview");
      });

      it("应正确分类学习路径规划", async () => {
        const result = await analyzer.analyze("制定学习路径");

        expect(result.intent).toBe("learn");
        expect(result.subType).toBe("path");
      });
    });

    describe("create 意图", () => {
      it("应正确分类摘要生成", async () => {
        const result = await analyzer.analyze("生成这些内容的摘要");

        expect(result.intent).toBe("create");
        expect(result.subType).toBe("digest");
      });

      it("应正确分类报告生成", async () => {
        const result = await analyzer.analyze("生成阅读报告");

        expect(result.intent).toBe("create");
        expect(["report", "digest"]).toContain(result.subType);
      });

      it("应正确分类分享导出操作", async () => {
        const result = await analyzer.analyze("导出为 Markdown");

        expect(result.intent).toBe("create");
        expect(result.subType).toBe("share");
      });

      it("应正确分类主题合成", async () => {
        const result = await analyzer.analyze("关于AI的综述");

        expect(result.intent).toBe("create");
        expect(result.subType).toBe("synthesis_topic");
      });
    });

    describe("analyze 意图", () => {
      it("应正确分类洞察分析", async () => {
        const result = await analyzer.analyze("分析趋势");

        expect(result.intent).toBe("analyze");
        expect(result.subType).toBe("insight");
      });

      it("应正确分类周报生成", async () => {
        const result = await analyzer.analyze("查看我的周报");

        expect(result.intent).toBe("analyze");
        expect(result.subType).toBe("report");
      });
    });

    describe("chitchat 意图", () => {
      it("应正确分类问候", async () => {
        const result = await analyzer.analyze("你好");

        expect(result.intent).toBe("chitchat");
        expect(result.subType).toBe("greeting");
      });

      it("应正确分类感谢", async () => {
        const result = await analyzer.analyze("谢谢你");

        expect(result.intent).toBe("chitchat");
        expect(result.subType).toBe("thanks");
      });
    });
  });

  // ============================================
  // 2. 复杂度评估测试
  // ============================================

  describe("复杂度评估 (Complexity Evaluation)", () => {
    it("数量查询应为 simple 复杂度", async () => {
      const result = await analyzer.analyze("我有多少收藏");

      expect(result.complexity.level).toBe("simple");
      expect(result.complexity.score).toBeLessThan(35);
    });

    it("搜索查询应为 simple 复杂度", async () => {
      const result = await analyzer.analyze("搜索 React 相关");

      expect(result.complexity.level).toBe("simple");
    });

    it("整理操作应为 medium 或 complex 复杂度", async () => {
      const result = await analyzer.analyze("整理所有未分类的书签");

      expect(["medium", "complex"]).toContain(result.complexity.level);
    });

    it("复习操作应为 complex 复杂度", async () => {
      const result = await analyzer.analyze("开始复习这些内容");

      expect(result.complexity.level).toBe("complex");
    });

    it("复杂度因子应包含正确的权重", async () => {
      const result = await analyzer.analyze("整理书签");

      expect(result.complexity.factors.length).toBeGreaterThan(0);
      result.complexity.factors.forEach((factor) => {
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
        expect(factor.name).toBeDefined();
        expect(factor.reason).toBeDefined();
      });
    });

    it("带上下文的复杂度评估应考虑数据规模", async () => {
      const result = await analyzer.analyze("整理书签", {
        totalBookmarks: 1000,
      });

      const hasDataScaleFactor = result.complexity.factors.some(
        (f) => f.name === "data_scale",
      );
      expect(hasDataScaleFactor).toBe(true);
    });
  });

  // ============================================
  // 3. 模式选择测试
  // ============================================

  describe("模式选择 (Mode Selection)", () => {
    it("简单查询应选择 atomic 模式", async () => {
      const result = await analyzer.analyze("我有多少收藏");

      expect(result.execution.mode).toBe("atomic");
      expect(result.execution.reason).toBeDefined();
    });

    it("整理操作应选择 orchestration 模式", async () => {
      const result = await analyzer.analyze("整理所有书签");

      expect(result.execution.mode).toBe("orchestration");
      expect(result.execution.suggestedSkill).toBeDefined();
    });

    it("复习操作应选择 orchestration 模式并建议 active_recall", async () => {
      const result = await analyzer.analyze("开始今日复习");

      expect(result.execution.mode).toBe("orchestration");
      expect(result.execution.suggestedSkill).toBe("active_recall");
    });

    it("分享操作应选择正确的模式", async () => {
      const result = await analyzer.analyze("导出为 Markdown 格式");

      expect(result.execution.mode).toBeDefined();
      expect(result.execution.suggestedSkill).toBeDefined();
    });

    it("去重操作应选择 orchestration 模式并建议 duplicate_cleanup", async () => {
      const result = await analyzer.analyze("去除重复书签");

      expect(result.execution.mode).toBe("orchestration");
      expect(result.execution.suggestedSkill).toBe("duplicate_cleanup");
    });

    it("forceAtomicMode 配置应强制使用 atomic 模式", async () => {
      const forcedAnalyzer = createIntentAnalyzer({ forceAtomicMode: true });
      const result = await forcedAnalyzer.analyze("整理所有书签");

      expect(result.execution.mode).toBe("atomic");
    });
  });

  // ============================================
  // 4. 实体提取测试
  // ============================================

  describe("实体提取 (Entity Extraction)", () => {
    it("应提取时间实体 - 今天", async () => {
      const result = await analyzer.analyze("今天收藏的内容");

      const timeEntity = result.entities.find((e) => e.type === "time");
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.value).toContain("今");
    });

    it("应提取时间实体 - 最近N天", async () => {
      const result = await analyzer.analyze("最近7天的收藏");

      const timeEntity = result.entities.find((e) => e.type === "time");
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.value).toContain("7");
    });

    it("应提取数量实体", async () => {
      const result = await analyzer.analyze("显示前10条收藏");

      const quantityEntity = result.entities.find((e) => e.type === "quantity");
      expect(quantityEntity).toBeDefined();
      expect(quantityEntity?.value).toBe("10");
    });

    it("应提取主题实体", async () => {
      const result = await analyzer.analyze("关于React的内容");

      const topicEntity = result.entities.find((e) => e.type === "topic");
      expect(topicEntity).toBeDefined();
      expect(topicEntity?.value).toContain("React");
    });

    it("应提取平台实体", async () => {
      const result = await analyzer.analyze("搜索B站的视频");

      const platformEntity = result.entities.find((e) => e.type === "platform");
      expect(platformEntity).toBeDefined();
    });

    it("应提取文件夹实体 - 方括号", async () => {
      const result = await analyzer.analyze("移动到[学习资料]文件夹");

      const folderEntity = result.entities.find((e) => e.type === "folder");
      expect(folderEntity).toBeDefined();
      expect(folderEntity?.value).toBe("学习资料");
    });

    it("禁用实体提取时不应提取", async () => {
      const noEntityAnalyzer = createIntentAnalyzer({
        enableEntityExtraction: false,
      });
      const result = await noEntityAnalyzer.analyze("今天收藏的内容");

      expect(result.entities.length).toBe(0);
    });
  });

  // ============================================
  // 5. 消歧规则测试
  // ============================================

  describe("消歧规则 (Disambiguation Rules)", () => {
    it("动词+宾语结构应优先匹配 create", async () => {
      // "梳理内容做总结" 应该匹配 create:digest 而非 organize:cleanup
      const result = await analyzer.analyze("梳理内容做总结");

      expect(result.intent).toBe("create");
      expect(result.subType).toBe("digest");
    });

    it("整理为主时应匹配 organize", async () => {
      // "整理完" 主动词是整理
      const result = await analyzer.analyze("整理完再说");

      expect(result.intent).toBe("organize");
    });

    it("明确的创建类动词应匹配 create", async () => {
      const result = await analyzer.analyze("帮我生成一份摘要");

      expect(result.intent).toBe("create");
      expect(result.subType).toBe("digest");
    });

    it("高权重规则应优先于低权重规则", async () => {
      // 获取规则列表验证排序
      const rules = analyzer.getRules();
      for (let i = 1; i < rules.length; i++) {
        const prevWeight = rules[i - 1].weight || 0;
        const currWeight = rules[i].weight || 0;
        expect(prevWeight).toBeGreaterThanOrEqual(currWeight);
      }
    });
  });

  // ============================================
  // 6. 边界条件测试
  // ============================================

  describe("边界条件 (Edge Cases)", () => {
    it("空消息应返回默认结果", async () => {
      const result = await analyzer.analyze("");

      // 空消息应有有效的意图和置信度
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it("单字符消息应正常处理", async () => {
      const result = await analyzer.analyze("?");

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
    });

    it("超长消息应正常处理", async () => {
      const longMessage = "搜索".repeat(100);
      const result = await analyzer.analyze(longMessage);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
    });

    it("特殊字符应正常处理", async () => {
      const result = await analyzer.analyze("搜索<script>alert(1)</script>");

      expect(result).toBeDefined();
      expect(result.intent).toBe("query");
    });

    it("结果应包含 durationMs", async () => {
      const result = await analyzer.analyze("搜索");

      expect(result.durationMs).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // 7. 配置测试
  // ============================================

  describe("配置选项 (Configuration)", () => {
    it("应使用自定义阈值", () => {
      const customAnalyzer = createIntentAnalyzer({
        simpleThreshold: 20,
        complexThreshold: 50,
      });

      expect(customAnalyzer).toBeDefined();
    });

    it("debug 模式应启用详细日志", () => {
      const debugAnalyzer = createIntentAnalyzer({ debug: true });

      expect(debugAnalyzer).toBeDefined();
    });

    it("addRule 应添加自定义规则", async () => {
      const customAnalyzer = createIntentAnalyzer();
      customAnalyzer.addRule({
        pattern: /我的自定义规则/,
        type: "query",
        subType: "custom",
        complexity: "simple",
        weight: 200, // 最高优先级
      });

      const result = await customAnalyzer.analyze("我的自定义规则测试");

      expect(result.intent).toBe("query");
      expect(result.subType).toBe("custom");
    });
  });

  // ============================================
  // 8. 向后兼容测试
  // ============================================

  describe("向后兼容 (Backward Compatibility)", () => {
    it("IntentClassifier 应是 IntentAnalyzer 的别名", () => {
      expect(IntentClassifier).toBe(IntentAnalyzer);
    });

    it("createIntentClassifier 应是 createIntentAnalyzer 的别名", () => {
      expect(createIntentClassifier).toBe(createIntentAnalyzer);
    });

    it("intentClassifier 应是 intentAnalyzer 的别名", () => {
      expect(intentClassifier).toBe(intentAnalyzer);
    });

    it("使用别名创建的实例应正常工作", async () => {
      const classifier = createIntentClassifier();
      const result = await classifier.analyze("搜索 React");

      expect(result.intent).toBe("query");
      expect(result.subType).toBe("search");
    });
  });

  // ============================================
  // 9. 默认实例测试
  // ============================================

  describe("默认实例 (Default Instance)", () => {
    it("默认实例应存在", () => {
      expect(intentAnalyzer).toBeDefined();
      expect(intentAnalyzer).toBeInstanceOf(IntentAnalyzer);
    });

    it("默认实例应正常工作", async () => {
      const result = await intentAnalyzer.analyze("搜索内容");

      expect(result).toBeDefined();
      expect(result.intent).toBe("query");
    });
  });

  // ============================================
  // 10. 性能测试
  // ============================================

  describe("性能 (Performance)", () => {
    it("分析应在 100ms 内完成（无 LLM）", async () => {
      const start = performance.now();
      await analyzer.analyze("搜索 React 相关内容");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("批量分析应保持稳定性能", async () => {
      const messages = [
        "搜索 React",
        "删除这个",
        "整理书签",
        "我有多少收藏",
        "开始复习",
      ];

      const start = performance.now();
      for (const msg of messages) {
        await analyzer.analyze(msg);
      }
      const duration = performance.now() - start;

      // 5 条消息应在 500ms 内完成
      expect(duration).toBeLessThan(500);
    });
  });
});
