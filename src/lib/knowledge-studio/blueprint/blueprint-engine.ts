/**
 * Blueprint Engine - 蓝图生成引擎核心
 * @module knowledge-studio/blueprint
 * @description 5 种写作蓝图的生成引擎，支持 SSE 流式输出
 */

import { createLogger } from "@/lib/logger";
import { aiEnv } from "@/lib/env";
import { generateText, streamText } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";
import type {
  BlueprintMetadata,
  Citation,
  GenerationStage,
  StreamChunk,
  RecoverableError,
} from "../types";
import { ERROR_CODES } from "../types";
import type {
  GenerationContext,
  MaterialInput,
  BlueprintEngineConfig,
  ProgressCallback,
  GenerationResult,
} from "./types";
import { BLUEPRINT_DISPLAY_CONFIG } from "./types";
import { buildPromptForBlueprint } from "./prompt-builder";
import type { StreamEmitter } from "../streaming/stream-emitter";

const logger = createLogger("blueprint-engine");

/**
 * 默认引擎配置
 */
const DEFAULT_CONFIG: BlueprintEngineConfig = {
  maxContextTokens: 8000,
  defaultTargetLength: "medium",
  enableCitationTracking: true,
  streamingEnabled: true,
};

/**
 * 阶段权重（用于计算总进度）
 */
const STAGE_WEIGHTS: Record<GenerationStage, number> = {
  parsing: 10,
  outline: 20,
  content: 50,
  citations: 15,
  finalizing: 5,
};

/**
 * BlueprintEngine - 蓝图生成引擎
 *
 * 职责：
 * 1. 解析素材并构建上下文
 * 2. 根据蓝图类型生成 Prompt
 * 3. 调用 AI 模型生成内容
 * 4. 提取和验证引用
 * 5. 通过 SSE 报告进度
 */
export class BlueprintEngine {
  private config: BlueprintEngineConfig;
  private streamEmitter: StreamEmitter | null = null;

  constructor(config: Partial<BlueprintEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成合成报告（主入口）
   */
  async generate(
    context: GenerationContext,
    onProgress?: ProgressCallback,
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const stagesTiming: Record<GenerationStage, number> = {
      parsing: 0,
      outline: 0,
      content: 0,
      citations: 0,
      finalizing: 0,
    };

    logger.info(
      {
        requestId: context.requestId,
        blueprintType: context.config.type,
        materialCount: context.materials.length,
      },
      "Starting blueprint generation",
    );

    try {
      // Stage 1: Parsing - 解析素材
      this.emitProgress(context, "parsing", 0, onProgress);
      const stageStart = Date.now();

      const parsedMaterials = await this.parseMaterials(context.materials);
      stagesTiming.parsing = Date.now() - stageStart;
      this.emitProgress(context, "parsing", 100, onProgress);

      // Stage 2: Outline - 生成大纲
      this.emitProgress(context, "outline", 0, onProgress);
      const outlineStart = Date.now();

      const outlineResult = await this.generateOutline(
        context,
        parsedMaterials,
      );
      const outline = outlineResult.text;
      const outlineUsage = outlineResult.usage;
      stagesTiming.outline = Date.now() - outlineStart;
      this.emitProgress(context, "outline", 100, onProgress);

      // Stage 3: Content - 生成正文
      this.emitProgress(context, "content", 0, onProgress);
      const contentStart = Date.now();

      const contentResult = await this.generateContent(
        context,
        outline,
        parsedMaterials,
        onProgress,
      );
      const content = contentResult.text;
      const contentUsage = contentResult.usage;
      stagesTiming.content = Date.now() - contentStart;
      this.emitProgress(context, "content", 100, onProgress);

      // Stage 4: Citations - 提取引用
      this.emitProgress(context, "citations", 0, onProgress);
      const citationsStart = Date.now();

      const citations = await this.extractCitations(content, context.materials);
      stagesTiming.citations = Date.now() - citationsStart;
      this.emitProgress(context, "citations", 100, onProgress);

      // Stage 5: Finalizing - 最终处理
      this.emitProgress(context, "finalizing", 0, onProgress);
      const finalizingStart = Date.now();

      const finalContent = await this.finalizeContent(content, citations);
      stagesTiming.finalizing = Date.now() - finalizingStart;
      this.emitProgress(context, "finalizing", 100, onProgress);

      // 获取实际使用的模型（从最后一次调用获取）
      const selection = aiProviderRouter.selectProvider({ taskType: "chat" });
      const actualModel = selection?.provider?.defaultModel || "deepseek-chat";

      // 累加 Token 使用情况
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      if (outlineUsage) {
        totalInputTokens += outlineUsage.inputTokens;
        totalOutputTokens += outlineUsage.outputTokens;
      }
      if (contentUsage) {
        totalInputTokens += contentUsage.inputTokens;
        totalOutputTokens += contentUsage.outputTokens;
      }

      const metadata: BlueprintMetadata = {
        model: actualModel,
        tokens: {
          input: totalInputTokens,
          output: totalOutputTokens,
          total: totalInputTokens + totalOutputTokens,
        },
        durationMs: Date.now() - startTime,
        stagesTiming,
      };

      logger.info(
        {
          requestId: context.requestId,
          tokens: metadata.tokens,
          outlineUsage,
          contentUsage,
        },
        "Token usage calculated",
      );

      logger.info(
        {
          requestId: context.requestId,
          durationMs: metadata.durationMs,
          citationCount: citations.length,
        },
        "Blueprint generation completed",
      );

      return {
        success: true,
        content: finalContent,
        citations,
        metadata,
      };
    } catch (error) {
      logger.error(
        {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Blueprint generation failed",
      );

      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 解析素材
   */
  private async parseMaterials(
    materials: MaterialInput[],
  ): Promise<ParsedMaterial[]> {
    return materials.map((m) => ({
      ...m,
      wordCount: this.estimateTokens(m.content),
      keyPoints: [], // TODO: 提取关键点
    }));
  }

  /**
   * 生成大纲
   * @returns 大纲文本和 Token 使用情况
   */
  private async generateOutline(
    context: GenerationContext,
    materials: ParsedMaterial[],
  ): Promise<{
    text: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }> {
    const prompt = buildPromptForBlueprint(context.config.type, "outline", {
      materials,
      customPrompt: context.customPrompt,
    });

    // 获取 AI 模型
    const selection = aiProviderRouter.selectProvider({ taskType: "chat" });

    logger.info(
      {
        requestId: context.requestId,
        hasSelection: !!selection,
        hasModel: !!selection?.model,
        provider: selection?.provider?.name,
        providerEnabled: selection?.provider?.enabled,
        modelId: selection?.provider?.defaultModel,
        selectionReason: selection?.reason,
        envCheck: {
          hasDeepSeekKey: aiEnv.hasDeepseekApiKey,
          deepSeekKeyLength: aiEnv.hasDeepseekApiKey
            ? aiEnv.deepseekApiKey.length
            : 0,
        },
      },
      "Selecting AI model for outline generation",
    );

    if (!selection?.model) {
      logger.warn(
        { requestId: context.requestId },
        "No AI model available for outline generation, using fallback",
      );
      return {
        text: `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`,
        usage: undefined,
      };
    }

    try {
      logger.info(
        {
          requestId: context.requestId,
          modelId: selection.provider.defaultModel,
          promptType: "object",
          promptSystem: prompt.system?.slice(0, 100),
          promptUser: prompt.user?.slice(0, 100),
        },
        "Calling AI model for outline generation",
      );

      // buildPromptForBlueprint 返回 { system, user }，需要直接传递
      const { text, usage } = await generateText({
        model: selection.model,
        system: prompt.system,
        prompt: prompt.user,
        maxOutputTokens: 1000,
        temperature: 0.7,
      });

      logger.info(
        {
          requestId: context.requestId,
          textLength: text?.length || 0,
          hasText: !!text,
          textPreview: text?.slice(0, 200),
          usage: usage
            ? {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              }
            : undefined,
        },
        "Outline generation AI call completed",
      );

      if (!text || text.trim().length === 0) {
        logger.error(
          {
            requestId: context.requestId,
            textLength: text?.length || 0,
            textValue: text,
          },
          "Outline generation returned empty or whitespace-only text",
        );
        return {
          text: `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`,
          usage: undefined,
        };
      }

      // 检查是否是占位文本（简单启发式检查）
      const isPlaceholder =
        text.includes("这是基于") && text.includes("个素材生成");
      if (isPlaceholder) {
        logger.warn(
          {
            requestId: context.requestId,
            textPreview: text.slice(0, 100),
          },
          "Outline generation returned placeholder-like text, may indicate AI call issue",
        );
      }

      // 返回文本和 Token 使用情况
      const tokenUsage = usage
        ? {
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
          }
        : undefined;

      return {
        text,
        usage: tokenUsage,
      };
    } catch (error) {
      logger.error(
        {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "Outline generation failed, using fallback",
      );
      return {
        text: `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`,
        usage: undefined,
      };
    }
  }

  /**
   * 生成正文内容
   * @returns 正文文本和 Token 使用情况
   */
  private async generateContent(
    context: GenerationContext,
    outline: string,
    materials: ParsedMaterial[],
    onProgress?: ProgressCallback,
  ): Promise<{
    text: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }> {
    const prompt = buildPromptForBlueprint(context.config.type, "content", {
      outline,
      materials,
      targetLength: context.config.targetLength,
      tone: context.config.tone,
    });

    // 获取 AI 模型
    const selection = aiProviderRouter.selectProvider({ taskType: "chat" });

    logger.info(
      {
        requestId: context.requestId,
        hasSelection: !!selection,
        hasModel: !!selection?.model,
        provider: selection?.provider?.name,
        providerEnabled: selection?.provider?.enabled,
        modelId: selection?.provider?.defaultModel,
        selectionReason: selection?.reason,
        envCheck: {
          hasDeepSeekKey: aiEnv.hasDeepseekApiKey,
          deepSeekKeyLength: aiEnv.hasDeepseekApiKey
            ? aiEnv.deepseekApiKey.length
            : 0,
        },
      },
      "Selecting AI model for content generation",
    );

    if (!selection?.model) {
      logger.warn(
        { requestId: context.requestId },
        "No AI model available for content generation, using fallback",
      );
      return {
        text: `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`,
        usage: undefined,
      };
    }

    try {
      // 根据目标长度设置输出 token 数
      const maxTokensMap = {
        short: 1500,
        medium: 3000,
        long: 5000,
      };
      const maxTokens = maxTokensMap[context.config.targetLength || "medium"];

      logger.info(
        {
          requestId: context.requestId,
          modelId: selection.provider.defaultModel,
          promptType: "object",
          promptSystem: prompt.system?.slice(0, 100),
          promptUser: prompt.user?.slice(0, 100),
          maxTokens,
          targetLength: context.config.targetLength,
        },
        "Calling AI model for content generation (streaming)",
      );

      // buildPromptForBlueprint 返回 { system, user }，需要直接传递
      const result = streamText({
        model: selection.model,
        system: prompt.system,
        prompt: prompt.user,
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      });

      logger.info(
        {
          requestId: context.requestId,
          hasResult: !!result,
          hasTextStream: !!result.textStream,
        },
        "StreamText result created, starting to read stream",
      );

      let fullContent = "";
      let chunkCount = 0;
      let hasReceivedChunks = false;

      // 流式读取内容
      try {
        for await (const chunk of result.textStream) {
          fullContent += chunk;
          chunkCount++;
          hasReceivedChunks = true;

          logger.debug(
            {
              requestId: context.requestId,
              chunkLength: chunk.length,
              totalLength: fullContent.length,
              chunkCount,
            },
            "Received content chunk",
          );

          // 发送内容更新事件
          if (onProgress) {
            const contentChunk: StreamChunk = {
              type: "content",
              data: {
                content: chunk,
              },
              timestamp: new Date().toISOString(),
              requestId: context.requestId,
            };
            onProgress(contentChunk);
          }
        }
      } catch (streamError) {
        logger.error(
          {
            requestId: context.requestId,
            error:
              streamError instanceof Error
                ? streamError.message
                : String(streamError),
            errorStack:
              streamError instanceof Error ? streamError.stack : undefined,
            chunkCount,
            contentLength: fullContent.length,
          },
          "Error reading text stream",
        );
        // 如果已经收到一些内容，继续使用；否则抛出错误
        if (!hasReceivedChunks) {
          throw streamError;
        }
      }

      // 如果流式读取没有产生内容，尝试获取完整文本
      if (!fullContent || fullContent.trim().length === 0) {
        logger.warn(
          { requestId: context.requestId, chunkCount, hasReceivedChunks },
          "Text stream produced no content, trying to get full text",
        );

        try {
          // 等待流完成并获取完整文本
          const fullText = await result.text;
          if (fullText && fullText.trim().length > 0) {
            fullContent = fullText;
            logger.info(
              { requestId: context.requestId, textLength: fullText.length },
              "Retrieved full text from result",
            );
          } else {
            logger.warn(
              {
                requestId: context.requestId,
                textLength: fullText?.length || 0,
                textPreview: fullText?.slice(0, 100),
              },
              "Full text from result is also empty",
            );
          }
        } catch (textError) {
          logger.error(
            {
              requestId: context.requestId,
              error:
                textError instanceof Error
                  ? textError.message
                  : String(textError),
              errorStack:
                textError instanceof Error ? textError.stack : undefined,
            },
            "Failed to get full text from result",
          );
        }
      }

      logger.info(
        {
          requestId: context.requestId,
          contentLength: fullContent.length,
          chunkCount,
          hasContent: !!fullContent,
          hasReceivedChunks,
        },
        "Content generation completed",
      );

      if (!fullContent || fullContent.trim().length === 0) {
        logger.error(
          {
            requestId: context.requestId,
            chunkCount,
            hasReceivedChunks,
            contentLength: fullContent.length,
            resultKeys: result ? Object.keys(result) : [],
          },
          "Content generation returned empty text, using fallback",
        );

        // 如果完全没有收到任何内容，抛出错误而不是使用 fallback
        if (!hasReceivedChunks && chunkCount === 0) {
          const error = new Error(
            "AI 模型调用失败：未收到任何内容。请检查 API Key 配置和网络连接。",
          );
          logger.error(
            {
              requestId: context.requestId,
              error: error.message,
            },
            "Throwing error for empty content generation",
          );
          throw error;
        }

        return {
          text: `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`,
          usage: undefined,
        };
      }

      // 检查是否是占位文本（简单启发式检查）
      const isPlaceholder =
        fullContent.includes("这是基于") && fullContent.includes("个素材生成");
      if (isPlaceholder) {
        logger.warn(
          {
            requestId: context.requestId,
            contentPreview: fullContent.slice(0, 200),
          },
          "Content generation returned placeholder-like text, may indicate AI call issue",
        );
      }

      // 获取 Token 使用情况（从 result.usage 获取）
      let tokenUsage:
        | {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
          }
        | undefined;
      try {
        const usage = await result.usage;
        if (usage) {
          tokenUsage = {
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
          };
          logger.info(
            {
              requestId: context.requestId,
              usage: tokenUsage,
            },
            "Content generation token usage",
          );
        }
      } catch (usageError) {
        logger.warn(
          {
            requestId: context.requestId,
            error:
              usageError instanceof Error
                ? usageError.message
                : String(usageError),
          },
          "Failed to get token usage from stream result",
        );
      }

      return {
        text: fullContent,
        usage: tokenUsage,
      };
    } catch (error) {
      logger.error(
        {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "Content generation failed, using fallback",
      );
      return {
        text: `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`,
        usage: undefined,
      };
    }
  }

  /**
   * 提取引用
   * 基于规则和内容匹配提取引用位置
   */
  private async extractCitations(
    content: string,
    materials: MaterialInput[],
  ): Promise<Citation[]> {
    const citations: Citation[] = [];
    const usedBookmarkIds = new Set<string>();

    // 策略 1: 基于标题匹配
    // 在内容中查找素材标题，如果找到则标记为已使用
    for (const material of materials) {
      // 清理标题（移除特殊字符，用于匹配）
      const cleanTitle = material.title.replace(/[【】\[\]()（）]/g, "").trim();

      // 检查内容中是否包含标题（支持部分匹配）
      const titlePatterns = [
        cleanTitle, // 完整标题
        cleanTitle.slice(0, Math.max(10, Math.floor(cleanTitle.length * 0.6))), // 标题前60%或至少10个字符
      ];

      let foundInContent = false;
      for (const pattern of titlePatterns) {
        if (pattern.length >= 5 && content.includes(pattern)) {
          foundInContent = true;
          break;
        }
      }

      // 策略 2: 基于 URL 域名匹配
      if (!foundInContent) {
        try {
          const urlObj = new URL(material.url);
          const domain = urlObj.hostname.replace(/^www\./, "");
          // 检查内容中是否提到域名
          if (content.includes(domain)) {
            foundInContent = true;
          }
        } catch {
          // URL 解析失败，跳过
        }
      }

      // 策略 3: 基于内容摘要匹配（关键词提取）
      if (!foundInContent && material.content) {
        // 提取素材内容的前几个关键词（简单实现：取前50个字符中的关键词）
        const materialKeywords = material.content
          .slice(0, 200)
          .split(/[，。、\s\n]/)
          .filter((word) => word.length >= 2)
          .slice(0, 5); // 取前5个关键词

        // 检查内容中是否包含这些关键词
        const keywordMatches = materialKeywords.filter((keyword) =>
          content.includes(keyword),
        ).length;

        // 如果匹配到至少2个关键词，认为相关
        if (keywordMatches >= 2) {
          foundInContent = true;
        }
      }

      // 如果找到匹配，添加到引用列表
      if (foundInContent || citations.length < materials.length) {
        // 提取内容中相关的片段作为 excerpt
        let excerpt = material.content.slice(0, 100) + "...";

        // 尝试从内容中找到包含标题的段落作为 excerpt
        if (cleanTitle.length >= 5) {
          const titleIndex = content.indexOf(cleanTitle);
          if (titleIndex >= 0) {
            // 提取标题前后各50个字符
            const start = Math.max(0, titleIndex - 50);
            const end = Math.min(
              content.length,
              titleIndex + cleanTitle.length + 50,
            );
            const contextExcerpt = content.slice(start, end).trim();
            if (contextExcerpt.length > 0) {
              excerpt = contextExcerpt;
            }
          }
        }

        citations.push({
          bookmarkId: material.bookmarkId,
          title: material.title,
          url: material.url,
          excerpt,
          position: citations.length + 1,
        });
        usedBookmarkIds.add(material.bookmarkId);
      }
    }

    // 确保所有素材都有引用（如果还没有）
    for (const material of materials) {
      if (!usedBookmarkIds.has(material.bookmarkId)) {
        citations.push({
          bookmarkId: material.bookmarkId,
          title: material.title,
          url: material.url,
          excerpt: material.content.slice(0, 100) + "...",
          position: citations.length + 1,
        });
      }
    }

    logger.info(
      {
        totalMaterials: materials.length,
        extractedCitations: citations.length,
      },
      "Citations extracted",
    );

    return citations;
  }

  /**
   * 最终内容处理
   */
  private async finalizeContent(
    content: string,
    citations: Citation[],
  ): Promise<string> {
    // 添加引用标记
    let finalContent = content;

    // 在内容中插入引用标记 [^1], [^2] 等
    // 使用智能匹配算法将引用插入到最相关的段落
    if (citations.length > 0) {
      finalContent = this.insertCitationMarkers(finalContent, citations);
    }

    // 添加引用脚注
    if (citations.length > 0) {
      finalContent += "\n\n---\n\n## 参考来源\n\n";
      citations.forEach((c, i) => {
        finalContent += `[^${i + 1}]: [${c.title}](${c.url})\n`;
      });
    }

    return finalContent;
  }

  /**
   * 在内容中插入引用标记
   * 使用简单的关键词匹配和位置策略
   */
  private insertCitationMarkers(
    content: string,
    citations: Citation[],
  ): string {
    if (citations.length === 0) {
      return content;
    }

    // 按段落分割内容（保留分隔符）
    const paragraphs = content.split(/(\n\n+)/);
    const processedParagraphs: string[] = [];
    const usedCitations = new Set<number>();

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      // 跳过空段落和分隔符
      if (!paragraph.trim() || paragraph.match(/^\n+$/)) {
        processedParagraphs.push(paragraph);
        continue;
      }

      // 为每个段落找到最相关的引用
      const bestCitation = this.findBestCitationForParagraph(
        paragraph,
        citations,
        usedCitations,
      );

      if (bestCitation !== null) {
        const citationIndex = bestCitation + 1; // 引用编号从 1 开始
        usedCitations.add(bestCitation);

        // 在段落末尾插入引用标记（如果还没有）
        if (!paragraph.includes(`[^${citationIndex}]`)) {
          // 移除末尾的标点符号（如果有），然后添加引用标记
          const trimmed = paragraph.trimEnd();
          const lastChar = trimmed[trimmed.length - 1];
          const needsPunctuation = !/[。！？.!?]$/.test(lastChar);

          if (needsPunctuation) {
            processedParagraphs.push(trimmed + `[^${citationIndex}]`);
          } else {
            // 在最后一个标点符号前插入引用标记
            processedParagraphs.push(
              trimmed.slice(0, -1) + `[^${citationIndex}]` + lastChar,
            );
          }
        } else {
          processedParagraphs.push(paragraph);
        }
      } else {
        processedParagraphs.push(paragraph);
      }
    }

    // 确保每个引用至少被使用一次（如果内容中没有匹配，在适当位置插入）
    for (let i = 0; i < citations.length; i++) {
      if (!usedCitations.has(i)) {
        const citationIndex = i + 1;
        // 在第一个非空段落末尾添加引用标记
        for (let j = 0; j < processedParagraphs.length; j++) {
          const para = processedParagraphs[j];
          if (para.trim() && !para.match(/^\n+$/)) {
            if (!para.includes(`[^${citationIndex}]`)) {
              const trimmed = para.trimEnd();
              const lastChar = trimmed[trimmed.length - 1];
              if (/[。！？.!?]$/.test(lastChar)) {
                processedParagraphs[j] =
                  trimmed.slice(0, -1) + `[^${citationIndex}]` + lastChar;
              } else {
                processedParagraphs[j] = trimmed + `[^${citationIndex}]`;
              }
              usedCitations.add(i);
              break;
            }
          }
        }
      }
    }

    return processedParagraphs.join("");
  }

  /**
   * 为段落找到最相关的引用
   * 使用简单的关键词匹配算法
   */
  private findBestCitationForParagraph(
    paragraph: string,
    citations: Citation[],
    usedCitations: Set<number>,
  ): number | null {
    let bestMatch: { index: number; score: number } | null = null;

    for (let i = 0; i < citations.length; i++) {
      // 跳过已使用的引用（优先使用未使用的）
      if (usedCitations.has(i)) {
        continue;
      }

      const citation = citations[i];
      let score = 0;

      // 1. 检查标题关键词匹配
      const titleWords = citation.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const paragraphLower = paragraph.toLowerCase();
      for (const word of titleWords) {
        if (paragraphLower.includes(word)) {
          score += 2;
        }
      }

      // 2. 检查摘要关键词匹配
      const excerptWords = citation.excerpt
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      for (const word of excerptWords) {
        if (paragraphLower.includes(word)) {
          score += 1;
        }
      }

      // 3. 检查 URL 域名匹配（简单提取）
      try {
        const urlDomain = new URL(citation.url).hostname
          .replace(/^www\./, "")
          .split(".")[0]
          .toLowerCase();
        if (paragraphLower.includes(urlDomain)) {
          score += 1;
        }
      } catch {
        // URL 解析失败，忽略
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { index: i, score };
      }
    }

    // 如果找到匹配且分数足够高，返回引用索引
    if (bestMatch && bestMatch.score >= 2) {
      return bestMatch.index;
    }

    // 如果没有找到好的匹配，返回第一个未使用的引用
    for (let i = 0; i < citations.length; i++) {
      if (!usedCitations.has(i)) {
        return i;
      }
    }

    return null;
  }

  /**
   * 发送进度事件
   */
  private emitProgress(
    context: GenerationContext,
    stage: GenerationStage,
    stageProgress: number,
    onProgress?: ProgressCallback,
  ): void {
    if (!onProgress) return;

    const totalProgress = this.calculateTotalProgress(stage, stageProgress);

    const chunk: StreamChunk = {
      type: "progress",
      data: {
        stage,
        stageProgress,
        totalProgress,
      },
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
    };

    onProgress(chunk);
  }

  /**
   * 计算总进度
   */
  private calculateTotalProgress(
    currentStage: GenerationStage,
    stageProgress: number,
  ): number {
    const stages: GenerationStage[] = [
      "parsing",
      "outline",
      "content",
      "citations",
      "finalizing",
    ];
    const currentIndex = stages.indexOf(currentStage);

    let completed = 0;
    for (let i = 0; i < currentIndex; i++) {
      completed += STAGE_WEIGHTS[stages[i]];
    }

    const currentContribution =
      (STAGE_WEIGHTS[currentStage] * stageProgress) / 100;

    return Math.round(completed + currentContribution);
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(text: string): number {
    // 简单估算：中文约 1.5 字符/token，英文约 4 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;

    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): RecoverableError {
    if (error instanceof Error) {
      // 检查是否是可恢复的错误
      if (
        error.message.includes("timeout") ||
        error.message.includes("rate limit")
      ) {
        return {
          code: ERROR_CODES.GENERATION_TIMEOUT,
          message: "生成超时，请稍后重试",
          recoverable: true,
          retryAfterMs: 5000,
        };
      }
    }

    return {
      code: ERROR_CODES.GENERATION_FAILED,
      message: error instanceof Error ? error.message : "生成失败",
      recoverable: false,
    };
  }
}

/**
 * 解析后的素材
 */
interface ParsedMaterial extends MaterialInput {
  wordCount: number;
  keyPoints: string[];
}

// 导出单例（可选）
export const blueprintEngine = new BlueprintEngine();
