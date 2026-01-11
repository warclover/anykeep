/**
 * 意图驱动工具加载测试
 *
 * @version 1.1.0
 * @since 2026-01-11
 * @updated 2026-01-13 - 添加精确单工具模式测试
 */

import { describe, it, expect } from "@jest/globals";
import {
  getToolsForIntent,
  getToolsForIntentWithDetails,
  getToolSetNamesForIntent,
  INTENT_TOOL_MAPPING,
  FALLBACK_CONFIG,
  PRECISE_TOOL_MAP,
  PRECISE_MODE_CONFIDENCE_THRESHOLD,
} from "../intent-tool-mapping";
import { CORE_TOOLS, TOOL_SETS } from "../tool-layers";

describe("intent-tool-mapping", () => {
  describe("getToolsForIntent", () => {
    it("should always include core tools for standard mode", () => {
      // 使用低于精确模式阈值的置信度
      const tools = getToolsForIntent("query", "search", 0.7);
      for (const coreTool of CORE_TOOLS) {
        expect(tools).toContain(coreTool);
      }
    });

    it("should only return core tools for query:search with medium confidence", () => {
      // query:search 映射为空数组，所以只加载 Core Tools
      const tools = getToolsForIntent("query", "search", 0.7);
      expect(tools.length).toBe(CORE_TOOLS.length);
    });

    it("should only return core tools for chitchat intent", () => {
      const tools = getToolsForIntent("chitchat", "greeting", 0.9);
      expect(tools.length).toBe(CORE_TOOLS.length);
    });

    it("should load more tools for low confidence", () => {
      const mediumConfTools = getToolsForIntent("query", "search", 0.7);
      const lowConfTools = getToolsForIntent(
        "query",
        "search",
        FALLBACK_CONFIG.lowConfidenceThreshold - 0.1,
      );
      // 低置信度应该加载更多工具
      expect(lowConfTools.length).toBeGreaterThan(mediumConfTools.length);
    });

    it("should load import_tools when user mentions '导入'", () => {
      const tools = getToolsForIntent("query", "search", 0.7, "我想导入书签");
      expect(tools).toContain("import_bookmarks");
    });

    it("should load messages_tools when user mentions '消息'", () => {
      const tools = getToolsForIntent("query", "search", 0.7, "查看未读消息");
      expect(tools).toContain("list_messages");
    });
  });

  describe("getToolsForIntentWithDetails - Precise Mode", () => {
    it("should return single tool for query:list_folders with high confidence", () => {
      const result = getToolsForIntentWithDetails(
        "query",
        "list_folders",
        0.92,
      );

      expect(result.isPreciseMode).toBe(true);
      expect(result.preciseTool).toBe("list_folders");
      expect(result.tools).toEqual(["list_folders"]);
      expect(result.tools.length).toBe(1);
    });

    it("should return single tool for query:count with high confidence", () => {
      const result = getToolsForIntentWithDetails("query", "count", 0.9);

      expect(result.isPreciseMode).toBe(true);
      expect(result.preciseTool).toBe("count_total");
      expect(result.tools).toEqual(["count_total"]);
    });

    it("should return single tool for query:stats with high confidence", () => {
      const result = getToolsForIntentWithDetails("query", "stats", 0.88);

      expect(result.isPreciseMode).toBe(true);
      expect(result.preciseTool).toBe("get_stats");
      expect(result.tools).toEqual(["get_stats"]);
    });

    it("should return single tool for query:search with high confidence", () => {
      const result = getToolsForIntentWithDetails("query", "search", 0.95);

      expect(result.isPreciseMode).toBe(true);
      expect(result.preciseTool).toBe("search_bookmarks");
      expect(result.tools).toEqual(["search_bookmarks"]);
    });

    it("should return single tool for action:star with high confidence", () => {
      const result = getToolsForIntentWithDetails("action", "star", 0.9);

      expect(result.isPreciseMode).toBe(true);
      expect(result.preciseTool).toBe("toggle_bookmark_starred");
      expect(result.tools).toEqual(["toggle_bookmark_starred"]);
    });

    it("should NOT use precise mode when confidence is below threshold", () => {
      const result = getToolsForIntentWithDetails(
        "query",
        "list_folders",
        0.8, // Below 0.85 threshold
      );

      expect(result.isPreciseMode).toBe(false);
      expect(result.preciseTool).toBeUndefined();
      expect(result.tools.length).toBe(CORE_TOOLS.length);
    });

    it("should NOT use precise mode when subType is undefined", () => {
      const result = getToolsForIntentWithDetails("query", undefined, 0.95);

      expect(result.isPreciseMode).toBe(false);
      expect(result.preciseTool).toBeUndefined();
    });

    it("should NOT use precise mode when no mapping exists", () => {
      const result = getToolsForIntentWithDetails(
        "query",
        "unknown_subtype",
        0.95,
      );

      expect(result.isPreciseMode).toBe(false);
      expect(result.preciseTool).toBeUndefined();
    });

    it("should include debug info", () => {
      const result = getToolsForIntentWithDetails(
        "query",
        "list_folders",
        0.92,
      );

      expect(result.debug).toBeDefined();
      expect(result.debug?.intentKey).toBe("query:list_folders");
      expect(result.debug?.confidence).toBe(0.92);
      expect(result.debug?.reason).toContain("precise_single_tool");
    });
  });

  describe("PRECISE_TOOL_MAP completeness", () => {
    const expectedPreciseMappings = [
      ["query:list_folders", "list_folders"],
      ["query:count", "count_total"],
      ["query:stats", "get_stats"],
      ["query:list", "list_recent"],
      ["query:search", "search_bookmarks"],
      ["query:tag", "list_tags"],
      ["query:platform", "list_by_platform"],
      ["action:star", "toggle_bookmark_starred"],
      ["action:read", "toggle_bookmark_read"],
      ["create:folder", "create_folder"],
      ["create:bookmark", "create_bookmark"],
    ];

    it.each(expectedPreciseMappings)(
      "should have precise mapping for %s -> %s",
      (intentKey, expectedTool) => {
        expect(PRECISE_TOOL_MAP[intentKey]).toBe(expectedTool);
      },
    );
  });

  describe("getToolSetNamesForIntent", () => {
    it("should return empty array for query:list (now uses Core only)", () => {
      const setNames = getToolSetNamesForIntent("query", "list");
      expect(setNames).toEqual([]);
    });

    it("should return manage_tools for action:tag", () => {
      const setNames = getToolSetNamesForIntent("action", "tag");
      expect(setNames).toContain("manage_tools");
    });

    it("should return empty array for chitchat", () => {
      const setNames = getToolSetNamesForIntent("chitchat", "greeting");
      expect(setNames).toEqual([]);
    });

    it("should return empty array for query:search (now uses Core only)", () => {
      const setNames = getToolSetNamesForIntent("query", "search");
      expect(setNames).toEqual([]);
    });
  });

  describe("INTENT_TOOL_MAPPING completeness", () => {
    const expectedMappings = [
      "query:list",
      "query:count",
      "query:stats",
      "query:search",
      "action:tag",
      "action:move",
      "action:delete",
      "organize:cleanup",
      "organize:classify",
      "analyze:report",
      "create:export",
      "learn:review",
      "chitchat:general",
    ];

    it.each(expectedMappings)("should have mapping for %s", (intent) => {
      expect(intent in INTENT_TOOL_MAPPING).toBe(true);
    });
  });

  describe("performance optimization verification", () => {
    it("should return single tool for precise mode (maximum reduction)", () => {
      const result = getToolsForIntentWithDetails(
        "query",
        "list_folders",
        0.92,
      );
      const allToolsCount =
        CORE_TOOLS.length +
        Object.values(TOOL_SETS).reduce((acc, set) => acc + set.length, 0);

      // 精确模式应该只返回 1 个工具
      expect(result.tools.length).toBe(1);
      console.log(
        `Precise mode tool reduction: ${allToolsCount} -> ${result.tools.length} (${Math.round((1 - result.tools.length / allToolsCount) * 100)}% reduction)`,
      );
    });

    it("should significantly reduce tool count for simple queries in standard mode", () => {
      const simpleQueryTools = getToolsForIntent("query", "search", 0.7);
      const allToolsCount =
        CORE_TOOLS.length +
        Object.values(TOOL_SETS).reduce((acc, set) => acc + set.length, 0);

      // 简单查询应该只加载 Core Tools（8 个），远少于全量工具
      expect(simpleQueryTools.length).toBeLessThan(allToolsCount * 0.2);
      console.log(
        `Standard mode tool reduction: ${allToolsCount} -> ${simpleQueryTools.length} (${Math.round((1 - simpleQueryTools.length / allToolsCount) * 100)}% reduction)`,
      );
    });

    it("should load reasonable amount of tools for complex intents", () => {
      const organizeTools = getToolsForIntent("organize", "cleanup", 0.9);
      // 整理意图应该加载 Core + Organize Tools，但不是全部
      expect(organizeTools.length).toBeLessThan(60);
      expect(organizeTools.length).toBeGreaterThan(CORE_TOOLS.length);
    });
  });

  describe("threshold verification", () => {
    it("should have correct precise mode threshold", () => {
      expect(PRECISE_MODE_CONFIDENCE_THRESHOLD).toBe(0.85);
    });

    it("should have correct low confidence threshold", () => {
      expect(FALLBACK_CONFIG.lowConfidenceThreshold).toBe(0.5);
    });
  });
});
