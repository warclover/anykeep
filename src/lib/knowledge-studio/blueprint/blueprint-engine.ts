/**
 * Blueprint Engine - 蓝图生成引擎核心
 * @module knowledge-studio/blueprint
 * @description 5 种写作蓝图的生成引擎，支持 SSE 流式输出
 */

import { createLogger } from "@/lib/logger";
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

      const outline = await this.generateOutline(context, parsedMaterials);
      stagesTiming.outline = Date.now() - outlineStart;
      this.emitProgress(context, "outline", 100, onProgress);

      // Stage 3: Content - 生成正文
      this.emitProgress(context, "content", 0, onProgress);
      const contentStart = Date.now();

      const content = await this.generateContent(
        context,
        outline,
        parsedMaterials,
        onProgress,
      );
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
      const actualModel = selection?.model?.modelId || "deepseek-chat";

      const metadata: BlueprintMetadata = {
        model: actualModel,
        tokens: {
          input: 0, // TODO: 从实际调用结果获取
          output: 0, // TODO: 从实际调用结果获取
          total: 0, // TODO: 从实际调用结果获取
        },
        durationMs: Date.now() - startTime,
        stagesTiming,
      };

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
   */
  private async generateOutline(
    context: GenerationContext,
    materials: ParsedMaterial[],
  ): Promise<string> {
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
        modelId: selection?.model?.modelId,
        selectionReason: selection?.reason,
        envCheck: {
          hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
          deepSeekKeyLength: process.env.DEEPSEEK_API_KEY?.length || 0,
        },
      },
      "Selecting AI model for outline generation",
    );

    if (!selection?.model) {
      logger.warn(
        { requestId: context.requestId },
        "No AI model available for outline generation, using fallback",
      );
      return `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`;
    }

    try {
      logger.info(
        {
          requestId: context.requestId,
          modelId: selection.model.modelId,
          promptType: typeof prompt,
          promptSystem: typeof prompt === "object" ? prompt.system?.slice(0, 100) : undefined,
          promptUser: typeof prompt === "object" ? prompt.user?.slice(0, 100) : typeof prompt === "string" ? prompt.slice(0, 100) : undefined,
        },
        "Calling AI model for outline generation",
      );

      // buildPromptForBlueprint 返回 { system, user }，需要直接传递
      const { text, usage } = await generateText({
        model: selection.model,
        system: prompt.system,
        prompt: prompt.user,
        maxTokens: 1000,
        temperature: 0.7,
      });

      logger.info(
        {
          requestId: context.requestId,
          textLength: text?.length || 0,
          hasText: !!text,
          textPreview: text?.slice(0, 200),
          usage: usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens } : undefined,
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
        return `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`;
      }

      // 检查是否是占位文本（简单启发式检查）
      const isPlaceholder = text.includes("这是基于") && text.includes("个素材生成");
      if (isPlaceholder) {
        logger.warn(
          {
            requestId: context.requestId,
            textPreview: text.slice(0, 100),
          },
          "Outline generation returned placeholder-like text, may indicate AI call issue",
        );
      }

      return text;
    } catch (error) {
      logger.error(
        {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "Outline generation failed, using fallback",
      );
      return `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`;
    }
  }

  /**
   * 生成正文内容
   */
  private async generateContent(
    context: GenerationContext,
    outline: string,
    materials: ParsedMaterial[],
    onProgress?: ProgressCallback,
  ): Promise<string> {
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
        modelId: selection?.model?.modelId,
        selectionReason: selection?.reason,
        envCheck: {
          hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
          deepSeekKeyLength: process.env.DEEPSEEK_API_KEY?.length || 0,
        },
      },
      "Selecting AI model for content generation",
    );

    if (!selection?.model) {
      logger.warn(
        { requestId: context.requestId },
        "No AI model available for content generation, using fallback",
      );
      return `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`;
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
          modelId: selection.model.modelId,
          promptType: typeof prompt,
          promptSystem: typeof prompt === "object" ? prompt.system?.slice(0, 100) : undefined,
          promptUser: typeof prompt === "object" ? prompt.user?.slice(0, 100) : typeof prompt === "string" ? prompt.slice(0, 100) : undefined,
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
        maxTokens,
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
            error: streamError instanceof Error ? streamError.message : String(streamError),
            errorStack: streamError instanceof Error ? streamError.stack : undefined,
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
              error: textError instanceof Error ? textError.message : String(textError),
              errorStack: textError instanceof Error ? textError.stack : undefined,
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
          const error = new Error("AI 模型调用失败：未收到任何内容。请检查 API Key 配置和网络连接。");
          logger.error(
            {
              requestId: context.requestId,
              error: error.message,
            },
            "Throwing error for empty content generation",
          );
          throw error;
        }
        
        return `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`;
      }

      // 检查是否是占位文本（简单启发式检查）
      const isPlaceholder = fullContent.includes("这是基于") && fullContent.includes("个素材生成");
      if (isPlaceholder) {
        logger.warn(
          {
            requestId: context.requestId,
            contentPreview: fullContent.slice(0, 200),
          },
          "Content generation returned placeholder-like text, may indicate AI call issue",
        );
      }

      return fullContent;
    } catch (error) {
      logger.error(
        {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "Content generation failed, using fallback",
      );
      return `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`;
    }
  }

  /**
   * 提取引用
   */
  private async extractCitations(
    content: string,
    materials: MaterialInput[],
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    // TODO: 使用 AI 或规则提取引用位置
    // 临时为每个素材生成一个引用
    materials.forEach((m, index) => {
      citations.push({
        bookmarkId: m.bookmarkId,
        title: m.title,
        url: m.url,
        excerpt: m.content.slice(0, 100) + "...",
        position: index + 1,
      });
    });

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

    // TODO: 在内容中插入引用标记 [^1], [^2] 等

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
