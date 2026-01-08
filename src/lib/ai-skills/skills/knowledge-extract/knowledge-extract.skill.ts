/**
 * KnowledgeExtractSkill - 知识萃取编排 Skill
 *
 * 从多篇收藏中提取、整合知识
 * 支持多种输出格式和 Perplexity 风格的来源标注
 *
 * 执行步骤：
 * 1. 收集内容 - 获取目标书签的内容
 * 2. 识别主题 - 分析文档，识别共同主题
 * 3. 提取知识 - 提取要点、概念、结论
 * 4. 格式化输出 - 按选定格式生成输出
 * 5. 交付结果 - 返回萃取结果
 *
 * @module ai-skills/skills/knowledge-extract
 * @version 1.0.0
 * @since 2025-12-25
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { logger } from "@/lib/logger";
import type {
  KnowledgeExtractInput,
  KnowledgeExtraction,
  ExtractionFormat,
} from "./types";
import { KnowledgeExtractor } from "./knowledge-extractor";
import { ExtractionFormatter } from "./formatter";

// ============================================
// Schema 定义
// ============================================

const KnowledgeExtractInputSchema = z.object({
  bookmarkIds: z
    .array(z.number())
    .min(1, "至少需要 1 篇收藏")
    .max(20, "最多支持 20 篇收藏")
    .describe("目标书签 ID 列表"),
  topic: z.string().max(20).optional().describe("指定主题（未指定时自动识别）"),
  format: z
    .enum(["summary", "memo", "outline"])
    .default("memo")
    .describe("输出格式"),
  options: z
    .object({
      maxKeyPoints: z.number().min(3).max(10).optional(),
      includeConceptDefinitions: z.boolean().optional(),
      includeActionItems: z.boolean().optional(),
    })
    .optional()
    .describe("萃取选项"),
});

// Citation Schema
const CitationSchema = z.object({
  id: z.number(),
  sourceId: z.number(),
  sourceTitle: z.string(),
  quotedText: z.string().optional(),
  confidence: z.number(),
});

// KeyPoint Schema
const KeyPointSchema = z.object({
  id: z.string(),
  content: z.string(),
  citations: z.array(CitationSchema),
  importance: z.enum(["high", "medium"]),
  synthesized: z.boolean(),
});

// ConceptDefinition Schema
const ConceptDefinitionSchema = z.object({
  term: z.string(),
  definition: z.string(),
  relatedConcepts: z.array(z.string()).optional(),
  sourceIds: z.array(z.number()),
});

// SourceInfo Schema
const SourceInfoSchema = z.object({
  id: z.number(),
  index: z.number(),
  title: z.string(),
  url: z.string(),
  platform: z.string(),
  savedAt: z.date(),
});

// ExtractionMetadata Schema
const ExtractionMetadataSchema = z.object({
  sourceCount: z.number(),
  extractedAt: z.date(),
  format: z.enum(["summary", "memo", "outline"]),
  llmModel: z.string(),
  processingTimeMs: z.number(),
});

// KnowledgeExtraction Output Schema
const KnowledgeExtractOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  keyPoints: z.array(KeyPointSchema),
  concepts: z.array(ConceptDefinitionSchema),
  conclusion: z.string(),
  actionItems: z.array(z.string()).optional(),
  sources: z.array(SourceInfoSchema),
  metadata: ExtractionMetadataSchema,
});

// ============================================
// 步骤定义
// ============================================

const EXTRACT_STEPS = [
  { id: "collect", name: "收集内容", description: "获取书签内容", weight: 15 },
  { id: "identify", name: "识别主题", description: "分析共同主题", weight: 15 },
  {
    id: "extract",
    name: "提取知识",
    description: "提取要点和概念",
    weight: 40,
  },
  {
    id: "format",
    name: "格式化输出",
    description: "生成格式化内容",
    weight: 20,
  },
  { id: "deliver", name: "交付结果", description: "返回萃取结果", weight: 10 },
];

// ============================================
// 格式配置
// ============================================

const FORMAT_CONFIG: Record<ExtractionFormat, { name: string; icon: string }> =
  {
    summary: { name: "快速摘要", icon: "📝" },
    memo: { name: "学习纪要", icon: "📋" },
    outline: { name: "大纲结构", icon: "🗂️" },
  };

// ============================================
// KnowledgeExtractSkill 实现
// ============================================

export class KnowledgeExtractSkill extends OrchestrationSkill<
  KnowledgeExtractInput,
  KnowledgeExtraction
> {
  private readonly extractor: KnowledgeExtractor;
  private readonly formatter: ExtractionFormatter;

  constructor() {
    super();
    this.extractor = new KnowledgeExtractor();
    this.formatter = new ExtractionFormatter();
  }

  readonly metadata: OrchestrationSkillMetadata = {
    id: "knowledge_extract",
    name: "知识萃取助手",
    description:
      "从多篇收藏中提取、整合知识，支持 Perplexity 风格的来源标注，可生成摘要、纪要或大纲格式。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "multi-document-synthesis",
      "citation-annotation",
      "concept-extraction",
      "format-conversion",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["document"],
    outputFormats: ["markdown", "plain"],
    steps: EXTRACT_STEPS,
  };

  readonly inputSchema = KnowledgeExtractInputSchema;
  readonly outputSchema = KnowledgeExtractOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<KnowledgeExtractInput> {
    // ============================================
    // 优先使用附件书签（用户显式选择的内容）
    // 附件书签具有最高优先级
    // ============================================
    let bookmarkIds: number[] = [];
    if (
      context.attachmentBookmarkIds &&
      context.attachmentBookmarkIds.length > 0
    ) {
      bookmarkIds = context.attachmentBookmarkIds;
    } else {
      // 回退：使用页面上下文书签
      bookmarkIds = context.bookmarkIds || [];
    }

    const input: KnowledgeExtractInput = {
      bookmarkIds,
      format: "memo",
    };

    // 解析格式
    if (/摘要|快速|简要|tldr/i.test(message)) {
      input.format = "summary";
    } else if (/大纲|结构|层级|outline/i.test(message)) {
      input.format = "outline";
    } else if (/纪要|学习|详细|完整|memo/i.test(message)) {
      input.format = "memo";
    }

    // 解析主题（如果明确指定）
    const topicMatch = message.match(/(?:关于|有关|主题[是为]?)([^的,，。]+)/);
    if (topicMatch) {
      input.topic = topicMatch[1].trim().substring(0, 20);
    }

    // 解析选项
    input.options = {};

    if (/概念|定义|术语/i.test(message)) {
      input.options.includeConceptDefinitions = true;
    }

    if (/建议|行动|下一步|todo/i.test(message)) {
      input.options.includeActionItems = true;
    }

    // 解析要点数量
    const pointsMatch = message.match(/(\d+)\s*[个条点]/);
    if (pointsMatch) {
      const count = parseInt(pointsMatch[1], 10);
      if (count >= 3 && count <= 10) {
        input.options.maxKeyPoints = count;
      }
    }

    return input;
  }

  /**
   * 流式执行知识萃取
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as KnowledgeExtractInput;
    const formatConfig = FORMAT_CONFIG[input.format];

    // 初始化进度
    this.initProgress(EXTRACT_STEPS);

    try {
      // ========================================
      // Step 1: 收集内容
      // ========================================
      yield* this.reportProgress("收集内容", 5, "正在获取收藏内容...");
      yield* this.emitText(
        `💡 正在从 **${input.bookmarkIds.length}** 篇收藏中萃取知识...\n\n`,
      );

      const contents = await this.extractor.fetchContents(
        input.bookmarkIds,
        context.userId,
      );

      if (contents.length === 0) {
        yield* this.emitText("❌ 未找到有效的收藏内容。\n");
        yield* this.emitDone(false, "未找到有效的收藏内容");
        return;
      }

      yield* this.reportProgress(
        "收集内容",
        15,
        `获取到 ${contents.length} 篇内容`,
      );
      yield* this.emitText(`✅ 获取到 **${contents.length}** 篇有效内容。\n\n`);

      // ========================================
      // Step 2: 识别主题
      // ========================================
      yield* this.reportProgress("识别主题", 20, "正在分析共同主题...");

      let topic = input.topic;
      if (!topic) {
        topic = await this.extractor.identifyTopic(contents);
        yield* this.emitText(`📌 识别主题：**${topic}**\n\n`);
      } else {
        yield* this.emitText(`📌 指定主题：**${topic}**\n\n`);
      }

      yield* this.reportProgress("识别主题", 30, `主题：${topic}`);

      // ========================================
      // Step 3: 提取知识
      // ========================================
      yield* this.reportProgress("提取知识", 35, "正在提取核心要点...");
      yield* this.emitText("🔍 正在分析内容，提取核心知识...\n\n");

      // 执行完整萃取
      const extraction = await this.extractor.extract(
        { ...input, topic },
        context.userId,
      );

      yield* this.reportProgress(
        "提取知识",
        70,
        `提取了 ${extraction.keyPoints.length} 个要点`,
      );

      yield* this.emitText(
        `✅ 提取完成：**${extraction.keyPoints.length}** 个核心要点`,
      );
      if (extraction.concepts.length > 0) {
        yield* this.emitText(`、**${extraction.concepts.length}** 个概念`);
      }
      yield* this.emitText("\n\n");

      // ========================================
      // Step 4: 格式化输出
      // ========================================
      yield* this.reportProgress("格式化输出", 75, "正在生成格式化内容...");
      yield* this.emitText(
        `📄 输出格式：${formatConfig.icon} **${formatConfig.name}**\n\n`,
      );

      const formatted = this.formatter.format(extraction, input.format);

      yield* this.reportProgress("格式化输出", 90, "格式化完成");

      // ========================================
      // Step 5: 交付结果
      // ========================================
      yield* this.reportProgress("交付结果", 95, "准备交付物...");

      // 输出格式化内容预览
      yield* this.emitText("---\n\n");
      yield* this.emitText(formatted);
      yield* this.emitText("\n\n---\n\n");

      // 创建交付物
      const deliverable = this.createDeliverable(
        "document",
        extraction.title,
        {
          ...extraction,
          formattedContent: formatted,
        },
        "markdown",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            topic: extraction.topic,
            sourceCount: extraction.sources.length,
            keyPointCount: extraction.keyPoints.length,
            conceptCount: extraction.concepts.length,
            format: input.format,
            processingTimeMs: extraction.metadata.processingTimeMs,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      const suggestions = this.generateSuggestions(extraction, input.format);
      if (suggestions.length > 0) {
        yield* this.emitSuggestions(suggestions);
      }

      // 完成
      yield* this.reportProgress("完成", 100, "萃取完成");
      yield* this.emitDone(
        true,
        `成功从 ${extraction.sources.length} 篇收藏中萃取了 ${extraction.keyPoints.length} 个核心要点`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          extractionId: extraction.id,
          sourceCount: extraction.sources.length,
          keyPointCount: extraction.keyPoints.length,
          format: input.format,
          durationMs: Date.now() - startTime,
        },
        "KnowledgeExtractSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "KnowledgeExtractSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "知识萃取失败",
        "EXTRACTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "知识萃取失败");
    }
  }

  /**
   * 生成后续建议
   */
  private generateSuggestions(
    extraction: KnowledgeExtraction,
    currentFormat: ExtractionFormat,
  ): Array<{
    text: string;
    action: string;
    params?: Record<string, unknown>;
    icon?: string;
  }> {
    const suggestions = [];

    // 切换格式建议
    const otherFormats = (
      ["summary", "memo", "outline"] as ExtractionFormat[]
    ).filter((f) => f !== currentFormat);

    suggestions.push({
      text: `切换为${FORMAT_CONFIG[otherFormats[0]].name}格式`,
      action: "knowledge_extract",
      params: { format: otherFormats[0] },
      icon: FORMAT_CONFIG[otherFormats[0]].icon,
    });

    // 导出建议
    suggestions.push({
      text: "导出为 Markdown 文件",
      action: "data_export",
      params: { format: "markdown", type: "extraction" },
      icon: "📤",
    });

    // 保存建议
    suggestions.push({
      text: "保存为笔记",
      action: "save_note",
      params: { extractionId: extraction.id },
      icon: "💾",
    });

    return suggestions;
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: KnowledgeExtractInput,
    context: SkillContext,
  ): Promise<KnowledgeExtraction> {
    const extraction = await this.extractor.extract(input, context.userId);
    return extraction;
  }
}

// ============================================
// 导出
// ============================================

export const knowledgeExtractSkill = new KnowledgeExtractSkill();
