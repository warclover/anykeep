/**
 * 内容提取工具函数
 * 统一的字数统计、图片计数等功能
 */

import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "./html-utils";

/**
 * 提取正文内容区域
 * 优先提取微信公众号正文、article、main 等语义化标签
 */
export function extractMainContent(html: string): string {
  // 移除脚本和样式
  const text = removeScriptsAndStyles(html);

  // 微信公众号正文
  const wechatContent = text.match(
    /<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (wechatContent) {
    return wechatContent[1];
  }

  // article 标签
  const articleContent = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleContent) {
    return articleContent[1];
  }

  // main 标签
  const mainContent = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainContent) {
    return mainContent[1];
  }

  // 无法识别，返回清理后的全文
  return text;
}

/**
 * 提取正文字数
 * 从 HTML 中提取纯文本并计算字数（中文按字符计算）
 */
export function extractWordCount(html: string): number {
  // 提取正文区域
  const content = extractMainContent(html);

  // 移除 HTML 标签并解码实体
  let text = stripHtmlTags(content);
  text = decodeHtmlEntities(text);

  // 移除所有空白字符
  text = text.replace(/\s+/g, "");

  return text.length;
}

/**
 * 提取图片数量
 * 统计 HTML 中的有效 img 标签数量（排除小图标、表情等）
 */
export function extractImageCount(html: string): number {
  // 提取正文区域
  const contentHtml = extractMainContent(html);

  // 匹配所有 img 标签
  const imgMatches = contentHtml.match(/<img[^>]+>/gi) || [];

  // 过滤掉小图片（如表情、图标等）
  const validImages = imgMatches.filter((img) => {
    // 排除带有 emoji、icon、avatar、logo、qr 类名的图片
    if (/class=["'][^"']*(?:emoji|icon|avatar|logo|qr)[^"']*["']/i.test(img)) {
      return false;
    }

    // 排除过小的图片（宽高小于 50px）
    const widthMatch = img.match(/width=["']?(\d+)/i);
    const heightMatch = img.match(/height=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 50) return false;
    if (heightMatch && parseInt(heightMatch[1]) < 50) return false;

    return true;
  });

  return validImages.length;
}

// ============================================================
// 两步法摘要 - 关键内容提取（Step 1）
// ============================================================

/**
 * 将文本分割为句子
 * 支持中英文混合内容
 */
function splitIntoSentences(text: string): string[] {
  // 中英文句子分割：句号、问号、感叹号后分割
  return text
    .split(/(?<=[。！？.!?])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // 过滤过短句子
}

/**
 * 计算句子的关键词密度得分
 * 得分越高，句子越重要
 */
function scoreSentence(sentence: string): number {
  let score = 0;

  // 包含数字（通常是数据/结论）+2分
  if (/\d+/.test(sentence)) score += 2;

  // 包含关键指示词 +1分/词
  const indicators = [
    "重要",
    "关键",
    "核心",
    "总结",
    "结论",
    "综上",
    "首先",
    "其次",
    "最后",
    "因此",
    "所以",
    "但是",
    "然而",
    "需要",
    "必须",
    "建议",
    "推荐",
    "注意",
    "步骤",
    "方法",
    "技巧",
    "原则",
    "要点",
    "特点",
    "优势",
    "缺点",
    "问题",
    "解决",
    "实现",
    "通过",
  ];
  indicators.forEach((word) => {
    if (sentence.includes(word)) score += 1;
  });

  // 句子长度适中（20-100字）得分更高 +1分
  const len = sentence.length;
  if (len >= 20 && len <= 100) score += 1;

  return score;
}

/**
 * 提取关键内容（两步法摘要 Step 1）
 *
 * 设计原理:
 * 1. 首段优先 - 文章开头通常包含核心观点
 * 2. 末段重要 - 文章结尾通常是总结
 * 3. 关键词加权 - 包含指示词的句子更重要
 * 4. 段首句 - 每段首句通常是段落主旨
 *
 * @param content 原始内容（纯文本）
 * @param maxLength 最大输出长度（字符数），默认 2000
 * @returns 提取后的关键内容
 */
export function extractKeyContent(
  content: string,
  maxLength: number = 2000,
): string {
  // 内容已经足够短，直接返回
  if (!content || content.length <= maxLength) {
    return content;
  }

  const sentences = splitIntoSentences(content);
  if (sentences.length === 0) {
    return content.substring(0, maxLength);
  }

  const selected: Array<{
    sentence: string;
    score: number;
    position: number;
  }> = [];

  // 规则 1: 首段句子（高优先级，得分 10/9/8）
  sentences.slice(0, 3).forEach((s, i) => {
    selected.push({ sentence: s, score: 10 - i, position: i });
  });

  // 规则 2: 末段句子（高优先级，得分 8/7/6）
  const lastThree = sentences.slice(-3);
  lastThree.forEach((s, i) => {
    const pos = sentences.length - 3 + i;
    // 避免与首段重复
    if (pos >= 3) {
      selected.push({ sentence: s, score: 8 - i, position: pos });
    }
  });

  // 规则 3: 中间段落的高分句子（基于关键词评分）
  const middleSentences = sentences.slice(3, -3);
  middleSentences.forEach((s, i) => {
    const score = scoreSentence(s);
    if (score >= 2) {
      selected.push({ sentence: s, score, position: i + 3 });
    }
  });

  // 规则 4: 段落首句（每段核心观点，得分 5）
  const paragraphs = content.split(/\n\n+/);
  paragraphs.forEach((p, pIndex) => {
    const firstSentence = splitIntoSentences(p)[0];
    if (firstSentence && !selected.some((s) => s.sentence === firstSentence)) {
      selected.push({
        sentence: firstSentence,
        score: 5,
        position: pIndex * 10, // 估算位置
      });
    }
  });

  // 去重：相同句子只保留得分最高的
  const uniqueMap = new Map<string, (typeof selected)[0]>();
  selected.forEach((item) => {
    const existing = uniqueMap.get(item.sentence);
    if (!existing || item.score > existing.score) {
      uniqueMap.set(item.sentence, item);
    }
  });

  // 按得分排序，取高分句子
  const sorted = Array.from(uniqueMap.values()).sort(
    (a, b) => b.score - a.score,
  );

  // 取前 15 个高分句子，然后按原文顺序组装（保持阅读连贯性）
  const topSentences = sorted.slice(0, 15);
  const ordered = topSentences.sort((a, b) => a.position - b.position);

  // 组装结果，控制总长度
  let result = "";
  for (const item of ordered) {
    if (result.length + item.sentence.length + 1 > maxLength) break;
    result += item.sentence + " ";
  }

  return result.trim();
}

/**
 * 获取提取统计信息（用于日志和监控）
 *
 * @param originalLength 原始内容长度
 * @param extractedLength 提取后内容长度
 * @returns 压缩统计
 */
export function getExtractionStats(
  originalLength: number,
  extractedLength: number,
): { compressionRatio: number; savedChars: number } {
  const compressionRatio = Math.round(
    (1 - extractedLength / originalLength) * 100,
  );
  const savedChars = originalLength - extractedLength;
  return { compressionRatio, savedChars };
}

/**
 * 检测摘要是否完整（以有效标点结尾）
 * 用于 Step 2 后的质量检测
 */
export function isSummaryComplete(summary: string): boolean {
  const trimmed = summary.trim();
  if (trimmed.length === 0) return false;

  // 有效的句末标点（中英文）
  const validEndings = [
    "。", // 中文句号
    "！", // 中文感叹号
    "？", // 中文问号
    "…", // 省略号
    "\u201D", // 中文右引号 "
    "）", // 中文右括号
    "」", // 中文右引号
    ".", // 英文句号
    "!", // 英文感叹号
    "?", // 英文问号
  ];
  const lastChar = trimmed.slice(-1);
  return validEndings.includes(lastChar);
}
