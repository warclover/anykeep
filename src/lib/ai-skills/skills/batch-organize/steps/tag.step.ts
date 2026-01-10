/**
 * 标签建议生成步骤
 *
 * 职责：
 * - 生成书签标签建议
 * - 支持基于 AI 标签推荐
 * - 支持基于内容特征生成标签
 *
 * @module ai-skills/skills/batch-organize/steps/tag
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2026-01-10 - 增强标签生成，支持无 AI 标签的书签
 */

import type { TagSuggestion } from "../types";
import type { BookmarkRow } from "./types";

// ============================================
// 平台标签映射
// ============================================

const PLATFORM_TAG_MAP: Record<string, string[]> = {
  wechat: ["公众号", "文章"],
  bilibili: ["视频", "B站"],
  zhihu: ["知乎", "问答"],
  github: ["代码", "开源"],
  twitter: ["推特", "资讯"],
  xiaohongshu: ["小红书", "生活"],
  youtube: ["视频", "YouTube"],
  weibo: ["微博", "社交"],
  juejin: ["掘金", "技术"],
  medium: ["博客", "技术"],
  default: ["收藏"],
};

// ============================================
// 内容关键词标签映射
// ============================================

const KEYWORD_TAG_MAP: Record<string, string[]> = {
  // 技术类
  "javascript|js|typescript|ts": ["JavaScript", "前端"],
  "react|vue|angular": ["前端框架"],
  "node|nodejs|express|nest": ["Node.js", "后端"],
  "python|django|flask": ["Python"],
  "java|spring|kotlin": ["Java"],
  "rust|go|golang": ["系统编程"],
  "ai|人工智能|机器学习|ml|deep learning": ["AI", "机器学习"],
  "css|tailwind|样式": ["CSS", "样式"],
  api: ["API"],
  数据库: ["数据库"],
  docker: ["Docker", "容器"],
  kubernetes: ["K8s", "云原生"],

  // 内容类
  教程: ["教程"],
  "面试|interview": ["面试"],
  "源码|source code": ["源码分析"],
  "最佳实践|best practice": ["最佳实践"],
  "工具|tool": ["工具"],
  "设计|design": ["设计"],
  产品: ["产品"],
  运营: ["运营"],
  创业: ["创业"],
  投资: ["投资"],
  "阅读|读书": ["阅读"],
  "学习|learning": ["学习"],
};

// ============================================
// 标签建议生成
// ============================================

/**
 * 生成标签建议（增强版）
 *
 * 策略：
 * 1. 优先使用 AI 标签推荐（如果存在）
 * 2. 如果没有 AI 标签，基于平台和标题关键词生成
 */
export function generateTagSuggestions(
  bookmarks: BookmarkRow[],
): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];

  // 处理标签较少的书签（user_tags < 2）
  const needTags = bookmarks.filter((b) => (b.user_tags?.length || 0) < 2);

  for (const bookmark of needTags) {
    const aiTags = bookmark.ai_tags || [];
    const userTags = bookmark.user_tags || [];

    let suggestedTags: string[] = [];
    let confidence = 0.8;

    if (aiTags.length > 0) {
      // 策略 1：推荐未添加的 AI 标签
      suggestedTags = aiTags.filter((t) => !userTags.includes(t)).slice(0, 3);
      confidence = 0.85;
    } else {
      // 策略 2：基于内容特征生成标签
      suggestedTags = generateTagsFromContent(bookmark, userTags);
      confidence = 0.65;
    }

    if (suggestedTags.length > 0) {
      suggestions.push({
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        currentTags: userTags,
        suggestedTags,
        confidence,
      });
    }
  }

  return suggestions;
}

/**
 * 基于内容特征生成标签
 */
function generateTagsFromContent(
  bookmark: BookmarkRow,
  existingTags: string[],
): string[] {
  const tags = new Set<string>();

  // 1. 基于平台添加标签
  const platformTags =
    PLATFORM_TAG_MAP[bookmark.platform] || PLATFORM_TAG_MAP.default;
  for (const tag of platformTags.slice(0, 1)) {
    // 每个平台最多取 1 个标签
    if (!existingTags.includes(tag)) {
      tags.add(tag);
    }
  }

  // 2. 基于标题关键词匹配
  const titleLower = bookmark.title.toLowerCase();
  const urlLower = bookmark.url.toLowerCase();
  const combinedText = `${titleLower} ${urlLower}`;

  for (const [pattern, keywordTags] of Object.entries(KEYWORD_TAG_MAP)) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(combinedText)) {
      for (const tag of keywordTags.slice(0, 1)) {
        // 每个关键词最多取 1 个标签
        if (!existingTags.includes(tag)) {
          tags.add(tag);
        }
      }
      // 找到一个匹配就跳出，避免标签过多
      if (tags.size >= 2) break;
    }
  }

  // 限制最多 3 个标签
  return Array.from(tags).slice(0, 3);
}
