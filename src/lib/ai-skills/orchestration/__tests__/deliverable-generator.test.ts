/**
 * DeliverableGenerator 单元测试
 *
 * @description 测试交付物生成器的核心功能
 */

import {
  DeliverableGenerator,
  createDeliverableGenerator,
  deliverableGenerator,
  type ReportData,
  type ListData,
  type CardData,
} from "../deliverable-generator";

describe("DeliverableGenerator", () => {
  let generator: DeliverableGenerator;

  beforeEach(() => {
    generator = new DeliverableGenerator();
  });

  describe("constructor", () => {
    it("使用默认配置初始化", () => {
      const instance = new DeliverableGenerator();
      // Verify through generated deliverable
      const report = instance.generateReport({
        title: "Test",
        sections: [],
        generatedAt: new Date(),
      });
      expect(report.format).toBe("markdown"); // default format
      expect(report.downloadable).toBe(true);
      expect(report.shareable).toBe(true);
    });

    it("接受自定义配置", () => {
      const instance = new DeliverableGenerator({
        defaultFormat: "json",
        defaultDownloadable: false,
        defaultShareable: false,
      });
      const report = instance.generateReport({
        title: "Test",
        sections: [],
        generatedAt: new Date(),
      });
      expect(report.format).toBe("json");
      expect(report.downloadable).toBe(false);
      expect(report.shareable).toBe(false);
    });
  });

  describe("generateReport", () => {
    const baseReportData: ReportData = {
      title: "周报",
      summary: "本周收藏了 50 条内容",
      sections: [
        { title: "概述", content: "本周活跃度较高" },
        { title: "亮点", content: "发现 3 篇优质文章" },
      ],
      stats: {
        总收藏: 50,
        新增: 10,
        整理: 5,
      },
      generatedAt: new Date("2025-12-25T10:00:00Z"),
    };

    it("生成 Markdown 格式报告", () => {
      const report = generator.generateReport(baseReportData);

      expect(report.type).toBe("report");
      expect(report.title).toBe("周报");
      expect(report.format).toBe("markdown");
      expect(report.id).toMatch(/^report-\d+-\d+$/);
      expect(report.downloadable).toBe(true);
      expect(report.shareable).toBe(true);
      expect(report.metadata?.sectionsCount).toBe(2);
      expect(report.metadata?.stats).toEqual(baseReportData.stats);

      // Check Markdown content
      const content = report.content as string;
      expect(content).toContain("# 周报");
      expect(content).toContain("> 本周收藏了 50 条内容");
      expect(content).toContain("## 概览");
      expect(content).toContain("**总收藏**: 50");
      expect(content).toContain("## 概述");
      expect(content).toContain("## 亮点");
    });

    it("生成 HTML 格式报告", () => {
      const report = generator.generateReport(baseReportData, {
        format: "html",
      });

      expect(report.format).toBe("html");
      const content = report.content as string;
      expect(content).toContain('<article class="report">');
      expect(content).toContain("<h1>周报</h1>");
      expect(content).toContain("<blockquote>");
      expect(content).toContain("<section>");
    });

    it("生成 JSON 格式报告", () => {
      const report = generator.generateReport(baseReportData, {
        format: "json",
      });

      expect(report.format).toBe("json");
      expect(report.content).toEqual(baseReportData);
    });

    it("处理无摘要的报告", () => {
      const data: ReportData = {
        title: "简单报告",
        sections: [{ title: "内容", content: "正文" }],
        generatedAt: new Date(),
      };

      const report = generator.generateReport(data);
      const content = report.content as string;

      expect(content).not.toContain(">");
      expect(content).toContain("# 简单报告");
    });

    it("处理无统计的报告", () => {
      const data: ReportData = {
        title: "无统计报告",
        sections: [{ title: "正文", content: "内容" }],
        generatedAt: new Date(),
      };

      const report = generator.generateReport(data);
      const content = report.content as string;

      expect(content).not.toContain("## 概览");
    });

    it("可覆盖 downloadable 和 shareable", () => {
      const report = generator.generateReport(baseReportData, {
        downloadable: false,
        shareable: false,
      });

      expect(report.downloadable).toBe(false);
      expect(report.shareable).toBe(false);
    });

    it("生成唯一 ID", () => {
      const report1 = generator.generateReport(baseReportData);
      const report2 = generator.generateReport(baseReportData);

      expect(report1.id).not.toBe(report2.id);
    });
  });

  describe("generateList", () => {
    const baseListData: ListData<string> = {
      title: "最近收藏",
      items: ["文章 1", "文章 2", "文章 3"],
      total: 100,
      pagination: {
        page: 1,
        pageSize: 3,
        totalPages: 34,
      },
    };

    it("生成 Markdown 格式列表", () => {
      const list = generator.generateList(baseListData);

      expect(list.type).toBe("list");
      expect(list.title).toBe("最近收藏");
      expect(list.format).toBe("markdown");
      expect(list.metadata?.itemsCount).toBe(3);
      expect(list.metadata?.total).toBe(100);
      expect(list.metadata?.pagination).toEqual(baseListData.pagination);

      const content = list.content as string;
      expect(content).toContain("# 最近收藏");
      expect(content).toContain("共 100 项");
      expect(content).toContain("1. 文章 1");
      expect(content).toContain("2. 文章 2");
      expect(content).toContain("3. 文章 3");
    });

    it("生成 HTML 格式列表", () => {
      const list = generator.generateList(baseListData, { format: "html" });

      expect(list.format).toBe("html");
      const content = list.content as string;
      expect(content).toContain('<div class="list">');
      expect(content).toContain("<h1>最近收藏</h1>");
      expect(content).toContain("<ol>");
      expect(content).toContain("<li>文章 1</li>");
    });

    it("生成 JSON 格式列表", () => {
      const list = generator.generateList(baseListData, { format: "json" });

      expect(list.format).toBe("json");
      expect(list.content).toEqual(baseListData);
    });

    it("使用自定义 itemFormatter", () => {
      interface BookmarkItem {
        id: number;
        title: string;
      }
      const data: ListData<BookmarkItem> = {
        title: "书签列表",
        items: [
          { id: 1, title: "React 教程" },
          { id: 2, title: "Vue 入门" },
        ],
        total: 2,
      };

      const list = generator.generateList(data, {
        itemFormatter: (item, _index) => `[${item.id}] ${item.title}`,
      });

      const content = list.content as string;
      expect(content).toContain("1. [1] React 教程");
      expect(content).toContain("2. [2] Vue 入门");
    });

    it("处理对象数组的默认格式化", () => {
      const data: ListData<{ name: string }> = {
        title: "对象列表",
        items: [{ name: "item1" }],
        total: 1,
      };

      const list = generator.generateList(data);
      const content = list.content as string;

      expect(content).toContain('{"name":"item1"}');
    });
  });

  describe("generateCards", () => {
    const cards: CardData[] = [
      {
        id: 1,
        title: "React 最佳实践",
        description: "学习 React 的核心概念",
        url: "https://example.com/react",
        tags: ["react", "frontend"],
        actions: [
          { label: "阅读", action: "open" },
          { label: "收藏", action: "save" },
        ],
      },
      {
        id: 2,
        title: "TypeScript 入门",
        description: "TypeScript 基础教程",
        content: "详细内容...",
        image: "https://example.com/ts.png",
        metadata: { views: 1000 },
      },
    ];

    it("生成卡片组交付物", () => {
      const result = generator.generateCards("精选内容", cards);

      expect(result.type).toBe("cards");
      expect(result.title).toBe("精选内容");
      expect(result.format).toBe("cards");
      expect(result.content).toEqual(cards);
      expect(result.metadata?.cardsCount).toBe(2);
      expect(result.downloadable).toBe(true);
      expect(result.shareable).toBe(true);
    });

    it("可覆盖 downloadable 和 shareable", () => {
      const result = generator.generateCards("卡片", cards, {
        downloadable: false,
        shareable: false,
      });

      expect(result.downloadable).toBe(false);
      expect(result.shareable).toBe(false);
    });

    it("处理空卡片数组", () => {
      const result = generator.generateCards("空卡片", []);

      expect(result.content).toEqual([]);
      expect(result.metadata?.cardsCount).toBe(0);
    });
  });

  describe("generateDocument", () => {
    it("生成 Markdown 文档", () => {
      const doc = generator.generateDocument(
        "学习笔记",
        "# 笔记\n\n## 重点\n\n- 点 1\n- 点 2",
      );

      expect(doc.type).toBe("document");
      expect(doc.title).toBe("学习笔记");
      expect(doc.format).toBe("markdown");
      expect(doc.content).toContain("# 笔记");
    });

    it("生成指定格式文档", () => {
      const doc = generator.generateDocument("HTML 文档", "<p>内容</p>", {
        format: "html",
      });

      expect(doc.format).toBe("html");
      expect(doc.content).toBe("<p>内容</p>");
    });

    it("包含自定义元数据", () => {
      const doc = generator.generateDocument("文档", "内容", {
        metadata: {
          author: "AI",
          version: "1.0",
          wordCount: 100,
        },
      });

      expect(doc.metadata?.author).toBe("AI");
      expect(doc.metadata?.version).toBe("1.0");
      expect(doc.metadata?.wordCount).toBe(100);
    });
  });

  describe("generateTable", () => {
    const headers = ["名称", "平台", "标签数"];
    const rows = [
      ["React 教程", "掘金", 5],
      ["Vue 入门", "微信", 3],
      ["TypeScript 手册", "GitHub", 10],
    ];

    it("生成 Markdown 表格", () => {
      const table = generator.generateTable("收藏统计", headers, rows);

      expect(table.type).toBe("table");
      expect(table.title).toBe("收藏统计");
      expect(table.format).toBe("markdown");
      expect(table.metadata?.columnsCount).toBe(3);
      expect(table.metadata?.rowsCount).toBe(3);

      const content = table.content as string;
      expect(content).toContain("| 名称 | 平台 | 标签数 |");
      expect(content).toContain("| --- | --- | --- |");
      expect(content).toContain("| React 教程 | 掘金 | 5 |");
    });

    it("生成 HTML 表格", () => {
      const table = generator.generateTable("表格", headers, rows, {
        format: "html",
      });

      const content = table.content as string;
      expect(content).toContain("<table>");
      expect(content).toContain("<thead>");
      expect(content).toContain("<th>名称</th>");
      expect(content).toContain("<tbody>");
      expect(content).toContain("<td>React 教程</td>");
    });

    it("生成 JSON 表格", () => {
      const table = generator.generateTable("表格", headers, rows, {
        format: "json",
      });

      expect(table.content).toEqual({ headers, rows });
    });

    it("处理空表格", () => {
      const table = generator.generateTable("空表格", ["列1", "列2"], []);

      expect(table.metadata?.rowsCount).toBe(0);
      expect(table.metadata?.columnsCount).toBe(2);
    });
  });

  describe("addActions", () => {
    it("添加操作到交付物", () => {
      const deliverable = generator.generateDocument("文档", "内容");

      const actions = [
        { id: "download", label: "下载", type: "download" as const },
        { id: "share", label: "分享", type: "share" as const },
        { id: "copy", label: "复制", type: "copy" as const },
      ];

      const result = generator.addActions(deliverable, actions);

      expect(result.metadata?.actions).toEqual(actions);
      // Original deliverable should be unchanged
      expect(deliverable.metadata?.actions).toBeUndefined();
    });

    it("保留现有元数据", () => {
      const deliverable = generator.generateDocument("文档", "内容", {
        metadata: { custom: "value" },
      });

      const result = generator.addActions(deliverable, [
        { id: "open", label: "打开", type: "open" as const },
      ]);

      expect(result.metadata?.custom).toBe("value");
      expect(result.metadata?.actions).toHaveLength(1);
    });
  });

  describe("HTML escaping", () => {
    it("正确转义 HTML 特殊字符", () => {
      const report = generator.generateReport(
        {
          title: "<script>alert('xss')</script>",
          summary: "Test & Summary with \"quotes\" and 'apostrophes'",
          sections: [
            { title: "Section <1>", content: "Content with <div> tags" },
          ],
          generatedAt: new Date(),
        },
        { format: "html" },
      );

      const content = report.content as string;
      expect(content).toContain("&lt;script&gt;");
      expect(content).toContain("&amp;");
      expect(content).toContain("&quot;");
      expect(content).toContain("&#039;");
      expect(content).not.toContain("<script>");
    });
  });

  describe("date handling", () => {
    it("使用提供的 generatedAt 日期", () => {
      const date = new Date("2025-01-01T00:00:00Z");
      const report = generator.generateReport({
        title: "报告",
        sections: [],
        generatedAt: date,
      });

      expect(report.createdAt).toEqual(date);
    });

    it("generateList 使用当前日期", () => {
      const before = new Date();
      const list = generator.generateList({
        title: "列表",
        items: [],
        total: 0,
      });
      const after = new Date();

      expect(list.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(list.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});

describe("createDeliverableGenerator", () => {
  it("创建新实例", () => {
    const gen = createDeliverableGenerator();
    expect(gen).toBeInstanceOf(DeliverableGenerator);
  });

  it("接受配置", () => {
    const gen = createDeliverableGenerator({
      defaultFormat: "html",
    });
    const report = gen.generateReport({
      title: "Test",
      sections: [],
      generatedAt: new Date(),
    });
    expect(report.format).toBe("html");
  });
});

describe("deliverableGenerator (singleton)", () => {
  it("导出默认实例", () => {
    expect(deliverableGenerator).toBeInstanceOf(DeliverableGenerator);
  });
});
