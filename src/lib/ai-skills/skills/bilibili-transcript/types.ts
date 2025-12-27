/**
 * B站字幕提取 Skill 类型定义
 * @version 1.0.0
 */

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

// ============================================
// 输入 Schema
// ============================================

export const BilibiliTranscriptInputSchema = z.object({
  /** 书签 ID（从现有书签提取） */
  bookmarkId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("要提取字幕的书签ID"),

  /** 视频 URL（直接提供 URL） */
  url: z
    .string()
    .url()
    .optional()
    .describe("B站视频URL（支持 bilibili.com 和 b23.tv）"),

  /** 输出格式 */
  format: z
    .enum(["text", "srt", "json", "markdown"])
    .default("text")
    .describe("字幕输出格式"),

  /** 是否保存到书签 */
  saveToBookmark: z
    .boolean()
    .default(true)
    .describe("是否将字幕保存到书签记录"),

  /** 语言偏好（如果有多语言字幕） */
  preferredLang: z.string().optional().describe("首选字幕语言（如 zh-CN, en）"),
});

export type BilibiliTranscriptInput = z.infer<
  typeof BilibiliTranscriptInputSchema
>;

// ============================================
// 输出 Schema
// ============================================

export const BilibiliTranscriptOutputSchema = z.object({
  /** 视频基础信息 */
  videoInfo: z.object({
    bvid: z.string(),
    title: z.string(),
    duration: z.number().describe("时长（秒）"),
    uploader: z.string(),
    coverUrl: z.string().optional(),
  }),

  /** 字幕状态 */
  transcriptStatus: z.enum([
    "available", // 有 CC 字幕
    "ai_generated", // AI 生成字幕（未来支持）
    "not_available", // 无字幕
    "fetch_failed", // 获取失败
  ]),

  /** 字幕内容 */
  transcript: z
    .object({
      language: z.string(),
      languageLabel: z.string(),
      segments: z.array(
        z.object({
          from: z.number().describe("开始时间（秒）"),
          to: z.number().describe("结束时间（秒）"),
          content: z.string().describe("字幕文本"),
        }),
      ),
      fullText: z.string().describe("完整纯文本"),
      formattedContent: z.string().describe("格式化后的内容"),
      wordCount: z.number(),
    })
    .optional(),

  /** 是否已保存到书签 */
  savedToBookmark: z.boolean(),

  /** 处理统计 */
  stats: z.object({
    segmentCount: z.number(),
    totalDuration: z.number(),
    fetchTimeMs: z.number(),
  }),

  /** 生成时间 */
  generatedAt: z.string(),
});

export type BilibiliTranscriptOutput = z.infer<
  typeof BilibiliTranscriptOutputSchema
>;

// ============================================
// 字幕段类型
// ============================================

export interface SubtitleSegment {
  from: number; // 开始时间（秒）
  to: number; // 结束时间（秒）
  content: string; // 字幕文本
  sid?: number; // 段落 ID（B站原始数据）
  location?: number; // 位置信息
}

export interface SubtitleInfo {
  id: number;
  language: string;
  languageLabel: string;
  isLock: boolean;
  subtitleUrl: string;
  aiType?: number; // 0=人工上传, 1=AI生成
  aiStatus?: number;
}

// ============================================
// 视频信息类型
// ============================================

export interface VideoInfo {
  bvid: string;
  aid: number;
  cid: number;
  title: string;
  description: string;
  duration: number;
  uploader: string;
  uploaderMid: number;
  coverUrl: string;
  publishDate: string;
}

// ============================================
// 步骤定义
// ============================================

export const BILIBILI_TRANSCRIPT_STEPS: StepDefinition[] = [
  {
    id: "parse",
    name: "解析链接",
    description: "解析视频URL获取视频信息",
    weight: 15,
  },
  {
    id: "fetch_info",
    name: "获取信息",
    description: "获取视频元数据",
    weight: 20,
  },
  {
    id: "fetch_subtitle",
    name: "获取字幕",
    description: "获取视频字幕列表",
    weight: 25,
  },
  {
    id: "download",
    name: "下载字幕",
    description: "下载并解析字幕内容",
    weight: 25,
  },
  {
    id: "format",
    name: "格式化",
    description: "格式化字幕输出",
    weight: 10,
  },
  { id: "save", name: "保存", description: "保存到书签记录", weight: 5 },
];

// ============================================
// 错误代码
// ============================================

export const BILIBILI_TRANSCRIPT_ERRORS = {
  INVALID_URL: "INVALID_BILIBILI_URL",
  VIDEO_NOT_FOUND: "VIDEO_NOT_FOUND",
  NO_SUBTITLE: "NO_SUBTITLE_AVAILABLE",
  FETCH_FAILED: "SUBTITLE_FETCH_FAILED",
  PARSE_FAILED: "SUBTITLE_PARSE_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  COOKIE_REQUIRED: "COOKIE_REQUIRED",
} as const;

export type BilibiliTranscriptErrorCode =
  (typeof BILIBILI_TRANSCRIPT_ERRORS)[keyof typeof BILIBILI_TRANSCRIPT_ERRORS];
