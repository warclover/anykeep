/**
 * 对比分析标题生成器
 *
 * 根据书签标题提取共同关键词，生成有意义的标题
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

/**
 * 停用词集合（中英文）
 */
const STOP_WORDS = new Set([
  "的",
  "了",
  "是",
  "在",
  "和",
  "与",
  "或",
  "为",
  "被",
  "让",
  "把",
  "从",
  "到",
  "对",
  "这",
  "那",
  "有",
  "我",
  "你",
  "他",
  "她",
  "它",
  "们",
  "个",
  "一",
  "不",
  "也",
  "都",
  "就",
  "还",
  "要",
  "会",
  "能",
  "可以",
  "可能",
  "应该",
  "需要",
  "如何",
  "怎么",
  "什么",
  "为什么",
  "哪些",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "and",
  "but",
  "if",
  "or",
  "because",
  "until",
  "while",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "he",
  "she",
  "his",
  "her",
  "what",
  "which",
  "who",
  "whom",
]);

/**
 * 关键词权重
 */
interface KeywordWeight {
  word: string;
  weight: number;
  frequency: number;
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text: string): string[] {
  const words: string[] = [];

  // 提取英文单词（至少2个字符）
  const englishMatches = text.match(/[a-zA-Z][a-zA-Z0-9]{1,}/g) || [];
  englishMatches.forEach((word) => {
    const lower = word.toLowerCase();
    if (!STOP_WORDS.has(lower)) {
      words.push(lower);
    }
  });

  // 提取中文词组（2-4字）
  const chineseText = text.replace(/[a-zA-Z0-9\s]+/g, "");
  // 优先提取较长的词组
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= chineseText.length - len; i++) {
      const word = chineseText.slice(i, i + len);
      if (!STOP_WORDS.has(word) && isValidChineseWord(word)) {
        words.push(word);
      }
    }
  }

  return words;
}

/**
 * 检查是否为有效的中文词组
 */
function isValidChineseWord(word: string): boolean {
  // 检查是否包含常见的无意义字符
  const invalidChars = /[，。、！？""''：；（）【】《》\s\d]/;
  return !invalidChars.test(word);
}

/**
 * 从多个标题中提取共同关键词
 *
 * @param titles 书签标题数组
 * @param topN 返回前 N 个关键词
 * @returns 排序后的关键词数组
 */
export function extractCommonKeywords(titles: string[], topN = 3): string[] {
  if (titles.length === 0) {
    return [];
  }

  // 收集所有关键词及其出现频率
  const keywordStats = new Map<string, KeywordWeight>();

  titles.forEach((title) => {
    const keywords = extractKeywords(title);
    const seen = new Set<string>(); // 同一标题内去重

    keywords.forEach((word) => {
      if (seen.has(word)) return;
      seen.add(word);

      const existing = keywordStats.get(word);
      if (existing) {
        existing.frequency += 1;
        // 出现在多个标题中的词权重更高
        existing.weight = existing.frequency * (word.length >= 2 ? 1.5 : 1);
      } else {
        keywordStats.set(word, {
          word,
          weight: word.length >= 2 ? 1.5 : 1,
          frequency: 1,
        });
      }
    });
  });

  // 优先选择出现在多个标题中的关键词
  const minFrequency = Math.max(1, Math.floor(titles.length * 0.3)); // 至少出现在 30% 的标题中

  const sortedKeywords = Array.from(keywordStats.values())
    .filter((kw) => kw.frequency >= minFrequency || titles.length <= 2)
    .sort((a, b) => {
      // 首先按频率排序
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      // 其次按权重排序
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      // 最后按词长排序（优先选择较长的词）
      return b.word.length - a.word.length;
    })
    .slice(0, topN)
    .map((kw) => kw.word);

  return sortedKeywords;
}

/**
 * 生成对比分析标题
 *
 * @param titles 书签标题数组
 * @returns 生成的标题
 */
export function generateSynthesisTitle(titles: string[]): string {
  if (titles.length === 0) {
    return "对比分析";
  }

  const keywords = extractCommonKeywords(titles, 3);

  if (keywords.length === 0) {
    // 无法提取共同关键词，使用回退方案
    return `${titles.length} 篇收藏对比分析`;
  }

  // 组合关键词生成标题
  if (keywords.length === 1) {
    return `${keywords[0]} 对比分析`;
  }

  // 多个关键词用顿号连接
  return `${keywords.slice(0, 2).join("·")} 对比分析`;
}
