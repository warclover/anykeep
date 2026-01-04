/**
 * DueDiligence Blueprint - 尽调专家 (Story 6.2)
 * @module knowledge-studio/blueprint/blueprints/business
 *
 * 根据财报和新闻生成风险评估备忘录。
 *
 * 目标用户: 投资人、分析师、风控人员
 * 输入: 财报、新闻、公开资料
 * 输出: 风险评估备忘录
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
 * 公司概览
 */
interface CompanyOverview {
  /** 公司名称 */
  name: string;
  /** 行业 */
  industry: string;
  /** 成立时间 */
  foundedYear?: number;
  /** 员工规模 */
  employeeCount?: string;
  /** 总部位置 */
  headquarters?: string;
  /** 主营业务 */
  mainBusiness: string;
  /** 市值/估值 */
  valuation?: string;
}

/**
 * 财务健康度
 */
interface FinancialHealth {
  /** 营收情况 */
  revenue: string;
  /** 盈利情况 */
  profitability: string;
  /** 现金流 */
  cashFlow: string;
  /** 负债情况 */
  debtLevel: string;
  /** 财务趋势 */
  trend: "improving" | "stable" | "declining";
  /** 关键财务指标 */
  keyMetrics: Record<string, string>;
}

/**
 * 风险项
 */
interface RiskItem {
  /** 风险ID */
  id: string;
  /** 风险类别 */
  category:
    | "financial"
    | "operational"
    | "legal"
    | "market"
    | "management"
    | "technology";
  /** 风险描述 */
  description: string;
  /** 严重程度 (1-5) */
  severity: number;
  /** 发生概率 */
  likelihood: "low" | "medium" | "high";
  /** 红旗警示 */
  isRedFlag: boolean;
  /** 来源引用 */
  sourceReference?: string;
  /** 缓解建议 */
  mitigation?: string;
}

/**
 * 机会项
 */
interface OpportunityItem {
  /** 机会ID */
  id: string;
  /** 机会类别 */
  category: "growth" | "synergy" | "undervalued" | "market_position";
  /** 机会描述 */
  description: string;
  /** 潜在价值 */
  potentialValue: "low" | "medium" | "high";
  /** 来源引用 */
  sourceReference?: string;
}

/**
 * 待验证事项
 */
interface VerificationItem {
  /** 事项ID */
  id: string;
  /** 事项描述 */
  item: string;
  /** 优先级 (1-5) */
  priority: number;
  /** 验证方式 */
  verificationMethod: string;
  /** 负责方 */
  responsibleParty?: string;
}

/**
 * DueDiligence 输出类型
 */
export interface DueDiligenceOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 备忘录标题 */
  title: string;
  /** 公司概览 */
  companyOverview: CompanyOverview;
  /** 财务健康度评估 */
  financialHealth: FinancialHealth;
  /** 风险清单 */
  risks: RiskItem[];
  /** 红旗警示数量 */
  redFlagCount: number;
  /** 机会清单 */
  opportunities: OpportunityItem[];
  /** 待验证事项清单 */
  verificationItems: VerificationItem[];
  /** 整体风险评级 */
  overallRiskRating: "low" | "medium" | "high" | "very_high";
  /** 投资建议 */
  investmentRecommendation:
    | "proceed"
    | "proceed_with_caution"
    | "further_review"
    | "pass";
  /** 执行摘要 */
  executiveSummary: string;
  /** 投资类型 */
  investmentType: string;
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * DueDiligence 蓝图
 *
 * 根据财报和新闻生成风险评估备忘录。
 *
 * 生成内容包含：
 * - 公司概览
 * - 财务健康度评估
 * - 风险清单（红旗警示）
 * - 机会清单
 * - 待验证事项清单
 */
export class DueDiligenceBlueprint extends EnhancedBlueprintEngine<DueDiligenceOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "business-due_diligence";
  readonly displayName = "尽调专家";
  readonly description =
    "根据财报和新闻生成风险评估备忘录，标注红旗警示和来源引用";
  readonly icon = "📋";
  readonly tier: BlueprintTier = "enterprise";
  readonly targetUsers: TargetUserGroup[] = [
    "investor",
    "analyst",
    "entrepreneur",
  ];
  readonly creditsCost = 3; // High complexity: enterprise-grade risk analysis

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "business" as const;
  readonly priority = 2;
  readonly isNew = true;
  readonly tags = ["尽调", "风险评估", "投资分析", "财务"];
  readonly examplePrompts = [
    "根据这份财报生成尽调备忘录",
    "分析这家公司的投资风险",
    "评估这个标的的财务健康度",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "investment_type",
        type: "single_choice",
        category: "context",
        question: "投资类型？",
        options: [
          {
            value: "equity",
            label: "股权投资",
            description: "VC/PE 股权投资",
          },
          {
            value: "ma",
            label: "并购收购",
            description: "企业并购或收购",
          },
          {
            value: "public",
            label: "二级市场",
            description: "上市公司股票",
          },
          {
            value: "debt",
            label: "债权投资",
            description: "债券或贷款",
          },
        ],
        required: true,
        defaultValue: "equity",
      },
      {
        id: "risk_preference",
        type: "single_choice",
        category: "constraint",
        question: "风险偏好？",
        options: [
          {
            value: "conservative",
            label: "保守型",
            description: "风险规避优先",
          },
          {
            value: "moderate",
            label: "稳健型",
            description: "风险收益平衡",
          },
          {
            value: "aggressive",
            label: "激进型",
            description: "追求高收益",
          },
        ],
        required: true,
        defaultValue: "moderate",
      },
      {
        id: "focus_area",
        type: "multi_choice",
        category: "objective",
        question: "重点关注领域？",
        options: [
          {
            value: "financial",
            label: "财务状况",
            description: "营收、利润、现金流",
          },
          { value: "legal", label: "法律合规", description: "诉讼、合规风险" },
          {
            value: "operational",
            label: "运营能力",
            description: "团队、执行力",
          },
          {
            value: "market",
            label: "市场竞争",
            description: "行业地位、竞争格局",
          },
        ],
        required: false,
        defaultValue: ["financial", "legal"],
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
   * 生成尽调大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析财务资料...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深投资分析师，正在为以下资料创建尽调备忘录大纲。

${briefingPrompt}

请生成包含以下结构的大纲：
1. 执行摘要 - 关键发现和投资建议
2. 公司概览 - 基本信息和主营业务
3. 财务健康度 - 营收、利润、现金流、负债分析
4. 风险清单 - 各类风险及红旗警示
5. 机会清单 - 投资亮点和增长潜力
6. 待验证事项 - 需要进一步核实的事项

每个章节需要：
- 明确分析维度
- 标注数据来源
- 提供具体证据
`;

    yield* this.reportProgress("outline", 30, "构建分析框架...");

    const materialContents = input.materials.map((m) => m.content).join("\n\n");
    const result = await generateOutline({
      materialContent: materialContents,
      customPrompt: outlinePrompt,
      blueprintType: "due_diligence",
    });

    yield* this.reportProgress("outline", 100, "大纲生成完成");

    return result.outline;
  }

  /**
   * 基于大纲生成尽调报告
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成尽调报告...");

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
      blueprintType: "due_diligence",
    });

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

    yield* this.reportProgress("content", 100, "尽调报告生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<DueDiligenceOutput> {
    const outline = context.outline;
    const risks = this.extractRisks(rawContent);
    const redFlagCount = risks.filter((r) => r.isRedFlag).length;

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: outline?.title ?? this.extractTitle(rawContent),
      companyOverview: this.extractCompanyOverview(rawContent),
      financialHealth: this.extractFinancialHealth(rawContent),
      risks,
      redFlagCount,
      opportunities: this.extractOpportunities(rawContent),
      verificationItems: this.extractVerificationItems(rawContent),
      overallRiskRating: this.calculateOverallRisk(risks),
      investmentRecommendation: this.generateRecommendation(
        risks,
        redFlagCount,
      ),
      executiveSummary: this.extractExecutiveSummary(rawContent),
      investmentType: this.extractInvestmentType(rawContent),
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
        companyOverview: {
          type: "object",
          properties: {
            name: { type: "string" },
            industry: { type: "string" },
            foundedYear: { type: "number" },
            employeeCount: { type: "string" },
            headquarters: { type: "string" },
            mainBusiness: { type: "string" },
            valuation: { type: "string" },
          },
          required: ["name", "industry", "mainBusiness"],
        },
        financialHealth: {
          type: "object",
          properties: {
            revenue: { type: "string" },
            profitability: { type: "string" },
            cashFlow: { type: "string" },
            debtLevel: { type: "string" },
            trend: {
              type: "string",
              enum: ["improving", "stable", "declining"],
            },
            keyMetrics: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          required: [
            "revenue",
            "profitability",
            "cashFlow",
            "debtLevel",
            "trend",
          ],
        },
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              category: {
                type: "string",
                enum: [
                  "financial",
                  "operational",
                  "legal",
                  "market",
                  "management",
                  "technology",
                ],
              },
              description: { type: "string" },
              severity: { type: "number", minimum: 1, maximum: 5 },
              likelihood: { type: "string", enum: ["low", "medium", "high"] },
              isRedFlag: { type: "boolean" },
              sourceReference: { type: "string" },
              mitigation: { type: "string" },
            },
            required: [
              "id",
              "category",
              "description",
              "severity",
              "likelihood",
              "isRedFlag",
            ],
          },
        },
        redFlagCount: { type: "number", minimum: 0 },
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              category: {
                type: "string",
                enum: ["growth", "synergy", "undervalued", "market_position"],
              },
              description: { type: "string" },
              potentialValue: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              sourceReference: { type: "string" },
            },
            required: ["id", "category", "description", "potentialValue"],
          },
        },
        verificationItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              item: { type: "string" },
              priority: { type: "number", minimum: 1, maximum: 5 },
              verificationMethod: { type: "string" },
              responsibleParty: { type: "string" },
            },
            required: ["id", "item", "priority", "verificationMethod"],
          },
        },
        overallRiskRating: {
          type: "string",
          enum: ["low", "medium", "high", "very_high"],
        },
        investmentRecommendation: {
          type: "string",
          enum: ["proceed", "proceed_with_caution", "further_review", "pass"],
        },
        executiveSummary: { type: "string" },
        investmentType: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "companyOverview",
        "financialHealth",
        "risks",
        "redFlagCount",
        "opportunities",
        "verificationItems",
        "overallRiskRating",
        "investmentRecommendation",
        "executiveSummary",
        "investmentType",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 提取标题
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/(?:标题|Title)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? "尽职调查备忘录";
  }

  /**
   * 提取公司概览
   */
  private extractCompanyOverview(content: string): CompanyOverview {
    const nameMatch = content.match(/(?:公司|Company)[：:]\s*(.+)/i);
    const industryMatch = content.match(/(?:行业|Industry)[：:]\s*(.+)/i);
    const businessMatch = content.match(/(?:主营|Business)[：:]\s*(.+)/i);

    return {
      name: nameMatch?.[1]?.trim() ?? "目标公司",
      industry: industryMatch?.[1]?.trim() ?? "待确认",
      mainBusiness: businessMatch?.[1]?.trim() ?? "待分析",
    };
  }

  /**
   * 提取财务健康度
   */
  private extractFinancialHealth(content: string): FinancialHealth {
    const revenueMatch = content.match(/(?:营收|Revenue)[：:]\s*(.+)/i);
    const profitMatch = content.match(/(?:利润|Profit)[：:]\s*(.+)/i);
    const cashMatch = content.match(/(?:现金流|Cash Flow)[：:]\s*(.+)/i);
    const debtMatch = content.match(/(?:负债|Debt)[：:]\s*(.+)/i);

    return {
      revenue: revenueMatch?.[1]?.trim() ?? "待分析",
      profitability: profitMatch?.[1]?.trim() ?? "待分析",
      cashFlow: cashMatch?.[1]?.trim() ?? "待分析",
      debtLevel: debtMatch?.[1]?.trim() ?? "待分析",
      trend: "stable",
      keyMetrics: {},
    };
  }

  /**
   * 提取风险列表
   */
  private extractRisks(content: string): RiskItem[] {
    const risks: RiskItem[] = [];
    const riskMatch = content.match(
      /(?:风险|Risks?)[：:]([\s\S]*?)(?=机会|待验证|总结|$)/i,
    );

    if (riskMatch) {
      const items = riskMatch[1].match(/[-•🚩]\s*(.+)/g);
      if (items) {
        items.forEach((item, index) => {
          const text = item.replace(/^[-•🚩]\s*/, "").trim();
          const isRedFlag =
            item.includes("🚩") ||
            text.includes("红旗") ||
            text.includes("警示");
          risks.push({
            id: `risk-${index + 1}`,
            category: this.inferRiskCategory(text),
            description: text,
            severity: isRedFlag ? 5 : 3,
            likelihood: "medium",
            isRedFlag,
            sourceReference: this.extractSourceReference(text),
          });
        });
      }
    }

    if (risks.length === 0) {
      risks.push({
        id: "risk-1",
        category: "financial",
        description: "待识别风险",
        severity: 3,
        likelihood: "medium",
        isRedFlag: false,
      });
    }

    return risks;
  }

  /**
   * 推断风险类别
   */
  private inferRiskCategory(text: string): RiskItem["category"] {
    const lower = text.toLowerCase();
    if (
      lower.includes("财务") ||
      lower.includes("营收") ||
      lower.includes("负债")
    )
      return "financial";
    if (
      lower.includes("法律") ||
      lower.includes("诉讼") ||
      lower.includes("合规")
    )
      return "legal";
    if (lower.includes("运营") || lower.includes("执行")) return "operational";
    if (lower.includes("市场") || lower.includes("竞争")) return "market";
    if (lower.includes("管理") || lower.includes("团队")) return "management";
    if (lower.includes("技术")) return "technology";
    return "operational";
  }

  /**
   * 提取来源引用
   */
  private extractSourceReference(text: string): string | undefined {
    const refMatch = text.match(/\[来源[：:](.+?)\]/i);
    return refMatch?.[1]?.trim();
  }

  /**
   * 提取机会列表
   */
  private extractOpportunities(content: string): OpportunityItem[] {
    const opportunities: OpportunityItem[] = [];
    const oppMatch = content.match(
      /(?:机会|Opportunities?)[：:]([\s\S]*?)(?=待验证|总结|$)/i,
    );

    if (oppMatch) {
      const items = oppMatch[1].match(/[-•✓]\s*(.+)/g);
      if (items) {
        items.forEach((item, index) => {
          const text = item.replace(/^[-•✓]\s*/, "").trim();
          opportunities.push({
            id: `opp-${index + 1}`,
            category: "growth",
            description: text,
            potentialValue: "medium",
          });
        });
      }
    }

    if (opportunities.length === 0) {
      opportunities.push({
        id: "opp-1",
        category: "growth",
        description: "待识别机会",
        potentialValue: "medium",
      });
    }

    return opportunities;
  }

  /**
   * 提取待验证事项
   */
  private extractVerificationItems(content: string): VerificationItem[] {
    const items: VerificationItem[] = [];
    const verifyMatch = content.match(
      /(?:待验证|验证|Verification)[：:]([\s\S]*?)(?=总结|$)/i,
    );

    if (verifyMatch) {
      const listItems = verifyMatch[1].match(/[-•]\s*(.+)/g);
      if (listItems) {
        listItems.forEach((item, index) => {
          const text = item.replace(/^[-•]\s*/, "").trim();
          items.push({
            id: `verify-${index + 1}`,
            item: text,
            priority: 3,
            verificationMethod: "文档审查/访谈",
          });
        });
      }
    }

    if (items.length === 0) {
      items.push({
        id: "verify-1",
        item: "核实关键财务数据",
        priority: 1,
        verificationMethod: "财务审计",
      });
    }

    return items;
  }

  /**
   * 计算整体风险评级
   */
  private calculateOverallRisk(
    risks: RiskItem[],
  ): "low" | "medium" | "high" | "very_high" {
    const avgSeverity =
      risks.reduce((sum, r) => sum + r.severity, 0) / Math.max(risks.length, 1);
    const redFlagCount = risks.filter((r) => r.isRedFlag).length;

    if (redFlagCount >= 3 || avgSeverity >= 4.5) return "very_high";
    if (redFlagCount >= 2 || avgSeverity >= 3.5) return "high";
    if (redFlagCount >= 1 || avgSeverity >= 2.5) return "medium";
    return "low";
  }

  /**
   * 生成投资建议
   */
  private generateRecommendation(
    risks: RiskItem[],
    redFlagCount: number,
  ): "proceed" | "proceed_with_caution" | "further_review" | "pass" {
    if (redFlagCount >= 3) return "pass";
    if (redFlagCount >= 2) return "further_review";
    if (redFlagCount >= 1) return "proceed_with_caution";
    return "proceed";
  }

  /**
   * 提取执行摘要
   */
  private extractExecutiveSummary(content: string): string {
    const summaryMatch = content.match(
      /(?:执行摘要|摘要|Summary)[：:]\s*([\s\S]+?)(?=公司|财务|风险|$)/i,
    );
    return (
      summaryMatch?.[1]?.trim().slice(0, 500) ??
      "尽职调查备忘录已生成，请查看各章节详细内容。"
    );
  }

  /**
   * 提取投资类型
   */
  private extractInvestmentType(content: string): string {
    const typeMatch = content.match(/(?:投资类型|Type)[：:]\s*(.+)/i);
    return typeMatch?.[1]?.trim() ?? "股权投资";
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
    return ["尽调", "风险评估", "投资分析"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 DueDiligence 蓝图实例
 */
export function createDueDiligenceBlueprint(): DueDiligenceBlueprint {
  return new DueDiligenceBlueprint();
}
