/**
 * QueryParser 单元测试
 */

import { QueryParser, parseQuery, createQueryParser } from "../query-parser";

describe("QueryParser", () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe("基本解析", () => {
    it("应该处理空查询", () => {
      const result = parser.parse("");
      expect(result.original).toBe("");
      expect(result.keywords).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.searchIntent).toBe("browse");
    });

    it("应该处理简单查询", () => {
      const result = parser.parse("人工智能");
      expect(result.original).toBe("人工智能");
      expect(result.keywords).toContain("人工智能");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该保留原始查询", () => {
      const result = parser.parse("  查找 AI 相关文章  ");
      expect(result.original).toBe("查找 AI 相关文章");
    });
  });

  describe("关键词提取", () => {
    it("应该过滤停用词", () => {
      const result = parser.parse("帮我找一下关于 AI 的文章");
      expect(result.keywords).not.toContain("帮");
      expect(result.keywords).not.toContain("我");
      expect(result.keywords).not.toContain("找");
      expect(result.keywords).not.toContain("一下");
      expect(result.keywords).not.toContain("的");
      expect(result.keywords).toContain("AI");
      expect(result.keywords).toContain("文章");
    });

    it("应该提取多个关键词", () => {
      const result = parser.parse("深度学习 神经网络 教程");
      expect(result.keywords).toContain("深度学习");
      expect(result.keywords).toContain("神经网络");
      expect(result.keywords).toContain("教程");
    });

    it("应该处理中英文混合", () => {
      const result = parser.parse("React组件开发");
      expect(result.keywords).toContain("React");
      expect(result.keywords).toContain("组件开发");
    });

    it("应该去重关键词", () => {
      const result = parser.parse("AI AI 人工智能");
      const aiCount = result.keywords.filter((k) => k === "AI").length;
      expect(aiCount).toBe(1);
    });

    it("应该过滤过短的词", () => {
      const result = parser.parse("的 a b 了 AI");
      expect(result.keywords).not.toContain("的");
      expect(result.keywords).not.toContain("a");
      expect(result.keywords).not.toContain("b");
      expect(result.keywords).not.toContain("了");
      expect(result.keywords).toContain("AI");
    });
  });

  describe("时间范围解析", () => {
    it("应该解析「今天」", () => {
      const result = parser.parse("今天收藏的文章");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toBe("今天");

      const today = new Date();
      expect(result.timeRange?.start.getDate()).toBe(today.getDate());
    });

    it("应该解析「昨天」", () => {
      const result = parser.parse("昨天的内容");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toBe("昨天");
    });

    it("应该解析「最近N天」", () => {
      const result = parser.parse("最近3天的收藏");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toBe("最近3天");

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      expect(result.timeRange?.start.getDate()).toBe(threeDaysAgo.getDate());
    });

    it("应该解析「上周」", () => {
      const result = parser.parse("上周看的文章");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toBe("上周");
    });

    it("应该解析「本月」", () => {
      const result = parser.parse("本月收藏");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toMatch(/本月|这个月/);
    });

    it("应该解析「上个月」", () => {
      const result = parser.parse("上个月的内容");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toMatch(/上个月|上月/);
    });

    it("应该解析「今年」", () => {
      const result = parser.parse("今年的学习笔记");
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.original).toBe("今年");
    });

    it("应该移除时间表达式后继续解析", () => {
      const result = parser.parse("最近7天 AI 文章");
      expect(result.timeRange).toBeDefined();
      expect(result.keywords).toContain("AI");
      expect(result.keywords).toContain("文章");
    });
  });

  describe("平台识别", () => {
    it("应该识别微信", () => {
      const result = parser.parse("微信的文章");
      expect(result.platform).toBe("wechat");
    });

    it("应该识别B站", () => {
      const result = parser.parse("b站的视频");
      expect(result.platform).toBe("bilibili");
    });

    it("应该识别小红书", () => {
      const result = parser.parse("小红书的笔记");
      expect(result.platform).toBe("xiaohongshu");
    });

    it("应该识别知乎", () => {
      const result = parser.parse("知乎的回答");
      expect(result.platform).toBe("zhihu");
    });

    it("应该识别掘金", () => {
      const result = parser.parse("掘金的技术文章");
      expect(result.platform).toBe("juejin");
    });

    it("应该识别 CSDN", () => {
      const result = parser.parse("csdn 博客");
      expect(result.platform).toBe("csdn");
    });

    it("应该识别浏览器书签", () => {
      const result = parser.parse("浏览器书签");
      expect(result.platform).toBe("browser");
    });

    it("应该移除平台关键词后继续解析", () => {
      const result = parser.parse("微信的 AI 教程");
      expect(result.platform).toBe("wechat");
      expect(result.keywords).toContain("AI");
      expect(result.keywords).toContain("教程");
    });
  });

  describe("模糊程度判断", () => {
    it("引号包围应为精确匹配", () => {
      const result = parser.parse('找"深度学习入门"');
      expect(result.fuzzyLevel).toBe("exact");
    });

    it("中文引号应为精确匹配", () => {
      const result = parser.parse("找「深度学习入门」");
      expect(result.fuzzyLevel).toBe("exact");
    });

    it("长关键词应为短语匹配", () => {
      const result = parser.parse("深度学习入门教程");
      expect(result.fuzzyLevel).toBe("phrase");
    });

    it("多个关键词应为短语匹配", () => {
      const result = parser.parse("React Vue Angular");
      expect(result.fuzzyLevel).toBe("phrase");
    });

    it("模糊表达应为模糊匹配", () => {
      const result = parser.parse("好像有篇关于 AI 的文章");
      expect(result.fuzzyLevel).toBe("fuzzy");
    });

    it("类似表达应为模糊匹配", () => {
      const result = parser.parse("类似深度学习的内容");
      expect(result.fuzzyLevel).toBe("fuzzy");
    });
  });

  describe("搜索意图识别", () => {
    it("应该识别找特定内容意图", () => {
      const result = parser.parse("那篇讲 AI 的文章");
      expect(result.searchIntent).toBe("find_specific");
    });

    it("应该识别浏览类意图", () => {
      const result = parser.parse("看看有什么新文章");
      expect(result.searchIntent).toBe("browse");
    });

    it("应该识别过滤类意图", () => {
      const result = parser.parse("微信的文章");
      expect(result.searchIntent).toBe("filter");
    });

    it("应该识别回忆类意图", () => {
      const result = parser.parse("之前收藏的那篇");
      expect(result.searchIntent).toBe("recall");
    });
  });

  describe("指代词检测", () => {
    it("应该检测「这个」", () => {
      const result = parser.parse("这个文章");
      expect(result.hasReference).toBe(true);
    });

    it("应该检测「那个」", () => {
      const result = parser.parse("那个链接");
      expect(result.hasReference).toBe(true);
    });

    it("应该检测「刚才」", () => {
      const result = parser.parse("刚才看的");
      expect(result.hasReference).toBe(true);
    });

    it("无指代词时应为 false", () => {
      const result = parser.parse("人工智能教程");
      expect(result.hasReference).toBe(false);
    });
  });

  describe("置信度计算", () => {
    it("空查询置信度应为 0", () => {
      const result = parser.parse("");
      expect(result.confidence).toBe(0);
    });

    it("有关键词应提高置信度", () => {
      const result = parser.parse("人工智能");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("有时间范围应提高置信度", () => {
      const withTime = parser.parse("今天的 AI 文章");
      const withoutTime = parser.parse("AI 文章");
      expect(withTime.confidence).toBeGreaterThan(withoutTime.confidence);
    });

    it("有平台应提高置信度", () => {
      const withPlatform = parser.parse("微信的 AI 文章");
      const withoutPlatform = parser.parse("AI 文章");
      expect(withPlatform.confidence).toBeGreaterThan(
        withoutPlatform.confidence,
      );
    });

    it("置信度不应超过 1", () => {
      const result = parser.parse("今天 微信 AI 深度学习 神经网络 教程");
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("配置选项", () => {
    it("应该支持禁用时间解析", () => {
      const parser = new QueryParser({ enableTimeParser: false });
      const result = parser.parse("今天的文章");
      expect(result.timeRange).toBeUndefined();
      expect(result.keywords).toContain("今天");
    });

    it("应该支持禁用平台解析", () => {
      const parser = new QueryParser({ enablePlatformParser: false });
      const result = parser.parse("微信的文章");
      expect(result.platform).toBeUndefined();
      expect(result.keywords).toContain("微信");
    });

    it("应该支持自定义停用词", () => {
      const parser = new QueryParser({ customStopWords: ["测试"] });
      const result = parser.parse("测试 AI 文章");
      expect(result.keywords).not.toContain("测试");
      expect(result.keywords).toContain("AI");
    });

    it("应该支持默认模糊级别", () => {
      const parser = new QueryParser({ defaultFuzzyLevel: "exact" });
      const result = parser.parse("AI");
      expect(result.fuzzyLevel).toBe("exact");
    });
  });

  describe("工厂函数和便捷方法", () => {
    it("createQueryParser 应创建实例", () => {
      const parser = createQueryParser({ enableTimeParser: false });
      const result = parser.parse("今天");
      expect(result.timeRange).toBeUndefined();
    });

    it("parseQuery 应使用默认配置", () => {
      const result = parseQuery("今天的 AI 文章");
      expect(result.timeRange).toBeDefined();
      expect(result.keywords).toContain("AI");
    });
  });

  describe("复杂场景", () => {
    it("应该处理复合查询", () => {
      const result = parser.parse("最近7天微信的深度学习教程");
      expect(result.timeRange?.original).toBe("最近7天");
      expect(result.platform).toBe("wechat");
      // 注意：基础分词器会将连续中文保持为一个词
      expect(result.keywords).toContain("深度学习教程");
    });

    it("应该处理长查询", () => {
      const result = parser.parse(
        "帮我找一下上周收藏的那篇关于 React 状态管理的文章",
      );
      expect(result.timeRange?.original).toBe("上周");
      expect(result.keywords).toContain("React");
      // "状态管理" 和 "文章" 会被提取为关键词
      expect(result.keywords.length).toBeGreaterThan(0);
      // "那篇" 指示用户在找特定内容
      expect(result.searchIntent).toBe("find_specific");
    });

    it("应该处理英文查询", () => {
      const result = parser.parse("TypeScript tutorial");
      expect(result.keywords).toContain("TypeScript");
      expect(result.keywords).toContain("tutorial");
    });

    it("应该处理特殊字符", () => {
      const result = parser.parse("C++, Java, Python!");
      expect(result.keywords.length).toBeGreaterThan(0);
    });
  });
});
