/**
 * DataExportSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { DataExportSkill, dataExportSkill } from "../data-export.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import { EXPORT_FORMAT_CONFIG, DEFAULT_EXPORT_FIELDS } from "../types";
import type { ExportFormat } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() =>
            Promise.resolve({
              data: [],
              error: null,
            }),
          ),
        })),
      })),
    })),
  })),
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

describe("DataExportSkill", () => {
  let skill: DataExportSkill;

  beforeEach(() => {
    skill = new DataExportSkill();
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
