/**
 * TutorialArchitect Blueprint - 技术教程架构师 (Story 4.2)
 * @module knowledge-studio/blueprint/blueprints/geek
 *
 * 将文档和问答素材转换为结构化技术教程。
 *
 * 目标用户: 技术作者、开发者教育者
 * 输入: 文档 + 问答素材
 * 输出: MDX 格式教程（学习目标、前置知识、分步指南、FAQ、进阶资源）
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
 * 学习目标
 */
interface LearningObjective {
  /** 目标ID */
  id: string;
  /** 目标描述 */
  description: string;
  /** 目标类型 */
  type: "knowledge" | "skill" | "attitude";
  /** Bloom 认知层级 */
  bloomLevel?:
    | "remember"
    | "understand"
    | "apply"
    | "analyze"
    | "evaluate"
    | "create";
}

/**
 * 前置知识项
 */
interface Prerequisite {
  /** 知识ID */
  id: string;
  /** 知识名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 推荐资源链接（可选） */
  resourceUrl?: string;
  /** 是否必须 */
  required: boolean;
}

/**
 * 教程步骤
 */
interface TutorialStep {
  /** 步骤ID */
  id: string;
  /** 步骤序号 */
  stepNumber: number;
  /** 步骤标题 */
  title: string;
  /** 步骤内容 (Markdown/MDX) */
  content: string;
  /** 代码示例（如有） */
  codeExample?: {
    language: string;
    code: string;
    filename?: string;
    highlightLines?: number[];
  };
  /** 预期结果 */
  expectedResult?: string;
  /** 常见错误 */
  commonMistakes?: string[];
  /** 预估时间（分钟） */
  estimatedMinutes?: number;
}

/**
 * FAQ 条目
 */
interface FaqItem {
  /** FAQ ID */
  id: string;
  /** 问题 */
  question: string;
  /** 答案 (Markdown) */
  answer: string;
  /** 相关步骤ID（可选） */
  relatedStepId?: string;
  /** 标签 */
  tags?: string[];
}

/**
 * 进阶资源
 */
interface AdvancedResource {
  /** 资源ID */
  id: string;
  /** 资源标题 */
  title: string;
  /** 资源类型 */
  type: "documentation" | "video" | "article" | "course" | "book" | "tool";
  /** 资源链接 */
  url?: string;
  /** 描述 */
  description: string;
  /** 难度 */
  difficulty?: "beginner" | "intermediate" | "advanced";
}

/**
 * TutorialArchitect 输出类型
 */
export interface TutorialArchitectOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 教程标题 */
  title: string;
  /** 教程简介 */
  introduction: string;
  /** 目标读者描述 */
  targetAudience: string;
  /** 学习目标 */
  learningObjectives: LearningObjective[];
  /** 前置知识 */
  prerequisites: Prerequisite[];
  /** 教程步骤 */
  steps: TutorialStep[];
  /** FAQ 列表 */
  faq: FaqItem[];
  /** 进阶资源 */
  advancedResources: AdvancedResource[];
  /** 总结 */
  summary: string;
  /** 预估总时长（分钟） */
  estimatedTotalMinutes: number;
  /** 难度等级 */
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * TutorialArchitect 蓝图
 *
 * 将文档和问答素材转换为完整的技术教程。
 *
 * 生成内容包含：
 * - 学习目标（基于 Bloom 分类法）
 * - 前置知识清单
 * - 分步实操指南（含代码示例）
 * - FAQ 常见问题
 * - 进阶学习资源
 */
export class TutorialArchitectBlueprint extends EnhancedBlueprintEngine<TutorialArchitectOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "geek-tutorial_architect";
  readonly displayName = "技术教程";
  readonly description =
    "将文档和问答素材转换为 MDX 格式技术教程，包含学习目标、分步指南、FAQ 和进阶资源";
  readonly icon = "📖";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "tech_writer",
    "developer",
    "content_creator",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "geek" as const;
  readonly priority = 2; // P0 高优先级
  readonly isNew = true;
  readonly tags = ["教程", "技术写作", "MDX", "学习"];
  readonly examplePrompts = [
    "将这份 API 文档转换为入门教程",
    "基于这些问答创建 React Hooks 教程",
    "把这些笔记整理成 Docker 入门指南",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "audience_level",
        type: "single_choice",
        category: "audience",
        question: "目标读者的技术水平？",
        options: [
          { value: "beginner", label: "初学者", description: "刚接触该技术" },
          {
            value: "intermediate",
            label: "中级",
            description: "有一定基础经验",
          },
          { value: "advanced", label: "高级", description: "寻求深入理解" },
        ],
        required: true,
        defaultValue: "intermediate",
      },
      {
        id: "tutorial_goal",
        type: "multi_choice",
        category: "objective",
        question: "教程的核心目标？",
        options: [
          {
            value: "quick_start",
            label: "快速上手",
            description: "5分钟跑通示例",
          },
          {
            value: "deep_dive",
            label: "深入理解",
            description: "原理+最佳实践",
          },
          {
            value: "troubleshooting",
            label: "问题排查",
            description: "常见错误解决",
          },
          {
            value: "project_based",
            label: "项目实战",
            description: "完整项目案例",
          },
        ],
        required: true,
        defaultValue: ["quick_start", "deep_dive"],
      },
      {
        id: "output_format",
        type: "single_choice",
        category: "constraint",
        question: "期望的教程风格？",
        options: [
          {
            value: "concise",
            label: "精简直接",
            description: "代码为主，文字为辅",
          },
          { value: "detailed", label: "详细讲解", description: "每步都有解释" },
          {
            value: "interactive",
            label: "互动练习",
            description: "含思考题和挑战",
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
   * 生成教程大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析素材结构...");

    // 构建大纲生成配置
    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位经验丰富的技术教程作者，正在为以下素材设计教程大纲。

${briefingPrompt}

请生成包含以下部分的教程大纲：

1. **学习目标** (2-4 条)
   - 使用「能够...」「理解...」「掌握...」等动词开头
   - 目标应该具体可衡量

2. **前置知识** (1-3 条)
   - 列出读者需要预先了解的知识
   - 标注是否必须

3. **分步指南** (3-8 步)
   - 每步有清晰的标题和目标
   - 步骤之间有逻辑递进关系

4. **FAQ** (3-5 条)
   - 预测读者可能遇到的问题
   - 包含常见错误和解决方案

5. **进阶资源** (2-4 条)
   - 推荐深入学习的资源

每个部分需要包含 2-3 个要点。
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
    yield* this.reportProgress("content", 10, "开始生成教程内容...");

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
  ): Promise<TutorialArchitectOutput> {
    const outline = context.outline;

    // 解析各部分内容
    const learningObjectives = this.parseLearningObjectives(rawContent);
    const prerequisites = this.parsePrerequisites(rawContent);
    const steps = this.parseSteps(rawContent, outline);
    const faq = this.parseFaq(rawContent);
    const advancedResources = this.parseAdvancedResources(rawContent);

    // 计算总时长
    const estimatedTotalMinutes = steps.reduce(
      (sum, step) => sum + (step.estimatedMinutes ?? 5),
      0,
    );

    // 推断难度
    const difficultyLevel = this.inferDifficultyLevel(rawContent, context);

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title: outline?.title ?? this.extractTitle(rawContent) ?? "技术教程",
      introduction: this.extractIntroduction(rawContent),
      targetAudience: this.extractTargetAudience(rawContent, context),
      learningObjectives,
      prerequisites,
      steps,
      faq,
      advancedResources,
      summary: this.extractSummary(rawContent),
      estimatedTotalMinutes,
      difficultyLevel,
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
        introduction: { type: "string" },
        targetAudience: { type: "string" },
        learningObjectives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              type: {
                type: "string",
                enum: ["knowledge", "skill", "attitude"],
              },
              bloomLevel: {
                type: "string",
                enum: [
                  "remember",
                  "understand",
                  "apply",
                  "analyze",
                  "evaluate",
                  "create",
                ],
              },
            },
            required: ["id", "description", "type"],
          },
        },
        prerequisites: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              resourceUrl: { type: "string", format: "uri" },
              required: { type: "boolean" },
            },
            required: ["id", "name", "description", "required"],
          },
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              stepNumber: { type: "number" },
              title: { type: "string" },
              content: { type: "string" },
              codeExample: {
                type: "object",
                properties: {
                  language: { type: "string" },
                  code: { type: "string" },
                  filename: { type: "string" },
                  highlightLines: { type: "array", items: { type: "number" } },
                },
                required: ["language", "code"],
              },
              expectedResult: { type: "string" },
              commonMistakes: { type: "array", items: { type: "string" } },
              estimatedMinutes: { type: "number" },
            },
            required: ["id", "stepNumber", "title", "content"],
          },
        },
        faq: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              answer: { type: "string" },
              relatedStepId: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["id", "question", "answer"],
          },
        },
        advancedResources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "documentation",
                  "video",
                  "article",
                  "course",
                  "book",
                  "tool",
                ],
              },
              url: { type: "string", format: "uri" },
              description: { type: "string" },
              difficulty: {
                type: "string",
                enum: ["beginner", "intermediate", "advanced"],
              },
            },
            required: ["id", "title", "type", "description"],
          },
        },
        summary: { type: "string" },
        estimatedTotalMinutes: { type: "number" },
        difficultyLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced"],
        },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "introduction",
        "targetAudience",
        "learningObjectives",
        "prerequisites",
        "steps",
        "faq",
        "advancedResources",
        "summary",
        "estimatedTotalMinutes",
        "difficultyLevel",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 解析学习目标
   */
  private parseLearningObjectives(content: string): LearningObjective[] {
    const objectives: LearningObjective[] = [];
    const sectionMatch = content.match(
      /(?:学习目标|Learning Objectives?)[：:][^]*?(?=##|$)/i,
    );

    if (sectionMatch) {
      const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, "").trim();
          objectives.push({
            id: `objective-${index + 1}`,
            description: text,
            type: this.inferObjectiveType(text),
            bloomLevel: this.inferBloomLevel(text),
          });
        });
      }
    }

    // 默认目标
    if (objectives.length === 0) {
      objectives.push(
        {
          id: "objective-1",
          description: "理解核心概念",
          type: "knowledge",
          bloomLevel: "understand",
        },
        {
          id: "objective-2",
          description: "能够实践操作",
          type: "skill",
          bloomLevel: "apply",
        },
      );
    }

    return objectives;
  }

  /**
   * 推断目标类型
   */
  private inferObjectiveType(text: string): "knowledge" | "skill" | "attitude" {
    if (/能够|实现|创建|编写|构建|开发/i.test(text)) return "skill";
    if (/态度|意识|价值|重视/i.test(text)) return "attitude";
    return "knowledge";
  }

  /**
   * 推断 Bloom 认知层级
   */
  private inferBloomLevel(text: string): LearningObjective["bloomLevel"] {
    if (/创建|设计|构建|开发|compose/i.test(text)) return "create";
    if (/评估|判断|比较|critique/i.test(text)) return "evaluate";
    if (/分析|区分|organize/i.test(text)) return "analyze";
    if (/应用|使用|实现|implement/i.test(text)) return "apply";
    if (/理解|解释|描述|explain/i.test(text)) return "understand";
    return "remember";
  }

  /**
   * 解析前置知识
   */
  private parsePrerequisites(content: string): Prerequisite[] {
    const prerequisites: Prerequisite[] = [];
    const sectionMatch = content.match(
      /(?:前置知识|Prerequisites?)[：:][^]*?(?=##|$)/i,
    );

    if (sectionMatch) {
      const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, "").trim();
          const isRequired = !/可选|optional/i.test(text);
          prerequisites.push({
            id: `prereq-${index + 1}`,
            name: text.split(/[：:]/)[0].trim(),
            description: text,
            required: isRequired,
          });
        });
      }
    }

    // 默认前置知识
    if (prerequisites.length === 0) {
      prerequisites.push({
        id: "prereq-1",
        name: "基础编程知识",
        description: "了解变量、函数、循环等基础概念",
        required: true,
      });
    }

    return prerequisites;
  }

  /**
   * 解析教程步骤
   */
  private parseSteps(
    content: string,
    outline?: BlueprintOutline,
  ): TutorialStep[] {
    const steps: TutorialStep[] = [];

    // 匹配步骤标题模式
    const stepRegex = /(?:步骤|Step)\s*(\d+)[：:\s]+(.+?)(?=\n)/gi;
    const matches = [...content.matchAll(stepRegex)];

    if (matches.length > 0) {
      matches.forEach((match, index) => {
        const stepNumber = parseInt(match[1], 10);
        const title = match[2].trim();
        const startIndex = match.index ?? 0;
        const endIndex =
          index < matches.length - 1
            ? matches[index + 1].index
            : content.length;
        const stepContent = content.slice(startIndex, endIndex).trim();

        steps.push({
          id: `step-${stepNumber}`,
          stepNumber,
          title,
          content: stepContent,
          codeExample: this.extractCodeExample(stepContent),
          expectedResult: this.extractExpectedResult(stepContent),
          commonMistakes: this.extractCommonMistakes(stepContent),
          estimatedMinutes: this.estimateStepDuration(stepContent),
        });
      });
    } else if (outline?.nodes) {
      // 从大纲生成步骤
      outline.nodes.forEach((node, index) => {
        steps.push({
          id: node.id,
          stepNumber: index + 1,
          title: node.title,
          content: node.description ?? "",
          estimatedMinutes: 5,
        });
      });
    }

    return steps;
  }

  /**
   * 提取代码示例
   */
  private extractCodeExample(
    content: string,
  ): TutorialStep["codeExample"] | undefined {
    const codeMatch = content.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return {
        language: codeMatch[1] ?? "text",
        code: codeMatch[2].trim(),
      };
    }
    return undefined;
  }

  /**
   * 提取预期结果
   */
  private extractExpectedResult(content: string): string | undefined {
    const resultMatch = content.match(
      /(?:预期结果|Expected Result)[：:]\s*(.+)/i,
    );
    return resultMatch?.[1]?.trim();
  }

  /**
   * 提取常见错误
   */
  private extractCommonMistakes(content: string): string[] | undefined {
    const mistakes: string[] = [];
    const mistakeMatch = content.match(
      /(?:常见错误|Common Mistakes?)[：:][^]*?(?=##|$)/i,
    );

    if (mistakeMatch) {
      const listItems = mistakeMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.forEach((item) => {
          mistakes.push(item.replace(/^[-*]\s+/, "").trim());
        });
      }
    }

    return mistakes.length > 0 ? mistakes : undefined;
  }

  /**
   * 估算步骤时长
   */
  private estimateStepDuration(content: string): number {
    const wordCount = content.length;
    const hasCode = /```/.test(content);

    // 基础时间 + 代码时间
    let minutes = Math.ceil(wordCount / 500) + 2;
    if (hasCode) minutes += 3;

    return Math.max(3, Math.min(15, minutes));
  }

  /**
   * 解析 FAQ
   */
  private parseFaq(content: string): FaqItem[] {
    const faq: FaqItem[] = [];
    const sectionMatch = content.match(
      /(?:FAQ|常见问题)[：:][^]*?(?=##\s*[^#]|$)/i,
    );

    if (sectionMatch) {
      // 匹配 Q: ... A: ... 模式
      const qaRegex =
        /(?:Q|问)[：:]\s*(.+?)\s*(?:A|答)[：:]\s*([\s\S]+?)(?=(?:Q|问)[：:]|$)/gi;
      const matches = [...sectionMatch[0].matchAll(qaRegex)];

      matches.forEach((match, index) => {
        faq.push({
          id: `faq-${index + 1}`,
          question: match[1].trim(),
          answer: match[2].trim(),
        });
      });
    }

    // 默认 FAQ
    if (faq.length === 0) {
      faq.push(
        {
          id: "faq-1",
          question: "遇到问题怎么办？",
          answer: "请查阅官方文档或在社区提问。",
        },
        {
          id: "faq-2",
          question: "如何深入学习？",
          answer: "参考进阶资源部分的推荐内容。",
        },
      );
    }

    return faq;
  }

  /**
   * 解析进阶资源
   */
  private parseAdvancedResources(content: string): AdvancedResource[] {
    const resources: AdvancedResource[] = [];
    const sectionMatch = content.match(
      /(?:进阶资源|Advanced Resources?|Further Reading)[：:][^]*?(?=##|$)/i,
    );

    if (sectionMatch) {
      const listItems = sectionMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        listItems.forEach((item, index) => {
          const text = item.replace(/^[-*]\s+/, "").trim();
          const urlMatch = text.match(/\[(.+?)\]\((.+?)\)/);

          resources.push({
            id: `resource-${index + 1}`,
            title: urlMatch ? urlMatch[1] : text.split(/[：:]/)[0].trim(),
            type: this.inferResourceType(text),
            url: urlMatch?.[2],
            description: text,
          });
        });
      }
    }

    // 默认资源
    if (resources.length === 0) {
      resources.push(
        {
          id: "resource-1",
          title: "官方文档",
          type: "documentation",
          description: "查阅官方文档获取最新信息",
        },
        {
          id: "resource-2",
          title: "社区论坛",
          type: "article",
          description: "加入社区获取帮助和分享经验",
        },
      );
    }

    return resources;
  }

  /**
   * 推断资源类型
   */
  private inferResourceType(text: string): AdvancedResource["type"] {
    if (/video|视频|youtube/i.test(text)) return "video";
    if (/course|课程|教程/i.test(text)) return "course";
    if (/book|书|图书/i.test(text)) return "book";
    if (/tool|工具/i.test(text)) return "tool";
    if (/doc|文档/i.test(text)) return "documentation";
    return "article";
  }

  /**
   * 提取标题
   */
  private extractTitle(content: string): string | undefined {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch?.[1]?.trim();
  }

  /**
   * 提取简介
   */
  private extractIntroduction(content: string): string {
    const introMatch = content.match(
      /(?:简介|Introduction)[：:]\s*([\s\S]+?)(?=##|$)/i,
    );
    if (introMatch) return introMatch[1].trim();

    // 尝试获取第一段
    const firstParagraph = content.match(/^#.+\n\n(.+?)(?=\n\n|##)/s);
    return firstParagraph?.[1]?.trim() ?? "本教程将带你学习相关技术知识。";
  }

  /**
   * 提取目标受众
   */
  private extractTargetAudience(
    content: string,
    context: BlueprintExecutionContext,
  ): string {
    const audienceMatch = content.match(
      /(?:目标读者|Target Audience)[：:]\s*(.+)/i,
    );
    if (audienceMatch) return audienceMatch[1].trim();

    // 从 Briefing 上下文推断
    const briefingContext = (
      context as { briefingContext?: { answers?: Record<string, string> } }
    ).briefingContext;
    const audienceLevel = briefingContext?.answers?.["audience_level"];

    switch (audienceLevel) {
      case "beginner":
        return "刚接触该技术的初学者";
      case "advanced":
        return "寻求深入理解的高级开发者";
      default:
        return "有一定基础经验的中级开发者";
    }
  }

  /**
   * 提取总结
   */
  private extractSummary(content: string): string {
    const summaryMatch = content.match(
      /(?:总结|Summary|Conclusion)[：:]\s*([\s\S]+?)(?=##|$)/i,
    );
    return summaryMatch?.[1]?.trim() ?? "恭喜完成本教程！继续探索进阶内容吧。";
  }

  /**
   * 推断难度级别
   */
  private inferDifficultyLevel(
    content: string,
    context: BlueprintExecutionContext,
  ): TutorialArchitectOutput["difficultyLevel"] {
    // 从 Briefing 上下文获取
    const briefingContext = (
      context as { briefingContext?: { answers?: Record<string, string> } }
    ).briefingContext;
    const audienceLevel = briefingContext?.answers?.["audience_level"];

    if (audienceLevel === "beginner") return "beginner";
    if (audienceLevel === "advanced") return "advanced";

    // 基于内容推断
    const advancedKeywords = [
      "高级",
      "深入",
      "底层",
      "源码",
      "advanced",
      "deep",
    ];
    const beginnerKeywords = ["入门", "基础", "简单", "beginner", "basic"];

    for (const keyword of advancedKeywords) {
      if (content.toLowerCase().includes(keyword)) return "advanced";
    }
    for (const keyword of beginnerKeywords) {
      if (content.toLowerCase().includes(keyword)) return "beginner";
    }

    return "intermediate";
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
    return ["教程", "技术", "学习"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 TutorialArchitect 蓝图实例
 */
export function createTutorialArchitectBlueprint(): TutorialArchitectBlueprint {
  return new TutorialArchitectBlueprint();
}
