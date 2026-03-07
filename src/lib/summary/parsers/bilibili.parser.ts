/**
 * B站解析器
 *
 * 从 B 站视频页面 HTML 中提取视频描述、UP主信息等
 * 支持域名: bilibili.com, b23.tv
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
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:\(function|window\.|$)/;
  const match = html.match(pattern);

  if (!match?.[1]) return null;

  try {
    // 处理 B 站 JSON 中可能存在的 undefined 值
    const jsonStr = match[1].replace(/:\s*undefined/g, ":null");
    return JSON.parse(jsonStr);
  } catch {
    logger.debug("B站解析器: __INITIAL_STATE__ JSON 解析失败");
    return null;
  }
}

/**
 * 从 meta 标签提取信息
 */
function extractMetaContent(html: string, name: string): string | null {
  // 尝试 name 属性
  const namePattern = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  let match = html.match(namePattern);
  if (match?.[1]) return decodeHtmlEntities(match[1].trim());

  // 尝试 content 在前的情况
  const reversePattern = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
    "i",
  );
  match = html.match(reversePattern);
  if (match?.[1]) return decodeHtmlEntities(match[1].trim());

  // 尝试 property 属性（Open Graph）
  const propertyPattern = new RegExp(
    `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  match = html.match(propertyPattern);
  if (match?.[1]) return decodeHtmlEntities(match[1].trim());

  return null;
}

/**
 * 从 DOM 选择器提取文本（正则模拟）
 */
function extractBySelector(html: string, className: string): string | null {
  const pattern = new RegExp(
    `<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</`,
    "i",
  );
  const match = html.match(pattern);
  if (match?.[1]) {
    return stripHtmlTags(match[1]).trim();
  }
  return null;
}

/**
 * 从 __INITIAL_STATE__ 中安全获取嵌套属性
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

export const BilibiliParser: IPlatformParser = {
  name: "bilibili",
  supportedDomains: ["bilibili.com", "b23.tv"],

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
    logger.debug({ url }, "B站解析器: 开始解析");

    try {
      const initialState = extractInitialState(html);
      let content = "";
      let title = "";
      let uploader = "";
      let viewCount: number | undefined;
      let likeCount: number | undefined;
      let confidence = 0.5;

      if (initialState) {
        // 从 __INITIAL_STATE__ 提取数据
        // 视频页面结构: videoData.title, videoData.desc, videoData.owner.name
        const videoData = getNestedValue(initialState, "videoData") as
          | Record<string, unknown>
          | undefined;

        if (videoData) {
          title = (videoData.title as string) || "";
          const desc = (videoData.desc as string) || "";
          uploader = (getNestedValue(videoData, "owner.name") as string) || "";
          viewCount = getNestedValue(videoData, "stat.view") as
            | number
            | undefined;
          likeCount = getNestedValue(videoData, "stat.like") as
            | number
            | undefined;

          // 组装内容
          const parts: string[] = [];
          if (title) parts.push(title);
          if (uploader) parts.push(`UP主: ${uploader}`);
          if (desc) parts.push(desc);
          content = parts.join("\n\n");
          confidence = 0.9;
        } else {
          // 番剧/专栏等其他类型页面
          const mediaInfo = getNestedValue(initialState, "mediaInfo") as
            | Record<string, unknown>
            | undefined;
          if (mediaInfo) {
            title = (mediaInfo.title as string) || "";
            const evaluate = (mediaInfo.evaluate as string) || "";
            content = [title, evaluate].filter(Boolean).join("\n\n");
            confidence = 0.85;
          }
        }
      }

      // 降级: 从 meta 标签和 DOM 元素提取
      if (!content) {
        title =
          extractMetaContent(html, "og:title") ||
          extractMetaContent(html, "title") ||
          "";

        const description =
          extractMetaContent(html, "og:description") ||
          extractMetaContent(html, "description") ||
          "";

        const domDesc =
          extractBySelector(html, "video-desc") ||
          extractBySelector(html, "desc-info") ||
          "";

        const parts: string[] = [];
        if (title) parts.push(title);
        if (description) parts.push(description);
        if (domDesc && domDesc !== description) parts.push(domDesc);
        content = parts.join("\n\n");
        confidence = content ? 0.6 : 0.3;
      }

      // 解码实体
      content = decodeHtmlEntities(content);

      // 统计字数
      const wordCount = content.replace(/\s+/g, "").length;

      // 统计图片（清理后的 HTML）
      const cleanedHtml = removeScriptsAndStyles(html);
      const imgMatches = cleanedHtml.match(/<img[^>]+>/gi) || [];
      const imageCount = imgMatches.filter((img) => {
        if (/class=["'][^"']*(?:emoji|icon|avatar|logo)[^"']*["']/i.test(img)) {
          return false;
        }
        return true;
      }).length;

      // 构建标题列表
      const headings: Array<{ level: number; text: string }> = [];
      if (title) {
        headings.push({ level: 1, text: title });
      }

      logger.debug(
        { url, wordCount, confidence, hasInitialState: !!initialState },
        "B站解析器: 解析完成",
      );

      return {
        content,
        headings,
        imageCount,
        wordCount,
        platform: "bilibili",
        confidence,
        metadata: {
          uploader: uploader || undefined,
          viewCount,
          likeCount,
        },
      };
    } catch (error) {
      logger.error({ error, url }, "B站解析器: 解析失败，降级为 meta 提取");

      const title = extractMetaContent(html, "og:title") || "";
      const description = extractMetaContent(html, "og:description") || "";
      const content = [title, description].filter(Boolean).join("\n\n");

      return {
        content: decodeHtmlEntities(content),
        wordCount: content.replace(/\s+/g, "").length,
        platform: "bilibili",
        confidence: 0.3,
      };
    }
  },
};
