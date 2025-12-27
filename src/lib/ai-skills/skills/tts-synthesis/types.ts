/**
 * TTSSynthesisSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { TTSContentType, TTSVoiceGender } from "@/lib/tts";

/**
 * TTS Skill 输入参数
 */
export interface TTSSynthesisInput {
  /** 书签 ID */
  bookmarkId: number;
  /** 内容类型 */
  contentType?: TTSContentType;
  /** 语速 (0.5-2.0) */
  speed?: number;
  /** 语音性别 */
  voiceGender?: TTSVoiceGender;
  /** 指定语音 ID */
  voice?: string;
}

/**
 * TTS Skill 输出结果
 */
export interface TTSSynthesisOutput {
  /** Base64 编码的音频数据 */
  audioBase64: string;
  /** 音频格式 */
  format: string;
  /** 音频时长（秒） */
  durationSec: number;
  /** 字符数 */
  charCount: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 内容类型 */
  contentType: TTSContentType;
  /** 请求 ID */
  requestId: string;
}

/**
 * TTS 执行步骤
 */
export const TTS_STEPS = [
  {
    id: "parse",
    name: "解析请求",
    description: "解析朗读请求参数",
    weight: 10,
  },
  {
    id: "fetch",
    name: "获取摘要",
    description: "获取书签摘要内容",
    weight: 20,
  },
  {
    id: "prepare",
    name: "准备文本",
    description: "预处理朗读文本",
    weight: 15,
  },
  {
    id: "synthesize",
    name: "合成语音",
    description: "调用 TTS 服务合成语音",
    weight: 45,
  },
  {
    id: "deliver",
    name: "输出音频",
    description: "生成音频交付物",
    weight: 10,
  },
];
