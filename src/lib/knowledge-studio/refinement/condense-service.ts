/**
 * Condense Service - 内容精简服务（Phase 3.2）
 * @module knowledge-studio/refinement
 *
 * 提供内容精简功能，将长文本压缩到目标字数范围内。
 */

import { streamText } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers/provider-router";
import { createLogger } from "@/lib/logger";

const logger = createLogger("condense-service");

// ============================================================
// Types
// ============================================================

export interface CondenseOptions {
  /** 原始内容 */
  content: string;
  /** 目标字数 */
  targetWords: number;
  /** 保留要点（可选，用于指导精简） */
  preserveKeyPoints?: string[];
  /** 内容类型（可选） */
  contentType?: "article" | "notes" | "report";
}

export interface CondenseResult {
  /** 精简后的内容 */
  condensedContent: string;
  /** 原始字数 */
  originalWords: number;
  /** 精简后字数 */
  finalWords: number;
  /** 压缩比例 */
  compressionRatio: number;
}

export interface CondenseStreamCallbacks {
  /** 内容流式输出 */
  onContent?: (chunk: string) => void;
  /** 进度更新 */
  onProgress?: (percent: number) => void;
  /** 完成回调 */
  onComplete?: (result: CondenseResult) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

// ============================================================
// Constants
// ============================================================

/** 精简预设配置 */
export const CONDENSE_PRESETS = {
  xiaohongshu: {
    label: "小红书风格",
    targetWords: 800,
    description: "适合小红书笔记",
  },
  wechat_short: {
    label: "公众号短文",
    targetWords: 1500,
    description: "适合公众号快速阅读",
  },
  wechat_standard: {
    label: "公众号标准",
    targetWords: 2000,
    description: "适合公众号标准文章",
  },
  summary: {
    label: "精华摘要",
    targetWords: 500,
    description: "只保留核心要点",
  },
} as const;

export type CondensePreset = keyof typeof CONDENSE_PRESETS;

// ============================================================
// Prompt Templates
// ============================================================

const CONDENSE_SYSTEM_PROMPT = `你是一位专业的内容编辑，擅长在保持核心信息完整的前提下精简文章。

## 精简原则

1. **保留核心**: 保留文章的主要论点和关键结论
2. **删减冗余**: 删除重复表述、过渡性废话、冗长的例子
3. **语言精炼**: 用更简洁的语言重新表达
4. **结构完整**: 保持文章的逻辑结构和阅读流畅度

## 输出要求

- 使用 Markdown 格式
- 保持原有的标题层级结构
- 段落清晰、重点突出
- 严格控制在目标字数范围内`;

function buildCondenseUserPrompt(options: CondenseOptions): string {
  const { content, targetWords, preserveKeyPoints, contentType } = options;

  const parts: string[] = [];

  parts.push(`## 任务

请将以下内容精简到约 **${targetWords} 字**（允许 ±10% 浮动）。`);

  if (contentType) {
    const typeHint = {
      article: "这是一篇文章，请保持其文章的完整性和可读性",
      notes: "这是笔记内容，请保留关键信息和要点",
      report: "这是报告内容，请保留数据、结论和建议",
    };
    parts.push(`\n内容类型: ${typeHint[contentType]}`);
  }

  if (preserveKeyPoints && preserveKeyPoints.length > 0) {
    parts.push(`\n## 必须保留的要点

${preserveKeyPoints.map((p) => `- ${p}`).join("\n")}`);
  }

  parts.push(`\n## 原始内容

${content}`);

  parts.push(`\n## 开始精简

请现在输出精简后的内容，目标字数约 ${targetWords} 字。直接输出 Markdown 格式的精简内容，无需额外说明。`);

  return parts.join("\n");
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 统计中文内容字数（更准确的字数统计）
 */
export function countWords(content: string): number {
  // 移除 Markdown 标记符号
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "") // 移除代码块
    .replace(/`[^`]+`/g, "") // 移除行内代码
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 保留链接文字
    .replace(/[#*_~`>|]/g, "") // 移除 Markdown 标记
    .replace(/\s+/g, "") // 移除空白字符
    .trim();

  return cleaned.length;
}

/**
 * 流式精简内容
 */
export async function condenseContentStream(
  options: CondenseOptions,
  callbacks: CondenseStreamCallbacks,
): Promise<void> {
  const { content, targetWords } = options;
  const originalWords = countWords(content);

  logger.info(
    `Starting content condensation: originalWords=${originalWords}, targetWords=${targetWords}, compressionTarget=${Math.round((targetWords / originalWords) * 100)}%`,
  );

  // 如果原文已经低于目标字数，无需精简
  if (originalWords <= targetWords * 1.1) {
    logger.info("Content already within target, skipping condensation");
    callbacks.onComplete?.({
      condensedContent: content,
      originalWords,
      finalWords: originalWords,
      compressionRatio: 1,
    });
    return;
  }

  try {
    const model = aiProviderRouter.getModel("deepseek");
    if (!model) {
      throw new Error("无法获取 AI 模型");
    }

    const stream = await streamText({
      model,
      system: CONDENSE_SYSTEM_PROMPT,
      prompt: buildCondenseUserPrompt(options),
      maxOutputTokens: Math.ceil(targetWords * 2), // 预留足够的 token
      temperature: 0.3, // 较低温度确保稳定输出
    });

    let condensedContent = "";
    let lastProgressPercent = 0;

    // 流式处理
    for await (const textPart of stream.textStream) {
      condensedContent += textPart;
      callbacks.onContent?.(textPart);

      // 更新进度（基于字数估算）
      const currentWords = countWords(condensedContent);
      const progressPercent = Math.min(
        Math.round((currentWords / targetWords) * 100),
        95,
      );

      if (progressPercent > lastProgressPercent) {
        callbacks.onProgress?.(progressPercent);
        lastProgressPercent = progressPercent;
      }
    }

    // 完成
    const finalWords = countWords(condensedContent);
    const result: CondenseResult = {
      condensedContent,
      originalWords,
      finalWords,
      compressionRatio: finalWords / originalWords,
    };

    callbacks.onProgress?.(100);
    callbacks.onComplete?.(result);

    logger.info(
      `Content condensation completed: originalWords=${originalWords}, finalWords=${finalWords}, compressionRatio=${Math.round(result.compressionRatio * 100)}%`,
    );
  } catch (error) {
    logger.error(`Content condensation failed: ${error}`);
    callbacks.onError?.(
      error instanceof Error ? error : new Error("精简失败，请重试"),
    );
  }
}

/**
 * 非流式精简内容（返回完整结果）
 */
export async function condenseContent(
  options: CondenseOptions,
): Promise<CondenseResult> {
  return new Promise((resolve, reject) => {
    condenseContentStream(options, {
      onComplete: (result) => {
        resolve(result);
      },
      onError: (error) => {
        reject(error);
      },
    });
  });
}
