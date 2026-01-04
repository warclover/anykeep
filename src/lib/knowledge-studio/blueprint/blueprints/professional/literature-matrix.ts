/**
 * LiteratureMatrix Blueprint - 文献矩阵 (Story 7.2)
 * @module knowledge-studio/blueprint/blueprints/professional
 *
 * 将多篇学术论文转换为文献综述矩阵。
 *
 * 目标用户: 研究生、研究员、学术工作者
 * 输入: 多篇学术论文（PDF/链接）
 * 输出: 结构化文献综述矩阵
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
 * 论文信息条目
 */
interface PaperEntry {
  /** 论文ID */
  id: string;
  /** 论文标题 */
  title: string;
  /** 作者列表 */
  authors: string[];
  /** 发表年份 */
  year: number;
  /** 发表刊物/会议 */
  venue: string;
  /** 引用次数（如有） */
  citations?: number;
  /** 论文链接 */
  url?: string;
  /** DOI */
  doi?: string;
}

/**
 * 方法论对比条目
 */
interface MethodologyComparison {
  /** 论文ID */
  paperId: string;
  /** 研究方法 */
  method: string;
  /** 数据来源 */
  dataSource: string;
  /** 样本规模 */
  sampleSize?: string;
  /** 分析方法 */
  analysisMethod: string;
  /** 优势 */
  strengths: string[];
  /** 局限性 */
  limitations: string[];
}

/**
 * 研究发现摘要
 */
interface FindingSummary {
  /** 论文ID */
  paperId: string;
  /** 主要发现 */
  mainFindings: string[];
  /** 关键贡献 */
  keyContributions: string[];
  /** 理论/实践意义 */
  implications: string[];
}

/**
 * 研究缺口
 */
interface ResearchGap {
  /** 缺口ID */
  id: string;
  /** 缺口描述 */
  description: string;
  /** 重要性等级: low | medium | high */
  importance: "low" | "medium" | "high";
  /** 相关论文ID */
  relatedPaperIds: string[];
  /** 潜在研究问题 */
  potentialQuestions: string[];
}

/**
 * 未来研究方向
 */
interface FutureDirection {
  /** 方向ID */
  id: string;
  /** 方向标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 可行性: low | medium | high */
  feasibility: "low" | "medium" | "high";
  /** 预期影响: low | medium | high */
  expectedImpact: "low" | "medium" | "high";
  /** 建议方法 */
  suggestedMethods: string[];
}

/**
 * 主题聚类
 */
interface ThemeCluster {
  /** 主题ID */
  id: string;
  /** 主题名称 */
  name: string;
  /** 主题描述 */
  description: string;
  /** 包含的论文ID */
  paperIds: string[];
  /** 关键词 */
  keywords: string[];
}

/**
 * LiteratureMatrix 输出类型
 */
export interface LiteratureMatrixOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 综述标题 */
  title: string;
  /** 研究领域 */
  researchField: string;
  /** 摘要 */
  abstract: string;
  /** 论文信息表 */
  paperInfoTable: PaperEntry[];
  /** 主题聚类 */
  themeClusters: ThemeCluster[];
  /** 方法论对比 */
  methodologyComparison: MethodologyComparison[];
  /** 研究发现摘要 */
  findingsSummary: FindingSummary[];
  /** 研究缺口 */
  researchGaps: ResearchGap[];
  /** 未来研究方向 */
  futureDirections: FutureDirection[];
  /** 关键词云 */
  keywords: string[];
  /** 参考文献（APA 格式） */
  references: string[];
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * LiteratureMatrix 蓝图
 *
 * 将多篇学术论文转换为结构化的文献综述矩阵。
 *
 * 生成内容包含：
 * - 论文信息表（作者、年份、刊物等）
 * - 主题聚类分析
 * - 方法论对比矩阵
 * - 研究发现摘要
 * - 研究缺口识别
 * - 未来研究方向建议
 */
export class LiteratureMatrixBlueprint extends EnhancedBlueprintEngine<LiteratureMatrixOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "professional-literature_matrix";
  readonly displayName = "文献矩阵";
  readonly description =
    "将多篇学术论文转换为结构化综述矩阵，快速梳理研究脉络、识别研究缺口";
  readonly icon = "📚";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "researcher",
    "academic",
    "student",
  ];

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "professional" as const;
  readonly priority = 2;
  readonly isNew = true;
  readonly tags = ["文献综述", "学术研究", "论文分析", "研究缺口"];
  readonly examplePrompts = [
    "帮我分析这 5 篇深度学习论文，生成文献矩阵",
    "将这些医学研究论文整理成综述矩阵",
    "分析这批教育技术论文，找出研究缺口",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "research_field",
        type: "single_choice",
        category: "context",
        question: "研究领域是什么？",
        options: [
          {
            value: "cs",
            label: "计算机科学",
            description: "AI、软件工程、网络安全等",
          },
          {
            value: "medicine",
            label: "医学/健康",
            description: "临床研究、公共卫生等",
          },
          {
            value: "social",
            label: "社会科学",
            description: "心理学、教育、经济等",
          },
          {
            value: "other",
            label: "其他领域",
            description: "工程、自然科学等",
          },
        ],
        required: true,
        defaultValue: "cs",
      },
      {
        id: "review_purpose",
        type: "single_choice",
        category: "objective",
        question: "文献综述的目的是什么？",
        options: [
          {
            value: "thesis",
            label: "学位论文",
            description: "硕博士论文的文献综述章节",
          },
          {
            value: "proposal",
            label: "研究提案",
            description: "项目申请书的研究背景",
          },
          {
            value: "survey",
            label: "综述论文",
            description: "发表综述类学术论文",
          },
          {
            value: "learning",
            label: "自学梳理",
            description: "了解研究领域进展",
          },
        ],
        required: true,
        defaultValue: "thesis",
      },
      {
        id: "depth",
        type: "single_choice",
        category: "constraint",
        question: "分析深度要求？",
        options: [
          {
            value: "overview",
            label: "概览式",
            description: "快速了解大致脉络",
          },
          {
            value: "standard",
            label: "标准式",
            description: "常规文献综述深度",
          },
          {
            value: "in_depth",
            label: "深入式",
            description: "详细方法论对比和批判性分析",
          },
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
   * 生成文献矩阵大纲
   */
  async *generateOutline(
    _context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析论文集合...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深学术研究员，正在为以下论文集合生成文献综述矩阵大纲。

${briefingPrompt}

请生成包含以下章节的文献综述大纲：
1. 论文信息表 - 提取每篇论文的基本信息（标题、作者、年份、刊物）
2. 主题聚类 - 按研究主题对论文进行分类
3. 方法论对比 - 比较各论文的研究方法、数据来源、分析方法
4. 研究发现 - 总结各论文的主要发现和贡献
5. 研究缺口 - 识别现有研究的不足和空白
6. 未来方向 - 基于缺口提出未来研究建议

每个章节需要包含 2-3 个要点。
`;

    yield* this.reportProgress("outline", 30, "生成矩阵结构...");

    const materialContents = input.materials.map((m) => m.content).join("\n\n");
    const result = await generateOutline({
      materialContent: materialContents,
      customPrompt: outlinePrompt,
      blueprintType: "literature_matrix",
    });

    yield* this.reportProgress("outline", 100, "大纲生成完成");

    return result.outline;
  }

  /**
   * 生成文献矩阵内容
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成文献矩阵...");

    const outline = context.outline;
    if (!outline) {
      throw new Error("缺少大纲信息");
    }

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const materialContents = input.materials.map((m) => m.content).join("\n\n");

    let fullContent = "";
    const stream = generateContentStream({
      outline,
      materialContent: materialContents,
      briefingContext: briefingPrompt,
      blueprintType: "literature_matrix",
    });

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

    yield* this.reportProgress("content", 100, "文献矩阵生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为 LiteratureMatrixOutput
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<LiteratureMatrixOutput> {
    const outline = context.outline;
    const title =
      this.extractTitle(rawContent) ?? outline?.title ?? "文献综述矩阵";

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title,
      researchField: this.extractResearchField(rawContent),
      abstract: this.extractAbstract(rawContent),
      paperInfoTable: this.extractPaperInfoTable(rawContent),
      themeClusters: this.extractThemeClusters(rawContent),
      methodologyComparison: this.extractMethodologyComparison(rawContent),
      findingsSummary: this.extractFindingsSummary(rawContent),
      researchGaps: this.extractResearchGaps(rawContent),
      futureDirections: this.extractFutureDirections(rawContent),
      keywords: this.extractKeywords(rawContent),
      references: this.extractReferences(rawContent),
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
        researchField: { type: "string" },
        abstract: { type: "string" },
        paperInfoTable: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              authors: { type: "array", items: { type: "string" } },
              year: { type: "number" },
              venue: { type: "string" },
              citations: { type: "number" },
              url: { type: "string", format: "uri" },
              doi: { type: "string" },
            },
            required: ["id", "title", "authors", "year", "venue"],
          },
        },
        themeClusters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              paperIds: { type: "array", items: { type: "string" } },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "description", "paperIds"],
          },
        },
        methodologyComparison: {
          type: "array",
          items: {
            type: "object",
            properties: {
              paperId: { type: "string" },
              method: { type: "string" },
              dataSource: { type: "string" },
              sampleSize: { type: "string" },
              analysisMethod: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              limitations: { type: "array", items: { type: "string" } },
            },
            required: [
              "paperId",
              "method",
              "dataSource",
              "analysisMethod",
              "strengths",
              "limitations",
            ],
          },
        },
        findingsSummary: {
          type: "array",
          items: {
            type: "object",
            properties: {
              paperId: { type: "string" },
              mainFindings: { type: "array", items: { type: "string" } },
              keyContributions: { type: "array", items: { type: "string" } },
              implications: { type: "array", items: { type: "string" } },
            },
            required: [
              "paperId",
              "mainFindings",
              "keyContributions",
              "implications",
            ],
          },
        },
        researchGaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              importance: { type: "string", enum: ["low", "medium", "high"] },
              relatedPaperIds: { type: "array", items: { type: "string" } },
              potentialQuestions: { type: "array", items: { type: "string" } },
            },
            required: [
              "id",
              "description",
              "importance",
              "relatedPaperIds",
              "potentialQuestions",
            ],
          },
        },
        futureDirections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              feasibility: { type: "string", enum: ["low", "medium", "high"] },
              expectedImpact: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              suggestedMethods: { type: "array", items: { type: "string" } },
            },
            required: [
              "id",
              "title",
              "description",
              "feasibility",
              "expectedImpact",
              "suggestedMethods",
            ],
          },
        },
        keywords: { type: "array", items: { type: "string" } },
        references: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "researchField",
        "abstract",
        "paperInfoTable",
        "themeClusters",
        "methodologyComparison",
        "findingsSummary",
        "researchGaps",
        "futureDirections",
        "keywords",
        "references",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 提取标题
   */
  private extractTitle(content: string): string | undefined {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch?.[1]?.trim();
  }

  /**
   * 提取研究领域
   */
  private extractResearchField(content: string): string {
    const fieldMatch = content.match(/(?:领域|Field)[：:]\s*([^\n]+)/i);
    return fieldMatch?.[1]?.trim() ?? "待确定";
  }

  /**
   * 提取摘要
   */
  private extractAbstract(content: string): string {
    const abstractMatch = content.match(/(?:摘要|Abstract)[：:]\s*([^#]+)/i);
    return (
      abstractMatch?.[1]?.trim().slice(0, 500) ??
      "本综述分析了多篇学术论文，梳理了研究脉络和发展趋势。"
    );
  }

  /**
   * 提取论文信息表
   */
  private extractPaperInfoTable(content: string): PaperEntry[] {
    const papers: PaperEntry[] = [];

    // 尝试匹配论文信息
    const paperRegex = /(?:论文|Paper)\s*(\d+)[：:]\s*([^\n]+)/gi;
    let match;
    let index = 0;

    while ((match = paperRegex.exec(content)) !== null) {
      index++;
      papers.push({
        id: `paper-${index}`,
        title: match[2].trim(),
        authors: ["待补充"],
        year: new Date().getFullYear(),
        venue: "待补充",
      });
    }

    // 默认论文条目
    if (papers.length === 0) {
      papers.push(
        {
          id: "paper-1",
          title: "论文 1",
          authors: ["Author A", "Author B"],
          year: 2024,
          venue: "Conference/Journal",
        },
        {
          id: "paper-2",
          title: "论文 2",
          authors: ["Author C"],
          year: 2023,
          venue: "Conference/Journal",
        },
      );
    }

    return papers;
  }

  /**
   * 提取主题聚类
   */
  private extractThemeClusters(content: string): ThemeCluster[] {
    const clusters: ThemeCluster[] = [];

    // 尝试从内容提取主题
    const themeMatch = content.match(/(?:主题|Theme)[^]*?(?=##|$)/i);
    if (themeMatch) {
      const listItems = themeMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 4); i++) {
          const themeName = listItems[i].replace(/^[-*]\s+/, "").trim();
          clusters.push({
            id: `theme-${i + 1}`,
            name: themeName,
            description: `关于 ${themeName} 的研究`,
            paperIds: [`paper-${i + 1}`],
            keywords: [themeName],
          });
        }
      }
    }

    // 默认主题
    if (clusters.length === 0) {
      clusters.push(
        {
          id: "theme-1",
          name: "主题 A",
          description: "第一个研究主题",
          paperIds: ["paper-1"],
          keywords: ["关键词A", "关键词B"],
        },
        {
          id: "theme-2",
          name: "主题 B",
          description: "第二个研究主题",
          paperIds: ["paper-2"],
          keywords: ["关键词C", "关键词D"],
        },
      );
    }

    return clusters;
  }

  /**
   * 提取方法论对比
   */
  private extractMethodologyComparison(
    content: string,
  ): MethodologyComparison[] {
    const papers = this.extractPaperInfoTable(content);
    return papers.map((paper) => ({
      paperId: paper.id,
      method: "待分析",
      dataSource: "待分析",
      analysisMethod: "待分析",
      strengths: ["待分析"],
      limitations: ["待分析"],
    }));
  }

  /**
   * 提取研究发现摘要
   */
  private extractFindingsSummary(content: string): FindingSummary[] {
    const papers = this.extractPaperInfoTable(content);
    return papers.map((paper) => ({
      paperId: paper.id,
      mainFindings: ["待分析"],
      keyContributions: ["待分析"],
      implications: ["待分析"],
    }));
  }

  /**
   * 提取研究缺口
   */
  private extractResearchGaps(content: string): ResearchGap[] {
    const gaps: ResearchGap[] = [];

    // 尝试从内容提取研究缺口
    const gapMatch = content.match(/(?:缺口|Gap|不足)[^]*?(?=##|$)/i);
    if (gapMatch) {
      const listItems = gapMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 5); i++) {
          const gapText = listItems[i].replace(/^[-*]\s+/, "").trim();
          gaps.push({
            id: `gap-${i + 1}`,
            description: gapText,
            importance: "medium",
            relatedPaperIds: ["paper-1"],
            potentialQuestions: ["待进一步探索"],
          });
        }
      }
    }

    // 默认研究缺口
    if (gaps.length === 0) {
      gaps.push(
        {
          id: "gap-1",
          description: "缺乏大规模实证研究验证",
          importance: "high",
          relatedPaperIds: ["paper-1", "paper-2"],
          potentialQuestions: ["如何设计更大规模的实验？"],
        },
        {
          id: "gap-2",
          description: "跨领域整合研究不足",
          importance: "medium",
          relatedPaperIds: ["paper-1"],
          potentialQuestions: ["如何结合多学科视角？"],
        },
      );
    }

    return gaps;
  }

  /**
   * 提取未来研究方向
   */
  private extractFutureDirections(content: string): FutureDirection[] {
    const directions: FutureDirection[] = [];

    // 尝试从内容提取未来方向
    const dirMatch = content.match(
      /(?:未来|Future|方向|Direction)[^]*?(?=##|$)/i,
    );
    if (dirMatch) {
      const listItems = dirMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 4); i++) {
          const dirText = listItems[i].replace(/^[-*]\s+/, "").trim();
          directions.push({
            id: `dir-${i + 1}`,
            title: `研究方向 ${i + 1}`,
            description: dirText,
            feasibility: "medium",
            expectedImpact: "medium",
            suggestedMethods: ["待确定"],
          });
        }
      }
    }

    // 默认未来方向
    if (directions.length === 0) {
      directions.push(
        {
          id: "dir-1",
          title: "扩展样本规模",
          description: "在更大规模数据集上验证现有发现",
          feasibility: "high",
          expectedImpact: "medium",
          suggestedMethods: ["大规模调查", "多中心研究"],
        },
        {
          id: "dir-2",
          title: "跨领域整合",
          description: "结合多学科方法进行综合研究",
          feasibility: "medium",
          expectedImpact: "high",
          suggestedMethods: ["跨学科合作", "混合方法研究"],
        },
      );
    }

    return directions;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    const keywordMatch = content.match(/(?:关键词|Keywords?)[：:]\s*(.+)/i);
    if (keywordMatch) {
      return keywordMatch[1]
        .split(/[,，、;；]/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
    return ["文献综述", "研究方法", "研究缺口"];
  }

  /**
   * 提取参考文献
   */
  private extractReferences(content: string): string[] {
    const refs: string[] = [];

    // 尝试提取参考文献
    const refMatch = content.match(/(?:参考文献|References?)[^]*$/i);
    if (refMatch) {
      const listItems = refMatch[0].match(/\[\d+\].+/g);
      if (listItems) {
        for (const item of listItems) {
          refs.push(item.trim());
        }
      }
    }

    return refs.length > 0 ? refs : ["[1] 待补充参考文献"];
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
    return ["文献综述", "学术研究"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 LiteratureMatrix 蓝图实例
 */
export function createLiteratureMatrixBlueprint(): LiteratureMatrixBlueprint {
  return new LiteratureMatrixBlueprint();
}
