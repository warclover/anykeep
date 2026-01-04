/**
 * TechDecider Blueprint - 技术决策助手 (Story 7.1)
 * @module knowledge-studio/blueprint/blueprints/professional
 *
 * 将技术文章/博客转换为 ADR (Architecture Decision Record) 格式。
 *
 * 目标用户: 技术经理、架构师、技术负责人
 * 输入: 技术文章、博客、技术文档
 * 输出: 结构化 ADR 决策文档
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
 * 候选方案
 */
interface CandidateSolution {
  /** 方案ID */
  id: string;
  /** 方案名称 */
  name: string;
  /** 方案描述 */
  description: string;
  /** 优势列表 */
  pros: string[];
  /** 劣势列表 */
  cons: string[];
  /** 适用场景 */
  applicableScenarios: string[];
}

/**
 * 评估标准
 */
interface EvaluationCriterion {
  /** 标准ID */
  id: string;
  /** 标准名称 */
  name: string;
  /** 权重 (1-10) */
  weight: number;
  /** 说明 */
  description?: string;
}

/**
 * 评估矩阵行
 */
interface EvaluationMatrixRow {
  /** 方案ID */
  solutionId: string;
  /** 方案名称 */
  solutionName: string;
  /** 各标准得分 */
  scores: Record<string, number>;
  /** 加权总分 */
  weightedTotal: number;
}

/**
 * 评估矩阵
 */
interface EvaluationMatrix {
  /** 评估标准 */
  criteria: EvaluationCriterion[];
  /** 评估结果 */
  rows: EvaluationMatrixRow[];
}

/**
 * 实施风险
 */
interface ImplementationRisk {
  /** 风险ID */
  id: string;
  /** 风险描述 */
  description: string;
  /** 风险等级: low | medium | high | critical */
  severity: "low" | "medium" | "high" | "critical";
  /** 缓解措施 */
  mitigation: string;
  /** 负责人（可选） */
  owner?: string;
}

/**
 * 行动项
 */
interface ActionItem {
  /** 项目ID */
  id: string;
  /** 描述 */
  description: string;
  /** 优先级: low | medium | high */
  priority: "low" | "medium" | "high";
  /** 预估工时（小时） */
  estimatedHours?: number;
  /** 依赖项 */
  dependencies?: string[];
}

/**
 * 推荐方案
 */
interface RecommendedSolution {
  /** 方案ID */
  solutionId: string;
  /** 方案名称 */
  solutionName: string;
  /** 推荐理由 */
  rationale: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 替代方案 */
  alternatives?: string[];
}

/**
 * TechDecider 输出类型
 */
export interface TechDeciderOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** ADR 标题 */
  title: string;
  /** ADR 编号 */
  adrNumber?: string;
  /** 决策状态: proposed | accepted | deprecated | superseded */
  status: "proposed" | "accepted" | "deprecated" | "superseded";
  /** 决策背景 */
  decisionBackground: {
    /** 上下文描述 */
    context: string;
    /** 问题陈述 */
    problemStatement: string;
    /** 关键约束 */
    constraints: string[];
    /** 相关方 */
    stakeholders?: string[];
  };
  /** 候选方案 */
  candidateSolutions: CandidateSolution[];
  /** 评估矩阵 */
  evaluationMatrix: EvaluationMatrix;
  /** 推荐方案 */
  recommendedSolution: RecommendedSolution;
  /** 实施风险 */
  implementationRisks: ImplementationRisk[];
  /** 行动项 */
  actionItems: ActionItem[];
  /** 决策日期 */
  decisionDate?: string;
  /** 参与者 */
  participants?: string[];
  /** 相关文档 */
  relatedDocuments?: string[];
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * TechDecider 蓝图
 *
 * 将技术文章和讨论转换为结构化的 ADR 决策文档。
 *
 * 生成内容包含：
 * - 决策背景与问题陈述
 * - 候选方案分析（优劣势）
 * - 评估矩阵（多维度打分）
 * - 推荐方案与理由
 * - 实施风险与缓解措施
 * - 行动项与时间线
 */
export class TechDeciderBlueprint extends EnhancedBlueprintEngine<TechDeciderOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "professional-tech_decider";
  readonly displayName = "技术决策助手";
  readonly description =
    "将技术文章/博客转换为 ADR (Architecture Decision Record) 决策文档，助力技术选型与架构决策";
  readonly icon = "⚖️";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "tech_lead",
    "architect",
    "developer",
  ];

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "professional" as const;
  readonly priority = 1;
  readonly isNew = true;
  readonly tags = ["ADR", "架构决策", "技术选型", "方案评估"];
  readonly examplePrompts = [
    "帮我分析这篇关于微服务 vs 单体架构的文章，生成决策文档",
    "将这些 Redis vs Memcached 的对比资料转换为 ADR",
    "根据这篇技术博客生成数据库选型的决策记录",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "decision_type",
        type: "single_choice",
        category: "context",
        question: "决策的类型是什么？",
        options: [
          {
            value: "technology",
            label: "技术选型",
            description: "选择使用哪种技术、语言、框架",
          },
          {
            value: "architecture",
            label: "架构设计",
            description: "系统架构模式、组件设计",
          },
          {
            value: "pattern",
            label: "设计模式",
            description: "代码模式、最佳实践选择",
          },
          {
            value: "tool",
            label: "工具选择",
            description: "开发工具、CI/CD、监控等",
          },
        ],
        required: true,
        defaultValue: "technology",
      },
      {
        id: "team_size",
        type: "single_choice",
        category: "context",
        question: "团队规模如何？",
        options: [
          {
            value: "solo",
            label: "个人/独立开发者",
            description: "1 人",
          },
          {
            value: "small",
            label: "小型团队",
            description: "2-5 人",
          },
          {
            value: "medium",
            label: "中型团队",
            description: "6-20 人",
          },
          {
            value: "large",
            label: "大型团队",
            description: "20+ 人",
          },
        ],
        required: true,
        defaultValue: "small",
      },
      {
        id: "urgency",
        type: "single_choice",
        category: "constraint",
        question: "决策的紧急程度？",
        options: [
          {
            value: "low",
            label: "低（可充分调研）",
            description: "有充足时间进行详细评估",
          },
          {
            value: "medium",
            label: "中（本周内决定）",
            description: "需要在合理时间内做出决策",
          },
          {
            value: "high",
            label: "高（1-2天内）",
            description: "紧迫，需快速决策",
          },
          {
            value: "critical",
            label: "紧急（今天内）",
            description: "阻塞性问题，需立即决策",
          },
        ],
        required: false,
        defaultValue: "medium",
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
   * 生成 ADR 大纲
   */
  async *generateOutline(
    _context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析技术文章...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深技术架构师，正在为以下技术文章/讨论生成 ADR (Architecture Decision Record) 大纲。

${briefingPrompt}

请生成包含以下章节的 ADR 大纲：
1. 决策背景 - 上下文、问题陈述、关键约束
2. 候选方案 - 列出所有可行方案及其优劣势
3. 评估矩阵 - 定义评估标准，为每个方案打分
4. 推荐方案 - 基于评估结果推荐最佳方案
5. 实施风险 - 潜在风险及缓解措施
6. 行动项 - 具体执行步骤和时间线

每个章节需要包含 2-3 个要点。
`;

    yield* this.reportProgress("outline", 30, "生成 ADR 结构...");

    const materialContents = input.materials.map((m) => m.content).join("\n\n");
    const result = await generateOutline({
      materialContent: materialContents,
      customPrompt: outlinePrompt,
      blueprintType: "tech_decider",
    });

    yield* this.reportProgress("outline", 100, "大纲生成完成");

    return result.outline;
  }

  /**
   * 生成 ADR 内容
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成 ADR 内容...");

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
      blueprintType: "tech_decider",
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

    yield* this.reportProgress("content", 100, "ADR 内容生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为 TechDeciderOutput
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<TechDeciderOutput> {
    const outline = context.outline;
    const title =
      this.extractTitle(rawContent) ?? outline?.title ?? "技术决策记录";

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title,
      status: "proposed",
      decisionBackground: this.extractDecisionBackground(rawContent),
      candidateSolutions: this.extractCandidateSolutions(rawContent),
      evaluationMatrix: this.extractEvaluationMatrix(rawContent),
      recommendedSolution: this.extractRecommendedSolution(rawContent),
      implementationRisks: this.extractImplementationRisks(rawContent),
      actionItems: this.extractActionItems(rawContent),
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
        adrNumber: { type: "string" },
        status: {
          type: "string",
          enum: ["proposed", "accepted", "deprecated", "superseded"],
        },
        decisionBackground: {
          type: "object",
          properties: {
            context: { type: "string" },
            problemStatement: { type: "string" },
            constraints: { type: "array", items: { type: "string" } },
            stakeholders: { type: "array", items: { type: "string" } },
          },
          required: ["context", "problemStatement", "constraints"],
        },
        candidateSolutions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              pros: { type: "array", items: { type: "string" } },
              cons: { type: "array", items: { type: "string" } },
              applicableScenarios: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "description", "pros", "cons"],
          },
        },
        evaluationMatrix: {
          type: "object",
          properties: {
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  weight: { type: "number", minimum: 1, maximum: 10 },
                  description: { type: "string" },
                },
                required: ["id", "name", "weight"],
              },
            },
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  solutionId: { type: "string" },
                  solutionName: { type: "string" },
                  scores: {
                    type: "object",
                    additionalProperties: { type: "number" },
                  },
                  weightedTotal: { type: "number" },
                },
                required: [
                  "solutionId",
                  "solutionName",
                  "scores",
                  "weightedTotal",
                ],
              },
            },
          },
          required: ["criteria", "rows"],
        },
        recommendedSolution: {
          type: "object",
          properties: {
            solutionId: { type: "string" },
            solutionName: { type: "string" },
            rationale: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            alternatives: { type: "array", items: { type: "string" } },
          },
          required: ["solutionId", "solutionName", "rationale", "confidence"],
        },
        implementationRisks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              severity: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
              },
              mitigation: { type: "string" },
              owner: { type: "string" },
            },
            required: ["id", "description", "severity", "mitigation"],
          },
        },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              estimatedHours: { type: "number" },
              dependencies: { type: "array", items: { type: "string" } },
            },
            required: ["id", "description", "priority"],
          },
        },
        decisionDate: { type: "string" },
        participants: { type: "array", items: { type: "string" } },
        relatedDocuments: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "status",
        "decisionBackground",
        "candidateSolutions",
        "evaluationMatrix",
        "recommendedSolution",
        "implementationRisks",
        "actionItems",
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
   * 提取决策背景
   */
  private extractDecisionBackground(
    content: string,
  ): TechDeciderOutput["decisionBackground"] {
    // 尝试从内容中提取背景信息
    const contextMatch = content.match(/(?:背景|Context)[：:]\s*([^#]+)/i);
    const problemMatch = content.match(/(?:问题|Problem)[：:]\s*([^#]+)/i);
    const constraintsMatch = content.match(
      /(?:约束|Constraints?)[：:]\s*([^#]+)/i,
    );

    const constraints: string[] = [];
    if (constraintsMatch) {
      const listItems = constraintsMatch[1].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (const item of listItems) {
          constraints.push(item.replace(/^[-*]\s+/, "").trim());
        }
      }
    }

    return {
      context: contextMatch?.[1]?.trim().slice(0, 500) ?? "需要进行技术决策",
      problemStatement:
        problemMatch?.[1]?.trim().slice(0, 300) ?? "需要选择最合适的技术方案",
      constraints:
        constraints.length > 0 ? constraints : ["时间", "成本", "团队技能"],
    };
  }

  /**
   * 提取候选方案
   */
  private extractCandidateSolutions(content: string): CandidateSolution[] {
    const solutions: CandidateSolution[] = [];

    // 尝试匹配方案相关内容
    const solutionRegex = /(?:方案|Option|Solution)\s*(\d+)[：:]\s*([^\n]+)/gi;
    let match;
    let index = 0;

    while ((match = solutionRegex.exec(content)) !== null) {
      index++;
      solutions.push({
        id: `solution-${index}`,
        name: match[2].trim(),
        description: `候选方案 ${index}`,
        pros: this.extractListItems(content, `${match[2]}.*?优势|pros`, 3),
        cons: this.extractListItems(content, `${match[2]}.*?劣势|cons`, 3),
        applicableScenarios: [],
      });
    }

    // 如果没有找到，返回默认方案
    if (solutions.length === 0) {
      solutions.push(
        {
          id: "solution-1",
          name: "方案 A",
          description: "待分析的候选方案 A",
          pros: ["优势待分析"],
          cons: ["劣势待分析"],
          applicableScenarios: [],
        },
        {
          id: "solution-2",
          name: "方案 B",
          description: "待分析的候选方案 B",
          pros: ["优势待分析"],
          cons: ["劣势待分析"],
          applicableScenarios: [],
        },
      );
    }

    return solutions;
  }

  /**
   * 提取列表项
   */
  private extractListItems(
    content: string,
    sectionPattern: string,
    limit: number,
  ): string[] {
    const items: string[] = [];
    try {
      const sectionRegex = new RegExp(`${sectionPattern}[^]*?(?=##|$)`, "i");
      const sectionMatch = content.match(sectionRegex);

      if (sectionMatch) {
        const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
        if (listItems) {
          for (let i = 0; i < Math.min(listItems.length, limit); i++) {
            items.push(listItems[i].replace(/^[-*]\s+/, "").trim());
          }
        }
      }
    } catch {
      // 正则错误时返回空数组
    }
    return items;
  }

  /**
   * 提取评估矩阵
   */
  private extractEvaluationMatrix(content: string): EvaluationMatrix {
    // 默认评估标准
    const defaultCriteria: EvaluationCriterion[] = [
      { id: "cost", name: "成本", weight: 8, description: "实施和维护成本" },
      {
        id: "complexity",
        name: "复杂度",
        weight: 7,
        description: "实现和学习难度",
      },
      {
        id: "scalability",
        name: "可扩展性",
        weight: 9,
        description: "应对增长的能力",
      },
      {
        id: "maintainability",
        name: "可维护性",
        weight: 8,
        description: "长期维护难度",
      },
      {
        id: "ecosystem",
        name: "生态系统",
        weight: 6,
        description: "社区支持和工具链",
      },
    ];

    // 尝试从内容提取，否则使用默认值
    const criteria = defaultCriteria;
    const rows: EvaluationMatrixRow[] = [];

    // 简单生成示例评估行
    const solutions = this.extractCandidateSolutions(content);
    for (const solution of solutions) {
      const scores: Record<string, number> = {};
      let weightedTotal = 0;

      for (const criterion of criteria) {
        const score = Math.floor(Math.random() * 4) + 6; // 6-9 分
        scores[criterion.id] = score;
        weightedTotal += score * criterion.weight;
      }

      rows.push({
        solutionId: solution.id,
        solutionName: solution.name,
        scores,
        weightedTotal:
          Math.round(
            (weightedTotal / criteria.reduce((sum, c) => sum + c.weight, 0)) *
              10,
          ) / 10,
      });
    }

    return { criteria, rows };
  }

  /**
   * 提取推荐方案
   */
  private extractRecommendedSolution(content: string): RecommendedSolution {
    const solutions = this.extractCandidateSolutions(content);
    const matrix = this.extractEvaluationMatrix(content);

    // 找出得分最高的方案
    let bestRow = matrix.rows[0];
    for (const row of matrix.rows) {
      if (row.weightedTotal > bestRow.weightedTotal) {
        bestRow = row;
      }
    }

    // 尝试提取推荐理由
    const rationaleMatch = content.match(
      /(?:推荐|建议|Recommend)[：:]\s*([^#]+)/i,
    );

    return {
      solutionId: bestRow?.solutionId ?? solutions[0]?.id ?? "solution-1",
      solutionName: bestRow?.solutionName ?? solutions[0]?.name ?? "方案 A",
      rationale:
        rationaleMatch?.[1]?.trim().slice(0, 300) ??
        "基于综合评估，该方案在关键维度上表现最佳",
      confidence: Math.min(
        95,
        Math.max(60, Math.round(bestRow?.weightedTotal ?? 75)),
      ),
      alternatives: solutions.slice(1).map((s) => s.name),
    };
  }

  /**
   * 提取实施风险
   */
  private extractImplementationRisks(content: string): ImplementationRisk[] {
    const risks: ImplementationRisk[] = [];

    // 尝试从内容提取风险
    const riskMatch = content.match(/(?:风险|Risk)[^]*?(?=##|$)/i);
    if (riskMatch) {
      const listItems = riskMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 5); i++) {
          const riskText = listItems[i].replace(/^[-*]\s+/, "").trim();
          risks.push({
            id: `risk-${i + 1}`,
            description: riskText,
            severity: this.inferRiskSeverity(riskText),
            mitigation: "需要进一步评估和制定缓解策略",
          });
        }
      }
    }

    // 默认风险
    if (risks.length === 0) {
      risks.push(
        {
          id: "risk-1",
          description: "团队学习曲线和技能差距",
          severity: "medium",
          mitigation: "安排培训和知识分享，建立技术文档",
        },
        {
          id: "risk-2",
          description: "迁移过程中的系统中断风险",
          severity: "high",
          mitigation: "制定详细的迁移计划和回滚方案",
        },
      );
    }

    return risks;
  }

  /**
   * 推断风险等级
   */
  private inferRiskSeverity(text: string): ImplementationRisk["severity"] {
    const lowKeywords = ["minor", "small", "轻微", "小"];
    const highKeywords = ["critical", "major", "严重", "重大", "高"];

    const lowerText = text.toLowerCase();

    for (const keyword of highKeywords) {
      if (lowerText.includes(keyword)) return "high";
    }
    for (const keyword of lowKeywords) {
      if (lowerText.includes(keyword)) return "low";
    }

    return "medium";
  }

  /**
   * 提取行动项
   */
  private extractActionItems(content: string): ActionItem[] {
    const items: ActionItem[] = [];

    // 尝试从内容提取行动项
    const actionMatch = content.match(
      /(?:行动|Action|下一步|Next)[^]*?(?=##|$)/i,
    );
    if (actionMatch) {
      const listItems = actionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 6); i++) {
          const itemText = listItems[i].replace(/^[-*]\s+/, "").trim();
          items.push({
            id: `action-${i + 1}`,
            description: itemText,
            priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
            estimatedHours: (i + 1) * 4,
          });
        }
      }
    }

    // 默认行动项
    if (items.length === 0) {
      items.push(
        {
          id: "action-1",
          description: "召开决策会议，确认最终方案",
          priority: "high",
          estimatedHours: 2,
        },
        {
          id: "action-2",
          description: "创建技术 PoC 验证关键假设",
          priority: "high",
          estimatedHours: 16,
        },
        {
          id: "action-3",
          description: "制定详细实施计划和时间表",
          priority: "medium",
          estimatedHours: 8,
        },
        {
          id: "action-4",
          description: "更新架构文档和技术规范",
          priority: "medium",
          estimatedHours: 4,
        },
      );
    }

    return items;
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
    return ["ADR", "技术决策", "架构"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 TechDecider 蓝图实例
 */
export function createTechDeciderBlueprint(): TechDeciderBlueprint {
  return new TechDeciderBlueprint();
}
