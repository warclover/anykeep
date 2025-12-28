/**
 * 语义切片器
 *
 * 将长文本拆分为 Parent-Child 结构的切片：
 * - Parent: 完整段落/章节（用于上下文）
 * - Child: 小块（用于精准检索）
 *
 * @module chunking/semantic-chunker
 * @version 1.0.0
 * @since 2025-12-28
 */

import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import type { Chunk, ChunkConfig, ChunkingStats } from "./types";
import { DEFAULT_CHUNK_CONFIG } from "./types";

/**
 * 段落信息
 */
interface Paragraph {
  content: string;
  startOffset: number;
  endOffset: number;
}

/**
 * 语义切片器
 *
 * 特性：
 * - 按 Markdown 标题智能分割 Parent
 * - 保留代码块完整性
 * - 滑动窗口 + 重叠确保上下文连续
 * - 自动计算内容哈希用于去重
 */
export class SemanticChunker {
  private config: ChunkConfig;

  constructor(config?: Partial<ChunkConfig>) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
  }

  /**
   * 对文本进行 Parent-Child 切片
   *
   * @param text - 输入文本
   * @returns 切片数组
   */
  chunk(text: string): Chunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: Chunk[] = [];

    // Step 1: 按段落/标题拆分 Parent
    const parents = this.splitIntoParents(text);

    let chunkIndex = 0;

    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      const parentTokenCount = this.estimateTokens(parent.content);

      // 跳过过短的段落
      if (parentTokenCount < this.config.minTokens) {
        continue;
      }

      // 创建 Parent chunk
      const parentChunk: Chunk = {
        content: parent.content,
        index: chunkIndex++,
        tokenCount: parentTokenCount,
        startOffset: parent.startOffset,
        endOffset: parent.endOffset,
        type: "parent",
        contentHash: this.hashContent(parent.content),
      };
      chunks.push(parentChunk);

      // Step 2: 将 Parent 拆分为多个 Child
      // 只有当 Parent 超过 maxTokens 时才拆分
      if (parentTokenCount > this.config.maxTokens) {
        const children = this.splitIntoChildren(
          parent.content,
          parent.startOffset,
        );

        for (const child of children) {
          chunks.push({
            ...child,
            index: chunkIndex++,
            parentIndex: parentChunk.index,
            type: "child",
          });
        }
      }
    }

    logger.debug(
      {
        inputLength: text.length,
        totalChunks: chunks.length,
        parentChunks: chunks.filter((c) => c.type === "parent").length,
        childChunks: chunks.filter((c) => c.type === "child").length,
      },
      "SemanticChunker: Chunking completed",
    );

    return chunks;
  }

  /**
   * 获取切片统计信息
   */
  getStats(chunks: Chunk[]): ChunkingStats {
    const parentChunks = chunks.filter((c) => c.type === "parent");
    const childChunks = chunks.filter((c) => c.type === "child");

    return {
      totalChunks: chunks.length,
      parentChunks: parentChunks.length,
      childChunks: childChunks.length,
      totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      avgChildrenPerParent:
        parentChunks.length > 0 ? childChunks.length / parentChunks.length : 0,
    };
  }

  /**
   * 按段落/标题分割为 Parent
   */
  private splitIntoParents(text: string): Paragraph[] {
    const parents: Paragraph[] = [];

    if (this.config.splitByHeaders) {
      // 按 Markdown 标题分割
      const headerPattern = /^(#{1,6})\s+(.+)$/gm;
      const matches: Array<{ index: number; header: string }> = [];

      let match;
      while ((match = headerPattern.exec(text)) !== null) {
        matches.push({ index: match.index, header: match[0] });
      }

      if (matches.length > 0) {
        // 处理第一个标题之前的内容
        if (matches[0].index > 0) {
          const content = text.slice(0, matches[0].index).trim();
          if (content) {
            parents.push({
              content,
              startOffset: 0,
              endOffset: matches[0].index,
            });
          }
        }

        // 处理每个标题及其内容
        for (let i = 0; i < matches.length; i++) {
          const startIdx = matches[i].index;
          const endIdx =
            i < matches.length - 1 ? matches[i + 1].index : text.length;
          const content = text.slice(startIdx, endIdx).trim();

          if (content) {
            parents.push({
              content,
              startOffset: startIdx,
              endOffset: endIdx,
            });
          }
        }

        return parents;
      }
    }

    // 如果没有标题，按双换行分割
    const paragraphs = text.split(/\n{2,}/);
    let offset = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed) {
        const startIdx = text.indexOf(para, offset);
        const endIdx = startIdx + para.length;

        parents.push({
          content: trimmed,
          startOffset: startIdx,
          endOffset: endIdx,
        });

        offset = endIdx;
      }
    }

    // 如果仍然没有分割，将整个文本作为一个 Parent
    if (parents.length === 0) {
      parents.push({
        content: text.trim(),
        startOffset: 0,
        endOffset: text.length,
      });
    }

    return parents;
  }

  /**
   * 将 Parent 拆分为多个 Child
   * 使用滑动窗口 + 重叠策略
   */
  private splitIntoChildren(
    parentContent: string,
    parentStartOffset: number,
  ): Omit<Chunk, "index" | "parentIndex" | "type">[] {
    const children: Omit<Chunk, "index" | "parentIndex" | "type">[] = [];

    // 如果需要保留代码块，先提取并标记
    let processedContent = parentContent;
    const codeBlocks: Array<{ placeholder: string; content: string }> = [];

    if (this.config.preserveCodeBlocks) {
      const codeBlockPattern = /```[\s\S]*?```/g;
      let matchIdx = 0;

      processedContent = parentContent.replace(codeBlockPattern, (match) => {
        const placeholder = `__CODE_BLOCK_${matchIdx}__`;
        codeBlocks.push({ placeholder, content: match });
        matchIdx++;
        return placeholder;
      });
    }

    // 按句子分割
    const sentences = this.splitIntoSentences(processedContent);

    let currentChunk = "";
    let currentTokens = 0;
    let chunkStartOffset = parentStartOffset;

    for (let i = 0; i < sentences.length; i++) {
      let sentence = sentences[i];

      // 还原代码块
      for (const { placeholder, content } of codeBlocks) {
        sentence = sentence.replace(placeholder, content);
      }

      const sentenceTokens = this.estimateTokens(sentence);

      // 如果单个句子就超过 maxTokens，强制拆分
      if (sentenceTokens > this.config.maxTokens) {
        // 先保存当前累积的内容
        if (currentChunk.trim()) {
          children.push(
            this.createChildChunk(
              currentChunk.trim(),
              chunkStartOffset,
              parentStartOffset,
              parentContent,
            ),
          );
        }

        // 强制按字符拆分长句子
        const forceSplitChunks = this.forceSplitLongText(
          sentence,
          parentStartOffset + parentContent.indexOf(sentence),
        );
        children.push(...forceSplitChunks);

        currentChunk = "";
        currentTokens = 0;
        chunkStartOffset =
          parentStartOffset + parentContent.indexOf(sentence) + sentence.length;
        continue;
      }

      // 检查是否超过 maxTokens
      if (currentTokens + sentenceTokens > this.config.maxTokens) {
        // 保存当前 chunk
        if (currentChunk.trim()) {
          children.push(
            this.createChildChunk(
              currentChunk.trim(),
              chunkStartOffset,
              parentStartOffset,
              parentContent,
            ),
          );
        }

        // 计算重叠部分
        const overlapContent = this.getOverlapContent(
          currentChunk,
          this.config.overlapTokens,
        );

        // 开始新 chunk（包含重叠）
        currentChunk = overlapContent + sentence;
        currentTokens = this.estimateTokens(overlapContent) + sentenceTokens;
        chunkStartOffset =
          parentStartOffset +
          parentContent.indexOf(sentence) -
          overlapContent.length;
      } else {
        currentChunk += sentence;
        currentTokens += sentenceTokens;
      }
    }

    // 保存最后一个 chunk
    if (
      currentChunk.trim() &&
      this.estimateTokens(currentChunk) >= this.config.minTokens
    ) {
      children.push(
        this.createChildChunk(
          currentChunk.trim(),
          chunkStartOffset,
          parentStartOffset,
          parentContent,
        ),
      );
    }

    return children;
  }

  /**
   * 创建 Child chunk
   */
  private createChildChunk(
    content: string,
    startOffset: number,
    parentStartOffset: number,
    parentContent: string,
  ): Omit<Chunk, "index" | "parentIndex" | "type"> {
    const contentPos = parentContent.indexOf(content);
    const actualStartOffset =
      contentPos >= 0 ? parentStartOffset + contentPos : startOffset;

    return {
      content,
      tokenCount: this.estimateTokens(content),
      startOffset: actualStartOffset,
      endOffset: actualStartOffset + content.length,
      contentHash: this.hashContent(content),
    };
  }

  /**
   * 按句子分割文本
   */
  private splitIntoSentences(text: string): string[] {
    // 中英文句号、问号、感叹号作为分隔符
    // 保留分隔符在句子末尾
    const sentencePattern = /([^。！？.!?]+[。！？.!?]?)/g;
    const sentences: string[] = [];
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      const sentence = match[1].trim();
      if (sentence) {
        sentences.push(sentence + " ");
      }
    }

    return sentences;
  }

  /**
   * 获取用于重叠的内容
   */
  private getOverlapContent(text: string, overlapTokens: number): string {
    const words = text.split(/\s+/);
    const overlapWords: string[] = [];
    let tokens = 0;

    // 从后往前取词，直到达到 overlapTokens
    for (let i = words.length - 1; i >= 0 && tokens < overlapTokens; i--) {
      overlapWords.unshift(words[i]);
      tokens += this.estimateTokens(words[i]);
    }

    return overlapWords.join(" ") + " ";
  }

  /**
   * 强制拆分过长文本
   */
  private forceSplitLongText(
    text: string,
    baseOffset: number,
  ): Omit<Chunk, "index" | "parentIndex" | "type">[] {
    const chunks: Omit<Chunk, "index" | "parentIndex" | "type">[] = [];
    const maxChars = this.config.maxTokens * 4; // 粗略估计：1 token ≈ 4 字符
    let offset = 0;

    while (offset < text.length) {
      const end = Math.min(offset + maxChars, text.length);
      const content = text.slice(offset, end);

      chunks.push({
        content,
        tokenCount: this.estimateTokens(content),
        startOffset: baseOffset + offset,
        endOffset: baseOffset + end,
        contentHash: this.hashContent(content),
      });

      offset = end;
    }

    return chunks;
  }

  /**
   * 估算文本的 Token 数
   * 粗略估计：中文 2 字符/token，英文 4 字符/token
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;

    // 统计中文字符
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 其他字符
    const otherChars = text.length - chineseChars;

    // 中文按 1.5 字符/token，英文按 4 字符/token
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 计算内容哈希
   */
  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }
}

// 单例实例
let chunkerInstance: SemanticChunker | null = null;

/**
 * 获取 SemanticChunker 单例
 */
export function getSemanticChunker(
  config?: Partial<ChunkConfig>,
): SemanticChunker {
  if (!chunkerInstance) {
    chunkerInstance = new SemanticChunker(config);
  }
  return chunkerInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetSemanticChunker(): void {
  chunkerInstance = null;
}
