/**
 * Newsletter Blueprint - 周刊策展人 (Story 5.2)
 * @module knowledge-studio/blueprint/blueprints/creator
 *
 * 将碎片内容整理为结构化周刊/Newsletter。
 *
 * 目标用户: Newsletter作者、内容策展人、媒体编辑
 * 输入: 碎片素材、链接、笔记
 * 输出: 结构化周刊内容
 */

import type { JSONSchema7 } from "json-schema";
import {
  EnhancedBlueprintEngine,
  type BlueprintExecutionContext,
} from "../../enhanced-blueprint-engine";
import type {
  BriefingQuestion,
  BriefingConfig,
  EnhancedBlueprintInput,
  BlueprintOutline,
  BlueprintTier,
  TargetUserGroup,
} from "../../types";
import type { OrchestrationStreamChunk } from "../../../../ai-skills/output/types";
import { generateOutline } from "../../outline-generator";
import { generateContentStream } from "../../content-generator";
import { injectBriefingToPrompt } from "../../briefing-injector";

// ============================================================
// Output Types
// ============================================================

/**
 * 精选内容条目
 */
interface CuratedItem {
  /** 条目ID */
  id: string;
  /** 标题 */
  title: string;
  /** 来源/出处 */
  source: string;
  /** 原文链接 */
  url?: string;
  /** 内容摘要 */
  summary: string;
  /** 编辑点评 */
  editorNote: string;
  /** 标签 */
  tags?: string[];
  /** 推荐指数 (1-5) */
  rating?: number;
}

/**
 * 延伸阅读
 */
interface ExtendedReading {
  /** 标题 */
  title: string;
  /** 链接 */
  url: string;
  /** 简短描述 */
  description: string;
}

/**
 * Newsletter 输出类型
 */
export interface NewsletterOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 周刊标题 */
  title: string;
  /** 期号 */
  issueNumber?: number;
  /** 本期主题 */
  theme: string;
  /** 主题摘要 */
  themeSummary: string;
  /** 精选内容列表 */
  curatedItems: CuratedItem[];
  /** 延伸阅读 */
  extendedReadings: ExtendedReading[];
  /** 编辑寄语 */
  editorNote: string;
  /** 订阅引导 */
  subscriptionCta?: string;
  /** 社交分享文案 */
  socialShareText?: string;
  /** 周刊风格 */
  style: string;
  /** 目标读者 */
  targetAudience: string;
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * Newsletter 蓝图
 *
 * 将碎片内容整理为结构化周刊。
 *
 * 生成内容包含：
 * - 本期主题摘要
 * - 精选内容（3-5 条，含点评）
 * - 延伸阅读
 * - 个人观点/编辑寄语
 */
export class NewsletterBlueprint extends EnhancedBlueprintEngine<NewsletterOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "creator-newsletter";
  readonly displayName = "周刊策展人";
  readonly description = "将碎片内容整理为结构化周刊，保持一致性和专业性";
  readonly icon = "📰";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "content_creator",
    "marketer",
    "writer",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "creator" as const;
  readonly priority = 2;
  readonly isNew = true;
  readonly tags = ["周刊", "Newsletter", "策展", "内容"];
  readonly examplePrompts = [
    "把这周收集的AI新闻整理成周刊",
    "根据这些技术文章生成周刊内容",
    "将这些产品动态整理成Newsletter",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "newsletter_style",
        type: "single_choice",
        category: "tone",
        question: "周刊风格？",
        options: [
          {
            value: "professional",
            label: "专业严谨",
            description: "行业洞察、深度分析",
          },
          {
            value: "casual",
            label: "轻松友好",
            description: "日常分享、个人视角",
          },
          {
            value: "curated",
            label: "精选策展",
            description: "简洁摘要、快速浏览",
          },
          {
            value: "analytical",
            label: "分析评论",
            description: "深度点评、观点输出",
          },
        ],
        required: true,
        defaultValue: "curated",
      },
      {
        id: "target_audience",
        type: "single_choice",
        category: "audience",
        question: "目标读者？",
        options: [
          {
            value: "developers",
            label: "开发者",
            description: "技术人员、工程师",
          },
          {
            value: "designers",
            label: "设计师",
            description: "UI/UX、产品设计",
          },
          {
            value: "managers",
            label: "管理者",
            description: "产品经理、团队领导",
          },
          {
            value: "general",
            label: "大众读者",
            description: "兴趣爱好者、入门者",
          },
        ],
        required: true,
        defaultValue: "general",
      },
      {
        id: "content_count",
        type: "single_choice",
        category: "constraint",
        question: "精选内容数量？",
        options: [
          { value: "compact", label: "精简版", description: "3条精选" },
          { value: "standard", label: "标准版", description: "5条精选" },
          { value: "extended", label: "扩展版", description: "8条精选" },
        ],
        required: false,
        defaultValue: "standard",
      },
    ],
  };

  // ============================================================
  // Abstract Method Implementations
  // ============================================================

  getBriefingQuestions(): BriefingQuestion[] {
    return this.briefingConfig.questions;
  }

  /**
   * 生成周刊大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析素材内容...");

    const _briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const contentCount = this.getContentCount(input);

    const outlinePrompt = `
你是一位资深Newsletter编辑，正在为以下素材创建周刊大纲。

${briefingPrompt}

精选内容数量：${contentCount} 条

请生成包含以下结构的大纲：
1. 本期主题 - 提炼核心主题，撰写吸引人的摘要
2. 精选内容 - 筛选 ${contentCount} 条最有价值的内容
3. 延伸阅读 - 推荐 2-3 个相关资源
4. 编辑寄语 - 个人观点或本期总结

每个精选内容需要包含：
- 内容标题
- 核心观点
- 为什么值得一读
`;

    yield* this.reportProgress("outline", 30, "生成周刊结构...");

    const result = await generateOutline(
      input.materials,
      {
        blueprintId: this.blueprintId,
        blueprintName: this.displayName,
        blueprintInstructions: outlinePrompt,
        targetLength: input.targetLength ?? "medium",
      },
      input.briefingContext,
    );

    yield* this.reportProgress("outline", 100, "大纲生成完成");

    return result.outline;
  }

  /**
   * 基于大纲生成周刊内容
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成周刊内容...");

    const outline = context.outline;
    if (!outline) {
      throw new Error("缺少大纲信息");
    }

    const _briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    let fullContent = "";
    const stream = generateContentStream(
      input.materials,
      {
        blueprintId: this.blueprintId,
        blueprintName: this.displayName,
        outline,
        targetLength: input.targetLength ?? "medium",
      },
      input.briefingContext,
    );

    for await (const chunk of stream) {
      if (chunk.type === "text" && chunk.data.text) {
        fullContent += chunk.data.text;
        yield chunk;
      } else if (chunk.type === "progress" && chunk.data.percent) {
        yield* this.reportProgress(
          "content",
          10 + chunk.data.percent * 0.8,
          chunk.data.step ?? "生成中...",
        );
      }
    }

    yield* this.reportProgress("content", 100, "周刊内容生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<NewsletterOutput> {
    const outline = context.outline;
    const curatedItems = this.parseCuratedItems(rawContent);
    const extendedReadings = this.parseExtendedReadings(rawContent);

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: outline?.title ?? this.extractTitle(rawContent),
      issueNumber: this.extractIssueNumber(rawContent),
      theme: this.extractTheme(rawContent),
      themeSummary: this.extractThemeSummary(rawContent),
      curatedItems,
      extendedReadings,
      editorNote: this.extractEditorNote(rawContent),
      subscriptionCta: this.extractSubscriptionCta(rawContent),
      socialShareText: this.extractSocialShareText(rawContent),
      style: this.extractStyle(context),
      targetAudience: this.extractTargetAudience(context),
      tags: this.extractTags(rawContent),
    };
  }

  /**
   * 获取输出 JSON Schema
   */
  getOutputSchema(): JSONSchema7 {
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        version: { type: "string" },
        generatedAt: { type: "string", format: "date-time" },
        blueprintId: { type: "string" },
        title: { type: "string" },
        issueNumber: { type: "number", minimum: 1 },
        theme: { type: "string" },
        themeSummary: { type: "string" },
        curatedItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              source: { type: "string" },
              url: { type: "string", format: "uri" },
              summary: { type: "string" },
              editorNote: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              rating: { type: "number", minimum: 1, maximum: 5 },
            },
            required: ["id", "title", "source", "summary", "editorNote"],
          },
          minItems: 1,
        },
        extendedReadings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string", format: "uri" },
              description: { type: "string" },
            },
            required: ["title", "url", "description"],
          },
        },
        editorNote: { type: "string" },
        subscriptionCta: { type: "string" },
        socialShareText: { type: "string" },
        style: {
          type: "string",
          enum: ["professional", "casual", "curated", "analytical"],
        },
        targetAudience: {
          type: "string",
          enum: ["developers", "designers", "managers", "general"],
        },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "theme",
        "themeSummary",
        "curatedItems",
        "extendedReadings",
        "editorNote",
        "style",
        "targetAudience",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 获取精选内容数量
   */
  private getContentCount(input: EnhancedBlueprintInput): number {
    const countAnswer =
      input.briefingContext?.answers?.content_count ?? "standard";
    const countMap: Record<string, number> = {
      compact: 3,
      standard: 5,
      extended: 8,
    };
    return countMap[countAnswer as string] ?? 5;
  }

  /**
   * 解析精选内容
   */
  private parseCuratedItems(content: string): CuratedItem[] {
    const items: CuratedItem[] = [];
    const itemRegex =
      /(?:精选|推荐|#?\d+)[：:.]?\s*(.+?)(?=(?:精选|推荐|#?\d+)[：:.]|延伸阅读|编辑|$)/gis;
    let match;
    let id = 1;

    while ((match = itemRegex.exec(content)) !== null) {
      const itemContent = match[1];
      if (itemContent.length > 50) {
        items.push({
          id: `item-${id++}`,
          title: this.extractItemTitle(itemContent),
          source: this.extractItemSource(itemContent),
          url: this.extractItemUrl(itemContent),
          summary: this.extractItemSummary(itemContent),
          editorNote: this.extractItemNote(itemContent),
          tags: this.extractItemTags(itemContent),
          rating: this.extractItemRating(itemContent),
        });
      }
    }

    // 如果没有找到，创建默认条目
    if (items.length === 0) {
      const paragraphs = content.split(/\n\n+/).filter((p) => p.length > 100);
      for (let i = 0; i < Math.min(5, paragraphs.length); i++) {
        items.push({
          id: `item-${i + 1}`,
          title: `精选内容 ${i + 1}`,
          source: "来源待补充",
          summary: paragraphs[i].slice(0, 200),
          editorNote: "编辑点评待补充",
        });
      }
    }

    return items;
  }

  /**
   * 解析延伸阅读
   */
  private parseExtendedReadings(content: string): ExtendedReading[] {
    const readings: ExtendedReading[] = [];
    const readingMatch = content.match(
      /延伸阅读[：:]([\s\S]*?)(?=编辑寄语|$)/i,
    );

    if (readingMatch) {
      const readingContent = readingMatch[1];
      const linkRegex = /[-•]\s*\[(.+?)\]\((.+?)\)[：:.]?\s*(.+)?/g;
      let match;

      while ((match = linkRegex.exec(readingContent)) !== null) {
        readings.push({
          title: match[1],
          url: match[2],
          description: match[3]?.trim() ?? "",
        });
      }
    }

    // 如果没有找到，返回默认
    if (readings.length === 0) {
      readings.push({
        title: "相关资源",
        url: "#",
        description: "更多相关内容请关注我们的周刊",
      });
    }

    return readings;
  }

  /**
   * 提取条目标题
   */
  private extractItemTitle(content: string): string {
    const titleMatch = content.match(/(?:标题|Title)[：:]\s*(.+)/i);
    if (titleMatch) return titleMatch[1].trim();

    // 尝试提取第一行作为标题
    const firstLine = content.split("\n")[0];
    return firstLine?.slice(0, 100).trim() ?? "未命名内容";
  }

  /**
   * 提取条目来源
   */
  private extractItemSource(content: string): string {
    const sourceMatch = content.match(/(?:来源|Source|出处)[：:]\s*(.+)/i);
    return sourceMatch?.[1]?.trim() ?? "网络";
  }

  /**
   * 提取条目链接
   */
  private extractItemUrl(content: string): string | undefined {
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    return urlMatch?.[0];
  }

  /**
   * 提取条目摘要
   */
  private extractItemSummary(content: string): string {
    const summaryMatch = content.match(/(?:摘要|Summary)[：:]\s*(.+)/i);
    if (summaryMatch) return summaryMatch[1].trim();

    // 提取前200字作为摘要
    return content.replace(/\n/g, " ").slice(0, 200).trim();
  }

  /**
   * 提取编辑点评
   */
  private extractItemNote(content: string): string {
    const noteMatch = content.match(/(?:点评|Note|评论)[：:]\s*(.+)/i);
    return noteMatch?.[1]?.trim() ?? "值得一读的好内容";
  }

  /**
   * 提取条目标签
   */
  private extractItemTags(content: string): string[] {
    const tagMatch = content.match(/(?:标签|Tags?)[：:]\s*(.+)/i);
    if (tagMatch) {
      return tagMatch[1]
        .split(/[,，、]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * 提取条目评分
   */
  private extractItemRating(content: string): number | undefined {
    const ratingMatch = content.match(/(?:评分|Rating)[：:]\s*(\d)/i);
    if (ratingMatch) {
      const rating = parseInt(ratingMatch[1], 10);
      return rating >= 1 && rating <= 5 ? rating : undefined;
    }
    return undefined;
  }

  /**
   * 提取周刊标题
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/(?:标题|Title)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? "本周精选";
  }

  /**
   * 提取期号
   */
  private extractIssueNumber(content: string): number | undefined {
    const issueMatch = content.match(/(?:期号|Issue|第)\s*#?(\d+)/i);
    if (issueMatch) {
      return parseInt(issueMatch[1], 10);
    }
    return undefined;
  }

  /**
   * 提取主题
   */
  private extractTheme(content: string): string {
    const themeMatch = content.match(/(?:主题|Theme)[：:]\s*(.+)/i);
    return themeMatch?.[1]?.trim() ?? "本期精选";
  }

  /**
   * 提取主题摘要
   */
  private extractThemeSummary(content: string): string {
    const summaryMatch = content.match(/(?:摘要|Summary)[：:]\s*(.+)/i);
    return summaryMatch?.[1]?.trim() ?? "精心策展的本周内容精选";
  }

  /**
   * 提取编辑寄语
   */
  private extractEditorNote(content: string): string {
    const noteMatch = content.match(
      /(?:编辑寄语|寄语|Editor)[：:]\s*([\s\S]+?)(?=订阅|分享|$)/i,
    );
    return noteMatch?.[1]?.trim() ?? "感谢阅读本期周刊，我们下期再见！";
  }

  /**
   * 提取订阅引导
   */
  private extractSubscriptionCta(content: string): string | undefined {
    const ctaMatch = content.match(/(?:订阅|Subscribe)[：:]\s*(.+)/i);
    return ctaMatch?.[1]?.trim();
  }

  /**
   * 提取社交分享文案
   */
  private extractSocialShareText(content: string): string | undefined {
    const shareMatch = content.match(/(?:分享|Share)[：:]\s*(.+)/i);
    return shareMatch?.[1]?.trim();
  }

  /**
   * 提取风格
   */
  private extractStyle(_context: BlueprintExecutionContext): string {
    return "curated";
  }

  /**
   * 提取目标读者
   */
  private extractTargetAudience(_context: BlueprintExecutionContext): string {
    return "general";
  }

  /**
   * 提取标签
   */
  private extractTags(content: string): string[] {
    const tagMatch = content.match(/(?:标签|Tags?)[：:]\s*(.+)/i);
    if (tagMatch) {
      return tagMatch[1]
        .split(/[,，、]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return ["周刊", "策展", "精选"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 Newsletter 蓝图实例
 */
export function createNewsletterBlueprint(): NewsletterBlueprint {
  return new NewsletterBlueprint();
}
