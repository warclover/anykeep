/**
 * FilterExtractor 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import {
  FilterExtractor,
  extractFilters,
  resetFilterExtractor,
} from "../filter-extractor";
import type {
  TimeRangeFilter,
  PlatformFilter,
  TagFilter,
  StarredFilter,
  ReadStatusFilter,
  SortPreference,
  LimitFilter,
  FolderFilter,
} from "../filter-extractor.types";

describe("FilterExtractor", () => {
  beforeEach(() => {
    resetFilterExtractor();
  });

  describe("时间范围提取", () => {
    it("应该提取「今天」", async () => {
      const result = await extractFilters("今天收藏的文章");

      expect(result.success).toBe(true);
      expect(result.filters.length).toBeGreaterThanOrEqual(1);

      const filter = result.filters.find(
        (f) => f.type === "time_range",
      ) as TimeRangeFilter;
      expect(filter.type).toBe("time_range");
      expect(filter.expression).toBe("今天");

      const today = new Date();
      expect(filter.start.toDateString()).toBe(today.toDateString());
      expect(filter.end.toDateString()).toBe(today.toDateString());
    });

    it("应该提取「昨天」", async () => {
      const result = await extractFilters("昨天的收藏");

      expect(result.success).toBe(true);
      expect(result.filters).toHaveLength(1);

      const filter = result.filters[0] as TimeRangeFilter;
      expect(filter.type).toBe("time_range");
      expect(filter.expression).toBe("昨天");

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(filter.start.toDateString()).toBe(yesterday.toDateString());
    });

    it("应该提取「最近7天」", async () => {
      const result = await extractFilters("最近7天的React文章");

      expect(result.success).toBe(true);
      expect(result.filters.length).toBeGreaterThanOrEqual(1);

      const timeFilter = result.filters.find(
        (f) => f.type === "time_range",
      ) as TimeRangeFilter;
      expect(timeFilter).toBeDefined();
      expect(timeFilter.expression).toBe("最近7天");

      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      expect(timeFilter.start.toDateString()).toBe(sevenDaysAgo.toDateString());
      expect(timeFilter.end.toDateString()).toBe(now.toDateString());
    });

    it("应该提取「本周」", async () => {
      const result = await extractFilters("本周收藏的内容");

      expect(result.success).toBe(true);
      const timeFilter = result.filters.find(
        (f) => f.type === "time_range",
      ) as TimeRangeFilter;
      expect(timeFilter).toBeDefined();
      expect(timeFilter.expression).toBe("本周");
    });

    it("应该提取「上个月」", async () => {
      const result = await extractFilters("上个月的文章");

      expect(result.success).toBe(true);
      const timeFilter = result.filters.find(
        (f) => f.type === "time_range",
      ) as TimeRangeFilter;
      expect(timeFilter).toBeDefined();
      expect(timeFilter.expression).toBe("上个月");
    });

    it("应该提取「最近」默认为7天", async () => {
      const result = await extractFilters("最近的收藏");

      expect(result.success).toBe(true);
      const timeFilter = result.filters.find(
        (f) => f.type === "time_range",
      ) as TimeRangeFilter;
      expect(timeFilter).toBeDefined();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      expect(timeFilter.start.toDateString()).toBe(sevenDaysAgo.toDateString());
    });
  });

  describe("平台提取", () => {
    it("应该提取「微信」", async () => {
      const result = await extractFilters("微信的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "platform",
      ) as PlatformFilter;
      expect(filter).toBeDefined();
      expect(filter.platform).toBe("wechat");
    });

    it("应该提取「B站」", async () => {
      const result = await extractFilters("b站的视频");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "platform",
      ) as PlatformFilter;
      expect(filter).toBeDefined();
      expect(filter.platform).toBe("bilibili");
    });

    it("应该提取「小红书」", async () => {
      const result = await extractFilters("小红书收藏");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "platform",
      ) as PlatformFilter;
      expect(filter).toBeDefined();
      expect(filter.platform).toBe("xiaohongshu");
    });

    it("应该提取「知乎」", async () => {
      const result = await extractFilters("知乎的回答");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "platform",
      ) as PlatformFilter;
      expect(filter).toBeDefined();
      expect(filter.platform).toBe("zhihu");
    });

    it("应该提取「GitHub」", async () => {
      const result = await extractFilters("github的仓库");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "platform",
      ) as PlatformFilter;
      expect(filter).toBeDefined();
      expect(filter.platform).toBe("github");
    });
  });

  describe("标签提取", () => {
    it("应该提取显式标签「标签为React」", async () => {
      const result = await extractFilters("标签为React的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find((f) => f.type === "tag") as TagFilter;
      expect(filter).toBeDefined();
      expect(filter.tags).toContain("React");
      expect(filter.matchMode).toBe("all");
    });

    it("应该提取「React相关的」", async () => {
      const result = await extractFilters("React相关的教程");

      expect(result.success).toBe(true);
      const filter = result.filters.find((f) => f.type === "tag") as TagFilter;
      expect(filter).toBeDefined();
      expect(filter.tags).toContain("React");
      expect(filter.matchMode).toBe("any");
    });

    it("应该提取「关于TypeScript的」", async () => {
      const result = await extractFilters("关于TypeScript的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find((f) => f.type === "tag") as TagFilter;
      expect(filter).toBeDefined();
      expect(filter.tags).toContain("TypeScript");
    });

    it("应该提取多标签「标签为React,Vue」", async () => {
      const result = await extractFilters("标签为React,Vue的对比文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find((f) => f.type === "tag") as TagFilter;
      expect(filter).toBeDefined();
      expect(filter.tags).toContain("React");
      expect(filter.tags).toContain("Vue");
    });
  });

  describe("星标过滤", () => {
    it("应该提取「星标的」", async () => {
      const result = await extractFilters("星标的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "starred",
      ) as StarredFilter;
      expect(filter).toBeDefined();
      expect(filter.isStarred).toBe(true);
    });

    it("应该提取「收藏的」", async () => {
      const result = await extractFilters("收藏的内容");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "starred",
      ) as StarredFilter;
      expect(filter).toBeDefined();
      expect(filter.isStarred).toBe(true);
    });

    it("应该提取「重要的」", async () => {
      const result = await extractFilters("重要的书签");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "starred",
      ) as StarredFilter;
      expect(filter).toBeDefined();
      expect(filter.isStarred).toBe(true);
    });
  });

  describe("已读状态过滤", () => {
    it("应该提取「未读的」", async () => {
      const result = await extractFilters("未读的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "read_status",
      ) as ReadStatusFilter;
      expect(filter).toBeDefined();
      expect(filter.isRead).toBe(false);
    });

    it("应该提取「没看的」", async () => {
      const result = await extractFilters("还没看的收藏");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "read_status",
      ) as ReadStatusFilter;
      expect(filter).toBeDefined();
      expect(filter.isRead).toBe(false);
    });

    it("应该提取「已读的」", async () => {
      const result = await extractFilters("已读的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "read_status",
      ) as ReadStatusFilter;
      expect(filter).toBeDefined();
      expect(filter.isRead).toBe(true);
    });
  });

  describe("文件夹过滤", () => {
    it("应该提取「工作文件夹里的」", async () => {
      const result = await extractFilters("工作文件夹里的文档");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "folder",
      ) as FolderFilter;
      expect(filter).toBeDefined();
      expect(filter.folderName).toBe("工作");
    });

    it("应该提取「学习目录下的」", async () => {
      const result = await extractFilters("学习目录下的教程");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "folder",
      ) as FolderFilter;
      expect(filter).toBeDefined();
      expect(filter.folderName).toBe("学习");
    });
  });

  describe("排序提取", () => {
    it("应该提取「最新的」", async () => {
      const result = await extractFilters("最新的文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "sort",
      ) as SortPreference;
      expect(filter).toBeDefined();
      expect(filter.field).toBe("time");
      expect(filter.direction).toBe("desc");
    });

    it("应该提取「最早的」", async () => {
      const result = await extractFilters("最早的收藏");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "sort",
      ) as SortPreference;
      expect(filter).toBeDefined();
      expect(filter.field).toBe("time");
      expect(filter.direction).toBe("asc");
    });

    it("应该提取「访问最多的」", async () => {
      const result = await extractFilters("访问最多的书签");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "sort",
      ) as SortPreference;
      expect(filter).toBeDefined();
      expect(filter.field).toBe("visits");
      expect(filter.direction).toBe("desc");
    });
  });

  describe("数量限制提取", () => {
    it("应该提取「前10条」", async () => {
      const result = await extractFilters("前10条文章");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "limit",
      ) as LimitFilter;
      expect(filter).toBeDefined();
      expect(filter.count).toBe(10);
    });

    it("应该提取「top5」", async () => {
      const result = await extractFilters("top5的收藏");

      expect(result.success).toBe(true);
      const filter = result.filters.find(
        (f) => f.type === "limit",
      ) as LimitFilter;
      expect(filter).toBeDefined();
      expect(filter.count).toBe(5);
    });
  });

  describe("复合过滤器提取", () => {
    it("应该提取多个过滤器「最近7天微信的React文章」", async () => {
      const result = await extractFilters("最近7天微信的React相关文章");

      expect(result.success).toBe(true);
      expect(result.filters.length).toBeGreaterThanOrEqual(2);

      const timeFilter = result.filters.find((f) => f.type === "time_range");
      const platformFilter = result.filters.find((f) => f.type === "platform");
      const tagFilter = result.filters.find((f) => f.type === "tag");

      expect(timeFilter).toBeDefined();
      expect(platformFilter).toBeDefined();
      expect(tagFilter).toBeDefined();
    });

    it("应该提取「未读的星标文章」", async () => {
      const result = await extractFilters("未读的星标文章");

      expect(result.success).toBe(true);

      const readFilter = result.filters.find((f) => f.type === "read_status");
      const starredFilter = result.filters.find((f) => f.type === "starred");

      expect(readFilter).toBeDefined();
      expect(starredFilter).toBeDefined();
    });
  });

  describe("查询清理", () => {
    it("应该正确清理匹配文本", async () => {
      const result = await extractFilters("最近7天的React教程");

      expect(result.cleanedQuery).not.toContain("最近7天");
      expect(result.cleanedQuery.length).toBeLessThan(
        "最近7天的React教程".length,
      );
    });

    it("空查询应该返回原始查询", async () => {
      const result = await extractFilters("");

      expect(result.success).toBe(true);
      expect(result.filters).toHaveLength(0);
      expect(result.cleanedQuery).toBe("");
    });

    it("短查询应该跳过提取", async () => {
      const result = await extractFilters("a");

      expect(result.success).toBe(true);
      expect(result.filters).toHaveLength(0);
    });
  });

  describe("置信度计算", () => {
    it("无过滤器时置信度为0.5", async () => {
      const result = await extractFilters("普通搜索词");

      expect(result.confidence).toBe(0.5);
    });

    it("有过滤器时置信度应该更高", async () => {
      const result = await extractFilters("最近7天的React文章");

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("多个过滤器时置信度最高", async () => {
      const result = await extractFilters("最近7天微信的星标React文章");

      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("FilterExtractor 类", () => {
    it("应该可以自定义配置", async () => {
      const extractor = new FilterExtractor({
        debug: true,
        maxFilters: 3,
      });

      const result = await extractor.extract("最近7天微信的React星标未读文章");

      expect(result.debug).toBeDefined();
      expect(result.debug?.originalQuery).toBe(
        "最近7天微信的React星标未读文章",
      );
      expect(result.filters.length).toBeLessThanOrEqual(3);
    });

    it("应该记录匹配的规则（debug模式）", async () => {
      const extractor = new FilterExtractor({ debug: true });
      const result = await extractor.extract("今天的文章");

      expect(result.debug?.matchedRules).toBeDefined();
      expect(result.debug?.matchedRules.length).toBeGreaterThan(0);
    });
  });
});
