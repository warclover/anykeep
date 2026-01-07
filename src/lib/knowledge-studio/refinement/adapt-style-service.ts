/**
 * Adapt Style Service - 一稿多发风格适配服务（P1-1）
 * @module knowledge-studio/refinement
 *
 * 将已生成的内容转换为不同平台的风格。
 */

import { streamText } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers/provider-router";
import { createLogger } from "@/lib/logger";
import {
  PLATFORM_STYLE_CONFIG,
  type PlatformStyle,
} from "@/lib/knowledge-studio/v2/constants";

const logger = createLogger("adapt-style-service");

// ============================================================
// Types
// ============================================================

export interface AdaptStyleOptions {
  /** 原始内容 */
  content: string;
  /** 原始风格 */
  sourceStyle: PlatformStyle;
  /** 目标风格 */
  targetStyle: PlatformStyle;
  /** 是否保留原有结构 */
  preserveStructure?: boolean;
}

export interface AdaptStyleResult {
  /** 适配后的内容 */
  adaptedContent: string;
  /** 原始字数 */
  originalWords: number;
  /** 适配后字数 */
  finalWords: number;
  /** 目标风格 */
  targetStyle: PlatformStyle;
}

export interface AdaptStyleStreamCallbacks {
  /** 内容流式输出 */
  onContent?: (chunk: string) => void;
  /** 进度更新 */
  onProgress?: (percent: number) => void;
  /** 完成回调 */
  onComplete?: (result: AdaptStyleResult) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

// ============================================================
// Prompt Templates
// ============================================================

const ADAPT_STYLE_SYSTEM_PROMPT = `你是一位专业的内容运营专家，擅长将文章适配到不同平台的风格。

## 核心原则

1. **保留核心内容**: 文章的主要观点和信息必须完整保留
2. **风格转换**: 语言表达、排版格式必须符合目标平台特点
3. **字数适配**: 根据目标平台调整内容长度
4. **可读性优先**: 确保适配后的内容易于阅读

## 输出要求

- 使用 Markdown 格式
- 严格遵循目标平台的风格要求
- 内容完整、逻辑清晰`;

/**
 * 平台风格详细指令
 */
const PLATFORM_STYLE_INSTRUCTIONS: Record<PlatformStyle, string> = {
  wechat: `【公众号风格要求】

## 标题要求
- 使用吸引眼球的标题技巧：数字开头、疑问句、对比冲突
- 示例："3个让我效率翻倍的秘密"、"为什么90%的人都错了？"

## 格式要求
- 每段 3-5 行，段落间留一行空白
- 使用分隔线 --- 分隔大章节
- 重点用「」或【】框起
- 适当使用引用块 > 突出金句

## 语言风格
- 专业但不晦涩，像"懂行的朋友"在分享
- 避免学术腔和官方话术
- 多用短句，节奏感强
- 结尾必须引导互动："你觉得呢？欢迎留言讨论"

## 字数要求
- 目标字数：1500-3000 字`,

  xiaohongshu: `【小红书风格要求】

## 格式要求
- 每段只能 1-3 行！绝对不能超过 3 行！
- 每个段落开头或结尾必须有 emoji
- 重点用【】框起来

## 必须使用的表达
- 开头用: "宝子们"、"姐妹们"、"朋友们"
- 转折用: "但是！"、"重点来了"、"划重点"
- 强调用: "真的很绝"、"太可了"、"直接封神"、"绝绝子"
- 结尾用: "码住"、"冲冲冲"、"感谢观看"

## Emoji 使用规则
- 标题: 🌟✨💡🔥 等突出
- 列表: 1️⃣2️⃣3️⃣ 或 ✅❌
- 强调: 💪🔥👏💯
- 情感: 😭🥹🤩😍

## 结尾格式
必须以话题标签结尾（3-5个）:
#话题1 #话题2 #话题3

## 字数要求
- 目标字数：600-1500 字（精简但信息丰富）`,

  general: `【通用风格要求】

## 格式要求
- 使用正式、规范的书面语言
- 结构完整，逻辑清晰
- 适合多平台发布

## 语言风格
- 客观中立的表述
- 不使用过于口语化或平台特色的表达
- 适当使用专业术语

## 字数要求
- 目标字数：2000-5000 字`,
};

// ============================================================
// Service Functions
// ============================================================

/**
 * 统计中文字数
 */
export function countWords(text: string): number {
  // 移除空白字符
  const cleaned = text.replace(/\s+/g, "");
  // 中文字符
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g)?.length || 0;
  // 英文单词（粗略估计：非中文字符数/5）
  const nonChinese = cleaned.replace(/[\u4e00-\u9fff]/g, "");
  const englishWords = Math.ceil(nonChinese.length / 5);
  return chineseChars + englishWords;
}

/**
 * 构建风格适配 Prompt
 */
function buildAdaptPrompt(options: AdaptStyleOptions): string {
  const sourceConfig = PLATFORM_STYLE_CONFIG[options.sourceStyle];
  const targetConfig = PLATFORM_STYLE_CONFIG[options.targetStyle];
  const targetInstructions = PLATFORM_STYLE_INSTRUCTIONS[options.targetStyle];

  return `## 任务

请将以下「${sourceConfig.label}」的内容转换为「${targetConfig.label}」风格。

${targetInstructions}

## 原始内容

${options.content}

## 开始转换

请现在按照目标平台风格要求，输出转换后的完整内容：`;
}

/**
 * 流式风格适配
 */
export async function adaptStyleStream(
  options: AdaptStyleOptions,
  callbacks: AdaptStyleStreamCallbacks,
): Promise<void> {
  const { content, sourceStyle, targetStyle } = options;
  const originalWords = countWords(content);

  // 如果源风格和目标风格相同，直接返回原内容
  if (sourceStyle === targetStyle) {
    callbacks.onComplete?.({
      adaptedContent: content,
      originalWords,
      finalWords: originalWords,
      targetStyle,
    });
    return;
  }

  logger.info(
    {
      sourceStyle,
      targetStyle,
      originalWords,
    },
    "Starting style adaptation",
  );

  try {
    const userPrompt = buildAdaptPrompt(options);

    // 获取 AI 模型
    const model = aiProviderRouter.getModel("deepseek");
    if (!model) {
      throw new Error("无法获取 AI 模型");
    }

    // 流式生成
    const stream = await streamText({
      model,
      system: ADAPT_STYLE_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 8192,
      temperature: 0.7,
    });

    let adaptedContent = "";
    let lastProgressPercent = 0;

    // 估算目标字数用于进度计算
    const targetConfig = PLATFORM_STYLE_CONFIG[targetStyle];
    const estimatedTargetWords =
      (targetConfig.minWords + targetConfig.maxWords) / 2;

    for await (const chunk of stream.textStream) {
      adaptedContent += chunk;
      callbacks.onContent?.(chunk);

      // 基于生成字数更新进度
      const currentWords = countWords(adaptedContent);
      const progress = Math.min(
        95,
        Math.floor((currentWords / estimatedTargetWords) * 100),
      );

      if (progress > lastProgressPercent) {
        lastProgressPercent = progress;
        callbacks.onProgress?.(progress);
      }
    }

    const finalWords = countWords(adaptedContent);

    logger.info(
      {
        sourceStyle,
        targetStyle,
        originalWords,
        finalWords,
      },
      "Style adaptation completed",
    );

    callbacks.onProgress?.(100);
    callbacks.onComplete?.({
      adaptedContent,
      originalWords,
      finalWords,
      targetStyle,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "风格适配失败";
    logger.error({ error: errorMessage }, "Style adaptation failed");
    callbacks.onError?.(new Error(errorMessage));
  }
}
