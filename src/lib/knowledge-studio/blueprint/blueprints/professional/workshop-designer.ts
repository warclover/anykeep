/**
 * WorkshopDesigner Blueprint - 课程设计师 (Story 7.4)
 * @module knowledge-studio/blueprint/blueprints/professional
 *
 * 将学习资料转换为工作坊/课程流程设计。
 *
 * 目标用户: 培训师、讲师、企业内训人员
 * 输入: 课程资料、知识点笔记
 * 输出: 结构化工作坊流程表
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
 * 时间线条目
 */
interface TimelineEntry {
  /** 条目ID */
  id: string;
  /** 开始时间（分钟） */
  startMinute: number;
  /** 持续时间（分钟） */
  durationMinutes: number;
  /** 环节标题 */
  title: string;
  /** 环节类型 */
  type: "opening" | "lecture" | "activity" | "break" | "discussion" | "closing";
  /** 简要描述 */
  description: string;
}

/**
 * 会话/环节描述
 */
interface SessionDescription {
  /** 环节ID */
  id: string;
  /** 环节标题 */
  title: string;
  /** 学习目标 */
  learningObjectives: string[];
  /** 详细描述 */
  description: string;
  /** 关键知识点 */
  keyPoints: string[];
  /** 讲师指导 */
  facilitatorNotes: string;
  /** 预期产出 */
  expectedOutcome: string;
}

/**
 * 活动格式
 */
interface ActivityFormat {
  /** 活动ID */
  id: string;
  /** 所属环节ID */
  sessionId: string;
  /** 活动名称 */
  name: string;
  /** 活动类型 */
  type:
    | "individual"
    | "pair"
    | "small_group"
    | "large_group"
    | "presentation"
    | "hands_on";
  /** 预估时长（分钟） */
  durationMinutes: number;
  /** 活动说明 */
  instructions: string[];
  /** 讨论问题/任务 */
  promptsOrTasks: string[];
  /** 分享方式 */
  debriefMethod: string;
}

/**
 * 材料清单项
 */
interface MaterialItem {
  /** 材料ID */
  id: string;
  /** 材料名称 */
  name: string;
  /** 材料类型 */
  type: "slide" | "handout" | "video" | "props" | "digital" | "stationery";
  /** 数量/说明 */
  quantity: string;
  /** 是否必需 */
  required: boolean;
  /** 准备说明 */
  preparationNotes?: string;
}

/**
 * 讲师技巧
 */
interface FacilitatorTip {
  /** 技巧ID */
  id: string;
  /** 相关环节ID */
  sessionId?: string;
  /** 技巧类型 */
  type: "engagement" | "timing" | "troubleshooting" | "transition" | "general";
  /** 技巧标题 */
  title: string;
  /** 详细说明 */
  description: string;
  /** 优先级 */
  priority: "low" | "medium" | "high";
}

/**
 * 评估方法
 */
interface AssessmentMethod {
  /** 评估ID */
  id: string;
  /** 评估名称 */
  name: string;
  /** 评估类型 */
  type: "formative" | "summative" | "self_assessment" | "peer_assessment";
  /** 时机 */
  timing: "before" | "during" | "after";
  /** 评估说明 */
  description: string;
  /** 评估标准 */
  criteria?: string[];
}

/**
 * WorkshopDesigner 输出类型
 */
export interface WorkshopDesignerOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 工作坊标题 */
  title: string;
  /** 工作坊概述 */
  overview: string;
  /** 总时长（分钟） */
  totalDurationMinutes: number;
  /** 目标受众 */
  targetAudience: string;
  /** 前置要求 */
  prerequisites: string[];
  /** 学习目标 */
  learningObjectives: string[];
  /** 时间线 */
  timeline: TimelineEntry[];
  /** 环节描述 */
  sessionDescriptions: SessionDescription[];
  /** 活动格式 */
  activityFormats: ActivityFormat[];
  /** 材料清单 */
  materialsList: MaterialItem[];
  /** 讲师技巧 */
  facilitatorTips: FacilitatorTip[];
  /** 评估方法 */
  assessmentMethods: AssessmentMethod[];
  /** 建议参与人数 */
  recommendedGroupSize: {
    min: number;
    max: number;
    optimal: number;
  };
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * WorkshopDesigner 蓝图
 *
 * 将学习资料转换为结构化的工作坊/培训流程设计。
 *
 * 生成内容包含：
 * - 完整时间线规划
 * - 各环节详细描述
 * - 互动活动设计
 * - 材料准备清单
 * - 讲师引导技巧
 * - 评估方法建议
 */
export class WorkshopDesignerBlueprint extends EnhancedBlueprintEngine<WorkshopDesignerOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "professional-workshop_designer";
  readonly displayName = "课程设计师";
  readonly description =
    "将学习资料转换为工作坊/培训流程设计，包含时间线、活动设计、材料清单和讲师指南";
  readonly icon = "🎓";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "trainer",
    "educator",
    "facilitator",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "professional" as const;
  readonly priority = 4;
  readonly isNew = true;
  readonly tags = ["培训", "工作坊", "课程设计", "教学"];
  readonly examplePrompts = [
    "帮我设计一个 3 小时的团队协作工作坊",
    "将这些 Python 学习笔记转换为 2 天培训课程",
    "设计一个新员工入职培训流程",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "workshop_duration",
        type: "single_choice",
        category: "constraint",
        question: "工作坊的时长是多少？",
        options: [
          {
            value: "short",
            label: "短课程（1-2小时）",
            description: "适合午间或晚间分享",
          },
          {
            value: "half_day",
            label: "半天（3-4小时）",
            description: "上午或下午的深度培训",
          },
          {
            value: "full_day",
            label: "全天（6-8小时）",
            description: "完整的一日工作坊",
          },
          {
            value: "multi_day",
            label: "多日（2天以上）",
            description: "系统性培训项目",
          },
        ],
        required: true,
        defaultValue: "half_day",
      },
      {
        id: "delivery_format",
        type: "single_choice",
        category: "context",
        question: "授课形式是什么？",
        options: [
          {
            value: "in_person",
            label: "线下面授",
            description: "现场互动培训",
          },
          {
            value: "online_sync",
            label: "线上同步",
            description: "实时视频直播",
          },
          {
            value: "hybrid",
            label: "混合模式",
            description: "线上线下同时进行",
          },
          {
            value: "self_paced",
            label: "自主学习",
            description: "异步录播课程",
          },
        ],
        required: true,
        defaultValue: "in_person",
      },
      {
        id: "interaction_level",
        type: "single_choice",
        category: "objective",
        question: "期望的互动程度？",
        options: [
          {
            value: "lecture",
            label: "讲授为主",
            description: "70% 讲解 + 30% 互动",
          },
          {
            value: "balanced",
            label: "讲练结合",
            description: "50% 讲解 + 50% 练习",
          },
          {
            value: "workshop",
            label: "工作坊型",
            description: "30% 讲解 + 70% 实践",
          },
        ],
        required: false,
        defaultValue: "balanced",
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
   * 生成工作坊设计大纲
   */
  async *generateOutline(
    _context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析学习材料...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深培训设计师，正在为以下学习材料设计工作坊流程。

${briefingPrompt}

请生成包含以下章节的工作坊设计大纲：
1. 工作坊概览 - 目标、受众、学习目标
2. 时间线规划 - 各环节时间分配
3. 环节详情 - 每个环节的目标和内容
4. 互动活动 - 具体的练习和讨论设计
5. 材料准备 - 需要的物料和设备
6. 讲师指南 - 引导技巧和常见问题处理

每个章节需要包含具体可执行的要点。
`;

    yield* this.reportProgress("outline", 30, "生成工作坊结构...");

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
   * 生成工作坊设计详情
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成工作坊设计...");

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

    yield* this.reportProgress("content", 100, "工作坊设计生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为 WorkshopDesignerOutput
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<WorkshopDesignerOutput> {
    const outline = context.outline;
    const title =
      this.extractTitle(rawContent) ?? outline?.title ?? "工作坊设计";

    const timeline = this.extractTimeline(rawContent);
    const totalDuration = timeline.reduce(
      (sum, t) => sum + t.durationMinutes,
      0,
    );

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title,
      overview: this.extractOverview(rawContent),
      totalDurationMinutes: totalDuration || 180,
      targetAudience: this.extractTargetAudience(rawContent),
      prerequisites: this.extractPrerequisites(rawContent),
      learningObjectives: this.extractLearningObjectives(rawContent),
      timeline,
      sessionDescriptions: this.extractSessionDescriptions(
        rawContent,
        timeline,
      ),
      activityFormats: this.extractActivityFormats(rawContent),
      materialsList: this.extractMaterialsList(rawContent),
      facilitatorTips: this.extractFacilitatorTips(rawContent),
      assessmentMethods: this.extractAssessmentMethods(rawContent),
      recommendedGroupSize: this.extractGroupSize(rawContent),
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
        overview: { type: "string" },
        totalDurationMinutes: { type: "number" },
        targetAudience: { type: "string" },
        prerequisites: { type: "array", items: { type: "string" } },
        learningObjectives: { type: "array", items: { type: "string" } },
        timeline: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              startMinute: { type: "number" },
              durationMinutes: { type: "number" },
              title: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "opening",
                  "lecture",
                  "activity",
                  "break",
                  "discussion",
                  "closing",
                ],
              },
              description: { type: "string" },
            },
            required: [
              "id",
              "startMinute",
              "durationMinutes",
              "title",
              "type",
              "description",
            ],
          },
        },
        sessionDescriptions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              learningObjectives: { type: "array", items: { type: "string" } },
              description: { type: "string" },
              keyPoints: { type: "array", items: { type: "string" } },
              facilitatorNotes: { type: "string" },
              expectedOutcome: { type: "string" },
            },
            required: [
              "id",
              "title",
              "learningObjectives",
              "description",
              "keyPoints",
            ],
          },
        },
        activityFormats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              sessionId: { type: "string" },
              name: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "individual",
                  "pair",
                  "small_group",
                  "large_group",
                  "presentation",
                  "hands_on",
                ],
              },
              durationMinutes: { type: "number" },
              instructions: { type: "array", items: { type: "string" } },
              promptsOrTasks: { type: "array", items: { type: "string" } },
              debriefMethod: { type: "string" },
            },
            required: [
              "id",
              "sessionId",
              "name",
              "type",
              "durationMinutes",
              "instructions",
            ],
          },
        },
        materialsList: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "slide",
                  "handout",
                  "video",
                  "props",
                  "digital",
                  "stationery",
                ],
              },
              quantity: { type: "string" },
              required: { type: "boolean" },
              preparationNotes: { type: "string" },
            },
            required: ["id", "name", "type", "quantity", "required"],
          },
        },
        facilitatorTips: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              sessionId: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "engagement",
                  "timing",
                  "troubleshooting",
                  "transition",
                  "general",
                ],
              },
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["id", "type", "title", "description", "priority"],
          },
        },
        assessmentMethods: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "formative",
                  "summative",
                  "self_assessment",
                  "peer_assessment",
                ],
              },
              timing: { type: "string", enum: ["before", "during", "after"] },
              description: { type: "string" },
              criteria: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "type", "timing", "description"],
          },
        },
        recommendedGroupSize: {
          type: "object",
          properties: {
            min: { type: "number" },
            max: { type: "number" },
            optimal: { type: "number" },
          },
          required: ["min", "max", "optimal"],
        },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "overview",
        "totalDurationMinutes",
        "targetAudience",
        "prerequisites",
        "learningObjectives",
        "timeline",
        "sessionDescriptions",
        "activityFormats",
        "materialsList",
        "facilitatorTips",
        "assessmentMethods",
        "recommendedGroupSize",
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
   * 提取概述
   */
  private extractOverview(content: string): string {
    const overviewMatch = content.match(
      /(?:概述|Overview|简介)[：:]\s*([^#]+)/i,
    );
    return (
      overviewMatch?.[1]?.trim().slice(0, 500) ??
      "本工作坊旨在通过互动式学习提升参与者的技能和知识。"
    );
  }

  /**
   * 提取目标受众
   */
  private extractTargetAudience(content: string): string {
    const audienceMatch = content.match(
      /(?:受众|Audience|对象)[：:]\s*([^\n]+)/i,
    );
    return audienceMatch?.[1]?.trim() ?? "对本主题感兴趣的学习者";
  }

  /**
   * 提取前置要求
   */
  private extractPrerequisites(content: string): string[] {
    const prereqMatch = content.match(
      /(?:前置|Prerequisites?|要求)[^]*?(?=##|$)/i,
    );
    const items: string[] = [];

    if (prereqMatch) {
      const listItems = prereqMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (const item of listItems) {
          items.push(item.replace(/^[-*]\s+/, "").trim());
        }
      }
    }

    return items.length > 0 ? items : ["无特殊要求"];
  }

  /**
   * 提取学习目标
   */
  private extractLearningObjectives(content: string): string[] {
    const objectiveMatch = content.match(
      /(?:学习目标|Learning Objectives?|目标)[^]*?(?=##|$)/i,
    );
    const objectives: string[] = [];

    if (objectiveMatch) {
      const listItems = objectiveMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (const item of listItems) {
          objectives.push(item.replace(/^[-*]\s+/, "").trim());
        }
      }
    }

    return objectives.length > 0
      ? objectives
      : ["理解核心概念", "掌握实践技能", "能够应用所学"];
  }

  /**
   * 提取时间线
   */
  private extractTimeline(content: string): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];

    // 尝试匹配时间相关内容
    const timeRegex = /(\d+)[：:]\s*(\d+)\s*[-–]\s*(\d+)[：:]\s*(\d+)\s+(.+)/g;
    let match;
    let index = 0;
    let currentMinute = 0;

    while ((match = timeRegex.exec(content)) !== null) {
      index++;
      const startHour = parseInt(match[1], 10);
      const startMin = parseInt(match[2], 10);
      const endHour = parseInt(match[3], 10);
      const endMin = parseInt(match[4], 10);
      const title = match[5].trim();

      const duration = (endHour - startHour) * 60 + (endMin - startMin);

      timeline.push({
        id: `timeline-${index}`,
        startMinute: currentMinute,
        durationMinutes: duration > 0 ? duration : 30,
        title,
        type: this.inferSessionType(title),
        description: title,
      });

      currentMinute += duration > 0 ? duration : 30;
    }

    // 默认时间线
    if (timeline.length === 0) {
      const defaultSessions = [
        { title: "开场与破冰", type: "opening" as const, duration: 15 },
        { title: "主题介绍", type: "lecture" as const, duration: 30 },
        { title: "小组讨论", type: "discussion" as const, duration: 30 },
        { title: "茶歇", type: "break" as const, duration: 15 },
        { title: "实践练习", type: "activity" as const, duration: 45 },
        { title: "分享与总结", type: "closing" as const, duration: 15 },
      ];

      let minute = 0;
      for (let i = 0; i < defaultSessions.length; i++) {
        const session = defaultSessions[i];
        timeline.push({
          id: `timeline-${i + 1}`,
          startMinute: minute,
          durationMinutes: session.duration,
          title: session.title,
          type: session.type,
          description: session.title,
        });
        minute += session.duration;
      }
    }

    return timeline;
  }

  /**
   * 推断环节类型
   */
  private inferSessionType(title: string): TimelineEntry["type"] {
    const lowerTitle = title.toLowerCase();

    if (
      lowerTitle.includes("开场") ||
      lowerTitle.includes("opening") ||
      lowerTitle.includes("破冰")
    ) {
      return "opening";
    }
    if (
      lowerTitle.includes("休息") ||
      lowerTitle.includes("break") ||
      lowerTitle.includes("茶歇")
    ) {
      return "break";
    }
    if (
      lowerTitle.includes("讨论") ||
      lowerTitle.includes("discussion") ||
      lowerTitle.includes("分享")
    ) {
      return "discussion";
    }
    if (
      lowerTitle.includes("练习") ||
      lowerTitle.includes("activity") ||
      lowerTitle.includes("实践")
    ) {
      return "activity";
    }
    if (
      lowerTitle.includes("结束") ||
      lowerTitle.includes("closing") ||
      lowerTitle.includes("总结")
    ) {
      return "closing";
    }

    return "lecture";
  }

  /**
   * 提取环节描述
   */
  private extractSessionDescriptions(
    content: string,
    timeline: TimelineEntry[],
  ): SessionDescription[] {
    return timeline
      .filter((t) => t.type !== "break")
      .map((t) => ({
        id: t.id.replace("timeline", "session"),
        title: t.title,
        learningObjectives: ["理解" + t.title + "的要点"],
        description: `本环节将${t.title}，帮助学员掌握相关内容。`,
        keyPoints: ["关键点 1", "关键点 2"],
        facilitatorNotes: "注意时间控制和学员参与度",
        expectedOutcome: "学员能够理解并应用所学",
      }));
  }

  /**
   * 提取活动格式
   */
  private extractActivityFormats(content: string): ActivityFormat[] {
    const activities: ActivityFormat[] = [];

    // 尝试从内容提取活动
    const activityMatch = content.match(/(?:活动|Activity|练习)[^]*?(?=##|$)/i);
    if (activityMatch) {
      const listItems = activityMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 5); i++) {
          const activityName = listItems[i].replace(/^[-*]\s+/, "").trim();
          activities.push({
            id: `activity-${i + 1}`,
            sessionId: "session-1",
            name: activityName,
            type: i % 2 === 0 ? "small_group" : "pair",
            durationMinutes: 15,
            instructions: ["步骤 1", "步骤 2", "步骤 3"],
            promptsOrTasks: ["讨论问题"],
            debriefMethod: "小组代表分享",
          });
        }
      }
    }

    // 默认活动
    if (activities.length === 0) {
      activities.push(
        {
          id: "activity-1",
          sessionId: "session-1",
          name: "小组讨论",
          type: "small_group",
          durationMinutes: 15,
          instructions: ["分成 4-5 人小组", "讨论给定话题", "记录要点"],
          promptsOrTasks: ["您对这个话题有什么看法？"],
          debriefMethod: "每组 2 分钟分享",
        },
        {
          id: "activity-2",
          sessionId: "session-2",
          name: "实践练习",
          type: "hands_on",
          durationMinutes: 30,
          instructions: ["按照指导完成练习", "遇到问题请举手"],
          promptsOrTasks: ["完成练习任务"],
          debriefMethod: "讲师点评",
        },
      );
    }

    return activities;
  }

  /**
   * 提取材料清单
   */
  private extractMaterialsList(content: string): MaterialItem[] {
    const materials: MaterialItem[] = [];

    // 尝试从内容提取材料
    const materialMatch = content.match(
      /(?:材料|Materials?|物料)[^]*?(?=##|$)/i,
    );
    if (materialMatch) {
      const listItems = materialMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 10); i++) {
          const materialName = listItems[i].replace(/^[-*]\s+/, "").trim();
          materials.push({
            id: `material-${i + 1}`,
            name: materialName,
            type: "handout",
            quantity: "每人 1 份",
            required: true,
          });
        }
      }
    }

    // 默认材料
    if (materials.length === 0) {
      materials.push(
        {
          id: "material-1",
          name: "演示文稿",
          type: "slide",
          quantity: "1 套",
          required: true,
          preparationNotes: "提前测试投影设备",
        },
        {
          id: "material-2",
          name: "学员手册",
          type: "handout",
          quantity: "每人 1 份",
          required: true,
          preparationNotes: "提前打印装订",
        },
        {
          id: "material-3",
          name: "白板/便利贴",
          type: "stationery",
          quantity: "若干",
          required: false,
          preparationNotes: "用于小组讨论记录",
        },
      );
    }

    return materials;
  }

  /**
   * 提取讲师技巧
   */
  private extractFacilitatorTips(_content: string): FacilitatorTip[] {
    const tips: FacilitatorTip[] = [
      {
        id: "tip-1",
        type: "engagement",
        title: "开场活跃氛围",
        description: "用有趣的问题或故事开场，快速吸引学员注意力",
        priority: "high",
      },
      {
        id: "tip-2",
        type: "timing",
        title: "时间管理",
        description: "设置时间提醒，确保每个环节不超时",
        priority: "high",
      },
      {
        id: "tip-3",
        type: "troubleshooting",
        title: "应对沉默",
        description: "准备备用问题，必要时可以指定学员回答",
        priority: "medium",
      },
      {
        id: "tip-4",
        type: "transition",
        title: "环节过渡",
        description: "用简短总结和预告平滑过渡到下一环节",
        priority: "medium",
      },
    ];

    return tips;
  }

  /**
   * 提取评估方法
   */
  private extractAssessmentMethods(_content: string): AssessmentMethod[] {
    return [
      {
        id: "assessment-1",
        name: "课前知识摸底",
        type: "formative",
        timing: "before",
        description: "了解学员现有水平，调整教学节奏",
        criteria: ["基础概念理解", "实践经验"],
      },
      {
        id: "assessment-2",
        name: "即时反馈",
        type: "formative",
        timing: "during",
        description: "通过问答和练习检查学习效果",
        criteria: ["理解程度", "应用能力"],
      },
      {
        id: "assessment-3",
        name: "课后反馈表",
        type: "summative",
        timing: "after",
        description: "收集学员对课程的评价和建议",
        criteria: ["内容满意度", "讲师评价", "建议收集"],
      },
    ];
  }

  /**
   * 提取建议人数
   */
  private extractGroupSize(
    _content: string,
  ): WorkshopDesignerOutput["recommendedGroupSize"] {
    return {
      min: 8,
      max: 30,
      optimal: 15,
    };
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
    return ["培训", "工作坊", "课程设计"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 WorkshopDesigner 蓝图实例
 */
export function createWorkshopDesignerBlueprint(): WorkshopDesignerBlueprint {
  return new WorkshopDesignerBlueprint();
}
