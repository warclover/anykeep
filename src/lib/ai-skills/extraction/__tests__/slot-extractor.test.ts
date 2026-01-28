/**
 * 槽位提取器单元测试
 *
 * @module ai-skills/extraction/__tests__/slot-extractor.test
 */

import {
  SlotExtractor,
  createSlotExtractor,
  extractSlot,
  defineSlot,
  mergeWithDefaults,
  COUNT_SLOT,
  TIME_RANGE_SLOT,
  AUTO_EXECUTE_SLOT,
  DETAIL_LEVEL_SLOT,
  DIFFICULTY_SLOT,
  SORT_BY_SLOT,
  GROUP_BY_SLOT,
  EXPORT_FORMAT_SLOT,
  PREDEFINED_SLOTS,
} from "../slot-extractor";

describe("SlotExtractor", () => {
  describe("COUNT_SLOT", () => {
    const extractor = new SlotExtractor([COUNT_SLOT]);

    it("应提取数量（N条）", () => {
      const result = extractor.extract("整理50条收藏");
      expect(result.count).toBe(50);
    });

    it("应提取数量（N个）", () => {
      const result = extractor.extract("帮我找10个书签");
      expect(result.count).toBe(10);
    });

    it("应提取数量（最多N）", () => {
      const result = extractor.extract("最多100条");
      expect(result.count).toBe(100);
    });

    it("应提取数量（前N）", () => {
      const result = extractor.extract("前20条收藏");
      expect(result.count).toBe(20);
    });

    it("应提取数量（top N）", () => {
      const result = extractor.extract("top 5 bookmarks");
      expect(result.count).toBe(5);
    });

    it("无数量时应返回默认值", () => {
      const result = extractor.extract("整理收藏");
      expect(result.count).toBe(10);
    });

    it("应限制最大值为 200", () => {
      const result = extractor.extract("整理500条收藏");
      expect(result.count).toBe(200);
    });

    it("应限制最小值为 1", () => {
      const result = extractor.extract("整理0条收藏");
      expect(result.count).toBe(1);
    });
  });

  describe("TIME_RANGE_SLOT", () => {
    const extractor = new SlotExtractor([TIME_RANGE_SLOT]);

    it("应识别今天", () => {
      expect(extractor.extract("今天的收藏").timeRange).toBe("today");
      expect(extractor.extract("今日新增").timeRange).toBe("today");
    });

    it("应识别本周", () => {
      expect(extractor.extract("本周收藏").timeRange).toBe("week");
      expect(extractor.extract("这周的书签").timeRange).toBe("week");
      expect(extractor.extract("一周内").timeRange).toBe("week");
    });

    it("应识别本月", () => {
      expect(extractor.extract("本月收藏").timeRange).toBe("month");
      expect(extractor.extract("这个月的书签").timeRange).toBe("month");
      expect(extractor.extract("一个月内").timeRange).toBe("month");
    });

    it("应识别全部", () => {
      expect(extractor.extract("全部收藏").timeRange).toBe("all");
      expect(extractor.extract("所有书签").timeRange).toBe("all");
    });

    it("无时间范围时应返回默认值 all", () => {
      expect(extractor.extract("整理收藏").timeRange).toBe("all");
    });
  });

  describe("AUTO_EXECUTE_SLOT", () => {
    const extractor = new SlotExtractor([AUTO_EXECUTE_SLOT]);

    it("应识别自动执行", () => {
      expect(extractor.extract("自动整理").autoExecute).toBe(true);
      expect(extractor.extract("直接执行").autoExecute).toBe(true);
      expect(extractor.extract("立即处理").autoExecute).toBe(true);
      expect(extractor.extract("一键整理").autoExecute).toBe(true);
    });

    it("无自动执行标志时应返回 false", () => {
      expect(extractor.extract("整理收藏").autoExecute).toBe(false);
    });
  });

  describe("DETAIL_LEVEL_SLOT", () => {
    const extractor = new SlotExtractor([DETAIL_LEVEL_SLOT]);

    it("应识别简要", () => {
      expect(extractor.extract("简要摘要").detailLevel).toBe("brief");
      expect(extractor.extract("简单总结").detailLevel).toBe("brief");
    });

    it("应识别详细", () => {
      expect(extractor.extract("详细分析").detailLevel).toBe("detailed");
      expect(extractor.extract("完整报告").detailLevel).toBe("detailed");
      expect(extractor.extract("深度解读").detailLevel).toBe("detailed");
    });

    it("无详细程度时应返回 normal", () => {
      expect(extractor.extract("生成报告").detailLevel).toBe("normal");
    });
  });

  describe("DIFFICULTY_SLOT", () => {
    const extractor = new SlotExtractor([DIFFICULTY_SLOT]);

    it("应识别简单", () => {
      expect(extractor.extract("简单模式").difficulty).toBe("easy");
      expect(extractor.extract("基础级别").difficulty).toBe("easy");
    });

    it("应识别困难", () => {
      expect(extractor.extract("困难模式").difficulty).toBe("hard");
      expect(extractor.extract("高级设置").difficulty).toBe("hard");
      expect(extractor.extract("深度学习").difficulty).toBe("hard");
    });

    it("无难度时应返回 medium", () => {
      expect(extractor.extract("开始").difficulty).toBe("medium");
    });
  });

  describe("SORT_BY_SLOT", () => {
    const extractor = new SlotExtractor([SORT_BY_SLOT]);

    it("应识别按日期排序", () => {
      expect(extractor.extract("按日期排序").sortBy).toBe("date");
      expect(extractor.extract("按时间排列").sortBy).toBe("date");
    });

    it("应识别按相关度排序", () => {
      expect(extractor.extract("按相关度排序").sortBy).toBe("relevance");
    });

    it("应识别按标题排序", () => {
      expect(extractor.extract("按标题排序").sortBy).toBe("title");
    });

    it("无排序方式时应返回 date", () => {
      expect(extractor.extract("搜索书签").sortBy).toBe("date");
    });
  });

  describe("GROUP_BY_SLOT", () => {
    const extractor = new SlotExtractor([GROUP_BY_SLOT]);

    it("应识别按主题分组", () => {
      expect(extractor.extract("按主题分组").groupBy).toBe("topic");
    });

    it("应识别按日期分组", () => {
      expect(extractor.extract("按日期分组").groupBy).toBe("date");
    });

    it("应识别按平台分组", () => {
      expect(extractor.extract("按平台分组").groupBy).toBe("platform");
    });

    it("无分组方式时应返回 topic", () => {
      expect(extractor.extract("整理收藏").groupBy).toBe("topic");
    });
  });

  describe("EXPORT_FORMAT_SLOT", () => {
    const extractor = new SlotExtractor([EXPORT_FORMAT_SLOT]);

    it("应识别 markdown", () => {
      expect(extractor.extract("导出为 markdown").exportFormat).toBe(
        "markdown",
      );
      expect(extractor.extract("导出为 md").exportFormat).toBe("markdown");
    });

    it("应识别 json", () => {
      expect(extractor.extract("导出为 json").exportFormat).toBe("json");
    });

    it("应识别 csv", () => {
      expect(extractor.extract("导出为 csv").exportFormat).toBe("csv");
    });

    it("应识别 html", () => {
      expect(extractor.extract("导出为 html").exportFormat).toBe("html");
    });

    it("无格式时应返回 markdown", () => {
      expect(extractor.extract("导出收藏").exportFormat).toBe("markdown");
    });
  });

  describe("组合提取", () => {
    it("应同时提取多个槽位", () => {
      const extractor = new SlotExtractor([
        COUNT_SLOT,
        TIME_RANGE_SLOT,
        AUTO_EXECUTE_SLOT,
      ]);

      const result = extractor.extract("自动整理本月50条收藏");

      expect(result.count).toBe(50);
      expect(result.timeRange).toBe("month");
      expect(result.autoExecute).toBe(true);
    });

    it("应正确处理部分槽位未匹配的情况", () => {
      const extractor = new SlotExtractor([
        COUNT_SLOT,
        TIME_RANGE_SLOT,
        DIFFICULTY_SLOT,
      ]);

      const result = extractor.extract("整理书签");

      expect(result.count).toBe(10); // 默认值
      expect(result.timeRange).toBe("all"); // 默认值
      expect(result.difficulty).toBe("medium"); // 默认值
    });
  });

  describe("createSlotExtractor", () => {
    it("应使用预定义槽位名称创建提取器", () => {
      const extractor = createSlotExtractor(["count", "timeRange"]);

      const result = extractor.extract("整理100条本月收藏");

      expect(result.count).toBe(100);
      expect(result.timeRange).toBe("month");
    });

    it("应支持自定义槽位", () => {
      const customSlot = defineSlot<string>(
        "platform",
        "string",
        [/微信|weixin/i],
        {
          defaultValue: "unknown",
          transform: () => "wechat",
        },
      );

      const extractor = createSlotExtractor(["count"], [customSlot]);

      const result = extractor.extract("整理50条微信收藏");

      expect(result.count).toBe(50);
      expect(result.platform).toBe("wechat");
    });
  });

  describe("extractSlot", () => {
    it("应快速提取单个槽位", () => {
      expect(extractSlot<number>("整理100条", "count")).toBe(100);
      expect(extractSlot<string>("本月收藏", "timeRange")).toBe("month");
    });
  });

  describe("mergeWithDefaults", () => {
    it("应正确合并提取结果和默认值", () => {
      const extracted = { count: 50 };
      const defaults = {
        count: 10,
        timeRange: "week" as const,
        autoExecute: false,
      };

      const result = mergeWithDefaults(extracted, defaults);

      expect(result.count).toBe(50); // 提取的值
      expect(result.timeRange).toBe("week"); // 默认值
      expect(result.autoExecute).toBe(false); // 默认值
    });
  });

  describe("defineSlot", () => {
    it("应创建自定义槽位定义", () => {
      const slot = defineSlot<string>(
        "action",
        "enum",
        [/删除|移除/, /添加|新增/],
        {
          enumValues: ["delete", "add"] as const,
          defaultValue: "add",
          transform: (matched) => {
            if (/删除|移除/.test(matched)) return "delete";
            return "add";
          },
        },
      );

      expect(slot.name).toBe("action");
      expect(slot.type).toBe("enum");
      expect(slot.defaultValue).toBe("add");
      expect(slot.patterns).toHaveLength(2);
    });
  });

  describe("PREDEFINED_SLOTS", () => {
    it("应包含所有预定义槽位", () => {
      expect(PREDEFINED_SLOTS.count).toBeDefined();
      expect(PREDEFINED_SLOTS.timeRange).toBeDefined();
      expect(PREDEFINED_SLOTS.autoExecute).toBeDefined();
      expect(PREDEFINED_SLOTS.detailLevel).toBeDefined();
      expect(PREDEFINED_SLOTS.difficulty).toBeDefined();
      expect(PREDEFINED_SLOTS.sortBy).toBeDefined();
      expect(PREDEFINED_SLOTS.groupBy).toBeDefined();
      expect(PREDEFINED_SLOTS.exportFormat).toBeDefined();
    });
  });

  describe("严格模式", () => {
    it("必需槽位未提取时应抛错", () => {
      const requiredSlot = defineSlot<string>(
        "keyword",
        "string",
        [/关键词[：:]\s*(\S+)/],
        {
          required: true,
        },
      );

      const extractor = new SlotExtractor([requiredSlot], { strict: true });

      expect(() => extractor.extract("搜索书签")).toThrow(
        "Missing required slots: keyword",
      );
    });

    it("必需槽位已提取时不应抛错", () => {
      const requiredSlot = defineSlot<string>(
        "keyword",
        "string",
        [/关键词[：:]\s*(\S+)/],
        {
          required: true,
          transform: (matched) => matched,
        },
      );

      const extractor = new SlotExtractor([requiredSlot], { strict: true });

      expect(() => extractor.extract("关键词：AI")).not.toThrow();
    });
  });
});
