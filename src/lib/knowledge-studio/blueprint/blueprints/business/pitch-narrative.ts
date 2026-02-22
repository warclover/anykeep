/**
 * PitchNarrative Blueprint - 故事线专家 (Story 6.3)
 * @module knowledge-studio/blueprint/blueprints/business
 *
 * 将碎片想法整理为 BP 逐字稿。
 *
 * 目标用户: 创业者、投资经理、商务人员
 * 输入: 碎片想法、商业计划素材
 * 输出: BP 逐字稿（10分钟/5分钟/3分钟版本）
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
 * 逐字稿段落
 */
interface NarrativeSection {
  /** 段落ID */
  id: string;
  /** 段落标题 */
  title: string;
  /** 逐字稿内容 */
  script: string;
  /** 建议时长（秒） */
  suggestedDuration: number;
  /** 演讲要点 */
  keyPoints: string[];
  /** 视觉建议 */
  visualSuggestion?: string;
  /** 过渡语 */
  transitionNote?: string;
}

/**
 * 版本变体
 */
interface NarrativeVersion {
  /** 版本ID */
  versionId: string;
  /** 版本名称 */
  name: string;
  /** 目标时长（分钟） */
  targetDuration: number;
  /** 实际估算时长（分钟） */
  estimatedDuration: number;
  /** 包含的段落 */
  sections: NarrativeSection[];
  /** 总字数 */
  wordCount: number;
}

/**
 * 开场 Hook
 */
interface OpeningHook {
  /** 30秒版本 */
  thirtySecond: string;
  /** 电梯演讲版 */
  elevatorPitch: string;
  /** 关键钩子点 */
  hookPoints: string[];
}

/**
 * 团队介绍
 */
interface TeamIntro {
  /** 团队亮点 */
  highlights: string[];
  /** 核心成员介绍 */
  coreMembers: Array<{
    role: string;
    background: string;
    contribution: string;
  }>;
  /** 团队优势总结 */
  teamAdvantage: string;
}

/**
 * 融资需求
 */
interface FundingAsk {
  /** 融资金额 */
  amount: string;
  /** 融资阶段 */
  stage: string;
  /** 资金用途 */
  useOfFunds: Array<{
    category: string;
    percentage: number;
    description: string;
  }>;
  /** 里程碑目标 */
  milestones: string[];
}

/**
 * PitchNarrative 输出类型
 */
export interface PitchNarrativeOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** BP 标题 */
  title: string;
  /** 开场 Hook */
  openingHook: OpeningHook;
  /** 完整版本（10分钟/5分钟/3分钟） */
  versions: NarrativeVersion[];
  /** 团队介绍 */
  teamIntro: TeamIntro;
  /** 融资需求 */
  fundingAsk: FundingAsk;
  /** 收尾 CTA */
  closingCta: string;
  /** 融资阶段 */
  fundingStage: string;
  /** 目标投资人类型 */
  targetInvestorType: string;
  /** 行业领域 */
  industry?: string;
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * PitchNarrative 蓝图
 *
 * 将碎片想法整理为专业 BP 逐字稿。
 *
 * 生成内容包含：
 * - 开场 Hook（30秒版/电梯演讲版）
 * - 问题阐述
 * - 解决方案
 * - 商业模式
 * - 市场规模
 * - 竞争优势
 * - 团队介绍
 * - 融资需求与用途
 * - 收尾 CTA
 */
export class PitchNarrativeBlueprint extends EnhancedBlueprintEngine<PitchNarrativeOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "business-pitch_narrative";
  readonly displayName = "融资故事";
  readonly description =
    "将碎片想法整理为 BP 逐字稿，提供 10/5/3 分钟版本，每段标注时长";
  readonly icon = "🎤";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "entrepreneur",
    "investor",
    "marketer",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "business" as const;
  readonly priority = 3;
  readonly isNew = true;
  readonly tags = ["融资", "BP", "路演", "创业", "逐字稿"];
  readonly examplePrompts = [
    "帮我整理这些想法成为路演稿",
    "根据这些素材生成 BP 逐字稿",
    "准备一个 5 分钟的融资演讲",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "funding_stage",
        type: "single_choice",
        category: "context",
        question: "融资阶段？",
        options: [
          {
            value: "seed",
            label: "种子轮",
            description: "天使轮/种子轮融资",
          },
          {
            value: "pre_a",
            label: "Pre-A轮",
            description: "Pre-A/A轮融资",
          },
          {
            value: "series_a",
            label: "A轮",
            description: "A轮融资",
          },
          {
            value: "series_b_plus",
            label: "B轮及以后",
            description: "B轮/C轮/D轮",
          },
        ],
        required: true,
        defaultValue: "seed",
      },
      {
        id: "investor_type",
        type: "single_choice",
        category: "context",
        question: "目标投资人类型？",
        options: [
          {
            value: "angel",
            label: "天使投资人",
            description: "个人天使投资人",
          },
          {
            value: "vc",
            label: "风险投资",
            description: "VC 机构",
          },
          {
            value: "cvc",
            label: "战略投资",
            description: "CVC/产业资本",
          },
          {
            value: "pe",
            label: "私募股权",
            description: "PE 基金",
          },
        ],
        required: true,
        defaultValue: "vc",
      },
      {
        id: "pitch_duration",
        type: "single_choice",
        category: "constraint",
        question: "主要版本时长？",
        options: [
          {
            value: "3min",
            label: "3分钟",
            description: "适合路演比赛",
          },
          {
            value: "5min",
            label: "5分钟",
            description: "适合投资人初次见面",
          },
          {
            value: "10min",
            label: "10分钟",
            description: "适合正式路演",
          },
        ],
        required: false,
        defaultValue: "5min",
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
   * 生成 BP 大纲
   */
  async *generateOutline(
    _context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析创业素材...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深融资顾问，正在为创业者准备 BP 路演逐字稿大纲。

${briefingPrompt}

请生成包含以下结构的大纲：
1. 开场 Hook - 30秒抓住投资人注意力
2. 问题阐述 - 市场痛点和用户需求
3. 解决方案 - 产品/服务如何解决问题
4. 商业模式 - 如何赚钱，收入来源
5. 市场规模 - TAM/SAM/SOM 分析
6. 竞争优势 - 护城河和差异化
7. 团队介绍 - 核心团队背景和能力
8. 融资需求 - 金额、用途、里程碑
9. 收尾 CTA - 行动呼吁

每个章节需要：
- 标注建议时长
- 提供关键讲述点
- 设计过渡语
`;

    yield* this.reportProgress("outline", 30, "构建叙事框架...");

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
   * 基于大纲生成逐字稿
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成逐字稿...");

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
          chunk.data.step ?? "撰写中...",
        );
      }
    }

    yield* this.reportProgress("content", 100, "逐字稿生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<PitchNarrativeOutput> {
    const outline = context.outline;
    const sections = this.extractSections(rawContent);

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: outline?.title ?? this.extractTitle(rawContent),
      openingHook: this.extractOpeningHook(rawContent),
      versions: this.generateVersions(sections),
      teamIntro: this.extractTeamIntro(rawContent),
      fundingAsk: this.extractFundingAsk(rawContent),
      closingCta: this.extractClosingCta(rawContent),
      fundingStage: this.extractFundingStage(rawContent),
      targetInvestorType: this.extractInvestorType(rawContent),
      industry: this.extractIndustry(rawContent),
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
        openingHook: {
          type: "object",
          properties: {
            thirtySecond: { type: "string" },
            elevatorPitch: { type: "string" },
            hookPoints: { type: "array", items: { type: "string" } },
          },
          required: ["thirtySecond", "elevatorPitch", "hookPoints"],
        },
        versions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              versionId: { type: "string" },
              name: { type: "string" },
              targetDuration: { type: "number" },
              estimatedDuration: { type: "number" },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    script: { type: "string" },
                    suggestedDuration: { type: "number" },
                    keyPoints: { type: "array", items: { type: "string" } },
                    visualSuggestion: { type: "string" },
                    transitionNote: { type: "string" },
                  },
                  required: [
                    "id",
                    "title",
                    "script",
                    "suggestedDuration",
                    "keyPoints",
                  ],
                },
              },
              wordCount: { type: "number" },
            },
            required: [
              "versionId",
              "name",
              "targetDuration",
              "estimatedDuration",
              "sections",
              "wordCount",
            ],
          },
        },
        teamIntro: {
          type: "object",
          properties: {
            highlights: { type: "array", items: { type: "string" } },
            coreMembers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  background: { type: "string" },
                  contribution: { type: "string" },
                },
                required: ["role", "background", "contribution"],
              },
            },
            teamAdvantage: { type: "string" },
          },
          required: ["highlights", "coreMembers", "teamAdvantage"],
        },
        fundingAsk: {
          type: "object",
          properties: {
            amount: { type: "string" },
            stage: { type: "string" },
            useOfFunds: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  percentage: { type: "number" },
                  description: { type: "string" },
                },
                required: ["category", "percentage", "description"],
              },
            },
            milestones: { type: "array", items: { type: "string" } },
          },
          required: ["amount", "stage", "useOfFunds", "milestones"],
        },
        closingCta: { type: "string" },
        fundingStage: { type: "string" },
        targetInvestorType: { type: "string" },
        industry: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "openingHook",
        "versions",
        "teamIntro",
        "fundingAsk",
        "closingCta",
        "fundingStage",
        "targetInvestorType",
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
    const titleMatch = content.match(/(?:标题|Title|项目)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? "融资路演逐字稿";
  }

  /**
   * 提取开场 Hook
   */
  private extractOpeningHook(content: string): OpeningHook {
    const hookMatch = content.match(
      /(?:开场|Hook)[：:]([\s\S]*?)(?=问题|痛点|$)/i,
    );
    const hookContent = hookMatch?.[1]?.trim() ?? "";

    const points =
      hookContent
        .match(/[-•]\s*(.+)/g)
        ?.map((p) => p.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean) ?? [];

    return {
      thirtySecond: this.extractThirtySecondHook(hookContent),
      elevatorPitch: this.extractElevatorPitch(hookContent),
      hookPoints: points.length > 0 ? points : ["待完善"],
    };
  }

  /**
   * 提取 30 秒 Hook
   */
  private extractThirtySecondHook(content: string): string {
    const match = content.match(/(?:30秒|三十秒)[：:]\s*(.+)/i);
    if (match) return match[1].trim();

    // 取前两句作为 30 秒版
    const sentences = content.split(/[。！？]/).filter(Boolean);
    return sentences.slice(0, 2).join("。") + "。" || "待完善";
  }

  /**
   * 提取电梯演讲
   */
  private extractElevatorPitch(content: string): string {
    const match = content.match(/(?:电梯|一句话)[：:]\s*(.+)/i);
    if (match) return match[1].trim();

    const sentences = content.split(/[。！？]/).filter(Boolean);
    return sentences[0]?.trim() || "待完善";
  }

  /**
   * 提取段落
   */
  private extractSections(content: string): NarrativeSection[] {
    const sectionPatterns = [
      {
        id: "opening",
        title: "开场 Hook",
        pattern: /(?:开场|Hook)[：:]([\s\S]*?)(?=问题|痛点|解决|$)/i,
      },
      {
        id: "problem",
        title: "问题阐述",
        pattern: /(?:问题|痛点)[：:]([\s\S]*?)(?=解决|方案|$)/i,
      },
      {
        id: "solution",
        title: "解决方案",
        pattern: /(?:解决|方案)[：:]([\s\S]*?)(?=商业|模式|$)/i,
      },
      {
        id: "business_model",
        title: "商业模式",
        pattern: /(?:商业|模式)[：:]([\s\S]*?)(?=市场|规模|$)/i,
      },
      {
        id: "market",
        title: "市场规模",
        pattern: /(?:市场|规模)[：:]([\s\S]*?)(?=竞争|优势|$)/i,
      },
      {
        id: "competitive",
        title: "竞争优势",
        pattern: /(?:竞争|优势)[：:]([\s\S]*?)(?=团队|$)/i,
      },
      {
        id: "team",
        title: "团队介绍",
        pattern: /(?:团队)[：:]([\s\S]*?)(?=融资|需求|$)/i,
      },
      {
        id: "funding",
        title: "融资需求",
        pattern: /(?:融资|需求)[：:]([\s\S]*?)(?=收尾|CTA|$)/i,
      },
      {
        id: "cta",
        title: "收尾 CTA",
        pattern: /(?:收尾|CTA)[：:]([\s\S]*?)$/i,
      },
    ];

    const sections: NarrativeSection[] = [];

    for (const { id, title, pattern } of sectionPatterns) {
      const match = content.match(pattern);
      if (match) {
        const sectionContent = match[1]?.trim() ?? "";
        const wordCount = sectionContent.length;
        // 按 150 字/分钟估算时长
        const duration = Math.max(30, Math.round((wordCount / 150) * 60));

        sections.push({
          id,
          title,
          script: sectionContent || "待完善",
          suggestedDuration: duration,
          keyPoints: this.extractKeyPoints(sectionContent),
          visualSuggestion: this.extractVisualSuggestion(sectionContent),
        });
      }
    }

    // 确保至少有基本段落
    if (sections.length === 0) {
      sections.push(
        {
          id: "opening",
          title: "开场 Hook",
          script: "待完善",
          suggestedDuration: 30,
          keyPoints: [],
        },
        {
          id: "problem",
          title: "问题阐述",
          script: "待完善",
          suggestedDuration: 60,
          keyPoints: [],
        },
        {
          id: "solution",
          title: "解决方案",
          script: "待完善",
          suggestedDuration: 60,
          keyPoints: [],
        },
        {
          id: "cta",
          title: "收尾 CTA",
          script: "待完善",
          suggestedDuration: 30,
          keyPoints: [],
        },
      );
    }

    return sections;
  }

  /**
   * 提取关键点
   */
  private extractKeyPoints(content: string): string[] {
    const points = content.match(/[-•]\s*(.+)/g);
    if (points) {
      return points
        .map((p) => p.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * 提取视觉建议
   */
  private extractVisualSuggestion(content: string): string | undefined {
    const match = content.match(/(?:视觉|PPT|幻灯片)[：:]\s*(.+)/i);
    return match?.[1]?.trim();
  }

  /**
   * 生成不同时长版本
   */
  private generateVersions(sections: NarrativeSection[]): NarrativeVersion[] {
    const totalDuration = sections.reduce(
      (sum, s) => sum + s.suggestedDuration,
      0,
    );
    const totalWords = sections.reduce((sum, s) => sum + s.script.length, 0);

    const versions: NarrativeVersion[] = [];

    // 10 分钟版本（完整版）
    versions.push({
      versionId: "v10min",
      name: "10分钟完整版",
      targetDuration: 10,
      estimatedDuration: Math.round((totalDuration / 60) * 10) / 10,
      sections: sections,
      wordCount: totalWords,
    });

    // 5 分钟版本（精简版）
    const fiveMinSections = this.createCondensedVersion(sections, 5);
    versions.push({
      versionId: "v5min",
      name: "5分钟精简版",
      targetDuration: 5,
      estimatedDuration:
        Math.round(
          (fiveMinSections.reduce((sum, s) => sum + s.suggestedDuration, 0) /
            60) *
            10,
        ) / 10,
      sections: fiveMinSections,
      wordCount: fiveMinSections.reduce((sum, s) => sum + s.script.length, 0),
    });

    // 3 分钟版本（快速版）
    const threeMinSections = this.createCondensedVersion(sections, 3);
    versions.push({
      versionId: "v3min",
      name: "3分钟快速版",
      targetDuration: 3,
      estimatedDuration:
        Math.round(
          (threeMinSections.reduce((sum, s) => sum + s.suggestedDuration, 0) /
            60) *
            10,
        ) / 10,
      sections: threeMinSections,
      wordCount: threeMinSections.reduce((sum, s) => sum + s.script.length, 0),
    });

    return versions;
  }

  /**
   * 创建精简版本
   */
  private createCondensedVersion(
    sections: NarrativeSection[],
    targetMinutes: number,
  ): NarrativeSection[] {
    const _targetSeconds = targetMinutes * 60;
    const compressionRatio = targetMinutes / 10;

    // 核心段落（必须保留）
    const coreSectionIds = ["opening", "problem", "solution", "cta"];

    // 次要段落（可精简）- 留作扩展用
    const _secondarySectionIds = [
      "business_model",
      "market",
      "competitive",
      "team",
      "funding",
    ];

    const result: NarrativeSection[] = [];

    for (const section of sections) {
      const isCore = coreSectionIds.includes(section.id);
      const newDuration = Math.round(
        section.suggestedDuration * (isCore ? 0.8 : compressionRatio),
      );

      if (targetMinutes <= 3 && !isCore) {
        // 3 分钟版本只保留核心内容
        continue;
      }

      result.push({
        ...section,
        suggestedDuration: Math.max(15, newDuration),
        script: this.condenseScript(section.script, compressionRatio),
      });
    }

    return result;
  }

  /**
   * 压缩脚本
   */
  private condenseScript(script: string, ratio: number): string {
    if (ratio >= 0.8) return script;

    const targetLength = Math.round(script.length * ratio);
    const sentences = script.split(/[。！？]/).filter(Boolean);

    let result = "";
    for (const sentence of sentences) {
      if (result.length + sentence.length <= targetLength) {
        result += sentence + "。";
      } else {
        break;
      }
    }

    return result || script.slice(0, targetLength);
  }

  /**
   * 提取团队介绍
   */
  private extractTeamIntro(content: string): TeamIntro {
    const teamMatch = content.match(
      /(?:团队)[：:]([\s\S]*?)(?=融资|需求|收尾|$)/i,
    );
    const teamContent = teamMatch?.[1]?.trim() ?? "";

    const highlights =
      teamContent
        .match(/[-•]\s*(.+)/g)
        ?.map((p) => p.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean) ?? [];

    return {
      highlights: highlights.length > 0 ? highlights : ["待完善"],
      coreMembers: this.extractCoreMembers(teamContent),
      teamAdvantage: this.extractTeamAdvantage(teamContent),
    };
  }

  /**
   * 提取核心成员
   */
  private extractCoreMembers(
    content: string,
  ): Array<{ role: string; background: string; contribution: string }> {
    const members: Array<{
      role: string;
      background: string;
      contribution: string;
    }> = [];

    const memberPatterns = [/(?:CEO|创始人|CTO|COO|CFO)[：:]\s*(.+)/gi];

    for (const pattern of memberPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const roleMatch = match[0].match(/^(CEO|创始人|CTO|COO|CFO)/i);
        members.push({
          role: roleMatch?.[1] ?? "核心成员",
          background: match[1]?.trim() ?? "待完善",
          contribution: "待完善",
        });
      }
    }

    if (members.length === 0) {
      members.push({
        role: "创始人",
        background: "待完善",
        contribution: "待完善",
      });
    }

    return members;
  }

  /**
   * 提取团队优势
   */
  private extractTeamAdvantage(content: string): string {
    const match = content.match(/(?:优势|特点|亮点)[：:]\s*(.+)/i);
    return match?.[1]?.trim() ?? "团队具备丰富的行业经验和执行力";
  }

  /**
   * 提取融资需求
   */
  private extractFundingAsk(content: string): FundingAsk {
    const fundingMatch = content.match(
      /(?:融资|需求)[：:]([\s\S]*?)(?=收尾|CTA|$)/i,
    );
    const fundingContent = fundingMatch?.[1]?.trim() ?? "";

    const amountMatch = fundingContent.match(/(?:金额|规模)[：:]\s*(.+)/i);
    const stageMatch = fundingContent.match(/(?:阶段|轮次)[：:]\s*(.+)/i);

    return {
      amount: amountMatch?.[1]?.trim() ?? "待定",
      stage: stageMatch?.[1]?.trim() ?? "种子轮",
      useOfFunds: this.extractUseOfFunds(fundingContent),
      milestones: this.extractMilestones(fundingContent),
    };
  }

  /**
   * 提取资金用途
   */
  private extractUseOfFunds(
    content: string,
  ): Array<{ category: string; percentage: number; description: string }> {
    const uses: Array<{
      category: string;
      percentage: number;
      description: string;
    }> = [];

    const usePattern = /[-•]\s*(.+?)[：:]\s*(\d+)%/g;
    const matches = content.matchAll(usePattern);

    for (const match of matches) {
      uses.push({
        category: match[1].trim(),
        percentage: parseInt(match[2], 10),
        description: match[1].trim(),
      });
    }

    if (uses.length === 0) {
      uses.push(
        { category: "研发", percentage: 50, description: "产品研发和技术迭代" },
        { category: "市场", percentage: 30, description: "市场推广和用户获取" },
        { category: "运营", percentage: 20, description: "团队扩充和日常运营" },
      );
    }

    return uses;
  }

  /**
   * 提取里程碑
   */
  private extractMilestones(content: string): string[] {
    const milestones =
      content
        .match(/(?:里程碑|目标|计划)[：:]([\s\S]*?)(?=\n\n|$)/i)?.[1]
        ?.match(/[-•]\s*(.+)/g)
        ?.map((m) => m.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean) ?? [];

    if (milestones.length === 0) {
      return ["产品上线", "获取种子用户", "验证商业模式"];
    }

    return milestones;
  }

  /**
   * 提取收尾 CTA
   */
  private extractClosingCta(content: string): string {
    const ctaMatch = content.match(/(?:收尾|CTA)[：:]\s*(.+)/i);
    return ctaMatch?.[1]?.trim() ?? "期待与您进一步交流，共创未来！";
  }

  /**
   * 提取融资阶段
   */
  private extractFundingStage(content: string): string {
    const stageMatch = content.match(/(?:阶段|轮次)[：:]\s*(.+)/i);
    return stageMatch?.[1]?.trim() ?? "种子轮";
  }

  /**
   * 提取投资人类型
   */
  private extractInvestorType(content: string): string {
    const typeMatch = content.match(/(?:投资人|投资机构)[：:]\s*(.+)/i);
    return typeMatch?.[1]?.trim() ?? "风险投资";
  }

  /**
   * 提取行业
   */
  private extractIndustry(content: string): string | undefined {
    const industryMatch = content.match(/(?:行业|领域)[：:]\s*(.+)/i);
    return industryMatch?.[1]?.trim();
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
    return ["融资", "BP", "路演"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 PitchNarrative 蓝图实例
 */
export function createPitchNarrativeBlueprint(): PitchNarrativeBlueprint {
  return new PitchNarrativeBlueprint();
}
