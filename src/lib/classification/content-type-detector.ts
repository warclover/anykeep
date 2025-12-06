/**
 * Content Type Detector
 * Detects content type based on URL, title, description, and content features
 *
 * Supports 4 core types (P0):
 * - article: General articles (news, blogs, opinions)
 * - tutorial: Tutorials/guides (step-oriented)
 * - video: Video content (Bilibili, YouTube)
 * - tool: Tool/product introductions
 */

import { logger } from "@/lib/logger";

/**
 * Content type enum
 */
export type ContentType = "article" | "tutorial" | "video" | "tool";

/**
 * Content type labels for display
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: "文章",
  tutorial: "教程",
  video: "视频",
  tool: "工具",
};

/**
 * Content type detection result
 */
export interface ContentTypeResult {
  type: ContentType;
  confidence: number; // 0-100
  signals: string[]; // Detection signals for debugging
}

/**
 * Detection input
 */
export interface DetectionInput {
  url?: string;
  title: string;
  description?: string;
  content?: string;
}

// ============================================================
// URL Domain Rules
// ============================================================

interface URLRule {
  pattern: string | RegExp;
  type: ContentType;
  confidence: number;
}

const URL_RULES: URLRule[] = [
  // Video platforms (highest confidence)
  { pattern: "bilibili.com", type: "video", confidence: 95 },
  { pattern: "b23.tv", type: "video", confidence: 95 },
  { pattern: "youtube.com", type: "video", confidence: 95 },
  { pattern: "youtu.be", type: "video", confidence: 95 },
  { pattern: "douyin.com", type: "video", confidence: 90 },
  { pattern: "v.qq.com", type: "video", confidence: 90 },
  { pattern: "ixigua.com", type: "video", confidence: 90 },

  // Tool/Product platforms
  { pattern: "github.com", type: "tool", confidence: 85 },
  { pattern: "gitee.com", type: "tool", confidence: 85 },
  { pattern: "npmjs.com", type: "tool", confidence: 85 },
  { pattern: "producthunt.com", type: "tool", confidence: 90 },
  { pattern: "alternativeto.net", type: "tool", confidence: 85 },
  { pattern: "appstore", type: "tool", confidence: 80 },
  { pattern: "play.google.com", type: "tool", confidence: 80 },

  // Tutorial/Technical platforms
  { pattern: "juejin.cn", type: "tutorial", confidence: 75 },
  { pattern: "blog.csdn.net", type: "tutorial", confidence: 75 },
  { pattern: "segmentfault.com", type: "tutorial", confidence: 75 },
  { pattern: "cnblogs.com", type: "tutorial", confidence: 70 },
  { pattern: "dev.to", type: "tutorial", confidence: 75 },
  { pattern: "medium.com", type: "article", confidence: 70 },
  { pattern: /docs\..+/, type: "tutorial", confidence: 80 },
  { pattern: /developer\..+/, type: "tutorial", confidence: 75 },
  { pattern: "readthedocs.io", type: "tutorial", confidence: 85 },

  // Article platforms
  { pattern: "mp.weixin.qq.com", type: "article", confidence: 80 },
  { pattern: "zhuanlan.zhihu.com", type: "article", confidence: 75 },
  { pattern: "zhihu.com/question", type: "article", confidence: 70 },
  { pattern: "sspai.com", type: "article", confidence: 75 },
  { pattern: "36kr.com", type: "article", confidence: 80 },
  { pattern: "thepaper.cn", type: "article", confidence: 80 },
  { pattern: "xiaohongshu.com", type: "article", confidence: 70 },
  { pattern: "weibo.com", type: "article", confidence: 65 },
];

// ============================================================
// Title/Description Keyword Rules
// ============================================================

interface KeywordRule {
  keywords: string[];
  type: ContentType;
  weight: number; // Points per keyword match
}

const KEYWORD_RULES: KeywordRule[] = [
  // Tutorial keywords (highest weight)
  {
    keywords: [
      "教程",
      "指南",
      "入门",
      "实战",
      "手把手",
      "从零开始",
      "step by step",
      "how to",
      "如何",
      "怎么",
      "怎样",
      "详解",
      "攻略",
      "保姆级",
      "一文搞懂",
      "深入理解",
      "源码分析",
      "原理",
      "实现",
      "搭建",
      "配置",
      "部署",
      "安装",
    ],
    type: "tutorial",
    weight: 15,
  },

  // Video keywords
  {
    keywords: [
      "视频",
      "【",
      "】",
      "EP",
      "P1",
      "合集",
      "vlog",
      "直播",
      "回放",
      "精彩",
      "集锦",
      "分钟",
      "小时",
    ],
    type: "video",
    weight: 12,
  },

  // Tool keywords
  {
    keywords: [
      "工具",
      "插件",
      "软件",
      "App",
      "应用",
      "神器",
      "推荐",
      "必备",
      "效率",
      "开源",
      "免费",
      "付费",
      "订阅",
      "下载",
      "安装包",
      "chrome扩展",
      "vscode插件",
      "利器",
    ],
    type: "tool",
    weight: 12,
  },

  // Article keywords (lower weight, as it's the default)
  {
    keywords: [
      "观点",
      "思考",
      "分析",
      "评论",
      "看法",
      "洞察",
      "趋势",
      "报告",
      "调研",
      "访谈",
      "故事",
      "经历",
      "体验",
      "感悟",
      "反思",
    ],
    type: "article",
    weight: 8,
  },
];

// ============================================================
// Detection Functions
// ============================================================

/**
 * Detect content type from URL
 */
function detectFromURL(
  url: string,
): { type: ContentType; confidence: number } | null {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  for (const rule of URL_RULES) {
    let matches = false;

    if (typeof rule.pattern === "string") {
      matches = urlLower.includes(rule.pattern);
    } else {
      matches = rule.pattern.test(urlLower);
    }

    if (matches) {
      return { type: rule.type, confidence: rule.confidence };
    }
  }

  return null;
}

/**
 * Detect content type from title and description keywords
 */
function detectFromKeywords(
  title: string,
  description?: string,
): { type: ContentType; confidence: number } | null {
  const text = `${title} ${description || ""}`.toLowerCase();

  const scores: Record<ContentType, number> = {
    article: 0,
    tutorial: 0,
    video: 0,
    tool: 0,
  };

  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        scores[rule.type] += rule.weight;
      }
    }
  }

  // Find the type with highest score
  let maxType: ContentType = "article";
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxType = type as ContentType;
    }
  }

  // Only return if score is significant
  if (maxScore >= 10) {
    // Map score to confidence (10-50 score -> 50-90 confidence)
    const confidence = Math.min(90, 50 + maxScore);
    return { type: maxType, confidence };
  }

  return null;
}

/**
 * Detect content type from content features
 */
function detectFromContent(
  content?: string,
): { type: ContentType; confidence: number } | null {
  if (!content || content.length < 100) return null;

  const features = {
    hasCodeBlocks: /```|<code>|<pre>/i.test(content),
    hasSteps: /步骤|step\s*\d|第[一二三四五六七八九十\d]+步/i.test(content),
    hasTimeMarkers: /\d{1,2}:\d{2}/.test(content),
    hasListItems: (content.match(/^[\s]*[-*•]\s/gm) || []).length > 3,
    hasCommands: /\$\s|npm\s|yarn\s|pip\s|git\s/i.test(content),
  };

  // Tutorial signals
  if (features.hasCodeBlocks && (features.hasSteps || features.hasCommands)) {
    return { type: "tutorial", confidence: 70 };
  }

  // Video signals (time markers in transcript)
  if (features.hasTimeMarkers && content.length > 500) {
    return { type: "video", confidence: 60 };
  }

  return null;
}

/**
 * Main detection function
 * Combines multiple signals with weighted scoring
 */
export function detectContentType(input: DetectionInput): ContentTypeResult {
  const signals: string[] = [];
  const scores: Record<ContentType, number> = {
    article: 0,
    tutorial: 0,
    video: 0,
    tool: 0,
  };

  // 1. URL detection (weight: 40%)
  const urlResult = detectFromURL(input.url || "");
  if (urlResult) {
    scores[urlResult.type] += urlResult.confidence * 0.4;
    signals.push(`URL: ${urlResult.type} (${urlResult.confidence}%)`);
  }

  // 2. Keyword detection (weight: 35%)
  const keywordResult = detectFromKeywords(input.title, input.description);
  if (keywordResult) {
    scores[keywordResult.type] += keywordResult.confidence * 0.35;
    signals.push(
      `Keywords: ${keywordResult.type} (${keywordResult.confidence}%)`,
    );
  }

  // 3. Content detection (weight: 25%)
  const contentResult = detectFromContent(input.content);
  if (contentResult) {
    scores[contentResult.type] += contentResult.confidence * 0.25;
    signals.push(
      `Content: ${contentResult.type} (${contentResult.confidence}%)`,
    );
  }

  // Find the type with highest score
  let maxType: ContentType = "article";
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxType = type as ContentType;
    }
  }

  // If no strong signals, default to article
  if (maxScore < 20) {
    maxType = "article";
    maxScore = 50;
    signals.push("Default: article (no strong signals)");
  }

  const result: ContentTypeResult = {
    type: maxType,
    confidence: Math.round(Math.min(95, maxScore)),
    signals,
  };

  logger.debug(
    {
      title: input.title.substring(0, 50),
      detectedType: result.type,
      confidence: result.confidence,
      signals: result.signals,
      action: "content_type_detected",
    },
    "ContentTypeDetector: Type detected",
  );

  return result;
}

/**
 * Get content type label for display
 */
export function getContentTypeLabel(type: ContentType): string {
  return CONTENT_TYPE_LABELS[type] || "文章";
}
