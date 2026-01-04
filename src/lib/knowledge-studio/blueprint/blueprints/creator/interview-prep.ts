/**
 * InterviewPrep Blueprint - 访谈准备官 (Story 5.3)
 * @module knowledge-studio/blueprint/blueprints/creator
 *
 * 根据嘉宾资料生成深度访谈提纲。
 *
 * 目标用户: 播客主持人、记者、访谈类节目制作人
 * 输入: 嘉宾资料、背景信息
 * 输出: 结构化访谈提纲
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
 * 访谈问题
 */
interface InterviewQuestion {
  /** 问题ID */
  id: string;
  /** 问题内容 */
  question: string;
  /** 问题类型 */
  type: "icebreaker" | "core" | "followup" | "closing";
  /** 问题主题 */
  topic: string;
  /** 预期回答要点 */
  expectedPoints?: string[];
  /** 追问提示 */
  followUpPrompts?: string[];
  /** 难度/深度 (1-5) */
  depth: number;
  /** 建议时长 (秒) */
  suggestedDuration?: number;
}

/**
 * 主题区块
 */
interface TopicSection {
  /** 区块ID */
  id: string;
  /** 主题名称 */
  name: string;
  /** 主题描述 */
  description: string;
  /** 该主题下的问题 */
  questions: InterviewQuestion[];
  /** 该区块预计时长 (分钟) */
  estimatedMinutes: number;
}

/**
 * 嘉宾背景摘要
 */
interface GuestProfile {
  /** 姓名 */
  name: string;
  /** 头衔/职位 */
  title?: string;
  /** 所属机构 */
  organization?: string;
  /** 专业领域 */
  expertise: string[];
  /** 关键成就 */
  achievements?: string[];
  /** 背景摘要 */
  summary: string;
}

/**
 * InterviewPrep 输出类型
 */
export interface InterviewPrepOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 访谈标题 */
  title: string;
  /** 访谈目的 */
  purpose: string;
  /** 目标受众 */
  targetAudience: string;
  /** 嘉宾资料 */
  guestProfile: GuestProfile;
  /** 破冰问题 */
  icebreakerQuestions: InterviewQuestion[];
  /** 主题区块 */
  topicSections: TopicSection[];
  /** 收尾问题 */
  closingQuestions: InterviewQuestion[];
  /** 总问题数 */
  totalQuestions: number;
  /** 预计总时长 (分钟) */
  estimatedDuration: number;
  /** 访谈风格 */
  style: string;
  /** 注意事项 */
  notes?: string[];
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * InterviewPrep 蓝图
 *
 * 根据嘉宾资料生成深度访谈提纲。
 *
 * 生成内容包含：
 * - 嘉宾背景摘要
 * - 破冰问题（2-3 个）
 * - 核心问题（5-8 个，分主题）
 * - 追问提示（每个核心问题 1-2 个）
 * - 收尾问题
 */
export class InterviewPrepBlueprint extends EnhancedBlueprintEngine<InterviewPrepOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "creator-interview_prep";
  readonly displayName = "访谈准备官";
  readonly description = "根据嘉宾资料生成深度访谈提纲，问题按难度递进排列";
  readonly icon = "🎙️";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "content_creator",
    "journalist",
    "podcaster",
  ];

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "creator" as const;
  readonly priority = 3;
  readonly isNew = true;
  readonly tags = ["访谈", "播客", "提纲", "问题"];
  readonly examplePrompts = [
    "根据这位CEO的资料生成访谈提纲",
    "为这位技术专家准备播客访谈问题",
    "生成与这位作家的深度对话提纲",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "interview_purpose",
        type: "single_choice",
        category: "objective",
        question: "访谈目的？",
        options: [
          {
            value: "introduction",
            label: "人物介绍",
            description: "让观众认识嘉宾",
          },
          {
            value: "expertise",
            label: "专业探讨",
            description: "深入技术/领域话题",
          },
          {
            value: "story",
            label: "故事挖掘",
            description: "挖掘嘉宾经历和故事",
          },
          {
            value: "trending",
            label: "热点讨论",
            description: "围绕时事/趋势展开",
          },
        ],
        required: true,
        defaultValue: "expertise",
      },
      {
        id: "target_audience",
        type: "single_choice",
        category: "audience",
        question: "目标观众？",
        options: [
          {
            value: "professional",
            label: "专业人士",
            description: "行业从业者、专家",
          },
          {
            value: "enthusiast",
            label: "爱好者",
            description: "对领域感兴趣的人",
          },
          {
            value: "general",
            label: "大众",
            description: "普通观众/听众",
          },
        ],
        required: true,
        defaultValue: "enthusiast",
      },
      {
        id: "interview_depth",
        type: "single_choice",
        category: "constraint",
        question: "访谈深度？",
        options: [
          { value: "light", label: "轻松访谈", description: "15-20分钟" },
          { value: "standard", label: "标准访谈", description: "30-45分钟" },
          { value: "deep", label: "深度对话", description: "60分钟以上" },
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
   * 生成访谈提纲大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析嘉宾资料...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const interviewDepth = this.getInterviewDepth(input);

    const outlinePrompt = `
你是一位资深访谈策划人，正在为以下嘉宾资料创建访谈提纲。

${briefingPrompt}

预计访谈时长：${interviewDepth.duration} 分钟
核心问题数量：${interviewDepth.coreQuestions} 个

请生成包含以下结构的提纲：
1. 嘉宾背景摘要 - 提炼嘉宾核心信息
2. 破冰问题（2-3个）- 轻松开场，拉近距离
3. 核心主题（3-5个主题）- 每个主题 1-3 个问题
   - 问题按难度/深度递进排列
   - 每个问题附带追问提示
4. 收尾问题（1-2个）- 总结性或展望性问题

问题设计原则：
- 开放式问题为主
- 避免是非题
- 有层次感，由浅入深
- 结合嘉宾具体经历
`;

    yield* this.reportProgress("outline", 30, "规划访谈结构...");

    const materialContents = input.materials.map((m) => m.content).join("\n\n");
    const result = await generateOutline({
      materialContent: materialContents,
      customPrompt: outlinePrompt,
      blueprintType: "interview_prep",
    });

    yield* this.reportProgress("outline", 100, "大纲生成完成");

    return result.outline;
  }

  /**
   * 基于大纲生成访谈提纲
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成访谈提纲...");

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
      blueprintType: "interview_prep",
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

    yield* this.reportProgress("content", 100, "访谈提纲生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<InterviewPrepOutput> {
    const outline = context.outline;
    const guestProfile = this.extractGuestProfile(rawContent);
    const icebreakerQuestions = this.extractIcebreakerQuestions(rawContent);
    const topicSections = this.extractTopicSections(rawContent);
    const closingQuestions = this.extractClosingQuestions(rawContent);

    const totalQuestions =
      icebreakerQuestions.length +
      topicSections.reduce((sum, s) => sum + s.questions.length, 0) +
      closingQuestions.length;

    const estimatedDuration =
      topicSections.reduce((sum, s) => sum + s.estimatedMinutes, 0) +
      icebreakerQuestions.length * 2 +
      closingQuestions.length * 3;

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: outline?.title ?? this.extractTitle(rawContent),
      purpose: this.extractPurpose(context),
      targetAudience: this.extractTargetAudience(context),
      guestProfile,
      icebreakerQuestions,
      topicSections,
      closingQuestions,
      totalQuestions,
      estimatedDuration,
      style: this.extractStyle(context),
      notes: this.extractNotes(rawContent),
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
        purpose: {
          type: "string",
          enum: ["introduction", "expertise", "story", "trending"],
        },
        targetAudience: {
          type: "string",
          enum: ["professional", "enthusiast", "general"],
        },
        guestProfile: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            organization: { type: "string" },
            expertise: { type: "array", items: { type: "string" } },
            achievements: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: ["name", "expertise", "summary"],
        },
        icebreakerQuestions: {
          type: "array",
          items: { $ref: "#/definitions/InterviewQuestion" },
          minItems: 2,
          maxItems: 3,
        },
        topicSections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              questions: {
                type: "array",
                items: { $ref: "#/definitions/InterviewQuestion" },
              },
              estimatedMinutes: { type: "number", minimum: 1 },
            },
            required: [
              "id",
              "name",
              "description",
              "questions",
              "estimatedMinutes",
            ],
          },
          minItems: 1,
        },
        closingQuestions: {
          type: "array",
          items: { $ref: "#/definitions/InterviewQuestion" },
          minItems: 1,
          maxItems: 2,
        },
        totalQuestions: { type: "number", minimum: 1 },
        estimatedDuration: { type: "number", minimum: 1 },
        style: { type: "string" },
        notes: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "purpose",
        "targetAudience",
        "guestProfile",
        "icebreakerQuestions",
        "topicSections",
        "closingQuestions",
        "totalQuestions",
        "estimatedDuration",
        "style",
      ],
      definitions: {
        InterviewQuestion: {
          type: "object",
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            type: {
              type: "string",
              enum: ["icebreaker", "core", "followup", "closing"],
            },
            topic: { type: "string" },
            expectedPoints: { type: "array", items: { type: "string" } },
            followUpPrompts: { type: "array", items: { type: "string" } },
            depth: { type: "number", minimum: 1, maximum: 5 },
            suggestedDuration: { type: "number", minimum: 0 },
          },
          required: ["id", "question", "type", "topic", "depth"],
        },
      },
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 获取访谈深度配置
   */
  private getInterviewDepth(input: EnhancedBlueprintInput): {
    duration: number;
    coreQuestions: number;
  } {
    const depthAnswer =
      input.briefingContext?.answers?.interview_depth ?? "standard";
    const depthMap: Record<
      string,
      { duration: number; coreQuestions: number }
    > = {
      light: { duration: 20, coreQuestions: 5 },
      standard: { duration: 40, coreQuestions: 8 },
      deep: { duration: 60, coreQuestions: 12 },
    };
    return depthMap[depthAnswer as string] ?? depthMap.standard;
  }

  /**
   * 提取嘉宾资料
   */
  private extractGuestProfile(content: string): GuestProfile {
    const nameMatch = content.match(/(?:嘉宾|姓名|Name)[：:]\s*(.+)/i);
    const titleMatch = content.match(/(?:头衔|职位|Title)[：:]\s*(.+)/i);
    const orgMatch = content.match(/(?:机构|公司|Organization)[：:]\s*(.+)/i);
    const summaryMatch = content.match(
      /(?:背景|简介|Summary)[：:]\s*([\s\S]+?)(?=专业|成就|##|$)/i,
    );

    return {
      name: nameMatch?.[1]?.trim() ?? "嘉宾",
      title: titleMatch?.[1]?.trim(),
      organization: orgMatch?.[1]?.trim(),
      expertise: this.extractExpertise(content),
      achievements: this.extractAchievements(content),
      summary: summaryMatch?.[1]?.trim() ?? "资深行业专家",
    };
  }

  /**
   * 提取专业领域
   */
  private extractExpertise(content: string): string[] {
    const expertiseMatch = content.match(
      /(?:专业|领域|Expertise)[：:]\s*(.+)/i,
    );
    if (expertiseMatch) {
      return expertiseMatch[1]
        .split(/[,，、]/)
        .map((e) => e.trim())
        .filter(Boolean);
    }
    return ["专业领域"];
  }

  /**
   * 提取成就
   */
  private extractAchievements(content: string): string[] {
    const achievementMatch = content.match(
      /(?:成就|荣誉|Achievement)[：:]\s*(.+)/i,
    );
    if (achievementMatch) {
      return achievementMatch[1]
        .split(/[,，、]/)
        .map((a) => a.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * 提取破冰问题
   */
  private extractIcebreakerQuestions(content: string): InterviewQuestion[] {
    const questions: InterviewQuestion[] = [];
    const icebreakerMatch = content.match(
      /(?:破冰|开场|Icebreaker)[：:]([\s\S]*?)(?=核心|主题|##|$)/i,
    );

    if (icebreakerMatch) {
      const questionRegex = /[-•]\s*(.+?)(?=[-•]|$)/g;
      let match;
      let id = 1;

      while ((match = questionRegex.exec(icebreakerMatch[1])) !== null) {
        questions.push({
          id: `icebreaker-${id++}`,
          question: match[1].trim(),
          type: "icebreaker",
          topic: "开场",
          depth: 1,
          suggestedDuration: 60,
        });
      }
    }

    // 如果没有找到，创建默认破冰问题
    if (questions.length === 0) {
      questions.push(
        {
          id: "icebreaker-1",
          question: "能否先简单介绍一下您目前在做的事情？",
          type: "icebreaker",
          topic: "开场",
          depth: 1,
          suggestedDuration: 60,
        },
        {
          id: "icebreaker-2",
          question: "是什么契机让您走上了现在这条路？",
          type: "icebreaker",
          topic: "开场",
          depth: 2,
          suggestedDuration: 90,
        },
      );
    }

    return questions.slice(0, 3);
  }

  /**
   * 提取主题区块
   */
  private extractTopicSections(content: string): TopicSection[] {
    const sections: TopicSection[] = [];
    const topicRegex =
      /(?:主题|Topic)\s*(\d+)[：:]\s*(.+?)\n([\s\S]*?)(?=(?:主题|Topic)\s*\d+|收尾|结束|$)/gi;
    let match;

    while ((match = topicRegex.exec(content)) !== null) {
      const topicName = match[2].trim();
      const topicContent = match[3];
      const questions = this.parseQuestionsFromContent(
        topicContent,
        topicName,
        sections.length + 1,
      );

      sections.push({
        id: `topic-${sections.length + 1}`,
        name: topicName,
        description: this.extractTopicDescription(topicContent),
        questions,
        estimatedMinutes: questions.length * 5,
      });
    }

    // 如果没有找到，创建默认主题
    if (sections.length === 0) {
      sections.push({
        id: "topic-1",
        name: "核心话题",
        description: "围绕嘉宾专业领域展开讨论",
        questions: [
          {
            id: "core-1",
            question: "您在这个领域最大的感悟是什么？",
            type: "core",
            topic: "核心话题",
            depth: 3,
            followUpPrompts: ["能举个具体的例子吗？"],
          },
        ],
        estimatedMinutes: 10,
      });
    }

    return sections;
  }

  /**
   * 从内容中解析问题
   */
  private parseQuestionsFromContent(
    content: string,
    topic: string,
    topicIndex: number,
  ): InterviewQuestion[] {
    const questions: InterviewQuestion[] = [];
    const questionRegex = /(?:\d+\.|[-•])\s*(.+?)(?=(?:\d+\.|[-•])|\n\n|$)/g;
    let match;
    let depth = 2;

    while ((match = questionRegex.exec(content)) !== null) {
      const questionText = match[1].trim();
      if (questionText.length > 10 && questionText.includes("？")) {
        questions.push({
          id: `core-${topicIndex}-${questions.length + 1}`,
          question: questionText,
          type: "core",
          topic,
          depth: Math.min(5, depth++),
          followUpPrompts: this.extractFollowUps(content, questionText),
        });
      }
    }

    return questions;
  }

  /**
   * 提取追问提示
   */
  private extractFollowUps(_content: string, _question: string): string[] {
    // 简化实现：返回通用追问
    return ["能具体说说吗？", "有什么具体的案例吗？"].slice(0, 2);
  }

  /**
   * 提取主题描述
   */
  private extractTopicDescription(content: string): string {
    const descMatch = content.match(/(?:描述|说明)[：:]\s*(.+)/i);
    return descMatch?.[1]?.trim() ?? "深入探讨该主题";
  }

  /**
   * 提取收尾问题
   */
  private extractClosingQuestions(content: string): InterviewQuestion[] {
    const questions: InterviewQuestion[] = [];
    const closingMatch = content.match(
      /(?:收尾|结束|Closing)[：:]([\s\S]*?)(?=注意|备注|$)/i,
    );

    if (closingMatch) {
      const questionRegex = /[-•]\s*(.+?)(?=[-•]|$)/g;
      let match;
      let id = 1;

      while ((match = questionRegex.exec(closingMatch[1])) !== null) {
        questions.push({
          id: `closing-${id++}`,
          question: match[1].trim(),
          type: "closing",
          topic: "收尾",
          depth: 2,
          suggestedDuration: 120,
        });
      }
    }

    // 如果没有找到，创建默认收尾问题
    if (questions.length === 0) {
      questions.push({
        id: "closing-1",
        question: "对于想进入这个领域的新人，您有什么建议？",
        type: "closing",
        topic: "收尾",
        depth: 2,
        suggestedDuration: 120,
      });
    }

    return questions.slice(0, 2);
  }

  /**
   * 提取标题
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/(?:标题|Title)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? "访谈提纲";
  }

  /**
   * 提取访谈目的
   */
  private extractPurpose(_context: BlueprintExecutionContext): string {
    return "expertise";
  }

  /**
   * 提取目标受众
   */
  private extractTargetAudience(_context: BlueprintExecutionContext): string {
    return "enthusiast";
  }

  /**
   * 提取访谈风格
   */
  private extractStyle(_context: BlueprintExecutionContext): string {
    return "conversational";
  }

  /**
   * 提取注意事项
   */
  private extractNotes(content: string): string[] {
    const notesMatch = content.match(
      /(?:注意|备注|Notes)[：:]\s*([\s\S]+?)(?=标签|$)/i,
    );
    if (notesMatch) {
      const notes = notesMatch[1].match(/[-•]\s*(.+)/g);
      if (notes) {
        return notes.map((n) => n.replace(/^[-•]\s*/, "").trim());
      }
    }
    return [];
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
    return ["访谈", "播客", "提纲"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 InterviewPrep 蓝图实例
 */
export function createInterviewPrepBlueprint(): InterviewPrepBlueprint {
  return new InterviewPrepBlueprint();
}
