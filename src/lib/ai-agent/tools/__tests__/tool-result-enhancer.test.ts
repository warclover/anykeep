/**
 * Tool Result Enhancer 单元测试
 *
 * @description 测试工具结果增强器的功能
 */

import {
  ToolResultEnhancer,
  enhanceToolResult,
  toolResultEnhancer,
} from "../tool-result-enhancer";
import type { ToolResult } from "../types";

describe("ToolResultEnhancer", () => {
  let enhancer: ToolResultEnhancer;

  beforeEach(() => {
    enhancer = new ToolResultEnhancer();
  });

  describe("enhance - 成功结果增强", () => {
    it("增强 list_recent 成功结果", () => {
      const result: ToolResult<{
        bookmarks: Array<{ id: number; title: string }>;
        total: number;
      }> = {
        success: true,
        data: {
          bookmarks: [
            { id: 1, title: "书签1" },
            { id: 2, title: "书签2" },
          ],
          total: 10,
        },
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.original).toBe(result);
      expect(enhanced).toHaveProperty("summary");
      expect(enhanced).toHaveProperty("keyInsights");
      expect(enhanced).toHaveProperty("suggestedActions");
      expect(enhanced.summary).toContain("2");
      expect(enhanced.summary).toContain("10");
    });

    it("增强 count_total 成功结果", () => {
      const result: ToolResult<{ total: number }> = {
        success: true,
        data: { total: 100 },
      };

      const enhanced = enhancer.enhance("count_total", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("100");
    });

    it("增强 list_folders 成功结果", () => {
      const result: ToolResult<{
        folders: Array<{ id: number; name: string; bookmarkCount: number }>;
        total: number;
      }> = {
        success: true,
        data: {
          folders: [
            { id: 1, name: "工作", bookmarkCount: 10 },
            { id: 2, name: "学习", bookmarkCount: 5 },
          ],
          total: 2,
        },
      };

      const enhanced = enhancer.enhance("list_folders", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("2");
      expect(enhanced.summary).toContain("15"); // 总书签数
    });

    it("增强 create_folder 成功结果", () => {
      const result: ToolResult<{
        folderId: number;
        name: string;
      }> = {
        success: true,
        data: {
          folderId: 123,
          name: "新文件夹",
        },
      };

      const enhanced = enhancer.enhance("create_folder", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("新文件夹");
    });

    it("增强 search 成功结果（有结果）", () => {
      const result: ToolResult<{
        results: Array<{ id: number; title: string }>;
        query: string;
        total: number;
      }> = {
        success: true,
        data: {
          results: [
            { id: 1, title: "React 教程" },
            { id: 2, title: "Vue 入门" },
          ],
          query: "前端",
          total: 2,
        },
      };

      const enhanced = enhancer.enhance("search", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("2");
    });

    it("增强 search 成功结果（无结果）", () => {
      const result: ToolResult<{
        results: never[];
        query: string;
        total: number;
      }> = {
        success: true,
        data: {
          results: [],
          query: "不存在的关键词",
          total: 0,
        },
      };

      const enhanced = enhancer.enhance("search", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("未找到");
    });

    it("增强 get_stats 成功结果并提取洞察", () => {
      const result: ToolResult<{
        overview: {
          totalBookmarks: number;
          totalFolders: number;
          totalTags: number;
        };
        trends: {
          last7Days: number;
          last30Days: number;
        };
        topTags: Array<{ name: string; count: number }>;
      }> = {
        success: true,
        data: {
          overview: {
            totalBookmarks: 500,
            totalFolders: 20,
            totalTags: 100,
          },
          trends: {
            last7Days: 15,
            last30Days: 50,
          },
          topTags: [{ name: "技术", count: 80 }],
        },
      };

      const enhanced = enhancer.enhance("get_stats", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("500");
      expect(enhanced.keyInsights.length).toBeGreaterThan(0);
      expect(enhanced.keyInsights.some((i) => i.includes("7天"))).toBe(true);
    });
  });

  describe("enhance - 错误结果增强", () => {
    it("增强 NOT_FOUND 错误", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "文件夹不存在",
        errorCode: "NOT_FOUND",
      };

      const enhanced = enhancer.enhance("delete_folder", result);

      expect(enhanced.original.success).toBe(false);
      expect(enhanced.errorAnalysis).toBeDefined();
      expect(enhanced.errorAnalysis?.errorType).toBe("not_found");
      expect(enhanced.errorAnalysis?.retryable).toBe(false);
      expect(enhanced.suggestedActions.length).toBeGreaterThan(0);
    });

    it("增强 UNAUTHORIZED 错误", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "无权操作",
        errorCode: "UNAUTHORIZED",
      };

      const enhanced = enhancer.enhance("move_bookmarks", result);

      expect(enhanced.original.success).toBe(false);
      expect(enhanced.errorAnalysis?.errorType).toBe("unauthorized");
      expect(enhanced.errorAnalysis?.actionableMessage).toContain("权限");
    });

    it("增强 EXECUTION_ERROR 错误", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "数据库连接失败",
        errorCode: "EXECUTION_ERROR",
      };

      const enhanced = enhancer.enhance("create_bookmark", result);

      expect(enhanced.original.success).toBe(false);
      expect(enhanced.errorAnalysis).toBeDefined();
      expect(enhanced.errorAnalysis?.errorType).toBe("unknown");
      expect(enhanced.errorAnalysis?.retryable).toBe(true);
    });

    it("增强未知错误码", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "未知错误",
        errorCode: "UNKNOWN_CODE",
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.original.success).toBe(false);
      expect(enhanced.errorAnalysis).toBeDefined();
      expect(enhanced.errorAnalysis?.errorType).toBe("unknown");
    });

    it("根据错误消息推断类型 - network", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "网络连接失败",
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.errorAnalysis?.errorType).toBe("network");
    });

    it("根据错误消息推断类型 - timeout", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "操作超时",
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.errorAnalysis?.errorType).toBe("timeout");
    });

    it("根据错误消息推断类型 - duplicate", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "该 URL 已存在",
      };

      const enhanced = enhancer.enhance("create_bookmark", result);

      expect(enhanced.errorAnalysis?.errorType).toBe("duplicate");
    });
  });

  describe("enhance - 未知工具处理", () => {
    it("处理未知工具名称", () => {
      const result: ToolResult<{ data: string }> = {
        success: true,
        data: { data: "test" },
      };

      const enhanced = enhancer.enhance("unknown_tool", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("成功");
    });

    it("未知工具返回默认建议", () => {
      const result: ToolResult<{ data: string }> = {
        success: true,
        data: { data: "test" },
      };

      const enhanced = enhancer.enhance("unknown_tool", result);

      expect(enhanced.suggestedActions).toEqual([]);
    });
  });

  describe("enhance - 原始数据保留", () => {
    it("保留原始结果", () => {
      const originalData = {
        bookmarks: [{ id: 1, title: "测试" }],
        total: 1,
      };
      const result: ToolResult<typeof originalData> = {
        success: true,
        data: originalData,
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.original).toBe(result);
      expect(enhanced.original.success).toBe(true);
      if (enhanced.original.success) {
        expect(enhanced.original.data).toEqual(originalData);
      }
    });

    it("保留原始 metadata 字段", () => {
      const result: ToolResult<{ total: number }> = {
        success: true,
        data: { total: 10 },
        metadata: {
          executionTimeMs: 100,
          affectedCount: 10,
        },
      };

      const enhanced = enhancer.enhance("count_total", result);

      expect(enhanced.original.metadata).toEqual({
        executionTimeMs: 100,
        affectedCount: 10,
      });
    });

    it("保留原始错误信息", () => {
      const result: ToolResult<unknown> = {
        success: false,
        error: "原始错误信息",
        errorCode: "TEST_ERROR",
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.original.success).toBe(false);
      if (!enhanced.original.success) {
        expect(enhanced.original.error).toBe("原始错误信息");
        expect(enhanced.original.errorCode).toBe("TEST_ERROR");
      }
    });
  });

  describe("边界情况", () => {
    it("处理 null data", () => {
      const result: ToolResult<null> = {
        success: true,
        data: null,
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced).toHaveProperty("summary");
    });

    it("处理空数组", () => {
      const result: ToolResult<{ bookmarks: never[]; total: number }> = {
        success: true,
        data: {
          bookmarks: [],
          total: 0,
        },
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.original.success).toBe(true);
      expect(enhanced.summary).toContain("暂无");
    });

    it("处理深层嵌套数据", () => {
      const result: ToolResult<{
        folders: Array<{
          id: number;
          name: string;
          children: Array<{ id: number; name: string }>;
        }>;
      }> = {
        success: true,
        data: {
          folders: [
            {
              id: 1,
              name: "父文件夹",
              children: [
                { id: 2, name: "子文件夹1" },
                { id: 3, name: "子文件夹2" },
              ],
            },
          ],
        },
      };

      const enhanced = enhancer.enhance("list_folders", result);

      expect(enhanced.original.success).toBe(true);
      if (enhanced.original.success) {
        expect(enhanced.original.data).toEqual(result.data);
      }
    });
  });

  describe("便捷函数和单例", () => {
    it("enhanceToolResult 函数正常工作", () => {
      const result: ToolResult<{ total: number }> = {
        success: true,
        data: { total: 50 },
      };

      const enhanced = enhanceToolResult("count_total", result);

      expect(enhanced.original).toBe(result);
      expect(enhanced.summary).toContain("50");
    });

    it("全局单例 toolResultEnhancer 正常工作", () => {
      const result: ToolResult<{ total: number }> = {
        success: true,
        data: { total: 30 },
      };

      const enhanced = toolResultEnhancer.enhance("count_total", result);

      expect(enhanced.original).toBe(result);
      expect(enhanced.summary).toContain("30");
    });
  });

  describe("下一步建议生成", () => {
    it("list_recent 空结果建议添加收藏", () => {
      const result: ToolResult<{ bookmarks: never[]; total: number }> = {
        success: true,
        data: { bookmarks: [], total: 0 },
      };

      const enhanced = enhancer.enhance("list_recent", result);

      expect(enhanced.suggestedActions.length).toBeGreaterThan(0);
      expect(
        enhanced.suggestedActions.some(
          (a) => a.relatedTool === "create_bookmark",
        ),
      ).toBe(true);
    });

    it("search 无结果建议语义搜索", () => {
      const result: ToolResult<{ results: never[]; query: string }> = {
        success: true,
        data: { results: [], query: "test" },
      };

      const enhanced = enhancer.enhance("search", result);

      expect(
        enhanced.suggestedActions.some(
          (a) => a.relatedTool === "semantic_search",
        ),
      ).toBe(true);
    });

    it("list_folders 空结果建议创建文件夹", () => {
      const result: ToolResult<{ folders: never[] }> = {
        success: true,
        data: { folders: [] },
      };

      const enhanced = enhancer.enhance("list_folders", result);

      expect(
        enhanced.suggestedActions.some(
          (a) => a.relatedTool === "create_folder",
        ),
      ).toBe(true);
    });

    it("create_folder 建议添加书签", () => {
      const result: ToolResult<{ id: number; name: string }> = {
        success: true,
        data: { id: 1, name: "新文件夹" },
      };

      const enhanced = enhancer.enhance("create_folder", result);

      expect(
        enhanced.suggestedActions.some(
          (a) => a.relatedTool === "move_bookmark",
        ),
      ).toBe(true);
    });
  });
});
