/**
 * CompetitorScout Blueprint - 竞品侦察兵 (Story 6.1)
 * @module knowledge-studio/blueprint/blueprints/business
 *
 * 根据竞品资料生成 SWOT 分析报告。
 *
 * 目标用户: 产品经理、市场分析师、创业者
 * 输入: 竞品资料、市场数据
 * 输出: 竞品分析报告 (含 SWOT 和功能矩阵)
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
 * 竞品概览
 */
interface CompetitorOverview {
  /** 竞品名称 */
  name: string;
  /** 公司/团队 */
  company?: string;
  /** 产品定位 */
  positioning: string;
  /** 目标用户 */
  targetUsers: string;
  /** 核心功能 */
  coreFeatures: string[];
  /** 定价模式 */
  pricingModel?: string;
  /** 市场份额（如有） */
  marketShare?: string;
  /** 成立时间 */
  foundedYear?: number;
}

/**
 * SWOT 分析
 */
interface SwotAnalysis {
  /** 优势 */
  strengths: string[];
  /** 劣势 */
  weaknesses: string[];
  /** 机会 */
  opportunities: string[];
  /** 威胁 */
  threats: string[];
}

/**
 * 功能对比项
 */
interface FeatureComparison {
  /** 功能名称 */
  feature: string;
  /** 功能类别 */
  category: string;
  /** 各竞品支持情况 */
  support: Record<string, "full" | "partial" | "none" | "unknown">;
  /** 备注 */
  notes?: string;
}

/**
 * 差异化机会
 */
interface DifferentiationOpportunity {
  /** 机会ID */
  id: string;
  /** 机会描述 */
  description: string;
  /** 优先级 (1-5) */
  priority: number;
  /** 难度评估 */
  difficulty: "low" | "medium" | "high";
  /** 潜在影响 */
  potentialImpact: string;
}

/**
 * 策略建议
 */
interface StrategicRecommendation {
  /** 建议ID */
  id: string;
  /** 建议类型 */
  type: "product" | "marketing" | "pricing" | "positioning";
  /** 建议内容 */
  recommendation: string;
  /** 理由 */
  rationale: string;
  /** 时间框架 */
  timeframe: "short-term" | "medium-term" | "long-term";
}

/**
 * CompetitorScout 输出类型
 */
export interface CompetitorScoutOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 报告标题 */
  title: string;
  /** 分析范围 */
  analysisScope: string;
  /** 目标市场 */
  targetMarket: string;
  /** 竞品概览列表 */
  competitors: CompetitorOverview[];
  /** SWOT 分析（针对自身产品） */
  swotAnalysis: SwotAnalysis;
  /** 功能对比矩阵 */
  featureMatrix: FeatureComparison[];
  /** 差异化机会 */
  differentiationOpportunities: DifferentiationOpportunity[];
  /** 策略建议 */
  strategicRecommendations: StrategicRecommendation[];
  /** 总结 */
  summary: string;
  /** 分析维度 */
  analysisDimensions: string[];
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * CompetitorScout 蓝图
 *
 * 根据竞品资料生成 SWOT 分析报告。
 *
 * 生成内容包含：
 * - 竞品概览表格
 * - SWOT 四象限分析
 * - 功能对比矩阵
 * - 差异化机会
 * - 策略建议
 */
export class CompetitorScoutBlueprint extends EnhancedBlueprintEngine<CompetitorScoutOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "business-competitor_scout";
  readonly displayName = "竞品侦察兵";
  readonly description =
    "根据竞品资料生成 SWOT 分析报告，支持多竞品对比和功能矩阵";
  readonly icon = "🔍";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "product_manager",
    "marketer",
    "entrepreneur",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "business" as const;
  readonly priority = 1;
  readonly isNew = true;
  readonly tags = ["竞品分析", "SWOT", "市场研究", "策略"];
  readonly examplePrompts = [
    "分析这3个竞品的优劣势",
    "生成竞品功能对比矩阵",
    "根据这些竞品资料做SWOT分析",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "analysis_dimension",
        type: "multi_choice",
        category: "objective",
        question: "重点分析维度？",
        options: [
          {
            value: "features",
            label: "功能对比",
            description: "核心功能和差异化特性",
          },
          {
            value: "pricing",
            label: "定价策略",
            description: "定价模式和价格区间",
          },
          {
            value: "ux",
            label: "用户体验",
            description: "界面设计和易用性",
          },
          {
            value: "market",
            label: "市场定位",
            description: "目标用户和市场策略",
          },
        ],
        required: true,
        defaultValue: ["features", "market"],
      },
      {
        id: "target_market",
        type: "single_choice",
        category: "context",
        question: "目标市场？",
        options: [
          {
            value: "b2b",
            label: "企业市场",
            description: "面向企业客户",
          },
          {
            value: "b2c",
            label: "消费者市场",
            description: "面向个人用户",
          },
          {
            value: "b2b2c",
            label: "混合市场",
            description: "企业+消费者",
          },
        ],
        required: true,
        defaultValue: "b2c",
      },
      {
        id: "competitor_count",
        type: "single_choice",
        category: "constraint",
        question: "分析竞品数量？",
        options: [
          { value: "few", label: "精选对比", description: "1-2个核心竞品" },
          { value: "standard", label: "标准分析", description: "3-4个竞品" },
          { value: "comprehensive", label: "全面分析", description: "5个竞品" },
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
   * 生成竞品分析大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析竞品资料...");

    const _briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const competitorCount = this.getCompetitorCount(input);

    const outlinePrompt = `
你是一位资深市场分析师，正在为以下竞品资料创建分析报告大纲。

${briefingPrompt}

分析竞品数量：最多 ${competitorCount} 个

请生成包含以下结构的大纲：
1. 竞品概览 - 列出各竞品基本信息和定位
2. SWOT 分析 - 针对自身产品的四象限分析
3. 功能对比矩阵 - 核心功能支持情况对比
4. 差异化机会 - 识别市场空白和差异化方向
5. 策略建议 - 产品、营销、定价方面的建议

每个章节需要包含：
- 分析维度
- 关键发现
- 数据支撑点
`;

    yield* this.reportProgress("outline", 30, "构建分析框架...");

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
   * 基于大纲生成竞品分析报告
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成竞品分析...");

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
          chunk.data.step ?? "分析中...",
        );
      }
    }

    yield* this.reportProgress("content", 100, "竞品分析生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<CompetitorScoutOutput> {
    const outline = context.outline;

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: outline?.title ?? this.extractTitle(rawContent),
      analysisScope: this.extractAnalysisScope(rawContent),
      targetMarket: this.extractTargetMarket(rawContent),
      competitors: this.extractCompetitors(rawContent),
      swotAnalysis: this.extractSwotAnalysis(rawContent),
      featureMatrix: this.extractFeatureMatrix(rawContent),
      differentiationOpportunities: this.extractOpportunities(rawContent),
      strategicRecommendations: this.extractRecommendations(rawContent),
      summary: this.extractSummary(rawContent),
      analysisDimensions: this.extractDimensions(rawContent),
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
        analysisScope: { type: "string" },
        targetMarket: {
          type: "string",
          enum: ["b2b", "b2c", "b2b2c"],
        },
        competitors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              company: { type: "string" },
              positioning: { type: "string" },
              targetUsers: { type: "string" },
              coreFeatures: { type: "array", items: { type: "string" } },
              pricingModel: { type: "string" },
              marketShare: { type: "string" },
              foundedYear: { type: "number" },
            },
            required: ["name", "positioning", "targetUsers", "coreFeatures"],
          },
          minItems: 1,
          maxItems: 5,
        },
        swotAnalysis: {
          type: "object",
          properties: {
            strengths: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
            weaknesses: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
            opportunities: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
            threats: { type: "array", items: { type: "string" }, minItems: 1 },
          },
          required: ["strengths", "weaknesses", "opportunities", "threats"],
        },
        featureMatrix: {
          type: "array",
          items: {
            type: "object",
            properties: {
              feature: { type: "string" },
              category: { type: "string" },
              support: {
                type: "object",
                additionalProperties: {
                  type: "string",
                  enum: ["full", "partial", "none", "unknown"],
                },
              },
              notes: { type: "string" },
            },
            required: ["feature", "category", "support"],
          },
        },
        differentiationOpportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              priority: { type: "number", minimum: 1, maximum: 5 },
              difficulty: { type: "string", enum: ["low", "medium", "high"] },
              potentialImpact: { type: "string" },
            },
            required: [
              "id",
              "description",
              "priority",
              "difficulty",
              "potentialImpact",
            ],
          },
        },
        strategicRecommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: ["product", "marketing", "pricing", "positioning"],
              },
              recommendation: { type: "string" },
              rationale: { type: "string" },
              timeframe: {
                type: "string",
                enum: ["short-term", "medium-term", "long-term"],
              },
            },
            required: [
              "id",
              "type",
              "recommendation",
              "rationale",
              "timeframe",
            ],
          },
        },
        summary: { type: "string" },
        analysisDimensions: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "analysisScope",
        "targetMarket",
        "competitors",
        "swotAnalysis",
        "featureMatrix",
        "differentiationOpportunities",
        "strategicRecommendations",
        "summary",
        "analysisDimensions",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 获取竞品数量
   */
  private getCompetitorCount(input: EnhancedBlueprintInput): number {
    const countAnswer =
      input.briefingContext?.answers?.competitor_count ?? "standard";
    const countMap: Record<string, number> = {
      few: 2,
      standard: 4,
      comprehensive: 5,
    };
    return countMap[countAnswer as string] ?? 4;
  }

  /**
   * 提取标题
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/(?:标题|Title)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? "竞品分析报告";
  }

  /**
   * 提取分析范围
   */
  private extractAnalysisScope(content: string): string {
    const scopeMatch = content.match(/(?:范围|Scope)[：:]\s*(.+)/i);
    return scopeMatch?.[1]?.trim() ?? "核心竞品分析";
  }

  /**
   * 提取目标市场
   */
  private extractTargetMarket(content: string): string {
    const marketMatch = content.match(/(?:市场|Market)[：:]\s*(.+)/i);
    const market = marketMatch?.[1]?.trim().toLowerCase() ?? "";
    if (market.includes("b2b2c") || market.includes("混合")) return "b2b2c";
    if (market.includes("b2b") || market.includes("企业")) return "b2b";
    return "b2c";
  }

  /**
   * 提取竞品列表
   */
  private extractCompetitors(content: string): CompetitorOverview[] {
    const competitors: CompetitorOverview[] = [];
    const competitorRegex =
      /(?:竞品|Competitor)\s*(\d+)[：:]\s*(.+?)(?=(?:竞品|Competitor)\s*\d+|SWOT|功能|$)/gis;
    let match;

    while ((match = competitorRegex.exec(content)) !== null) {
      const competitorContent = match[2];
      competitors.push({
        name: this.extractCompetitorName(competitorContent),
        company: this.extractCompetitorCompany(competitorContent),
        positioning: this.extractCompetitorPositioning(competitorContent),
        targetUsers: this.extractCompetitorTarget(competitorContent),
        coreFeatures: this.extractCompetitorFeatures(competitorContent),
        pricingModel: this.extractCompetitorPricing(competitorContent),
      });
    }

    // 如果没有找到，创建默认竞品
    if (competitors.length === 0) {
      competitors.push({
        name: "竞品 A",
        positioning: "市场领先者",
        targetUsers: "企业用户",
        coreFeatures: ["核心功能1", "核心功能2"],
      });
    }

    return competitors.slice(0, 5);
  }

  /**
   * 提取竞品名称
   */
  private extractCompetitorName(content: string): string {
    const nameMatch = content.match(/(?:名称|Name)[：:]\s*(.+)/i);
    if (nameMatch) return nameMatch[1].trim();
    const firstLine = content.split("\n")[0];
    return firstLine?.slice(0, 50).trim() ?? "未命名竞品";
  }

  /**
   * 提取竞品公司
   */
  private extractCompetitorCompany(content: string): string | undefined {
    const companyMatch = content.match(/(?:公司|Company)[：:]\s*(.+)/i);
    return companyMatch?.[1]?.trim();
  }

  /**
   * 提取竞品定位
   */
  private extractCompetitorPositioning(content: string): string {
    const posMatch = content.match(/(?:定位|Positioning)[：:]\s*(.+)/i);
    return posMatch?.[1]?.trim() ?? "综合解决方案";
  }

  /**
   * 提取竞品目标用户
   */
  private extractCompetitorTarget(content: string): string {
    const targetMatch = content.match(/(?:用户|Target)[：:]\s*(.+)/i);
    return targetMatch?.[1]?.trim() ?? "通用用户";
  }

  /**
   * 提取竞品核心功能
   */
  private extractCompetitorFeatures(content: string): string[] {
    const featuresMatch = content.match(/(?:功能|Features)[：:]\s*(.+)/i);
    if (featuresMatch) {
      return featuresMatch[1]
        .split(/[,，、]/)
        .map((f) => f.trim())
        .filter(Boolean);
    }
    return ["核心功能"];
  }

  /**
   * 提取竞品定价
   */
  private extractCompetitorPricing(content: string): string | undefined {
    const pricingMatch = content.match(/(?:定价|Pricing)[：:]\s*(.+)/i);
    return pricingMatch?.[1]?.trim();
  }

  /**
   * 提取 SWOT 分析
   */
  private extractSwotAnalysis(content: string): SwotAnalysis {
    return {
      strengths: this.extractSwotSection(content, "strengths"),
      weaknesses: this.extractSwotSection(content, "weaknesses"),
      opportunities: this.extractSwotSection(content, "opportunities"),
      threats: this.extractSwotSection(content, "threats"),
    };
  }

  /**
   * 提取 SWOT 各部分
   */
  private extractSwotSection(
    content: string,
    section: "strengths" | "weaknesses" | "opportunities" | "threats",
  ): string[] {
    const sectionNames: Record<string, string[]> = {
      strengths: ["优势", "Strengths", "S"],
      weaknesses: ["劣势", "Weaknesses", "W"],
      opportunities: ["机会", "Opportunities", "O"],
      threats: ["威胁", "Threats", "T"],
    };

    const names = sectionNames[section];
    const pattern = new RegExp(
      `(?:${names.join("|")})[：:]([\s\S]*?)(?=(?:优势|劣势|机会|威胁|Strengths|Weaknesses|Opportunities|Threats)|功能|差异|策略|$)`,
      "i",
    );
    const match = content.match(pattern);

    if (match) {
      const items = match[1].match(/[-•]\s*(.+)/g);
      if (items) {
        return items.map((item) => item.replace(/^[-•]\s*/, "").trim());
      }
    }

    // 默认值
    const defaults: Record<string, string[]> = {
      strengths: ["待分析优势"],
      weaknesses: ["待分析劣势"],
      opportunities: ["待分析机会"],
      threats: ["待分析威胁"],
    };
    return defaults[section];
  }

  /**
   * 提取功能矩阵
   */
  private extractFeatureMatrix(content: string): FeatureComparison[] {
    const matrix: FeatureComparison[] = [];
    const matrixMatch = content.match(
      /(?:功能对比|Feature Matrix)[：:]([\s\S]*?)(?=差异|策略|总结|$)/i,
    );

    if (matrixMatch) {
      const rows = matrixMatch[1].match(/\|.+\|/g);
      if (rows && rows.length > 2) {
        // 跳过表头和分隔行
        for (let i = 2; i < rows.length; i++) {
          const cells = rows[i]
            .split("|")
            .filter((c) => c.trim())
            .map((c) => c.trim());
          if (cells.length >= 2) {
            matrix.push({
              feature: cells[0],
              category: "核心功能",
              support: { 竞品A: "full", 竞品B: "partial" },
            });
          }
        }
      }
    }

    // 如果没有找到，创建默认矩阵
    if (matrix.length === 0) {
      matrix.push({
        feature: "核心功能",
        category: "基础",
        support: { 自身: "full" },
      });
    }

    return matrix;
  }

  /**
   * 提取差异化机会
   */
  private extractOpportunities(content: string): DifferentiationOpportunity[] {
    const opportunities: DifferentiationOpportunity[] = [];
    const oppMatch = content.match(
      /(?:差异化|机会|Opportunities)[：:]([\s\S]*?)(?=策略|建议|总结|$)/i,
    );

    if (oppMatch) {
      const items = oppMatch[1].match(/[-•]\s*(.+)/g);
      if (items) {
        items.forEach((item, index) => {
          opportunities.push({
            id: `opp-${index + 1}`,
            description: item.replace(/^[-•]\s*/, "").trim(),
            priority: 3,
            difficulty: "medium",
            potentialImpact: "中等影响",
          });
        });
      }
    }

    // 如果没有找到，创建默认机会
    if (opportunities.length === 0) {
      opportunities.push({
        id: "opp-1",
        description: "待识别的差异化机会",
        priority: 3,
        difficulty: "medium",
        potentialImpact: "待评估",
      });
    }

    return opportunities;
  }

  /**
   * 提取策略建议
   */
  private extractRecommendations(content: string): StrategicRecommendation[] {
    const recommendations: StrategicRecommendation[] = [];
    const recMatch = content.match(
      /(?:策略|建议|Recommendations?)[：:]([\s\S]*?)(?=总结|$)/i,
    );

    if (recMatch) {
      const items = recMatch[1].match(/[-•]\s*(.+)/g);
      if (items) {
        items.forEach((item, index) => {
          const text = item.replace(/^[-•]\s*/, "").trim();
          recommendations.push({
            id: `rec-${index + 1}`,
            type: this.inferRecommendationType(text),
            recommendation: text,
            rationale: "基于竞品分析结果",
            timeframe: "medium-term",
          });
        });
      }
    }

    // 如果没有找到，创建默认建议
    if (recommendations.length === 0) {
      recommendations.push({
        id: "rec-1",
        type: "product",
        recommendation: "待生成策略建议",
        rationale: "基于竞品分析",
        timeframe: "medium-term",
      });
    }

    return recommendations;
  }

  /**
   * 推断建议类型
   */
  private inferRecommendationType(
    text: string,
  ): "product" | "marketing" | "pricing" | "positioning" {
    const lower = text.toLowerCase();
    if (lower.includes("价格") || lower.includes("pricing")) return "pricing";
    if (lower.includes("营销") || lower.includes("marketing"))
      return "marketing";
    if (lower.includes("定位") || lower.includes("positioning"))
      return "positioning";
    return "product";
  }

  /**
   * 提取总结
   */
  private extractSummary(content: string): string {
    const summaryMatch = content.match(/(?:总结|Summary)[：:]\s*([\s\S]+?)$/i);
    return (
      summaryMatch?.[1]?.trim().slice(0, 500) ??
      "竞品分析报告已生成，请查看各章节详细内容。"
    );
  }

  /**
   * 提取分析维度
   */
  private extractDimensions(content: string): string[] {
    const dimMatch = content.match(/(?:维度|Dimensions)[：:]\s*(.+)/i);
    if (dimMatch) {
      return dimMatch[1]
        .split(/[,，、]/)
        .map((d) => d.trim())
        .filter(Boolean);
    }
    return ["功能", "定价", "市场定位"];
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
    return ["竞品分析", "SWOT", "市场研究"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 CompetitorScout 蓝图实例
 */
export function createCompetitorScoutBlueprint(): CompetitorScoutBlueprint {
  return new CompetitorScoutBlueprint();
}
