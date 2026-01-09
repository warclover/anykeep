/**
 * 中文数字解析器测试
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import {
  parseChineseNumber,
  extractQuantity,
  hasQuantityExpression,
  removeQuantityExpression,
} from "../chinese-number-parser";

describe("ChineseNumberParser", () => {
  // ============================================
  // parseChineseNumber 测试
  // ============================================
  describe("parseChineseNumber", () => {
    describe("基础数字解析", () => {
      const basicCases = [
        { input: "一", expected: 1 },
        { input: "二", expected: 2 },
        { input: "两", expected: 2 },
        { input: "三", expected: 3 },
        { input: "四", expected: 4 },
        { input: "五", expected: 5 },
        { input: "六", expected: 6 },
        { input: "七", expected: 7 },
        { input: "八", expected: 8 },
        { input: "九", expected: 9 },
        { input: "十", expected: 10 },
      ];

      test.each(basicCases)(
        '应将 "$input" 解析为 $expected',
        ({ input, expected }) => {
          expect(parseChineseNumber(input)).toBe(expected);
        },
      );
    });

    describe("大写数字解析", () => {
      const capitalCases = [
        { input: "壹", expected: 1 },
        { input: "贰", expected: 2 },
        { input: "叁", expected: 3 },
        { input: "肆", expected: 4 },
        { input: "伍", expected: 5 },
        { input: "陆", expected: 6 },
        { input: "柒", expected: 7 },
        { input: "捌", expected: 8 },
        { input: "玖", expected: 9 },
        { input: "拾", expected: 10 },
      ];

      test.each(capitalCases)(
        '应将大写数字 "$input" 解析为 $expected',
        ({ input, expected }) => {
          expect(parseChineseNumber(input)).toBe(expected);
        },
      );
    });

    describe("组合数字解析", () => {
      const combinedCases = [
        { input: "十一", expected: 11 },
        { input: "十二", expected: 12 },
        { input: "十五", expected: 15 },
        { input: "十九", expected: 19 },
        { input: "二十", expected: 20 },
        { input: "二十一", expected: 21 },
        { input: "二十三", expected: 23 },
        { input: "三十", expected: 30 },
        { input: "三十五", expected: 35 },
        { input: "五十", expected: 50 },
        { input: "九十九", expected: 99 },
      ];

      test.each(combinedCases)(
        '应将组合数字 "$input" 解析为 $expected',
        ({ input, expected }) => {
          expect(parseChineseNumber(input)).toBe(expected);
        },
      );
    });

    describe("模糊数字解析", () => {
      const fuzzyCases = [
        { input: "几", expected: 5 },
        { input: "若干", expected: 5 },
        { input: "一些", expected: 5 },
        { input: "多", expected: 10 },
        { input: "好几", expected: 5 },
      ];

      test.each(fuzzyCases)(
        '应将模糊数字 "$input" 解析为默认值 $expected',
        ({ input, expected }) => {
          expect(parseChineseNumber(input)).toBe(expected);
        },
      );
    });

    describe("阿拉伯数字解析", () => {
      const arabicCases = [
        { input: "1", expected: 1 },
        { input: "3", expected: 3 },
        { input: "5", expected: 5 },
        { input: "10", expected: 10 },
        { input: "15", expected: 15 },
        { input: "99", expected: 99 },
      ];

      test.each(arabicCases)(
        '应将阿拉伯数字 "$input" 解析为 $expected',
        ({ input, expected }) => {
          expect(parseChineseNumber(input)).toBe(expected);
        },
      );
    });

    describe("无效输入处理", () => {
      const invalidCases = [
        { input: "", expected: null },
        { input: "abc", expected: null },
        { input: "你好", expected: null },
        { input: "百", expected: null },
        { input: "千", expected: null },
      ];

      test.each(invalidCases)(
        '应将无效输入 "$input" 返回 null',
        ({ input, expected }) => {
          expect(parseChineseNumber(input)).toBe(expected);
        },
      );
    });

    it("应处理带空格的输入", () => {
      expect(parseChineseNumber("  三  ")).toBe(3);
      expect(parseChineseNumber(" 十五 ")).toBe(15);
    });
  });

  // ============================================
  // extractQuantity 测试
  // ============================================
  describe("extractQuantity", () => {
    describe("中文数字 + 量词", () => {
      const chineseCases = [
        {
          input: "最近三个收藏",
          expected: { count: 3, hasTimeModifier: true, isFuzzy: false },
        },
        {
          input: "前五篇文章",
          expected: { count: 5, hasTimeModifier: true, isFuzzy: false },
        },
        {
          input: "三条记录",
          expected: { count: 3, hasTimeModifier: false, isFuzzy: false },
        },
        {
          input: "两份资料",
          expected: { count: 2, hasTimeModifier: false, isFuzzy: false },
        },
        {
          input: "十个书签",
          expected: { count: 10, hasTimeModifier: false, isFuzzy: false },
        },
      ];

      test.each(chineseCases)(
        '应从 "$input" 提取数量',
        ({ input, expected }) => {
          const result = extractQuantity(input);
          expect(result).not.toBeNull();
          expect(result?.count).toBe(expected.count);
          expect(result?.hasTimeModifier).toBe(expected.hasTimeModifier);
          expect(result?.isFuzzy).toBe(expected.isFuzzy);
        },
      );
    });

    describe("阿拉伯数字 + 量词", () => {
      const arabicCases = [
        {
          input: "最近3个收藏",
          expected: { count: 3, hasTimeModifier: true },
        },
        {
          input: "前10篇文章",
          expected: { count: 10, hasTimeModifier: true },
        },
        {
          input: "5条记录",
          expected: { count: 5, hasTimeModifier: false },
        },
      ];

      test.each(arabicCases)(
        '应从 "$input" 提取数量',
        ({ input, expected }) => {
          const result = extractQuantity(input);
          expect(result).not.toBeNull();
          expect(result?.count).toBe(expected.count);
          expect(result?.hasTimeModifier).toBe(expected.hasTimeModifier);
        },
      );
    });

    describe("模糊数字", () => {
      const fuzzyCases = [
        { input: "几个收藏", expected: { count: 5, isFuzzy: true } },
        { input: "若干篇文章", expected: { count: 5, isFuzzy: true } },
        { input: "一些内容", expected: { count: 5, isFuzzy: true } },
      ];

      test.each(fuzzyCases)(
        '应从 "$input" 提取模糊数量',
        ({ input, expected }) => {
          const result = extractQuantity(input);
          expect(result).not.toBeNull();
          expect(result?.count).toBe(expected.count);
          expect(result?.isFuzzy).toBe(expected.isFuzzy);
        },
      );
    });

    describe("top N 模式", () => {
      const topCases = [
        { input: "前10", expected: { count: 10 } },
        { input: "top 5", expected: { count: 5 } },
        { input: "top5", expected: { count: 5 } },
        { input: "TOP 3", expected: { count: 3 } },
      ];

      test.each(topCases)('应从 "$input" 提取数量', ({ input, expected }) => {
        const result = extractQuantity(input);
        expect(result).not.toBeNull();
        expect(result?.count).toBe(expected.count);
      });
    });

    describe("实际用户输入场景", () => {
      const realWorldCases = [
        {
          input: "结合最近三个收藏写个总结",
          expected: { count: 3, hasTimeModifier: true },
        },
        {
          input: "把最近五篇整合一下",
          expected: { count: 5, hasTimeModifier: true },
        },
        {
          input: "帮我总结一下前十篇",
          expected: { count: 10, hasTimeModifier: true },
        },
        {
          input: "整理这几个收藏",
          expected: { count: 5, isFuzzy: true },
        },
      ];

      test.each(realWorldCases)(
        '应从实际输入 "$input" 提取数量',
        ({ input, expected }) => {
          const result = extractQuantity(input);
          expect(result).not.toBeNull();
          expect(result?.count).toBe(expected.count);
          if (expected.hasTimeModifier !== undefined) {
            expect(result?.hasTimeModifier).toBe(expected.hasTimeModifier);
          }
          if (expected.isFuzzy !== undefined) {
            expect(result?.isFuzzy).toBe(expected.isFuzzy);
          }
        },
      );
    });

    describe("无数量表达的输入", () => {
      const noCases = [
        "找一下关于 React 的文章",
        "帮我整理收藏",
        "总结这些内容",
        "没有数字的句子",
      ];

      test.each(noCases)('应从 "%s" 返回 null', (input) => {
        expect(extractQuantity(input)).toBeNull();
      });
    });

    describe("边界情况", () => {
      it("应处理空字符串", () => {
        expect(extractQuantity("")).toBeNull();
      });

      it("应处理超出范围的数字", () => {
        // 数字必须在 1-100 范围内
        expect(extractQuantity("0个")).toBeNull();
        expect(extractQuantity("101个")).toBeNull();
      });

      it("应返回匹配位置", () => {
        const result = extractQuantity("请找最近三个收藏");
        expect(result).not.toBeNull();
        expect(result?.position).toBe(2); // "最近三个" 从位置 2 开始
      });
    });
  });

  // ============================================
  // hasQuantityExpression 测试
  // ============================================
  describe("hasQuantityExpression", () => {
    it("应检测到数量表达", () => {
      expect(hasQuantityExpression("最近三个收藏")).toBe(true);
      expect(hasQuantityExpression("前5篇文章")).toBe(true);
      expect(hasQuantityExpression("几个书签")).toBe(true);
    });

    it("应检测不到数量表达", () => {
      expect(hasQuantityExpression("帮我整理收藏")).toBe(false);
      expect(hasQuantityExpression("找一下 React")).toBe(false);
    });
  });

  // ============================================
  // removeQuantityExpression 测试
  // ============================================
  describe("removeQuantityExpression", () => {
    const removeCases = [
      { input: "最近三个收藏的总结", expected: "收藏的总结" },
      { input: "前五篇文章整合", expected: "文章整合" },
      { input: "帮我整理收藏", expected: "帮我整理收藏" }, // 无数量表达
    ];

    test.each(removeCases)(
      '应从 "$input" 移除数量表达得到 "$expected"',
      ({ input, expected }) => {
        expect(removeQuantityExpression(input)).toBe(expected);
      },
    );
  });
});
