/**
 * Tool Description Templates 单元测试
 *
 * @description 测试工具描述模板的完整性和格式正确性
 */

import {
  QUERY_TOOL_DESCRIPTIONS,
  FOLDER_TOOL_DESCRIPTIONS,
  BOOKMARK_TOOL_DESCRIPTIONS,
  SEARCH_TOOL_DESCRIPTIONS,
  ACTION_TOOL_DESCRIPTIONS,
  EXPORT_TOOL_DESCRIPTIONS,
  ALL_TOOL_DESCRIPTIONS,
  buildToolDescription,
} from "../tool-description-templates";

describe("Tool Description Templates", () => {
  describe("buildToolDescription", () => {
    it("构建基础描述（仅必填参数）", () => {
      const description = buildToolDescription({
        core: "测试功能",
        scenarios: ['"场景1"'],
      });

      expect(description).toContain("测试功能");
      expect(description).toContain("场景1");
    });

    it("构建包含场景的描述", () => {
      const description = buildToolDescription({
        core: "测试功能",
        scenarios: ['"场景1"', '"场景2"'],
      });

      expect(description).toContain("测试功能");
      expect(description).toContain("场景1");
      expect(description).toContain("场景2");
      expect(description).toContain("【使用场景】");
    });

    it("构建包含注意事项的描述", () => {
      const description = buildToolDescription({
        core: "测试功能",
        scenarios: ['"场景"'],
        notes: ["注意1", "注意2"],
      });

      expect(description).toContain("测试功能");
      expect(description).toContain("注意1");
      expect(description).toContain("注意2");
      expect(description).toContain("【注意事项】");
    });

    it("构建包含边界条件的描述", () => {
      const description = buildToolDescription({
        core: "测试功能",
        scenarios: ['"场景"'],
        boundaries: ["notFound", "maxLimit"],
      });

      expect(description).toContain("测试功能");
      expect(description).toContain("【边界情况】");
    });

    it("构建完整描述", () => {
      const description = buildToolDescription({
        core: "完整测试功能",
        scenarios: ['"完整场景"'],
        notes: ["完整注意事项"],
        boundaries: ["emptyResult"],
      });

      expect(description).toContain("完整测试功能");
      expect(description).toContain("【使用场景】");
      expect(description).toContain("【注意事项】");
      expect(description).toContain("【边界情况】");
    });
  });

  describe("QUERY_TOOL_DESCRIPTIONS", () => {
    it("包含所有 query 工具描述", () => {
      const expectedTools = [
        "list_recent",
        "count_total",
        "list_by_folder",
        "list_by_platform",
        "count_by_folder",
        "count_by_platform",
        "get_stats",
      ];

      expectedTools.forEach((tool) => {
        expect(QUERY_TOOL_DESCRIPTIONS).toHaveProperty(tool);
        expect(
          typeof QUERY_TOOL_DESCRIPTIONS[
            tool as keyof typeof QUERY_TOOL_DESCRIPTIONS
          ],
        ).toBe("string");
        expect(
          QUERY_TOOL_DESCRIPTIONS[tool as keyof typeof QUERY_TOOL_DESCRIPTIONS]
            .length,
        ).toBeGreaterThan(10);
      });
    });

    it("每个描述都包含核心功能", () => {
      Object.values(QUERY_TOOL_DESCRIPTIONS).forEach((description) => {
        expect(description.length).toBeGreaterThan(20);
        expect(description).not.toContain("undefined");
      });
    });
  });

  describe("FOLDER_TOOL_DESCRIPTIONS", () => {
    it("包含所有 folder 工具描述", () => {
      const expectedTools = [
        "list_folders",
        "create_folder",
        "delete_folder",
        "rename_folder",
        "get_folder_detail",
        "get_folder_bookmarks",
        "move_bookmark",
        "move_folder_to_group",
        "merge_folders",
        "split_folder",
        "toggle_folder_archive",
        "toggle_folder_lock",
        "auto_classify_inbox",
        "reorder_folder",
        "delete_folder_bookmarks",
      ];

      expectedTools.forEach((tool) => {
        expect(FOLDER_TOOL_DESCRIPTIONS).toHaveProperty(tool);
        expect(
          typeof FOLDER_TOOL_DESCRIPTIONS[
            tool as keyof typeof FOLDER_TOOL_DESCRIPTIONS
          ],
        ).toBe("string");
      });
    });
  });

  describe("BOOKMARK_TOOL_DESCRIPTIONS", () => {
    it("包含所有 bookmark 工具描述", () => {
      const expectedTools = [
        "create_bookmark",
        "delete_bookmark",
        "update_bookmark",
        "toggle_bookmark_read",
        "toggle_bookmark_starred",
        "batch_delete_bookmarks",
        "create_snapshot",
      ];

      expectedTools.forEach((tool) => {
        expect(BOOKMARK_TOOL_DESCRIPTIONS).toHaveProperty(tool);
        expect(
          typeof BOOKMARK_TOOL_DESCRIPTIONS[
            tool as keyof typeof BOOKMARK_TOOL_DESCRIPTIONS
          ],
        ).toBe("string");
      });
    });
  });

  describe("SEARCH_TOOL_DESCRIPTIONS", () => {
    it("包含所有 search 工具描述", () => {
      expect(SEARCH_TOOL_DESCRIPTIONS).toHaveProperty("search");
    });
  });

  describe("ACTION_TOOL_DESCRIPTIONS", () => {
    it("包含所有 action 工具描述", () => {
      expect(ACTION_TOOL_DESCRIPTIONS).toHaveProperty("batch_tags");
      expect(ACTION_TOOL_DESCRIPTIONS).toHaveProperty("move_bookmarks");
    });
  });

  describe("EXPORT_TOOL_DESCRIPTIONS", () => {
    it("包含所有 export 工具描述", () => {
      const expectedTools = [
        "export_bookmarks",
        "list_export_formats",
        "preview_export",
      ];

      expectedTools.forEach((tool) => {
        expect(EXPORT_TOOL_DESCRIPTIONS).toHaveProperty(tool);
      });
    });
  });

  describe("ALL_TOOL_DESCRIPTIONS", () => {
    it("合并所有工具描述", () => {
      const allKeys = Object.keys(ALL_TOOL_DESCRIPTIONS);
      expect(allKeys.length).toBeGreaterThan(30);
    });

    it("包含所有类别的工具", () => {
      // Query
      expect(ALL_TOOL_DESCRIPTIONS).toHaveProperty("list_recent");
      // Folder
      expect(ALL_TOOL_DESCRIPTIONS).toHaveProperty("create_folder");
      // Bookmark
      expect(ALL_TOOL_DESCRIPTIONS).toHaveProperty("create_bookmark");
      // Search
      expect(ALL_TOOL_DESCRIPTIONS).toHaveProperty("search");
      // Action
      expect(ALL_TOOL_DESCRIPTIONS).toHaveProperty("batch_tags");
      // Export
      expect(ALL_TOOL_DESCRIPTIONS).toHaveProperty("export_bookmarks");
    });
  });

  describe("描述格式一致性", () => {
    it("所有描述不包含占位符", () => {
      Object.entries(ALL_TOOL_DESCRIPTIONS).forEach(([, description]) => {
        expect(description).not.toContain("TODO");
        expect(description).not.toContain("FIXME");
        expect(description).not.toContain("XXX");
        expect(description).not.toMatch(/\$\{.*\}/);
      });
    });

    it("所有描述都是非空字符串", () => {
      Object.entries(ALL_TOOL_DESCRIPTIONS).forEach(([, description]) => {
        expect(typeof description).toBe("string");
        expect(description.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
