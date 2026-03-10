/**
 * 分类系统共享文本处理工具
 *
 * 提取自多个匹配器的通用方法，遵循 DRY 原则。
 * 用于文本分词、截断等操作。
 */

// ============================================================================
// 分词工具
// ============================================================================

/**
 * 简单分词器
 * 支持中英文混合文本，按空格和标点分隔
 *
 * @param text 输入文本
 * @returns 分词结果数组
 *
 * @example
 * tokenize("Hello 世界") // ["Hello", "世界"]
 * tokenize("Next.js 是一个框架") // ["Next", "js", "是一个框架"]
 */
export function tokenize(text: string): string[] {
  // 移除标点符号（保留中文、英文字母、数字和空格）
  return text
    .replace(/[^\w\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * 分词并过滤短词
 *
 * @param text 输入文本
 * @param minLength 最小词长度（默认 2）
 * @param maxLength 最大词长度（默认 20）
 * @returns 过滤后的分词结果
 */
export function tokenizeFiltered(
  text: string,
  minLength = 2,
  maxLength = 20,
): string[] {
  return tokenize(text).filter(
    (word) => word.length >= minLength && word.length <= maxLength,
  );
}

// ============================================================================
// 字符串截断
// ============================================================================

/**
 * 截断字符串
 *
 * @param str 输入字符串
 * @param maxLength 最大长度
 * @param suffix 截断后缀（默认 "..."）
 * @returns 截断后的字符串
 *
 * @example
 * truncate("这是一个很长的标题", 5) // "这是一个很..."
 * truncate("Short", 10) // "Short"
 */
export function truncate(
  str: string,
  maxLength: number,
  suffix = "...",
): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + suffix;
}

// ============================================================================
// 标签规范化
// ============================================================================

/**
 * 规范化标签
 * 转小写、去首尾空格
 *
 * @param tag 原始标签
 * @returns 规范化后的标签
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim();
}

/**
 * 批量规范化标签
 *
 * @param tags 标签数组
 * @returns 规范化后的标签数组（去除空标签）
 */
export function normalizeTags(tags: string[]): string[] {
  return tags.map(normalizeTag).filter((tag) => tag.length > 0);
}

// ============================================================================
// 集合操作
// ============================================================================

/**
 * 计算 Jaccard 相似度
 *
 * @param setA 集合 A
 * @param setB 集合 B
 * @returns 0-1 之间的相似度分数
 */
export function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}
