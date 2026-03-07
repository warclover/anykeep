/**
 * 小红书解析器
 *
 * 从小红书笔记页面 HTML 中提取正文、图片、互动数据
 * 支持域名: xiaohongshu.com, xhslink.com
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { logger } from "@/lib/logger";
import {
  removeScriptsAndStyles,
  stripHtmlTags,
  decodeHtmlEntities,
} from "@/lib/utils/html-utils";
import type { IPlatformParser, ParsedContent } from "./parser.interface";

/**
 * 从 script 标签中提取 __INITIAL_STATE__ JSON 数据
 */
function extractInitialState(html: string): Record<string, unknown> | null {
  const pattern =
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})(?:\s*;|\s*<\/script>)/;
  const match = html.match(pattern);

  if (!match?.[1]) return null;

  try {
    // 小红书 JSON 中可能包含 undefined
    const jsonStr = match[1]
      .replace(/:\s*undefined/g, ":null")
      .replace(/,\s*}/g, "}");
    return JSON.parse(jsonStr);
  } catch {
    logger.debug("小红书解析器: __INITIAL_STATE__ JSON 解析失败");
    return null;
  }
}

/**
 * 安全获取嵌套属性
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * 从 DOM 元素中提取文本（正则模拟）
 */
function extractByClassOrId(html: string, selectors: string[]): string | null {
  for (const selector of selectors) {
    let pattern: RegExp;
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      pattern = new RegExp(`<[^>]*id=["']?${id}["']?[^>]*>([\\s\\S]*?)</`, "i");
    } else {
      const cls = selector.startsWith(".") ? selector.slice(1) : selector;
      pattern = new RegExp(
        `<[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)</`,
        "i",
      );
    }

    const match = html.match(pattern);
    if (match?.[1]) {
      const text = stripHtmlTags(match[1]).trim();
      if (text) return text;
    }
  }
  return null;
}

/**
 * 从 meta 标签提取内容
 */
function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

/**
 * 清理话题标签中的冗余 # 符号
 * 小红书话题格式: #话题名称# 或 #话题名称
 */
function cleanHashtags(text: string): string {
  // 将 #话题# 格式统一为 #话题
  return text.replace(/#([^#\s]+)#/g, "#$1");
}

export const XiaohongshuParser: IPlatformParser = {
  name: "xiaohongshu",
  supportedDomains: ["xiaohongshu.com", "xhslink.com"],

  canParse(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.supportedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  },

  parse(html: string, url: string): ParsedContent {
    logger.debug({ url }, "小红书解析器: 开始解析");

    try {
      let content = "";
      let title = "";
      let likeCount: number | undefined;
      let collectCount: number | undefined;
      let confidence = 0.5;

      // 方式 1: 从 __INITIAL_STATE__ 提取
      const initialState = extractInitialState(html);
      if (initialState) {
        // 小红书 SSR 数据结构: note.noteDetailMap[noteId].note
        const noteDetailMap = getNestedValue(
          initialState,
          "note.noteDetailMap",
        ) as Record<string, unknown> | undefined;

        if (noteDetailMap) {
          // 取第一个笔记（通常只有一个）
          const noteId = Object.keys(noteDetailMap)[0];
          if (noteId) {
            const noteWrapper = noteDetailMap[noteId] as
              | Record<string, unknown>
              | undefined;
            const note = noteWrapper?.note as
              | Record<string, unknown>
              | undefined;

            if (note) {
              title = (note.title as string) || "";
              const desc = (note.desc as string) || "";
              likeCount = getNestedValue(note, "interactInfo.likedCount") as
                | number
                | undefined;
              collectCount = getNestedValue(
                note,
                "interactInfo.collectedCount",
              ) as number | undefined;

              const parts: string[] = [];
              if (title) parts.push(title);
              if (desc) parts.push(cleanHashtags(desc));
              content = parts.join("\n\n");
              confidence = 0.9;
            }
          }
        }
      }

      // 方式 2: 从 DOM 元素提取
      if (!content) {
        const cleanedHtml = removeScriptsAndStyles(html);

        const noteText = extractByClassOrId(cleanedHtml, [
          ".note-text",
          "#detail-desc",
          ".note-content",
          ".desc",
        ]);

        title =
          extractMetaContent(html, "og:title") ||
          extractByClassOrId(cleanedHtml, [".note-title", ".title"]) ||
          "";

        const parts: string[] = [];
        if (title) parts.push(title);
        if (noteText) parts.push(cleanHashtags(noteText));
        content = parts.join("\n\n");
        confidence = content ? 0.65 : 0.3;
      }

      // 方式 3: 最终降级到 meta
      if (!content) {
        title = extractMetaContent(html, "og:title") || "";
        const description =
          extractMetaContent(html, "og:description") ||
          extractMetaContent(html, "description") ||
          "";

        content = [title, description].filter(Boolean).join("\n\n");
        confidence = content ? 0.4 : 0.2;
      }

      // 解码实体
      content = decodeHtmlEntities(content);

      // 字数统计
      const wordCount = content.replace(/\s+/g, "").length;

      // 图片统计
      const cleanedHtml = removeScriptsAndStyles(html);
      const imgMatches = cleanedHtml.match(/<img[^>]+>/gi) || [];
      const imageCount = imgMatches.filter((img) => {
        if (/class=["'][^"']*(?:emoji|icon|avatar|logo)[^"']*["']/i.test(img)) {
          return false;
        }
        const widthMatch = img.match(/width=["']?(\d+)/i);
        if (widthMatch && parseInt(widthMatch[1]) < 50) return false;
        return true;
      }).length;

      // 标题列表
      const headings: Array<{ level: number; text: string }> = [];
      if (title) {
        headings.push({ level: 1, text: title });
      }

      logger.debug(
        { url, wordCount, confidence, hasInitialState: !!initialState },
        "小红书解析器: 解析完成",
      );

      return {
        content,
        headings,
        imageCount,
        wordCount,
        platform: "xiaohongshu",
        confidence,
        metadata: {
          likeCount,
          collectCount,
        },
      };
    } catch (error) {
      logger.error({ error, url }, "小红书解析器: 解析失败，降级为 meta 提取");

      const title = extractMetaContent(html, "og:title") || "";
      const description = extractMetaContent(html, "og:description") || "";
      const content = [title, description].filter(Boolean).join("\n\n");

      return {
        content: decodeHtmlEntities(content),
        wordCount: content.replace(/\s+/g, "").length,
        platform: "xiaohongshu",
        confidence: 0.2,
      };
    }
  },
};
