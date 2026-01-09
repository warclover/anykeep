/**
 * 中文数字解析器
 *
 * 支持:
 * - 基础数字: 一二三四五六七八九十
 * - 组合数字: 十一、二十、三十五
 * - 模糊数字: 几、若干
 * - 序数词: 第一、第二
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

// =============================================================================
// 常量定义
// =============================================================================

/**
 * 中文数字映射表
 */
const CHINESE_DIGIT_MAP: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  贰: 2,
  两: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
  十: 10,
  拾: 10,
};

/**
 * 模糊数字默认值
 */
const FUZZY_NUMBER_MAP: Record<string, number> = {
  几: 5,
  若干: 5,
  一些: 5,
  数: 5,
  多: 10,
  好几: 5,
};

/**
 * 中文数字字符集（用于正则匹配）
 */
export const CHINESE_NUMBER_CHARS =
  "一二三四五六七八九十两零〇壹贰叁肆伍陆柒捌玖拾";

/**
 * 中文模糊数字词集
 */
export const CHINESE_FUZZY_WORDS = ["几", "若干", "一些", "数", "多", "好几"];

// =============================================================================
// 核心函数
// =============================================================================

/**
 * 解析中文数字
 *
 * @param str 中文数字字符串
 * @returns 解析后的数字，无法解析返回 null
 *
 * @example
 * parseChineseNumber("三") // 3
 * parseChineseNumber("十五") // 15
 * parseChineseNumber("二十") // 20
 * parseChineseNumber("二十三") // 23
 * parseChineseNumber("几") // 5
 */
export function parseChineseNumber(str: string): number | null {
  if (!str) return null;

  const trimmed = str.trim();

  // 检查是否是阿拉伯数字
  const arabicNum = parseInt(trimmed, 10);
  if (!isNaN(arabicNum)) {
    return arabicNum;
  }

  // 检查模糊数字
  if (FUZZY_NUMBER_MAP[trimmed] !== undefined) {
    return FUZZY_NUMBER_MAP[trimmed];
  }

  // 单字符中文数字
  if (trimmed.length === 1 && CHINESE_DIGIT_MAP[trimmed] !== undefined) {
    return CHINESE_DIGIT_MAP[trimmed];
  }

  // 组合数字解析 (如 "十五", "二十", "二十三")
  if (trimmed.includes("十") || trimmed.includes("拾")) {
    const tenChar = trimmed.includes("十") ? "十" : "拾";
    const parts = trimmed.split(tenChar);

    // "十五" -> parts = ["", "五"]
    // "二十" -> parts = ["二", ""]
    // "二十三" -> parts = ["二", "三"]
    const tens = parts[0] ? (CHINESE_DIGIT_MAP[parts[0]] ?? 1) : 1;
    const ones = parts[1] ? (CHINESE_DIGIT_MAP[parts[1]] ?? 0) : 0;

    // 验证解析结果有效
    if (tens >= 1 && tens <= 9 && ones >= 0 && ones <= 9) {
      return tens * 10 + ones;
    }
  }

  // 尝试单字符解析（可能是大写数字）
  if (trimmed.length === 1) {
    const digit = CHINESE_DIGIT_MAP[trimmed];
    if (digit !== undefined) {
      return digit;
    }
  }

  return null;
}

/**
 * 数量提取结果
 */
export interface QuantityExtractionResult {
  /** 提取的数量 */
  count: number;
  /** 原始表达式 */
  expression: string;
  /** 匹配位置 */
  position: number;
  /** 是否有时间修饰（最近/前） */
  hasTimeModifier: boolean;
  /** 是否是模糊数字 */
  isFuzzy: boolean;
}

/**
 * 从文本中提取数量
 *
 * @param text 用户输入文本
 * @returns 提取的数量信息，无法提取返回 null
 *
 * @example
 * extractQuantity("最近三个收藏") // { count: 3, expression: "最近三个", position: 0, hasTimeModifier: true, isFuzzy: false }
 * extractQuantity("前5篇文章") // { count: 5, expression: "前5篇", position: 0, hasTimeModifier: true, isFuzzy: false }
 * extractQuantity("几篇文章") // { count: 5, expression: "几篇", position: 0, hasTimeModifier: false, isFuzzy: true }
 */
export function extractQuantity(text: string): QuantityExtractionResult | null {
  if (!text) return null;

  // 模式 1: 中文数字 + 量词
  // 匹配: 最近三个, 前五篇, 三条, 两份
  const chinesePattern = /(最近|前)?([一二三四五六七八九十两]+)[个篇条份本]/g;
  const chineseMatch = chinesePattern.exec(text);
  if (chineseMatch) {
    const count = parseChineseNumber(chineseMatch[2]);
    if (count !== null && count > 0 && count <= 100) {
      return {
        count,
        expression: chineseMatch[0],
        position: chineseMatch.index,
        hasTimeModifier: !!chineseMatch[1],
        isFuzzy: false,
      };
    }
  }

  // 模式 2: 模糊数字 + 量词
  // 匹配: 几个, 若干篇, 一些
  const fuzzyPattern = /(几|若干|一些|好几)[个篇条份本]?/g;
  const fuzzyMatch = fuzzyPattern.exec(text);
  if (fuzzyMatch) {
    const count = FUZZY_NUMBER_MAP[fuzzyMatch[1]] ?? 5;
    return {
      count,
      expression: fuzzyMatch[0],
      position: fuzzyMatch.index,
      hasTimeModifier: false,
      isFuzzy: true,
    };
  }

  // 模式 3: 阿拉伯数字 + 量词
  // 匹配: 最近3个, 前10篇, 5条
  const arabicPattern = /(最近|前)?(\d+)[个篇条份本]/g;
  const arabicMatch = arabicPattern.exec(text);
  if (arabicMatch) {
    const count = parseInt(arabicMatch[2], 10);
    if (!isNaN(count) && count > 0 && count <= 100) {
      return {
        count,
        expression: arabicMatch[0],
        position: arabicMatch.index,
        hasTimeModifier: !!arabicMatch[1],
        isFuzzy: false,
      };
    }
  }

  // 模式 4: "前N个" / "top N"
  // 匹配: 前10, top 5
  const topPattern = /前(\d+)|top\s*(\d+)/gi;
  const topMatch = topPattern.exec(text);
  if (topMatch) {
    const count = parseInt(topMatch[1] || topMatch[2], 10);
    if (!isNaN(count) && count > 0 && count <= 100) {
      return {
        count,
        expression: topMatch[0],
        position: topMatch.index,
        hasTimeModifier: true,
        isFuzzy: false,
      };
    }
  }

  // 模式 5: 序数词提取最大值
  // 匹配: 第三个 -> 理解为前3个
  const ordinalPattern = /第([一二三四五六七八九十]+|\d+)[个篇条份本]?/g;
  const ordinalMatch = ordinalPattern.exec(text);
  if (ordinalMatch) {
    const count = parseChineseNumber(ordinalMatch[1]);
    if (count !== null && count > 0 && count <= 100) {
      return {
        count,
        expression: ordinalMatch[0],
        position: ordinalMatch.index,
        hasTimeModifier: false,
        isFuzzy: false,
      };
    }
  }

  return null;
}

/**
 * 检查文本是否包含数量表达
 *
 * @param text 用户输入文本
 * @returns 是否包含数量表达
 */
export function hasQuantityExpression(text: string): boolean {
  return extractQuantity(text) !== null;
}

/**
 * 从文本中移除数量表达
 *
 * @param text 用户输入文本
 * @returns 移除数量表达后的文本
 *
 * @example
 * removeQuantityExpression("最近三个收藏的总结") // "收藏的总结"
 */
export function removeQuantityExpression(text: string): string {
  const result = extractQuantity(text);
  if (!result) return text;

  return (
    text.slice(0, result.position) +
    text.slice(result.position + result.expression.length)
  ).trim();
}

// =============================================================================
// 导出工具集
// =============================================================================

/**
 * 中文数字工具集
 */
export const CHINESE_NUMBER_UTILS = {
  parseChineseNumber,
  extractQuantity,
  hasQuantityExpression,
  removeQuantityExpression,
  CHINESE_NUMBER_CHARS,
  CHINESE_FUZZY_WORDS,
};
