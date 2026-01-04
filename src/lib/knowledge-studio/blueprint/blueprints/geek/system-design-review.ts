/**
 * SystemDesignReview Blueprint - 系统架构评审官 (Story 4.4)
 * @module knowledge-studio/blueprint/blueprints/geek
 *
 * 对系统架构设计文档进行专业评审。
 *
 * 目标用户: 架构师、技术经理
 * 输入: 架构设计文档
 * 输出: 结构化评审报告（优势、风险、改进建议、评分）
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
 * 评审维度类型
 */
type ReviewDimension =
  | "scalability" // 可扩展性
  | "reliability" // 可靠性
  | "maintainability" // 可维护性
  | "performance" // 性能
  | "security" // 安全性
  | "cost" // 成本
  | "operability"; // 可运维性

/**
 * 评审项
 */
interface ReviewItem {
  /** 评审项ID */
  id: string;
  /** 评审维度 */
  dimension: ReviewDimension;
  /** 评审标题 */
  title: string;
  /** 评审描述 */
  description: string;
  /** 评分 (1-5) */
  score: number;
  /** 评分理由 */
  rationale: string;
}

/**
 * 优势点
 */
interface Strength {
  /** 优势ID */
  id: string;
  /** 优势标题 */
  title: string;
  /** 优势描述 */
  description: string;
  /** 相关维度 */
  relatedDimensions: ReviewDimension[];
  /** 影响程度 */
  impact: "high" | "medium" | "low";
}

/**
 * 风险点
 */
interface Risk {
  /** 风险ID */
  id: string;
  /** 风险标题 */
  title: string;
  /** 风险描述 */
  description: string;
  /** 风险类型 */
  riskType: "technical" | "operational" | "business" | "security";
  /** 严重程度 */
  severity: "critical" | "high" | "medium" | "low";
  /** 发生概率 */
  probability: "high" | "medium" | "low";
  /** 缓解建议 */
  mitigation?: string;
}

/**
 * 改进建议
 */
interface Recommendation {
  /** 建议ID */
  id: string;
  /** 建议标题 */
  title: string;
  /** 建议描述 */
  description: string;
  /** 优先级 */
  priority: "immediate" | "short-term" | "long-term";
  /** 预期收益 */
  expectedBenefit: string;
  /** 实施复杂度 */
  complexity: "high" | "medium" | "low";
  /** 相关风险ID */
  relatedRiskIds?: string[];
}

/**
 * 维度评分汇总
 */
interface DimensionScore {
  /** 维度 */
  dimension: ReviewDimension;
  /** 维度名称 */
  dimensionName: string;
  /** 平均分 */
  averageScore: number;
  /** 评审项数量 */
  itemCount: number;
  /** 关键发现 */
  keyFindings: string[];
}

/**
 * 总体评估
 */
interface OverallAssessment {
  /** 总体评分 (1-5) */
  overallScore: number;
  /** 评估等级 */
  grade: "A" | "B" | "C" | "D" | "F";
  /** 一句话总结 */
  summary: string;
  /** 是否建议采纳 */
  recommendation:
    | "strongly_recommend"
    | "recommend"
    | "conditional"
    | "not_recommend";
  /** 采纳条件（如有） */
  adoptionConditions?: string[];
}

/**
 * SystemDesignReview 输出类型
 */
export interface SystemDesignReviewOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 被评审系统名称 */
  systemName: string;
  /** 评审范围描述 */
  reviewScope: string;
  /** 评审方法论 */
  methodology: string;
  /** 评审项列表 */
  reviewItems: ReviewItem[];
  /** 优势点列表 */
  strengths: Strength[];
  /** 风险点列表 */
  risks: Risk[];
  /** 改进建议列表 */
  recommendations: Recommendation[];
  /** 维度评分汇总 */
  dimensionScores: DimensionScore[];
  /** 总体评估 */
  overallAssessment: OverallAssessment;
  /** 评审者备注 */
  reviewerNotes?: string;
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Constants
// ============================================================

const DIMENSION_NAMES: Record<ReviewDimension, string> = {
  scalability: "可扩展性",
  reliability: "可靠性",
  maintainability: "可维护性",
  performance: "性能",
  security: "安全性",
  cost: "成本效益",
  operability: "可运维性",
};

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * SystemDesignReview 蓝图
 *
 * 对系统架构设计进行全面专业评审。
 *
 * 评审内容包含：
 * - 多维度评估（可扩展性、可靠性、性能等）
 * - 优势识别
 * - 风险评估
 * - 改进建议
 * - 总体评分和采纳建议
 */
export class SystemDesignReviewBlueprint extends EnhancedBlueprintEngine<SystemDesignReviewOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "geek-system_design_review";
  readonly displayName = "系统架构评审官";
  readonly description =
    "对系统架构设计文档进行专业评审，输出结构化评审报告（优势、风险、改进建议、评分）";
  readonly icon = "🏗️";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "architect",
    "developer",
    "product_manager",
  ];
  readonly creditsCost = 3; // High complexity: deep architecture analysis

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "geek" as const;
  readonly priority = 4; // P0 高优先级
  readonly isNew = true;
  readonly tags = ["架构", "评审", "系统设计", "技术评估"];
  readonly examplePrompts = [
    "评审这份微服务架构设计",
    "分析这个系统的可扩展性和可靠性",
    "给这份技术方案打分并提出改进建议",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "review_focus",
        type: "multi_choice",
        category: "objective",
        question: "评审的重点维度？",
        options: [
          {
            value: "scalability",
            label: "可扩展性",
            description: "系统扩容能力",
          },
          {
            value: "reliability",
            label: "可靠性",
            description: "故障容错和恢复",
          },
          {
            value: "performance",
            label: "性能",
            description: "响应时间和吞吐量",
          },
          {
            value: "security",
            label: "安全性",
            description: "数据保护和访问控制",
          },
        ],
        required: true,
        defaultValue: ["scalability", "reliability"],
      },
      {
        id: "system_scale",
        type: "single_choice",
        category: "context",
        question: "系统预期规模？",
        options: [
          { value: "small", label: "小型", description: "<1K DAU" },
          { value: "medium", label: "中型", description: "1K-100K DAU" },
          { value: "large", label: "大型", description: "100K-1M DAU" },
          { value: "massive", label: "超大型", description: ">1M DAU" },
        ],
        required: true,
        defaultValue: "medium",
      },
      {
        id: "review_depth",
        type: "single_choice",
        category: "constraint",
        question: "评审深度？",
        options: [
          { value: "quick", label: "快速评审", description: "关键问题和建议" },
          { value: "standard", label: "标准评审", description: "全面分析" },
          {
            value: "deep",
            label: "深度评审",
            description: "详尽分析+改进方案",
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
   * 生成评审大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析架构文档...");

    // 构建大纲生成配置
    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深系统架构评审专家，正在为以下架构设计文档生成评审大纲。

${briefingPrompt}

请生成包含以下部分的评审大纲：

1. **评审范围** - 本次评审覆盖的系统边界
2. **评审维度** (选择适用的维度)
   - 可扩展性：水平/垂直扩展能力
   - 可靠性：故障容错、恢复能力
   - 可维护性：代码质量、模块化
   - 性能：响应时间、吞吐量
   - 安全性：认证授权、数据保护
   - 成本：资源效率、运维成本
   - 可运维性：监控、部署、日志
3. **优势识别** (3-5 个)
   - 架构设计的亮点和创新
4. **风险评估** (3-5 个)
   - 潜在的技术和运营风险
5. **改进建议** (3-5 个)
   - 具体可行的优化方向
6. **总体评估** - 综合评分和采纳建议

每个部分需要包含关键评审要点。
`;

    yield* this.reportProgress("outline", 30, "生成评审结构...");

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
    yield* this.reportProgress("content", 10, "开始生成评审报告...");

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
  ): Promise<SystemDesignReviewOutput> {
    const outline = context.outline;

    // 解析各部分内容
    const systemName = this.extractSystemName(rawContent, outline);
    const reviewScope = this.extractSection(rawContent, "评审范围", "Scope");
    const reviewItems = this.parseReviewItems(rawContent);
    const strengths = this.parseStrengths(rawContent);
    const risks = this.parseRisks(rawContent);
    const recommendations = this.parseRecommendations(rawContent);
    const dimensionScores = this.calculateDimensionScores(reviewItems);
    const overallAssessment = this.calculateOverallAssessment(
      dimensionScores,
      risks,
    );

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      systemName,
      reviewScope,
      methodology: "多维度架构评审法（ATAM/CBAM 参考）",
      reviewItems,
      strengths,
      risks,
      recommendations,
      dimensionScores,
      overallAssessment,
      reviewerNotes: this.extractSection(rawContent, "备注", "Notes"),
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
        systemName: { type: "string" },
        reviewScope: { type: "string" },
        methodology: { type: "string" },
        reviewItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              dimension: {
                type: "string",
                enum: [
                  "scalability",
                  "reliability",
                  "maintainability",
                  "performance",
                  "security",
                  "cost",
                  "operability",
                ],
              },
              title: { type: "string" },
              description: { type: "string" },
              score: { type: "number", minimum: 1, maximum: 5 },
              rationale: { type: "string" },
            },
            required: [
              "id",
              "dimension",
              "title",
              "description",
              "score",
              "rationale",
            ],
          },
        },
        strengths: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              relatedDimensions: { type: "array", items: { type: "string" } },
              impact: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: [
              "id",
              "title",
              "description",
              "relatedDimensions",
              "impact",
            ],
          },
        },
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              riskType: {
                type: "string",
                enum: ["technical", "operational", "business", "security"],
              },
              severity: {
                type: "string",
                enum: ["critical", "high", "medium", "low"],
              },
              probability: { type: "string", enum: ["high", "medium", "low"] },
              mitigation: { type: "string" },
            },
            required: [
              "id",
              "title",
              "description",
              "riskType",
              "severity",
              "probability",
            ],
          },
        },
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              priority: {
                type: "string",
                enum: ["immediate", "short-term", "long-term"],
              },
              expectedBenefit: { type: "string" },
              complexity: { type: "string", enum: ["high", "medium", "low"] },
              relatedRiskIds: { type: "array", items: { type: "string" } },
            },
            required: [
              "id",
              "title",
              "description",
              "priority",
              "expectedBenefit",
              "complexity",
            ],
          },
        },
        dimensionScores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dimension: { type: "string" },
              dimensionName: { type: "string" },
              averageScore: { type: "number" },
              itemCount: { type: "number" },
              keyFindings: { type: "array", items: { type: "string" } },
            },
            required: [
              "dimension",
              "dimensionName",
              "averageScore",
              "itemCount",
              "keyFindings",
            ],
          },
        },
        overallAssessment: {
          type: "object",
          properties: {
            overallScore: { type: "number", minimum: 1, maximum: 5 },
            grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
            summary: { type: "string" },
            recommendation: {
              type: "string",
              enum: [
                "strongly_recommend",
                "recommend",
                "conditional",
                "not_recommend",
              ],
            },
            adoptionConditions: { type: "array", items: { type: "string" } },
          },
          required: ["overallScore", "grade", "summary", "recommendation"],
        },
        reviewerNotes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "systemName",
        "reviewScope",
        "methodology",
        "reviewItems",
        "strengths",
        "risks",
        "recommendations",
        "dimensionScores",
        "overallAssessment",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 提取系统名称
   */
  private extractSystemName(
    content: string,
    outline?: BlueprintOutline,
  ): string {
    const nameMatch = content.match(/(?:系统名称|System Name)[：:]\s*(.+)/i);
    if (nameMatch) return nameMatch[1].trim();
    return outline?.title ?? "待评审系统";
  }

  /**
   * 提取指定章节内容
   */
  private extractSection(content: string, ...sectionNames: string[]): string {
    for (const name of sectionNames) {
      const regex = new RegExp(`(?:${name})[：:][^]*?(?=##|$)`, "i");
      const match = content.match(regex);
      if (match) {
        return match[0]
          .replace(new RegExp(`^${name}[：:]\\s*`, "i"), "")
          .trim()
          .split("\n")[0];
      }
    }
    return "";
  }

  /**
   * 解析评审项
   */
  private parseReviewItems(content: string): ReviewItem[] {
    const items: ReviewItem[] = [];
    const dimensions: ReviewDimension[] = [
      "scalability",
      "reliability",
      "maintainability",
      "performance",
      "security",
      "cost",
      "operability",
    ];

    dimensions.forEach((dimension, dimIndex) => {
      const dimName = DIMENSION_NAMES[dimension];
      const regex = new RegExp(
        `(?:${dimName}|${dimension})[：:][^]*?(?=##|$)`,
        "i",
      );
      const match = content.match(regex);

      if (match) {
        const score = this.extractScore(match[0]);
        items.push({
          id: `review-${dimIndex + 1}`,
          dimension,
          title: dimName,
          description: this.extractFirstParagraph(match[0]),
          score,
          rationale: this.extractRationale(match[0]) || `基于${dimName}评估`,
        });
      }
    });

    // 默认评审项
    if (items.length === 0) {
      items.push({
        id: "review-1",
        dimension: "scalability",
        title: "可扩展性",
        description: "系统扩展能力评估",
        score: 3,
        rationale: "待详细分析",
      });
    }

    return items;
  }

  /**
   * 提取评分
   */
  private extractScore(content: string): number {
    const scoreMatch = content.match(/(?:评分|Score)[：:]\s*(\d)/i);
    if (scoreMatch) return parseInt(scoreMatch[1], 10);

    // 基于关键词推断
    if (/优秀|excellent/i.test(content)) return 5;
    if (/良好|good/i.test(content)) return 4;
    if (/一般|average/i.test(content)) return 3;
    if (/较差|poor/i.test(content)) return 2;
    if (/差|bad/i.test(content)) return 1;

    return 3; // 默认中等
  }

  /**
   * 提取评分理由
   */
  private extractRationale(content: string): string {
    const rationaleMatch = content.match(/(?:理由|Rationale)[：:]\s*(.+)/i);
    return rationaleMatch?.[1]?.trim() || "";
  }

  /**
   * 提取第一段
   */
  private extractFirstParagraph(content: string): string {
    const paragraphs = content.split("\n\n");
    return (
      paragraphs
        .find((p) => p.trim() && !p.startsWith("#"))
        ?.trim()
        .slice(0, 200) ?? ""
    );
  }

  /**
   * 解析优势点
   */
  private parseStrengths(content: string): Strength[] {
    const strengths: Strength[] = [];
    const sectionMatch = content.match(
      /(?:优势|Strengths?)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.slice(0, 5).forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, "").trim();
          strengths.push({
            id: `strength-${index + 1}`,
            title: text.split(/[：:]/)[0].trim(),
            description: text,
            relatedDimensions: this.inferDimensions(text),
            impact: this.inferImpact(text),
          });
        });
      }
    }

    // 默认优势
    if (strengths.length === 0) {
      strengths.push({
        id: "strength-1",
        title: "待识别",
        description: "需要进一步分析架构优势",
        relatedDimensions: ["scalability"],
        impact: "medium",
      });
    }

    return strengths;
  }

  /**
   * 推断相关维度
   */
  private inferDimensions(text: string): ReviewDimension[] {
    const dimensions: ReviewDimension[] = [];
    if (/扩展|伸缩|scale/i.test(text)) dimensions.push("scalability");
    if (/可靠|容错|故障|reliability/i.test(text))
      dimensions.push("reliability");
    if (/维护|模块|maintain/i.test(text)) dimensions.push("maintainability");
    if (/性能|响应|吞吐|performance/i.test(text))
      dimensions.push("performance");
    if (/安全|认证|授权|security/i.test(text)) dimensions.push("security");
    if (/成本|资源|cost/i.test(text)) dimensions.push("cost");
    if (/运维|监控|部署|operability/i.test(text))
      dimensions.push("operability");
    return dimensions.length > 0 ? dimensions : ["maintainability"];
  }

  /**
   * 推断影响程度
   */
  private inferImpact(text: string): Strength["impact"] {
    if (/关键|核心|重大|high|critical/i.test(text)) return "high";
    if (/一般|中等|moderate/i.test(text)) return "medium";
    return "medium";
  }

  /**
   * 解析风险点
   */
  private parseRisks(content: string): Risk[] {
    const risks: Risk[] = [];
    const sectionMatch = content.match(
      /(?:风险|Risks?)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.slice(0, 5).forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, "").trim();
          risks.push({
            id: `risk-${index + 1}`,
            title: text.split(/[：:]/)[0].trim(),
            description: text,
            riskType: this.inferRiskType(text),
            severity: this.inferSeverity(text),
            probability: this.inferProbability(text),
            mitigation: this.extractMitigation(text),
          });
        });
      }
    }

    // 默认风险
    if (risks.length === 0) {
      risks.push({
        id: "risk-1",
        title: "待评估",
        description: "需要进一步分析潜在风险",
        riskType: "technical",
        severity: "medium",
        probability: "medium",
      });
    }

    return risks;
  }

  /**
   * 推断风险类型
   */
  private inferRiskType(text: string): Risk["riskType"] {
    if (/安全|权限|数据泄露/i.test(text)) return "security";
    if (/运营|运维|监控/i.test(text)) return "operational";
    if (/业务|商业|成本/i.test(text)) return "business";
    return "technical";
  }

  /**
   * 推断严重程度
   */
  private inferSeverity(text: string): Risk["severity"] {
    if (/致命|critical|严重/i.test(text)) return "critical";
    if (/高|high|重要/i.test(text)) return "high";
    if (/低|low|轻微/i.test(text)) return "low";
    return "medium";
  }

  /**
   * 推断发生概率
   */
  private inferProbability(text: string): Risk["probability"] {
    if (/很可能|经常|频繁|high probability/i.test(text)) return "high";
    if (/不太可能|偶尔|low probability/i.test(text)) return "low";
    return "medium";
  }

  /**
   * 提取缓解措施
   */
  private extractMitigation(text: string): string | undefined {
    const mitigationMatch = text.match(/(?:建议|缓解|Mitigation)[：:]\s*(.+)/i);
    return mitigationMatch?.[1]?.trim();
  }

  /**
   * 解析改进建议
   */
  private parseRecommendations(content: string): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const sectionMatch = content.match(
      /(?:建议|Recommendations?|改进)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.slice(0, 5).forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, "").trim();
          recommendations.push({
            id: `rec-${index + 1}`,
            title: text.split(/[：:]/)[0].trim(),
            description: text,
            priority: this.inferPriority(text),
            expectedBenefit: this.extractBenefit(text) || "提升系统质量",
            complexity: this.inferComplexity(text),
          });
        });
      }
    }

    // 默认建议
    if (recommendations.length === 0) {
      recommendations.push({
        id: "rec-1",
        title: "持续优化",
        description: "基于评审结果持续改进架构设计",
        priority: "short-term",
        expectedBenefit: "提升系统整体质量",
        complexity: "medium",
      });
    }

    return recommendations;
  }

  /**
   * 推断优先级
   */
  private inferPriority(text: string): Recommendation["priority"] {
    if (/立即|紧急|immediate|critical/i.test(text)) return "immediate";
    if (/长期|long-term|未来/i.test(text)) return "long-term";
    return "short-term";
  }

  /**
   * 提取预期收益
   */
  private extractBenefit(text: string): string {
    const benefitMatch = text.match(/(?:收益|Benefit)[：:]\s*(.+)/i);
    return benefitMatch?.[1]?.trim() || "";
  }

  /**
   * 推断复杂度
   */
  private inferComplexity(text: string): Recommendation["complexity"] {
    if (/简单|easy|低成本/i.test(text)) return "low";
    if (/复杂|困难|high effort/i.test(text)) return "high";
    return "medium";
  }

  /**
   * 计算维度评分汇总
   */
  private calculateDimensionScores(
    reviewItems: ReviewItem[],
  ): DimensionScore[] {
    const dimensionMap = new Map<
      ReviewDimension,
      { scores: number[]; findings: string[] }
    >();

    reviewItems.forEach((item) => {
      if (!dimensionMap.has(item.dimension)) {
        dimensionMap.set(item.dimension, { scores: [], findings: [] });
      }
      const data = dimensionMap.get(item.dimension);
      if (data) {
        data.scores.push(item.score);
        data.findings.push(item.rationale);
      }
    });

    const scores: DimensionScore[] = [];
    dimensionMap.forEach((data, dimension) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      scores.push({
        dimension,
        dimensionName: DIMENSION_NAMES[dimension],
        averageScore: Math.round(avg * 10) / 10,
        itemCount: data.scores.length,
        keyFindings: data.findings.slice(0, 3),
      });
    });

    return scores;
  }

  /**
   * 计算总体评估
   */
  private calculateOverallAssessment(
    dimensionScores: DimensionScore[],
    risks: Risk[],
  ): OverallAssessment {
    // 计算加权平均分
    const totalScore = dimensionScores.reduce(
      (sum, d) => sum + d.averageScore,
      0,
    );
    const overallScore =
      dimensionScores.length > 0
        ? Math.round((totalScore / dimensionScores.length) * 10) / 10
        : 3;

    // 确定等级
    let grade: OverallAssessment["grade"];
    if (overallScore >= 4.5) grade = "A";
    else if (overallScore >= 3.5) grade = "B";
    else if (overallScore >= 2.5) grade = "C";
    else if (overallScore >= 1.5) grade = "D";
    else grade = "F";

    // 检查是否有严重风险
    const hasCriticalRisk = risks.some((r) => r.severity === "critical");
    const hasHighRisk = risks.some((r) => r.severity === "high");

    // 确定采纳建议
    let recommendation: OverallAssessment["recommendation"];
    let adoptionConditions: string[] | undefined;

    if (hasCriticalRisk) {
      recommendation = "not_recommend";
      adoptionConditions = ["解决所有严重风险后重新评审"];
    } else if (hasHighRisk || overallScore < 3) {
      recommendation = "conditional";
      adoptionConditions = ["解决高风险问题", "完善改进建议中的优先项"];
    } else if (overallScore >= 4) {
      recommendation = "strongly_recommend";
    } else {
      recommendation = "recommend";
    }

    return {
      overallScore,
      grade,
      summary: this.generateSummary(overallScore, grade, risks.length),
      recommendation,
      adoptionConditions,
    };
  }

  /**
   * 生成评估总结
   */
  private generateSummary(
    score: number,
    grade: string,
    riskCount: number,
  ): string {
    if (score >= 4) {
      return `架构设计整体优秀（${grade}级），具备良好的工程实践基础。`;
    } else if (score >= 3) {
      return `架构设计基本合理（${grade}级），存在${riskCount}个需要关注的风险点。`;
    } else {
      return `架构设计存在明显不足（${grade}级），建议重点改进后再实施。`;
    }
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
    return ["架构评审", "技术评估"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 SystemDesignReview 蓝图实例
 */
export function createSystemDesignReviewBlueprint(): SystemDesignReviewBlueprint {
  return new SystemDesignReviewBlueprint();
}
