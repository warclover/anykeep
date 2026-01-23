/**
 * AI 标签匹配器集成测试
 *
 * 测试 AI 标签匹配系统的端到端流程
 *
 * @module @/lib/classification/v5/classification-pipeline/__tests__/ai-tag-matcher.integration.test
 * @version 1.0.0
 * @since 2026-01-23
 */

import { AiTagMatcher } from "../ai-tag-matcher";
import { FolderTagProfilerService } from "../folder-tag-profiler.service";
import type { ClassificationRequest } from "../types";

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
};

describe("AiTagMatcher Integration Tests", () => {
  let matcher: AiTagMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    matcher = new AiTagMatcher(mockSupabase as any);
  });

  describe("端到端分类场景", () => {
    it("应该正确分类「独立开发与产品策略」标签的书签", async () => {
      // 准备测试数据：模拟文件夹画像
      const mockProfiles = [
        {
          folder_id: 1,
          core_tags: ["独立开发与产品策略", "创业", "产品"],
          related_tags: ["商业模式", "增长"],
          folder_name_tokens: ["独立开发与产品策略"],
          bookmark_count: 10,
          folders: { name: "独立开发与产品策略" },
        },
        {
          folder_id: 2,
          core_tags: ["前端开发", "react", "vue"],
          related_tags: ["javascript", "css"],
          folder_name_tokens: ["前端开发"],
          bookmark_count: 20,
          folders: { name: "前端开发" },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }),
      });

      // 测试请求
      const request: ClassificationRequest = {
        bookmarkId: "test-1",
        userId: "user-1",
        title: "90%的一人公司卡在年入50万：3个致命的商业结构缺陷",
        url: "https://example.com/article",
        tags: ["独立开发与产品策略"],
      };

      const result = await matcher.match(request);

      // 验证结果
      expect(result).not.toBeNull();
      expect(result?.matched).toBe(true);
      expect(result?.folderId).toBe("1");
      expect(result?.folderName).toBe("独立开发与产品策略");
      expect(result?.matchType).toBe("exact_name");
      expect(result?.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it("应该通过核心标签匹配分类", async () => {
      const mockProfiles = [
        {
          folder_id: 3,
          core_tags: ["人工智能", "机器学习", "深度学习"],
          related_tags: ["神经网络", "nlp"],
          folder_name_tokens: ["ai技术"],
          bookmark_count: 15,
          folders: { name: "AI技术" },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }),
      });

      const request: ClassificationRequest = {
        bookmarkId: "test-2",
        userId: "user-1",
        title: "GPT-4 技术解析",
        url: "https://example.com/gpt4",
        tags: ["人工智能", "机器学习"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result?.matched).toBe(true);
      expect(result?.matchType).toBe("core_tag");
      expect(result?.matchedTags).toContain("人工智能");
      expect(result?.matchedTags).toContain("机器学习");
    });

    it("应该通过相关标签匹配分类", async () => {
      const mockProfiles = [
        {
          folder_id: 4,
          core_tags: ["投资理财"],
          related_tags: ["股票", "基金", "债券", "理财产品"],
          folder_name_tokens: ["投资理财"],
          bookmark_count: 25,
          folders: { name: "投资理财" },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }),
      });

      const request: ClassificationRequest = {
        bookmarkId: "test-3",
        userId: "user-1",
        title: "2026年基金投资策略",
        url: "https://example.com/fund",
        tags: ["股票", "基金", "债券"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result?.matched).toBe(true);
      expect(result?.matchType).toBe("related_tag");
      expect(result?.matchedTags.length).toBeGreaterThanOrEqual(3);
    });

    it("无匹配时应返回 null", async () => {
      const mockProfiles = [
        {
          folder_id: 1,
          core_tags: ["前端开发"],
          related_tags: ["react"],
          folder_name_tokens: ["前端开发"],
          bookmark_count: 10,
          folders: { name: "前端开发" },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }),
      });

      const request: ClassificationRequest = {
        bookmarkId: "test-4",
        userId: "user-1",
        title: "美食推荐",
        url: "https://example.com/food",
        tags: ["美食", "餐厅"],
      };

      const result = await matcher.match(request);

      expect(result).toBeNull();
    });

    it("无标签时应返回 null", async () => {
      const request: ClassificationRequest = {
        bookmarkId: "test-5",
        userId: "user-1",
        title: "测试文章",
        url: "https://example.com/test",
        tags: [],
      };

      const result = await matcher.match(request);

      expect(result).toBeNull();
    });
  });

  describe("缓存机制", () => {
    it("应该缓存文件夹画像", async () => {
      const mockProfiles = [
        {
          folder_id: 1,
          core_tags: ["测试"],
          related_tags: [],
          folder_name_tokens: ["测试"],
          bookmark_count: 5,
          folders: { name: "测试" },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }),
      });

      // 第一次调用
      await matcher.getFolderProfiles("user-1");
      // 第二次调用
      await matcher.getFolderProfiles("user-1");

      // 应该只查询数据库一次
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("clearCache 应该清除指定用户的缓存", async () => {
      const mockProfiles = [
        {
          folder_id: 1,
          core_tags: ["测试"],
          related_tags: [],
          folder_name_tokens: ["测试"],
          bookmark_count: 5,
          folders: { name: "测试" },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockProfiles,
            error: null,
          }),
        }),
      });

      // 第一次调用
      await matcher.getFolderProfiles("user-1");

      // 清除缓存
      matcher.clearCache("user-1");

      // 再次调用
      await matcher.getFolderProfiles("user-1");

      // 应该查询数据库两次
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });
});

describe("FolderTagProfilerService Integration Tests", () => {
  let profiler: FolderTagProfilerService;

  beforeEach(() => {
    jest.clearAllMocks();
    profiler = new FolderTagProfilerService(mockSupabase as any);
  });

  describe("画像生成逻辑", () => {
    it("应该正确计算核心标签和相关标签", async () => {
      // 模拟文件夹
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "folders") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ id: 1, name: "测试文件夹" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "bookmarks") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  not: jest.fn().mockResolvedValue({
                    data: [
                      { ai_tags: ["标签A", "标签B"] },
                      { ai_tags: ["标签A", "标签C"] },
                      { ai_tags: ["标签A", "标签B"] },
                      { ai_tags: ["标签A"] },
                      { ai_tags: ["标签D"] },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "folder_tag_profiles") {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return { select: jest.fn() };
      });

      await profiler.updateFolderProfile("user-1", 1, "测试文件夹");

      // 验证 upsert 被调用
      expect(mockSupabase.from).toHaveBeenCalledWith("folder_tag_profiles");
    });

    it("空文件夹应该使用文件夹名分词作为核心标签", async () => {
      let upsertData: any = null;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "bookmarks") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "folder_tag_profiles") {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertData = data;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return { select: jest.fn() };
      });

      await profiler.updateFolderProfile("user-1", 1, "独立开发与产品策略");

      // 验证核心标签包含文件夹名分词
      expect(upsertData).not.toBeNull();
      expect(upsertData.core_tags).toContain("独立开发与产品策略");
    });
  });

  describe("文件夹名分词", () => {
    it("应该正确分词包含分隔符的文件夹名", async () => {
      let upsertData: any = null;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "bookmarks") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "folder_tag_profiles") {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertData = data;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return { select: jest.fn() };
      });

      await profiler.updateFolderProfile("user-1", 1, "前端与后端");

      // 验证分词结果
      expect(upsertData.folder_name_tokens).toContain("前端与后端");
      expect(upsertData.folder_name_tokens).toContain("前端");
      expect(upsertData.folder_name_tokens).toContain("后端");
    });
  });
});
