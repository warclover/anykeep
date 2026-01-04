/**
 * PrdMaster Blueprint - PRD大师 (Story 4.3)
 * @module knowledge-studio/blueprint/blueprints/geek
 *
 * 将需求草稿和竞品资料转换为结构化 PRD 文档。
 *
 * 目标用户: 产品经理、创业者
 * 输入: 需求草稿 + 竞品资料
 * 输出: 结构化 PRD（用户故事、功能列表、验收标准）
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
 * 用户画像
 */
interface UserPersona {
  /** 画像ID */
  id: string;
  /** 用户类型名称 */
  name: string;
  /** 用户描述 */
  description: string;
  /** 核心需求 */
  coreNeeds: string[];
  /** 痛点 */
  painPoints: string[];
  /** 使用场景 */
  scenarios?: string[];
}

/**
 * 用户故事
 */
interface UserStory {
  /** 故事ID */
  id: string;
  /** 故事标题 */
  title: string;
  /** 作为...我想要...以便... */
  asA: string;
  iWantTo: string;
  soThat: string;
  /** 优先级 */
  priority: "must" | "should" | "could" | "wont";
  /** 估算工作量（故事点） */
  storyPoints?: number;
  /** 关联的用户画像ID */
  personaId?: string;
  /** 验收标准列表 */
  acceptanceCriteria: AcceptanceCriterion[];
}

/**
 * 验收标准
 */
interface AcceptanceCriterion {
  /** 标准ID */
  id: string;
  /** Given-When-Then 格式 */
  given: string;
  when: string;
  then: string;
  /** 备注 */
  notes?: string;
}

/**
 * 功能模块
 */
interface FeatureModule {
  /** 模块ID */
  id: string;
  /** 模块名称 */
  name: string;
  /** 模块描述 */
  description: string;
  /** 包含的功能列表 */
  features: Feature[];
  /** 优先级 */
  priority: "p0" | "p1" | "p2" | "p3";
  /** 依赖的模块ID */
  dependencies?: string[];
}

/**
 * 功能项
 */
interface Feature {
  /** 功能ID */
  id: string;
  /** 功能名称 */
  name: string;
  /** 功能描述 */
  description: string;
  /** 功能类型 */
  type: "core" | "enhancement" | "nice-to-have";
  /** 关联的用户故事ID */
  relatedStoryIds?: string[];
  /** 技术备注 */
  technicalNotes?: string;
}

/**
 * 竞品分析
 */
interface CompetitorAnalysis {
  /** 竞品名称 */
  name: string;
  /** 竞品链接 */
  url?: string;
  /** 优势 */
  strengths: string[];
  /** 劣势 */
  weaknesses: string[];
  /** 差异化点 */
  differentiators?: string[];
}

/**
 * 里程碑
 */
interface Milestone {
  /** 里程碑ID */
  id: string;
  /** 里程碑名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 包含的功能模块ID */
  moduleIds: string[];
  /** 目标日期（可选） */
  targetDate?: string;
  /** 预估工期（周） */
  estimatedWeeks?: number;
}

/**
 * PrdMaster 输出类型
 */
export interface PrdMasterOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 产品名称 */
  productName: string;
  /** 产品愿景 */
  productVision: string;
  /** 问题陈述 */
  problemStatement: string;
  /** 目标用户画像 */
  userPersonas: UserPersona[];
  /** 用户故事列表 */
  userStories: UserStory[];
  /** 功能模块列表 */
  featureModules: FeatureModule[];
  /** 竞品分析（如有） */
  competitorAnalysis?: CompetitorAnalysis[];
  /** 里程碑规划 */
  milestones: Milestone[];
  /** 非功能性需求 */
  nonFunctionalRequirements?: string[];
  /** 风险和假设 */
  risksAndAssumptions?: string[];
  /** 开放问题 */
  openQuestions?: string[];
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * PrdMaster 蓝图
 *
 * 将需求草稿和竞品资料转换为专业的 PRD 文档。
 *
 * 生成内容包含：
 * - 产品愿景和问题陈述
 * - 用户画像和使用场景
 * - 用户故事（含验收标准）
 * - 功能模块和优先级排序
 * - 里程碑规划
 */
export class PrdMasterBlueprint extends EnhancedBlueprintEngine<PrdMasterOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "geek-prd_master";
  readonly displayName = "PRD大师";
  readonly description =
    "将需求草稿和竞品资料转换为结构化 PRD，包含用户故事、功能列表和验收标准";
  readonly icon = "📋";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "product_manager",
    "developer",
    "architect",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "geek" as const;
  readonly priority = 3; // P0 高优先级
  readonly isNew = true;
  readonly tags = ["PRD", "产品", "需求", "用户故事"];
  readonly examplePrompts = [
    "根据这些需求草稿生成 PRD",
    "分析竞品并输出差异化 PRD",
    "将用户反馈整理成产品需求文档",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "product_stage",
        type: "single_choice",
        category: "context",
        question: "产品当前阶段？",
        options: [
          {
            value: "concept",
            label: "概念验证",
            description: "从0到1，验证想法可行性",
          },
          { value: "mvp", label: "MVP 开发", description: "最小可行产品" },
          {
            value: "growth",
            label: "增长迭代",
            description: "已上线，持续优化",
          },
          { value: "mature", label: "成熟产品", description: "大规模功能扩展" },
        ],
        required: true,
        defaultValue: "mvp",
      },
      {
        id: "prd_focus",
        type: "multi_choice",
        category: "objective",
        question: "PRD 的重点内容？",
        options: [
          {
            value: "user_stories",
            label: "用户故事",
            description: "详细的 As a / I want / So that",
          },
          {
            value: "features",
            label: "功能列表",
            description: "结构化的功能模块",
          },
          {
            value: "acceptance",
            label: "验收标准",
            description: "Given/When/Then 格式",
          },
          {
            value: "roadmap",
            label: "里程碑规划",
            description: "版本和时间规划",
          },
        ],
        required: true,
        defaultValue: ["user_stories", "features"],
      },
      {
        id: "detail_level",
        type: "single_choice",
        category: "constraint",
        question: "PRD 详细程度？",
        options: [
          {
            value: "high_level",
            label: "概要级",
            description: "战略方向和核心功能",
          },
          {
            value: "detailed",
            label: "详细级",
            description: "包含验收标准和技术备注",
          },
          {
            value: "implementation",
            label: "实现级",
            description: "可直接用于开发",
          },
        ],
        required: false,
        defaultValue: "detailed",
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
   * 生成 PRD 大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析需求素材...");

    // 构建大纲生成配置
    const _briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深产品经理，正在为以下需求素材生成 PRD 大纲。

${briefingPrompt}

请生成包含以下部分的 PRD 大纲：

1. **产品愿景** - 一句话描述产品价值
2. **问题陈述** - 目标用户面临的核心问题
3. **用户画像** (1-3 个)
   - 用户类型、核心需求、痛点
4. **用户故事** (5-10 个)
   - 使用 As a / I want / So that 格式
   - 按 MoSCoW 优先级排序
5. **功能模块** (3-5 个)
   - 模块名称、包含功能、优先级
6. **里程碑规划** (2-4 个)
   - 阶段目标、包含模块

每个部分需要包含关键要点。
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
    yield* this.reportProgress("content", 10, "开始生成 PRD 内容...");

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
  ): Promise<PrdMasterOutput> {
    const outline = context.outline;

    // 解析各部分内容
    const productName = this.extractProductName(rawContent, outline);
    const productVision = this.extractSection(rawContent, "产品愿景", "Vision");
    const problemStatement = this.extractSection(
      rawContent,
      "问题陈述",
      "Problem",
    );
    const userPersonas = this.parseUserPersonas(rawContent);
    const userStories = this.parseUserStories(rawContent);
    const featureModules = this.parseFeatureModules(rawContent);
    const milestones = this.parseMilestones(rawContent);
    const competitorAnalysis = this.parseCompetitorAnalysis(rawContent);

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      productName,
      productVision,
      problemStatement,
      userPersonas,
      userStories,
      featureModules,
      competitorAnalysis,
      milestones,
      nonFunctionalRequirements: this.extractListItems(
        rawContent,
        "非功能性需求",
      ),
      risksAndAssumptions: this.extractListItems(rawContent, "风险"),
      openQuestions: this.extractListItems(rawContent, "开放问题"),
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
        productName: { type: "string" },
        productVision: { type: "string" },
        problemStatement: { type: "string" },
        userPersonas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              coreNeeds: { type: "array", items: { type: "string" } },
              painPoints: { type: "array", items: { type: "string" } },
              scenarios: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "description", "coreNeeds", "painPoints"],
          },
        },
        userStories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              asA: { type: "string" },
              iWantTo: { type: "string" },
              soThat: { type: "string" },
              priority: {
                type: "string",
                enum: ["must", "should", "could", "wont"],
              },
              storyPoints: { type: "number" },
              personaId: { type: "string" },
              acceptanceCriteria: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    given: { type: "string" },
                    when: { type: "string" },
                    then: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["id", "given", "when", "then"],
                },
              },
            },
            required: [
              "id",
              "title",
              "asA",
              "iWantTo",
              "soThat",
              "priority",
              "acceptanceCriteria",
            ],
          },
        },
        featureModules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              features: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["core", "enhancement", "nice-to-have"],
                    },
                    relatedStoryIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                    technicalNotes: { type: "string" },
                  },
                  required: ["id", "name", "description", "type"],
                },
              },
              priority: { type: "string", enum: ["p0", "p1", "p2", "p3"] },
              dependencies: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "description", "features", "priority"],
          },
        },
        competitorAnalysis: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              url: { type: "string", format: "uri" },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              differentiators: { type: "array", items: { type: "string" } },
            },
            required: ["name", "strengths", "weaknesses"],
          },
        },
        milestones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              moduleIds: { type: "array", items: { type: "string" } },
              targetDate: { type: "string" },
              estimatedWeeks: { type: "number" },
            },
            required: ["id", "name", "description", "moduleIds"],
          },
        },
        nonFunctionalRequirements: { type: "array", items: { type: "string" } },
        risksAndAssumptions: { type: "array", items: { type: "string" } },
        openQuestions: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "productName",
        "productVision",
        "problemStatement",
        "userPersonas",
        "userStories",
        "featureModules",
        "milestones",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 提取产品名称
   */
  private extractProductName(
    content: string,
    outline?: BlueprintOutline,
  ): string {
    const nameMatch = content.match(/(?:产品名称|Product Name)[：:]\s*(.+)/i);
    if (nameMatch) return nameMatch[1].trim();
    return outline?.title ?? "新产品";
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
   * 解析用户画像
   */
  private parseUserPersonas(content: string): UserPersona[] {
    const personas: UserPersona[] = [];
    const sectionMatch = content.match(
      /(?:用户画像|User Personas?)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      // 匹配画像块
      const personaBlocks = sectionMatch[0].split(/###\s*/);
      personaBlocks.slice(1).forEach((block, index) => {
        const lines = block.trim().split("\n");
        const name = lines[0].trim();
        const description =
          lines
            .slice(1)
            .find((l) => l.trim() && !l.startsWith("-"))
            ?.trim() ?? "";
        const coreNeeds = this.extractListFromBlock(block, "核心需求", "needs");
        const painPoints = this.extractListFromBlock(block, "痛点", "pain");

        personas.push({
          id: `persona-${index + 1}`,
          name,
          description,
          coreNeeds: coreNeeds.length > 0 ? coreNeeds : ["待补充"],
          painPoints: painPoints.length > 0 ? painPoints : ["待补充"],
        });
      });
    }

    // 默认画像
    if (personas.length === 0) {
      personas.push({
        id: "persona-1",
        name: "核心用户",
        description: "产品的主要目标用户",
        coreNeeds: ["待分析"],
        painPoints: ["待分析"],
      });
    }

    return personas;
  }

  /**
   * 从块中提取列表
   */
  private extractListFromBlock(block: string, ...keywords: string[]): string[] {
    const items: string[] = [];
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[：:][^]*?(?=\\n[^-]|$)`, "i");
      const match = block.match(regex);
      if (match) {
        const listItems = match[0].match(/[-*]\s+(.+)/g);
        if (listItems) {
          listItems.forEach((item) => {
            items.push(item.replace(/^[-*]\s+/, "").trim());
          });
        }
      }
    }
    return items;
  }

  /**
   * 解析用户故事
   */
  private parseUserStories(content: string): UserStory[] {
    const stories: UserStory[] = [];
    const sectionMatch = content.match(
      /(?:用户故事|User Stories?)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      // 匹配 As a / I want / So that 模式
      const storyRegex =
        /(?:As a|作为)\s+([^,，]+)[,，]\s*(?:I want|我想要?)\s+([^,，]+)[,，]\s*(?:So that|以便)\s+([^.。\n]+)/gi;
      const matches = [...sectionMatch[0].matchAll(storyRegex)];

      matches.forEach((match, index) => {
        stories.push({
          id: `story-${index + 1}`,
          title: `故事 ${index + 1}`,
          asA: match[1].trim(),
          iWantTo: match[2].trim(),
          soThat: match[3].trim(),
          priority: this.inferPriority(match[0]),
          acceptanceCriteria: this.extractAcceptanceCriteria(
            sectionMatch[0],
            index + 1,
          ),
        });
      });
    }

    // 默认故事
    if (stories.length === 0) {
      stories.push({
        id: "story-1",
        title: "核心用户故事",
        asA: "用户",
        iWantTo: "使用核心功能",
        soThat: "解决主要问题",
        priority: "must",
        acceptanceCriteria: [
          {
            id: "ac-1-1",
            given: "用户已登录",
            when: "用户执行核心操作",
            then: "系统完成预期响应",
          },
        ],
      });
    }

    return stories;
  }

  /**
   * 推断优先级
   */
  private inferPriority(text: string): UserStory["priority"] {
    if (/必须|Must|P0|核心/i.test(text)) return "must";
    if (/应该|Should|P1|重要/i.test(text)) return "should";
    if (/可以|Could|P2|可选/i.test(text)) return "could";
    if (/不做|Won't|P3/i.test(text)) return "wont";
    return "should";
  }

  /**
   * 提取验收标准
   */
  private extractAcceptanceCriteria(
    content: string,
    storyIndex: number,
  ): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];

    // 匹配 Given/When/Then 模式
    const gwtRegex =
      /(?:Given|假设)\s+([^,，]+)[,，]\s*(?:When|当)\s+([^,，]+)[,，]\s*(?:Then|则|那么)\s+([^.。\n]+)/gi;
    const matches = [...content.matchAll(gwtRegex)];

    matches.slice(0, 3).forEach((match, index) => {
      criteria.push({
        id: `ac-${storyIndex}-${index + 1}`,
        given: match[1].trim(),
        when: match[2].trim(),
        then: match[3].trim(),
      });
    });

    // 默认验收标准
    if (criteria.length === 0) {
      criteria.push({
        id: `ac-${storyIndex}-1`,
        given: "前置条件满足",
        when: "用户执行操作",
        then: "系统返回预期结果",
      });
    }

    return criteria;
  }

  /**
   * 解析功能模块
   */
  private parseFeatureModules(content: string): FeatureModule[] {
    const modules: FeatureModule[] = [];
    const sectionMatch = content.match(
      /(?:功能模块|Feature Modules?|功能列表)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      const moduleBlocks = sectionMatch[0].split(/###\s*/);
      moduleBlocks.slice(1).forEach((block, index) => {
        const lines = block.trim().split("\n");
        const name = lines[0].trim();
        const description =
          lines
            .slice(1)
            .find((l) => l.trim() && !l.startsWith("-"))
            ?.trim() ?? "";
        const featureItems = this.extractListItems(block, "功能", "feature");

        const features: Feature[] = featureItems.map((item, idx) => ({
          id: `feature-${index + 1}-${idx + 1}`,
          name: item,
          description: item,
          type: "core" as const,
        }));

        modules.push({
          id: `module-${index + 1}`,
          name,
          description,
          features:
            features.length > 0
              ? features
              : [
                  {
                    id: `feature-${index + 1}-1`,
                    name: "待定义",
                    description: "待定义",
                    type: "core",
                  },
                ],
          priority: this.inferModulePriority(block),
        });
      });
    }

    // 默认模块
    if (modules.length === 0) {
      modules.push({
        id: "module-1",
        name: "核心功能",
        description: "产品核心功能模块",
        features: [
          {
            id: "feature-1-1",
            name: "主要功能",
            description: "待细化",
            type: "core",
          },
        ],
        priority: "p0",
      });
    }

    return modules;
  }

  /**
   * 推断模块优先级
   */
  private inferModulePriority(text: string): FeatureModule["priority"] {
    if (/P0|核心|必须/i.test(text)) return "p0";
    if (/P1|重要|优先/i.test(text)) return "p1";
    if (/P2|次要/i.test(text)) return "p2";
    return "p3";
  }

  /**
   * 解析里程碑
   */
  private parseMilestones(content: string): Milestone[] {
    const milestones: Milestone[] = [];
    const sectionMatch = content.match(
      /(?:里程碑|Milestones?|路线图|Roadmap)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      const milestoneBlocks = sectionMatch[0].split(/###\s*/);
      milestoneBlocks.slice(1).forEach((block, index) => {
        const lines = block.trim().split("\n");
        const name = lines[0].trim();
        const description =
          lines
            .slice(1)
            .find((l) => l.trim() && !l.startsWith("-"))
            ?.trim() ?? "";

        milestones.push({
          id: `milestone-${index + 1}`,
          name,
          description,
          moduleIds: [`module-${index + 1}`],
          estimatedWeeks: this.extractWeeks(block),
        });
      });
    }

    // 默认里程碑
    if (milestones.length === 0) {
      milestones.push({
        id: "milestone-1",
        name: "MVP 发布",
        description: "最小可行产品发布",
        moduleIds: ["module-1"],
        estimatedWeeks: 4,
      });
    }

    return milestones;
  }

  /**
   * 提取工期周数
   */
  private extractWeeks(content: string): number {
    const weeksMatch = content.match(/(\d+)\s*(?:周|weeks?)/i);
    return weeksMatch ? parseInt(weeksMatch[1], 10) : 4;
  }

  /**
   * 解析竞品分析
   */
  private parseCompetitorAnalysis(
    content: string,
  ): CompetitorAnalysis[] | undefined {
    const competitors: CompetitorAnalysis[] = [];
    const sectionMatch = content.match(
      /(?:竞品分析|Competitor Analysis)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      const competitorBlocks = sectionMatch[0].split(/###\s*/);
      competitorBlocks.slice(1).forEach((block) => {
        const lines = block.trim().split("\n");
        const name = lines[0].trim();
        const strengths = this.extractListFromBlock(block, "优势", "strength");
        const weaknesses = this.extractListFromBlock(block, "劣势", "weakness");

        competitors.push({
          name,
          strengths: strengths.length > 0 ? strengths : ["待分析"],
          weaknesses: weaknesses.length > 0 ? weaknesses : ["待分析"],
        });
      });
    }

    return competitors.length > 0 ? competitors : undefined;
  }

  /**
   * 提取列表项
   */
  private extractListItems(content: string, ...keywords: string[]): string[] {
    const items: string[] = [];
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[：:][^]*?(?=##|$)`, "i");
      const match = content.match(regex);
      if (match) {
        const listItems = match[0].match(/[-*]\s+(.+)/g);
        if (listItems) {
          listItems.forEach((item) => {
            items.push(item.replace(/^[-*]\s+/, "").trim());
          });
        }
      }
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
    return ["PRD", "产品需求"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 PrdMaster 蓝图实例
 */
export function createPrdMasterBlueprint(): PrdMasterBlueprint {
  return new PrdMasterBlueprint();
}
