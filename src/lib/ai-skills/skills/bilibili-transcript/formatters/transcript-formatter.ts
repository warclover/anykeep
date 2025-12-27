/**
 * 字幕格式化器
 * 支持多种输出格式
 *
 * @version 1.0.0
 */

import type { SubtitleSegment } from "../types";
import { formatSrtTime, formatMinuteTime } from "../api/url-parser";

export type TranscriptFormat = "text" | "srt" | "json" | "markdown";

export interface FormattedTranscript {
  format: TranscriptFormat;
  content: string;
  fullText: string;
  wordCount: number;
}

/**
 * 格式化字幕
 */
export function formatTranscript(
  segments: SubtitleSegment[],
  format: TranscriptFormat,
  videoTitle?: string,
): FormattedTranscript {
  // 生成纯文本
  const fullText = segments.map((s) => s.content).join(" ");
  const wordCount = fullText.length;

  let content: string;

  switch (format) {
    case "srt":
      content = formatAsSrt(segments);
      break;
    case "json":
      content = formatAsJson(segments);
      break;
    case "markdown":
      content = formatAsMarkdown(segments, videoTitle);
      break;
    case "text":
    default:
      content = formatAsText(segments);
      break;
  }

  return {
    format,
    content,
    fullText,
    wordCount,
  };
}

/**
 * 格式化为纯文本（带段落）
 */
function formatAsText(segments: SubtitleSegment[]): string {
  // 按照自然段落分组（间隔超过 3 秒视为新段落）
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  let lastEnd = 0;

  for (const segment of segments) {
    if (segment.from - lastEnd > 3 && currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(""));
      currentParagraph = [];
    }
    currentParagraph.push(segment.content);
    lastEnd = segment.to;
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(""));
  }

  return paragraphs.join("\n\n");
}

/**
 * 格式化为 SRT 格式
 */
function formatAsSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((segment, index) => {
      const startTime = formatSrtTime(segment.from);
      const endTime = formatSrtTime(segment.to);

      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.content}\n`;
    })
    .join("\n");
}

/**
 * 格式化为 JSON
 */
function formatAsJson(segments: SubtitleSegment[]): string {
  return JSON.stringify(
    {
      segments: segments.map((s) => ({
        from: s.from,
        to: s.to,
        content: s.content,
      })),
      metadata: {
        segmentCount: segments.length,
        totalDuration:
          segments.length > 0 ? segments[segments.length - 1].to : 0,
        generatedAt: new Date().toISOString(),
      },
    },
    null,
    2,
  );
}

/**
 * 格式化为 Markdown
 */
function formatAsMarkdown(
  segments: SubtitleSegment[],
  videoTitle?: string,
): string {
  const lines: string[] = [];

  if (videoTitle) {
    lines.push(`# ${videoTitle}`);
    lines.push("");
  }

  lines.push("## 视频字幕");
  lines.push("");

  // 按照时间段分组（每 5 分钟一组）
  const groups = groupByTime(segments, 300);

  for (const group of groups) {
    const startTime = formatMinuteTime(group.startTime);
    const endTime = formatMinuteTime(group.endTime);
    lines.push(`### [${startTime} - ${endTime}]`);
    lines.push("");
    lines.push(group.content);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 按时间分组
 */
function groupByTime(
  segments: SubtitleSegment[],
  intervalSeconds: number,
): Array<{ startTime: number; endTime: number; content: string }> {
  if (segments.length === 0) return [];

  const groups: Array<{
    startTime: number;
    endTime: number;
    content: string;
  }> = [];

  let currentGroup = {
    startTime: segments[0].from,
    endTime: segments[0].to,
    contents: [segments[0].content],
  };

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];

    // 如果超过间隔，开始新分组
    if (segment.from - currentGroup.startTime >= intervalSeconds) {
      groups.push({
        startTime: currentGroup.startTime,
        endTime: currentGroup.endTime,
        content: currentGroup.contents.join(""),
      });
      currentGroup = {
        startTime: segment.from,
        endTime: segment.to,
        contents: [segment.content],
      };
    } else {
      currentGroup.contents.push(segment.content);
      currentGroup.endTime = segment.to;
    }
  }

  // 添加最后一组
  groups.push({
    startTime: currentGroup.startTime,
    endTime: currentGroup.endTime,
    content: currentGroup.contents.join(""),
  });

  return groups;
}

/**
 * 合并相邻的短字幕段
 */
export function mergeShortSegments(
  segments: SubtitleSegment[],
  minDuration: number = 2,
): SubtitleSegment[] {
  if (segments.length === 0) return [];

  const merged: SubtitleSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];

    // 如果当前段太短且与下一段间隔很近，合并它们
    if (
      current.to - current.from < minDuration &&
      next.from - current.to < 0.5
    ) {
      current.to = next.to;
      current.content += next.content;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}
