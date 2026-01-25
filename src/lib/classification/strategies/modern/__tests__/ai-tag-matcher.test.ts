/**
 * AI 标签匹配器单元测试
 *
 * @module @/lib/classification/v5/classification-pipeline/__tests__/ai-tag-matcher.test
 */

import { AiTagMatcher } from "../ai-tag-matcher";
import type { ClassificationRequest, FolderTagProfile } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase 客户端
const createMockSupabase = (profiles: FolderTagProfile[] = []) => {
  // 修正：eq 必须返回一个既可以 await 也可以继续链式调用的对象
  // 实际上 Supabase 的 .eq() 返回的是 PostgrestFilterBuilder，它本身是 PromiseLike
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: any) => {
      // 使其成为 Thenable
      resolve({
        data: profiles.map((p) => ({
          folder_id: p.folderId,
          core_tags: p.coreTags,
          related_tags: p.relatedTags,
          folder_name_tokens: p.folderNameTokens,
          bookmark_count: p.bookmarkCount,
          folders: { name: p.folderName },
        })),
        error: null,
      });
    },
  };

  return {
    from: jest.fn().mockReturnValue(mockBuilder),
  } as unknown as SupabaseClient;
};

describe("AiTagMatcher", () => {
  const testProfiles: FolderTagProfile[] = [
    {
      folderId: 1,
      folderName: "独立开发与产品策略",
      coreTags: ["独立开发", "产品策略", "创业"],
      relatedTags: ["商业模式", "市场分析"],
      folderNameTokens: ["独立开发与产品策略", "独立开发", "产品策略"],
      bookmarkCount: 15,
    },
    {
      folderId: 2,
      folderName: "前端开发",
      coreTags: ["前端", "javascript", "react", "vue"],
      relatedTags: ["css", "html", "webpack"],
      folderNameTokens: ["前端开发"],
      bookmarkCount: 30,
    },
    {
      folderId: 3,
      folderName: "AI与机器学习",
      coreTags: ["ai", "机器学习", "深度学习"],
      relatedTags: ["神经网络", "tensorflow", "pytorch"],
      folderNameTokens: ["ai与机器学习", "ai", "机器学习"],
      bookmarkCount: 20,
    },
  ];

  describe("精确匹配 (exact_name)", () => {
    it("应该精确匹配标签与文件夹名", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-1",
        title: "90%的一人公司卡在年入50万：3个致命的商业结构缺陷",
        url: "https://example.com/article",
        tags: ["独立开发与产品策略"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("1");
      expect(result!.folderName).toBe("独立开发与产品策略");
      expect(result!.matchType).toBe("exact_name");
      expect(result!.confidence).toBe(0.98);
    });

    it("应该匹配标签包含文件夹名的情况", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-2",
        title: "前端开发最佳实践",
        url: "https://example.com/frontend",
        tags: ["前端开发入门"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("2");
      expect(result!.matchType).toBe("exact_name");
      expect(result!.confidence).toBe(0.95); // 0.98 - 0.03
    });

    it("应该匹配文件夹名包含标签的情况", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-3",
        title: "机器学习入门",
        url: "https://example.com/ml",
        tags: ["机器学习"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("3");
      expect(result!.matchType).toBe("exact_name");
    });
  });

  describe("核心标签匹配 (core_tag)", () => {
    it("应该匹配核心标签", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-4",
        title: "React Hooks 深入理解",
        url: "https://example.com/react-hooks",
        tags: ["react", "javascript"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("2");
      expect(result!.matchType).toBe("core_tag");
      expect(result!.matchedTags).toContain("react");
      expect(result!.matchedTags).toContain("javascript");
      expect(result!.confidence).toBe(0.92); // 命中 2+ 核心标签
    });

    it("单个核心标签匹配应降低置信度", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-5",
        title: "创业经验分享",
        url: "https://example.com/startup",
        tags: ["创业"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("1");
      expect(result!.matchType).toBe("core_tag");
      expect(result!.confidence).toBe(0.87); // 0.92 - 0.05
    });
  });

  describe("相关标签匹配 (related_tag)", () => {
    it("应该匹配相关标签（需要至少3个）", async () => {
      const profilesWithMoreRelated: FolderTagProfile[] = [
        {
          folderId: 4,
          folderName: "数据科学",
          coreTags: ["数据分析"],
          relatedTags: ["python", "pandas", "numpy", "统计", "可视化"],
          folderNameTokens: ["数据科学"],
          bookmarkCount: 25,
        },
      ];

      const supabase = createMockSupabase(profilesWithMoreRelated);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-6",
        title: "Python 数据处理",
        url: "https://example.com/python-data",
        tags: ["python", "pandas", "numpy"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("4");
      expect(result!.matchType).toBe("related_tag");
      expect(result!.matchedTags.length).toBeGreaterThanOrEqual(3);
      expect(result!.confidence).toBe(0.85);
    });

    it("少于3个相关标签不应匹配", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-7",
        title: "商业模式分析",
        url: "https://example.com/business",
        tags: ["商业模式"],
      };

      const result = await matcher.match(request);

      // 应该匹配到核心标签或不匹配，而不是相关标签
      if (result) {
        expect(result.matchType).not.toBe("related_tag");
      }
    });
  });

  describe("无匹配场景", () => {
    it("无标签时应返回 null", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-8",
        title: "随机文章",
        url: "https://example.com/random",
        tags: [],
      };

      const result = await matcher.match(request);

      expect(result).toBeNull();
    });

    it("tags 为 undefined 时应返回 null", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-9",
        title: "随机文章",
        url: "https://example.com/random",
      };

      const result = await matcher.match(request);

      expect(result).toBeNull();
    });

    it("无匹配的标签应返回 null", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-10",
        title: "无关文章",
        url: "https://example.com/unrelated",
        tags: ["完全无关的标签", "另一个无关标签"],
      };

      const result = await matcher.match(request);

      expect(result).toBeNull();
    });

    it("无文件夹画像时应返回 null", async () => {
      const supabase = createMockSupabase([]);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-11",
        title: "任意文章",
        url: "https://example.com/any",
        tags: ["独立开发与产品策略"],
      };

      const result = await matcher.match(request);

      expect(result).toBeNull();
    });
  });

  describe("缓存行为", () => {
    it("应缓存用户的文件夹画像", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-12",
        title: "测试文章",
        url: "https://example.com/test",
        tags: ["独立开发与产品策略"],
      };

      // 第一次调用
      await matcher.match(request);
      // 第二次调用
      await matcher.match(request);

      // Supabase 只应被调用一次
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it("清除缓存后应重新加载", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-13",
        title: "测试文章",
        url: "https://example.com/test",
        tags: ["独立开发与产品策略"],
      };

      // 第一次调用
      await matcher.match(request);

      // 清除缓存
      matcher.clearCache("user-1");

      // 第二次调用
      await matcher.match(request);

      // Supabase 应被调用两次
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });
  });

  describe("自定义配置", () => {
    it("应使用自定义置信度配置", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase, {
        exactMatchConfidence: 0.99,
        coreTagConfidence: 0.95,
        relatedTagConfidence: 0.88,
      });

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "bookmark-14",
        title: "测试文章",
        url: "https://example.com/test",
        tags: ["独立开发与产品策略"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.99);
    });
  });

  describe("验收用例", () => {
    it("书签「90%的一人公司卡在年入50万」应分类到「独立开发与产品策略」", async () => {
      const supabase = createMockSupabase(testProfiles);
      const matcher = new AiTagMatcher(supabase);

      const request: ClassificationRequest = {
        userId: "user-1",
        bookmarkId: "acceptance-test-1",
        title: "90%的一人公司卡在年入50万：3个致命的商业结构缺陷",
        url: "https://example.com/article",
        tags: ["独立开发与产品策略"],
      };

      const result = await matcher.match(request);

      expect(result).not.toBeNull();
      expect(result!.matched).toBe(true);
      expect(result!.folderId).toBe("1");
      expect(result!.folderName).toBe("独立开发与产品策略");
      expect(result!.confidence).toBeGreaterThanOrEqual(0.95);
    });
  });
});
