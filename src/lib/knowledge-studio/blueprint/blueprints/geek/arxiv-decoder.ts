/**
 * ArxivDecoder Blueprint - 论文实战解码器 (Story 4.1)
 * @module knowledge-studio/blueprint/blueprints/geek
 *
 * 将论文和代码素材转换为实战评测报告。
 *
 * 目标用户: AI博主、算法工程师
 * 输入: 论文 PDF/链接 + 代码仓库
 * 输出: 结构化评测报告
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
 * 代码片段引用
 */
interface CodeSnippet {
  /** 代码语言 */
  language: string;
  /** 代码内容 */
  code: string;
  /** 代码描述 */
  description: string;
  /** 来源文件（可选） */
  sourceFile?: string;
}

/**
 * 评测报告章节
 */
interface ReportSection {
  /** 章节ID */
  id: string;
  /** 章节标题 */
  title: string;
  /** 章节内容 (Markdown) */
  content: string;
  /** 代码片段（如有） */
  codeSnippets?: CodeSnippet[];
}

/**
 * ArxivDecoder 输出类型
 */
export interface ArxivDecoderOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 论文标题 */
  paperTitle: string;
  /** 论文作者 */
  paperAuthors?: string[];
  /** 论文链接 */
  paperUrl?: string;
  /** 代码仓库链接 */
  codeRepoUrl?: string;
  /** 核心贡献摘要 */
  coreContribution: string;
  /** 报告章节 */
  sections: ReportSection[];
  /** 复现难度评估 (1-5) */
  reproductionDifficulty: number;
  /** 复现难度说明 */
  reproductionNotes: string;
  /** 工程化建议列表 */
  engineeringRecommendations: string[];
  /** 推荐使用场景 */
  recommendedScenarios: string[];
  /** 总结 */
  conclusion: string;
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * ArxivDecoder 蓝图
 *
 * 将 arXiv 论文和相关代码转换为实战评测报告。
 *
 * 生成内容包含：
 * - 论文核心贡献（1 段）
 * - 方法论解析（带代码片段引用）
 * - 实验复现难度评估
 * - 工程化建议
 * - 结论与推荐场景
 */
export class ArxivDecoderBlueprint extends EnhancedBlueprintEngine<ArxivDecoderOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "geek-arxiv_decoder";
  readonly displayName = "论文实战解码器";
  readonly description =
    "将 arXiv 论文和代码仓库转换为实战评测报告，帮助技术博主快速产出高质量内容";
  readonly icon = "📄";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "ai_blogger",
    "developer",
    "researcher",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "geek" as const;
  readonly priority = 1; // P0 最高优先级
  readonly isNew = true;
  readonly tags = ["论文", "AI", "代码", "评测"];
  readonly examplePrompts = [
    "解析这篇 Transformer 论文并评估其代码实现",
    "分析 CLIP 论文的核心创新点和工程化建议",
    "评测这个开源项目的论文复现难度",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "audience",
        type: "single_choice",
        category: "audience",
        question: "目标读者的技术水平？",
        options: [
          {
            value: "beginner",
            label: "入门级",
            description: "了解基础 ML 概念",
          },
          { value: "intermediate", label: "中级", description: "熟悉主流框架" },
          { value: "advanced", label: "高级", description: "有论文复现经验" },
        ],
        required: true,
        defaultValue: "intermediate",
      },
      {
        id: "focus",
        type: "multi_choice",
        category: "objective",
        question: "评测报告的重点方向？",
        options: [
          {
            value: "theory",
            label: "理论创新",
            description: "论文核心思想和数学推导",
          },
          {
            value: "implementation",
            label: "代码实现",
            description: "代码架构和关键实现",
          },
          {
            value: "reproduction",
            label: "复现指南",
            description: "环境搭建和复现步骤",
          },
          {
            value: "engineering",
            label: "工程落地",
            description: "生产环境部署建议",
          },
        ],
        required: true,
        defaultValue: ["implementation", "engineering"],
      },
      {
        id: "length",
        type: "single_choice",
        category: "constraint",
        question: "报告的详细程度？",
        options: [
          { value: "concise", label: "精简版", description: "约 1500 字" },
          { value: "standard", label: "标准版", description: "约 3000 字" },
          { value: "detailed", label: "详尽版", description: "约 5000 字" },
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
   * 生成报告大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析论文结构...");

    // 构建大纲生成配置
    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深 AI 博主，正在为以下论文和代码生成评测报告大纲。

${briefingPrompt}

请生成包含以下章节的大纲：
1. 论文核心贡献 - 一段话概括论文的核心创新点
2. 方法论解析 - 详细分析论文的技术方法，需要引用关键代码
3. 实验复现评估 - 评估复现难度和关键步骤
4. 工程化建议 - 如何在生产环境中应用
5. 结论与推荐场景 - 总结和适用场景推荐

每个章节需要包含 2-3 个要点。
`;

    yield* this.reportProgress("outline", 30, "生成大纲结构...");

    // 调用大纲生成器 - 使用正确的函数签名
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
   * 基于大纲生成内容
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成报告内容...");

    const outline = context.outline;
    if (!outline) {
      throw new Error("缺少大纲信息");
    }

    // 构建内容生成配置
    const _briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const _materialContents = input.materials
      .map((m) => m.content)
      .join("\n\n");

    let fullContent = "";
    // 调用内容生成器 - 使用正确的函数签名
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

    yield* this.reportProgress("content", 100, "内容生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<ArxivDecoderOutput> {
    const outline = context.outline;

    // 解析原始内容为结构化章节
    const sections = this.parseContentToSections(rawContent, outline);

    // 提取元数据（从素材或内容中）
    const paperTitle =
      this.extractPaperTitle(rawContent) ?? outline?.title ?? "未知论文";

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      paperTitle,
      coreContribution:
        sections.find((s) => s.id === "core-contribution")?.content ?? "",
      sections,
      reproductionDifficulty: this.estimateReproductionDifficulty(rawContent),
      reproductionNotes: this.extractReproductionNotes(rawContent),
      engineeringRecommendations: this.extractRecommendations(rawContent),
      recommendedScenarios: this.extractScenarios(rawContent),
      conclusion: sections.find((s) => s.id === "conclusion")?.content ?? "",
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
        paperTitle: { type: "string" },
        paperAuthors: { type: "array", items: { type: "string" } },
        paperUrl: { type: "string", format: "uri" },
        codeRepoUrl: { type: "string", format: "uri" },
        coreContribution: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              content: { type: "string" },
              codeSnippets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    language: { type: "string" },
                    code: { type: "string" },
                    description: { type: "string" },
                    sourceFile: { type: "string" },
                  },
                  required: ["language", "code", "description"],
                },
              },
            },
            required: ["id", "title", "content"],
          },
        },
        reproductionDifficulty: { type: "number", minimum: 1, maximum: 5 },
        reproductionNotes: { type: "string" },
        engineeringRecommendations: {
          type: "array",
          items: { type: "string" },
        },
        recommendedScenarios: { type: "array", items: { type: "string" } },
        conclusion: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "paperTitle",
        "coreContribution",
        "sections",
        "reproductionDifficulty",
        "reproductionNotes",
        "engineeringRecommendations",
        "recommendedScenarios",
        "conclusion",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 解析内容为章节
   */
  private parseContentToSections(
    content: string,
    outline?: BlueprintOutline,
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    // 使用正则解析 Markdown 标题
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];

    // 如果有大纲，使用大纲结构
    if (outline?.nodes) {
      for (const node of outline.nodes) {
        sections.push({
          id: node.id,
          title: node.title,
          content: this.extractSectionContent(content, node.title),
          codeSnippets: this.extractCodeSnippets(content, node.title),
        });
      }
    } else {
      // 否则从 Markdown 解析
      for (let i = 0; i < matches.length; i++) {
        const [, , title] = matches[i];
        const startIndex = matches[i].index ?? 0;
        const endIndex =
          i < matches.length - 1 ? matches[i + 1].index : content.length;
        const sectionContent = content.slice(startIndex, endIndex).trim();

        sections.push({
          id: `section-${i + 1}`,
          title: title.trim(),
          content: sectionContent,
          codeSnippets: this.extractCodeSnippets(sectionContent, title),
        });
      }
    }

    return sections;
  }

  /**
   * 提取章节内容
   */
  private extractSectionContent(content: string, title: string): string {
    const titleRegex = new RegExp(
      `#{1,3}\\s*${this.escapeRegex(title)}[\\s\\S]*?(?=#{1,3}\\s|$)`,
      "i",
    );
    const match = content.match(titleRegex);
    return match ? match[0].trim() : "";
  }

  /**
   * 提取代码片段
   */
  private extractCodeSnippets(
    content: string,
    _sectionTitle: string,
  ): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      snippets.push({
        language: match[1] ?? "text",
        code: match[2].trim(),
        description: "代码片段",
      });
    }

    return snippets;
  }

  /**
   * 提取论文标题
   */
  private extractPaperTitle(content: string): string | undefined {
    const titleMatch = content.match(/(?:论文|Paper)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim();
  }

  /**
   * 估算复现难度 (1-5)
   */
  private estimateReproductionDifficulty(content: string): number {
    // 基于关键词估算
    const easyKeywords = ["简单", "易于", "开箱即用", "easy", "simple"];
    const hardKeywords = [
      "复杂",
      "困难",
      "需要大量",
      "difficult",
      "complex",
      "GPU",
    ];

    let score = 3; // 默认中等

    for (const keyword of easyKeywords) {
      if (content.toLowerCase().includes(keyword)) score -= 0.5;
    }
    for (const keyword of hardKeywords) {
      if (content.toLowerCase().includes(keyword)) score += 0.5;
    }

    return Math.max(1, Math.min(5, Math.round(score)));
  }

  /**
   * 提取复现说明
   */
  private extractReproductionNotes(content: string): string {
    const notesMatch = content.match(/(?:复现|Reproduction)[^]*?(?=##|$)/i);
    return (
      notesMatch?.[0]?.slice(0, 500).trim() ??
      "请参考代码仓库的 README 文件进行复现。"
    );
  }

  /**
   * 提取工程化建议
   */
  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const recMatch = content.match(
      /(?:建议|Recommendations?)[：:][^]*?(?=##|$)/i,
    );

    if (recMatch) {
      const listItems = recMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (const item of listItems) {
          recommendations.push(item.replace(/^[-*]\s+/, "").trim());
        }
      }
    }

    return recommendations.length > 0
      ? recommendations
      : ["优化模型推理性能", "添加错误处理和日志", "编写单元测试"];
  }

  /**
   * 提取推荐场景
   */
  private extractScenarios(content: string): string[] {
    const scenarios: string[] = [];
    const scenarioMatch = content.match(
      /(?:场景|适用|Scenarios?)[：:][^]*?(?=##|$)/i,
    );

    if (scenarioMatch) {
      const listItems = scenarioMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (const item of listItems) {
          scenarios.push(item.replace(/^[-*]\s+/, "").trim());
        }
      }
    }

    return scenarios.length > 0
      ? scenarios
      : ["学术研究", "技术博客写作", "原型验证"];
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
    return ["AI", "论文解读", "代码分析"];
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 获取预估生成时间（秒）
   * 覆盖基类方法
   */
  protected override getEstimatedDuration(): number {
    return 45; // 45 秒
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 ArxivDecoder 蓝图实例
 */
export function createArxivDecoderBlueprint(): ArxivDecoderBlueprint {
  return new ArxivDecoderBlueprint();
}
