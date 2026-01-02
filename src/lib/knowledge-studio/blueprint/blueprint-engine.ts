/**
 * Blueprint Engine - 蓝图生成引擎核心
 * @module knowledge-studio/blueprint
 * @description 5 种写作蓝图的生成引擎，支持 SSE 流式输出
 */

import { createLogger } from "@/lib/logger";
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

      const metadata: BlueprintMetadata = {
        model: "deepseek-chat", // TODO: 从实际调用获取
        tokens: {
          input: 0,
          output: 0,
          total: 0,
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
    const _prompt = buildPromptForBlueprint(context.config.type, "outline", {
      materials,
      customPrompt: context.customPrompt,
    });

    // TODO: 调用 AI 模型
    // const response = await this.callModel(prompt);

    // 临时返回占位大纲
    return `# ${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格大纲\n\n## 引言\n\n## 主体\n\n## 结论`;
  }

  /**
   * 生成正文内容
   */
  private async generateContent(
    context: GenerationContext,
    outline: string,
    materials: ParsedMaterial[],
    _onProgress?: ProgressCallback,
  ): Promise<string> {
    const _prompt = buildPromptForBlueprint(context.config.type, "content", {
      outline,
      materials,
      targetLength: context.config.targetLength,
      tone: context.config.tone,
    });

    // TODO: 调用 AI 模型，流式输出
    // 这里需要实现流式生成，每生成一部分就通过 onProgress 回调

    // 临时返回占位内容
    return `这是基于 ${materials.length} 个素材生成的${BLUEPRINT_DISPLAY_CONFIG[context.config.type].name}风格内容。\n\n${outline}`;
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
