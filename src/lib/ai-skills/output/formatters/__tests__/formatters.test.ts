/**
 * 格式化器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import {
  ListFormatter,
  TableFormatter,
  ReportFormatter,
  getFormatterForType,
  type ListItem,
  type ReportData,
} from "../index";

describe("ListFormatter", () => {
  let formatter: ListFormatter;

  beforeEach(() => {
    formatter = new ListFormatter();
  });

  const testItems: ListItem[] = [
    {
      text: "First item",
      description: "Description 1",
      url: "https://example.com/1",
      tags: ["tag1"],
    },
    {
      text: "Second item",
      description: "Description 2",
      tags: ["tag2", "tag3"],
    },
    { text: "Third item" },
  ];

  describe("format()", () => {
    it("should format list as markdown", () => {
      const result = formatter.format(testItems, {
        type: "list",
        title: "Test List",
      });

      expect(result.format).toBe("markdown");
      expect(result.content).toContain("# Test List");
      expect(result.content).toContain("**First item**");
      expect(result.content).toContain("Description 1");
      expect(result.content).toContain("[链接](https://example.com/1)");
      expect(result.content).toContain("`tag1`");
    });

    it("should format list as HTML", () => {
      formatter.updateConfig({ outputFormat: "html" });
      const result = formatter.format(testItems, {
        type: "list",
        title: "Test List",
      });

      expect(result.format).toBe("html");
      expect(result.content).toContain("<ul>");
      expect(result.content).toContain("<li>");
      expect(result.content).toContain("<strong>First item</strong>");
    });

    it("should format list as JSON", () => {
      formatter.updateConfig({ outputFormat: "json" });
      const result = formatter.format(testItems, {
        type: "list",
        title: "Test List",
      });

      expect(result.format).toBe("json");
      const parsed = JSON.parse(result.content.replace(/^# Test List\n\n/, ""));
      expect(parsed).toHaveLength(3);
    });

    it("should respect maxItems limit", () => {
      formatter.updateConfig({ maxItems: 2 });
      const result = formatter.format(testItems, {
        type: "list",
        title: "Test List",
      });

      expect(result.metadata?.displayedItems).toBe(2);
      expect(result.metadata?.truncated).toBe(true);
    });

    it("should use numbered list style", () => {
      formatter.updateConfig({ listStyle: "numbered" });
      const result = formatter.format(testItems, {
        type: "list",
        title: "Test List",
      });

      expect(result.content).toContain("1.");
      expect(result.content).toContain("2.");
    });

    it("should use checkbox list style", () => {
      formatter.updateConfig({ listStyle: "checkbox" });
      const result = formatter.format(testItems, {
        type: "list",
        title: "Test List",
      });

      expect(result.content).toContain("- [ ]");
    });
  });

  describe("supports()", () => {
    it("should support list type", () => {
      expect(formatter.supports("list")).toBe(true);
    });

    it("should not support table type", () => {
      expect(formatter.supports("table")).toBe(false);
    });
  });
});

describe("TableFormatter", () => {
  let formatter: TableFormatter;

  beforeEach(() => {
    formatter = new TableFormatter();
  });

  const testData = [
    { name: "Alice", age: 30, city: "Beijing" },
    { name: "Bob", age: 25, city: "Shanghai" },
    { name: "Charlie", age: 35, city: "Guangzhou" },
  ];

  describe("format()", () => {
    it("should format table as markdown", () => {
      const result = formatter.format(testData, {
        type: "table",
        title: "Test Table",
      });

      expect(result.format).toBe("markdown");
      expect(result.content).toContain("# Test Table");
      expect(result.content).toContain("| Name | Age | City |");
      expect(result.content).toContain("| --- | --- | --- |");
      expect(result.content).toContain("| Alice | 30 | Beijing |");
    });

    it("should format table as HTML", () => {
      formatter.updateConfig({ outputFormat: "html" });
      const result = formatter.format(testData, {
        type: "table",
        title: "Test Table",
      });

      expect(result.format).toBe("html");
      expect(result.content).toContain("<table");
      expect(result.content).toMatch(/<th[^>]*>Name<\/th>/);
      expect(result.content).toMatch(/<td[^>]*>Alice<\/td>/);
    });

    it("should show row numbers when enabled", () => {
      formatter.updateConfig({ showRowNumbers: true });
      const result = formatter.format(testData, {
        type: "table",
        title: "Test Table",
      });

      expect(result.content).toContain("| # |");
      expect(result.content).toContain("| 1 |");
    });

    it("should respect maxRows limit", () => {
      formatter.updateConfig({ maxRows: 2 });
      const result = formatter.format(testData, {
        type: "table",
        title: "Test Table",
      });

      expect(result.metadata?.displayedRows).toBe(2);
      expect(result.metadata?.truncated).toBe(true);
    });

    it("should handle empty data", () => {
      const result = formatter.format([], {
        type: "table",
        title: "Empty Table",
      });

      expect(result.content).toContain("*无数据*");
    });

    it("should use custom columns", () => {
      formatter.updateConfig({
        columns: [
          { key: "name", label: "姓名" },
          { key: "city", label: "城市" },
        ],
      });
      const result = formatter.format(testData, {
        type: "table",
        title: "Test Table",
      });

      expect(result.content).toContain("| 姓名 | 城市 |");
      expect(result.content).not.toContain("Age");
    });
  });

  describe("supports()", () => {
    it("should support table type", () => {
      expect(formatter.supports("table")).toBe(true);
    });

    it("should not support list type", () => {
      expect(formatter.supports("list")).toBe(false);
    });
  });
});

describe("ReportFormatter", () => {
  let formatter: ReportFormatter;

  beforeEach(() => {
    formatter = new ReportFormatter();
  });

  const testReport: ReportData = {
    summary: "This is a test report summary.",
    sections: [
      {
        title: "Introduction",
        content: "This is the introduction.",
      },
      {
        title: "Analysis",
        content: [
          { title: "Part A", content: "Analysis part A" },
          { title: "Part B", content: "Analysis part B" },
        ],
      },
    ],
    conclusion: "This is the conclusion.",
    references: ["Reference 1", "Reference 2"],
  };

  describe("format()", () => {
    it("should format report as markdown", () => {
      const result = formatter.format(testReport, {
        type: "report",
        title: "Test Report",
      });

      expect(result.format).toBe("markdown");
      expect(result.content).toContain("# Test Report");
      expect(result.content).toContain("## 摘要");
      expect(result.content).toContain("> This is a test report summary.");
      expect(result.content).toContain("## Introduction");
      expect(result.content).toContain("## 结论");
      expect(result.content).toContain("## 参考资料");
    });

    it("should format report as HTML", () => {
      formatter.updateConfig({ outputFormat: "html" });
      const result = formatter.format(testReport, {
        type: "report",
        title: "Test Report",
      });

      expect(result.format).toBe("html");
      expect(result.content).toContain("<article");
      expect(result.content).toContain("<h1>Test Report</h1>");
      expect(result.content).toContain("<blockquote>");
    });

    it("should hide summary when disabled", () => {
      formatter.updateConfig({ showSummary: false });
      const result = formatter.format(testReport, {
        type: "report",
        title: "Test Report",
      });

      expect(result.content).not.toContain("## 摘要");
    });

    it("should hide conclusion when disabled", () => {
      formatter.updateConfig({ showConclusion: false });
      const result = formatter.format(testReport, {
        type: "report",
        title: "Test Report",
      });

      expect(result.content).not.toContain("## 结论");
    });

    it("should show table of contents when enabled", () => {
      formatter.updateConfig({ showToc: true });
      const result = formatter.format(testReport, {
        type: "report",
        title: "Test Report",
      });

      expect(result.content).toContain("## 目录");
      expect(result.content).toContain("[Introduction]");
    });

    it("should handle nested sections", () => {
      const result = formatter.format(testReport, {
        type: "report",
        title: "Test Report",
      });

      expect(result.content).toContain("### Part A");
      expect(result.content).toContain("### Part B");
    });
  });

  describe("supports()", () => {
    it("should support report type", () => {
      expect(formatter.supports("report")).toBe(true);
    });

    it("should support document type", () => {
      expect(formatter.supports("document")).toBe(true);
    });

    it("should not support list type", () => {
      expect(formatter.supports("list")).toBe(false);
    });
  });
});

describe("getFormatterForType()", () => {
  it("should return ListFormatter for list type", () => {
    const formatter = getFormatterForType("list");
    expect(formatter).toBeInstanceOf(ListFormatter);
  });

  it("should return TableFormatter for table type", () => {
    const formatter = getFormatterForType("table");
    expect(formatter).toBeInstanceOf(TableFormatter);
  });

  it("should return ReportFormatter for report type", () => {
    const formatter = getFormatterForType("report");
    expect(formatter).toBeInstanceOf(ReportFormatter);
  });

  it("should return ReportFormatter for document type", () => {
    const formatter = getFormatterForType("document");
    expect(formatter).toBeInstanceOf(ReportFormatter);
  });

  it("should return ListFormatter for unknown types", () => {
    const formatter = getFormatterForType("mindmap");
    expect(formatter).toBeInstanceOf(ListFormatter);
  });

  it("should pass config to formatter", () => {
    const formatter = getFormatterForType("list", { outputFormat: "html" });
    const result = formatter.format([{ text: "Test" }], {
      type: "list",
      title: "Test",
    });
    expect(result.format).toBe("html");
  });
});
