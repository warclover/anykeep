/**
 * DataExportSkill 单元测试
 *
 * @version 1.1.0 - 新增 executeStream 测试
 * @since 2025-12-24
 */

import { DataExportSkill, dataExportSkill } from "../data-export.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";
import { EXPORT_FORMAT_CONFIG, DEFAULT_EXPORT_FIELDS } from "../types";
import type { ExportFormat } from "../types";

// Mock 书签数据
const mockBookmarks = [
  {
    id: 1,
    title: "React 入门教程",
    url: "https://example.com/react",
    platform: "juejin",
    ai_summary: "React 是一个用于构建用户界面的 JavaScript 库",
    ai_tags: ["React", "前端"],
    user_tags: ["学习", "前端"],
    rating: 5,
    notes: "很棒的教程",
    created_at: "2025-12-20T10:00:00Z",
    updated_at: "2025-12-20T10:00:00Z",
    folder_id: 1,
    folders: { name: "技术文章" },
  },
  {
    id: 2,
    title: "TypeScript 高级特性",
    url: "https://example.com/typescript",
    platform: "zhihu",
    ai_summary: "TypeScript 提供了强大的类型系统",
    ai_tags: ["TypeScript", "编程"],
    user_tags: ["TypeScript"],
    rating: 4,
    notes: null,
    created_at: "2025-12-21T10:00:00Z",
    updated_at: "2025-12-21T10:00:00Z",
    folder_id: 1,
    folders: { name: "技术文章" },
  },
];

// Mock Supabase - 需要在测试前重置
let mockQueryResult: {
  data: typeof mockBookmarks | null;
  error: { message: string } | null;
} = { data: mockBookmarks, error: null };

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn(() => Promise.resolve(mockQueryResult)),
      })),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// 辅助函数：收集所有流式输出
async function collectChunks(
  generator: AsyncGenerator<OrchestrationStreamChunk>,
): Promise<OrchestrationStreamChunk[]> {
  const chunks: OrchestrationStreamChunk[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("DataExportSkill", () => {
  let skill: DataExportSkill;

  beforeEach(() => {
    skill = new DataExportSkill();
    // 重置 mock 数据
    mockQueryResult = { data: mockBookmarks, error: null };
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("data_export");
      expect(skill.metadata.name).toBe("数据导出助手");
      expect(skill.metadata.category).toBe("utility");
    });

    it("should have deliverable types", () => {
      expect(skill.metadata.deliverableTypes).toBeDefined();
      expect(skill.metadata.deliverableTypes).toContain("document");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(4);
      expect(skill.metadata.steps![0].id).toBe("parse");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("multi-format-export");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse export format from message", async () => {
      const csvResult = await skill.parseInput("导出为 CSV 文件", mockContext);
      expect(csvResult.format).toBe("csv");

      const mdResult = await skill.parseInput("导出为 Markdown", mockContext);
      expect(mdResult.format).toBe("markdown");

      const obsResult = await skill.parseInput("导出到 Obsidian", mockContext);
      expect(obsResult.format).toBe("obsidian");

      const jsonResult = await skill.parseInput("导出 JSON 格式", mockContext);
      expect(jsonResult.format).toBe("json");

      const htmlResult = await skill.parseInput("导出 HTML 书签", mockContext);
      expect(htmlResult.format).toBe("html");
    });

    it("should default to markdown format when not specified", async () => {
      const result = await skill.parseInput("导出我的书签", mockContext);
      expect(result.format).toBe("markdown");
    });

    it("should parse export scope from message", async () => {
      const allResult = await skill.parseInput("导出全部书签", mockContext);
      expect(allResult.scope).toBe("all");

      const folderResult = await skill.parseInput(
        "导出文件夹中的内容",
        mockContext,
      );
      expect(folderResult.scope).toBe("folder");

      const tagResult = await skill.parseInput(
        "导出带有标签的书签",
        mockContext,
      );
      expect(tagResult.scope).toBe("tag");
    });

    it("should parse AI content option", async () => {
      const result = await skill.parseInput("导出书签包含AI摘要", mockContext);
      expect(result.options?.includeAiContent).toBe(true);
    });
  });

  describe("executeStream", () => {
    const createContext = (
      params: Record<string, unknown> = {},
    ): OrchestrationContext => ({
      userId: "test-user-id",
      conversationId: "test-conv-id",
      params: {
        format: "markdown",
        scope: "all",
        ...params,
      },
    });

    it("should emit progress chunks during execution", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证进度块存在
      const progressChunks = chunks.filter((c) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);

      // 验证进度递增
      const percentages = progressChunks
        .map((c) => c.data.percent)
        .filter((p): p is number => p !== undefined);

      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }
    });

    it("should emit text chunks with export status", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证文本块存在
      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);

      // 验证包含导出格式信息
      const allText = textChunks.map((c) => c.data.text || "").join("");
      expect(allText).toContain("导出格式");
      expect(allText).toContain("Markdown");
    });

    it("should emit deliverable with correct metadata", async () => {
      const context = createContext({ format: "json" });
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证交付物块
      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();
      // DeliverableChunk.data 直接包含 type/format/content 等字段
      expect(deliverableChunk?.data.type).toBe("document");
      expect(deliverableChunk?.data.format).toBe("json"); // OutputFormat
      expect(deliverableChunk?.data.downloadable).toBe(true);
    });

    it("should emit done with success summary", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证完成块
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.data.success).toBe(true);
      expect(doneChunk?.data.summary).toContain("成功导出");
      expect(doneChunk?.data.summary).toContain("2"); // 2 条书签
    });

    it("should handle empty bookmarks gracefully", async () => {
      // 设置空数据
      mockQueryResult = { data: [], error: null };

      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证正常完成
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.data.success).toBe(true);
      expect(doneChunk?.data.summary).toContain("没有需要导出的数据");

      // 验证没有交付物
      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      // 设置数据库错误
      mockQueryResult = {
        data: null,
        error: { message: "Database connection failed" },
      };

      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证错误块
      const errorChunk = chunks.find((c) => c.type === "error");
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.data.retryable).toBe(true);

      // 验证失败完成
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.data.success).toBe(false);
    });

    it("should generate CSV format correctly", async () => {
      const context = createContext({ format: "csv" });
      const chunks = await collectChunks(skill.executeStream(context));

      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();

      // chunk.data.content 是 DataExportOutput 对象
      const output = deliverableChunk?.data.content as {
        mimeType?: string;
        filename?: string;
      };
      expect(output).toBeDefined();
      expect(output?.mimeType).toBe("text/csv");
      expect(output?.filename).toContain(".csv");
    });

    it("should generate HTML format correctly", async () => {
      const context = createContext({ format: "html" });
      const chunks = await collectChunks(skill.executeStream(context));

      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();

      // chunk.data.content 是 DataExportOutput 对象
      const output = deliverableChunk?.data.content as {
        mimeType?: string;
        content?: string;
      };
      expect(output).toBeDefined();
      expect(output?.mimeType).toBe("text/html");
      // DataExportOutput.content 字段包含实际的 HTML 内容
      expect(output?.content).toContain("NETSCAPE-Bookmark-file-1");
    });

    it("should generate Obsidian format correctly", async () => {
      const context = createContext({ format: "obsidian" });
      const chunks = await collectChunks(skill.executeStream(context));

      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();

      // chunk.data.content 是 DataExportOutput 对象
      const output = deliverableChunk?.data.content as {
        content?: string;
      };
      expect(output).toBeDefined();
      // DataExportOutput.content 字段包含 Obsidian 双链语法
      expect(output?.content).toContain("[[");
    });

    it("should emit suggestions when applicable", async () => {
      const context = createContext({ format: "markdown" });
      const chunks = await collectChunks(skill.executeStream(context));

      const suggestionsChunk = chunks.find((c) => c.type === "suggestions");
      // 由于只有 2 条书签，可能不会触发所有建议，但如果有则验证格式
      if (suggestionsChunk) {
        expect(Array.isArray(suggestionsChunk.data.suggestions)).toBe(true);
      }
    });

    it("should include platform distribution in output", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      const textChunks = chunks.filter((c) => c.type === "text");
      const allText = textChunks.map((c) => c.data.text || "").join("");

      // 验证包含平台分布信息
      expect(allText).toContain("平台分布");
    });

    it("should include folder distribution in output", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      const textChunks = chunks.filter((c) => c.type === "text");
      const allText = textChunks.map((c) => c.data.text || "").join("");

      // 验证包含文件夹分布信息
      expect(allText).toContain("文件夹分布");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(dataExportSkill).toBeInstanceOf(DataExportSkill);
      expect(dataExportSkill.metadata.id).toBe("data_export");
    });
  });

  describe("schemas", () => {
    it("should have valid input schema", () => {
      expect(skill.inputSchema).toBeDefined();
    });

    it("should have valid output schema", () => {
      expect(skill.outputSchema).toBeDefined();
    });
  });
});

describe("EXPORT_FORMAT_CONFIG", () => {
  it("should have all required formats", () => {
    const formats: ExportFormat[] = [
      "csv",
      "markdown",
      "json",
      "html",
      "obsidian",
    ];
    formats.forEach((format) => {
      expect(EXPORT_FORMAT_CONFIG[format]).toBeDefined();
      expect(EXPORT_FORMAT_CONFIG[format].name).toBeDefined();
      expect(EXPORT_FORMAT_CONFIG[format].extension).toBeDefined();
      expect(EXPORT_FORMAT_CONFIG[format].mimeType).toBeDefined();
    });
  });

  it("should have correct file extensions", () => {
    expect(EXPORT_FORMAT_CONFIG.csv.extension).toBe(".csv");
    expect(EXPORT_FORMAT_CONFIG.markdown.extension).toBe(".md");
    expect(EXPORT_FORMAT_CONFIG.json.extension).toBe(".json");
    expect(EXPORT_FORMAT_CONFIG.html.extension).toBe(".html");
    expect(EXPORT_FORMAT_CONFIG.obsidian.extension).toBe(".md");
  });

  it("should have correct MIME types", () => {
    expect(EXPORT_FORMAT_CONFIG.csv.mimeType).toBe("text/csv");
    expect(EXPORT_FORMAT_CONFIG.json.mimeType).toBe("application/json");
  });
});

describe("DEFAULT_EXPORT_FIELDS", () => {
  it("should include essential fields", () => {
    expect(DEFAULT_EXPORT_FIELDS).toContain("title");
    expect(DEFAULT_EXPORT_FIELDS).toContain("url");
    expect(DEFAULT_EXPORT_FIELDS).toContain("platform");
    expect(DEFAULT_EXPORT_FIELDS).toContain("createdAt");
  });

  it("should be an array", () => {
    expect(Array.isArray(DEFAULT_EXPORT_FIELDS)).toBe(true);
  });
});
