/**
 * Scriptwriter Blueprint - 视频编剧 (Story 5.1)
 * @module knowledge-studio/blueprint/blueprints/creator
 *
 * 将素材转换为专业分镜脚本。
 *
 * 目标用户: 视频创作者、UP主、YouTuber
 * 输入: 内容素材、参考资料
 * 输出: 分镜脚本 (含时间线)
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
 * 单个分镜
 */
interface Shot {
  /** 分镜编号 */
  shotNumber: number;
  /** 时间点 (秒) */
  timestamp: number;
  /** 时长 (秒) */
  duration: number;
  /** 画面描述 */
  visual: string;
  /** 旁白/台词 */
  narration: string;
  /** B-roll 建议 */
  brollSuggestions?: string[];
  /** 转场类型 */
  transition?: string;
  /** 音效/音乐提示 */
  audioNotes?: string;
}

/**
 * 视频段落
 */
interface VideoSection {
  /** 段落ID */
  id: string;
  /** 段落名称 */
  name: string;
  /** 段落类型 */
  type: "hook" | "intro" | "body" | "conclusion" | "cta";
  /** 该段落的分镜列表 */
  shots: Shot[];
  /** 段落时长 (秒) */
  totalDuration: number;
}

/**
 * Scriptwriter 输出类型
 */
export interface ScriptwriterOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 视频标题 */
  videoTitle: string;
  /** 视频类型 */
  videoType: string;
  /** 目标时长 (秒) */
  targetDuration: number;
  /** 实际预估时长 (秒) */
  estimatedDuration: number;
  /** 开场 Hook (前5秒描述) */
  openingHook: string;
  /** 视频段落 */
  sections: VideoSection[];
  /** 结尾 CTA */
  closingCta: string;
  /** 视频风格 */
  style: string;
  /** 背景音乐建议 */
  musicSuggestions?: string[];
  /** 设备/器材建议 */
  equipmentNotes?: string[];
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * Scriptwriter 蓝图
 *
 * 将素材转换为专业分镜脚本。
 *
 * 生成内容包含：
 * - 开场 hook（前 5 秒）
 * - 分镜列表（时间点、画面、旁白、B-roll 建议）
 * - 转场提示
 * - 结尾 CTA
 */
export class ScriptwriterBlueprint extends EnhancedBlueprintEngine<ScriptwriterOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "creator-scriptwriter";
  readonly displayName = "视频编剧";
  readonly description =
    "将素材转换为专业分镜脚本，支持时间线可视化和多格式导出";
  readonly icon = "🎬";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "video_creator",
    "content_creator",
    "marketer",
  ];

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "creator" as const;
  readonly priority = 1;
  readonly isNew = true;
  readonly tags = ["视频", "脚本", "分镜", "创作"];
  readonly examplePrompts = [
    "根据这篇产品介绍生成3分钟短视频脚本",
    "把这个技术教程转换成YouTube视频分镜",
    "为这个新闻稿创建B站视频脚本",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "video_type",
        type: "single_choice",
        category: "context",
        question: "视频类型？",
        options: [
          {
            value: "explainer",
            label: "讲解型",
            description: "知识分享、教程、科普",
          },
          {
            value: "vlog",
            label: "Vlog型",
            description: "日常记录、体验分享",
          },
          {
            value: "promotional",
            label: "推广型",
            description: "产品介绍、品牌宣传",
          },
          {
            value: "documentary",
            label: "纪录型",
            description: "深度报道、人物专访",
          },
        ],
        required: true,
        defaultValue: "explainer",
      },
      {
        id: "target_duration",
        type: "single_choice",
        category: "constraint",
        question: "目标视频时长？",
        options: [
          { value: "short", label: "短视频", description: "1-3分钟" },
          { value: "medium", label: "中等", description: "5-10分钟" },
          { value: "long", label: "长视频", description: "15-30分钟" },
        ],
        required: true,
        defaultValue: "medium",
      },
      {
        id: "style",
        type: "single_choice",
        category: "tone",
        question: "视频风格？",
        options: [
          {
            value: "professional",
            label: "专业正式",
            description: "企业、商务场景",
          },
          {
            value: "casual",
            label: "轻松自然",
            description: "日常、生活化",
          },
          {
            value: "energetic",
            label: "活力动感",
            description: "快节奏、年轻化",
          },
          {
            value: "cinematic",
            label: "电影质感",
            description: "叙事性、艺术化",
          },
        ],
        required: false,
        defaultValue: "casual",
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
   * 生成脚本大纲
   */
  async *generateOutline(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析素材内容...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const targetDuration = this.getTargetDuration(input);

    const outlinePrompt = `
你是一位资深视频编剧，正在为以下素材创建分镜脚本大纲。

${briefingPrompt}

目标视频时长：约 ${Math.floor(targetDuration / 60)} 分钟

请生成包含以下结构的大纲：
1. 开场 Hook（0-5秒）- 抓住观众注意力
2. 引入段（5-30秒）- 介绍主题和价值主张
3. 正文段落（核心内容分3-5个要点）
4. 总结段 - 回顾要点
5. 结尾 CTA - 引导观众行动

每个段落需要包含：
- 预估时长
- 主要内容摘要
- 视觉风格建议
`;

    yield* this.reportProgress("outline", 30, "生成脚本结构...");

    const materialContents = input.materials.map((m) => m.content).join("\n\n");
    const result = await generateOutline({
      materialContent: materialContents,
      customPrompt: outlinePrompt,
      blueprintType: "scriptwriter",
    });

    yield* this.reportProgress("outline", 100, "大纲生成完成");

    return result.outline;
  }

  /**
   * 基于大纲生成分镜脚本
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成分镜脚本...");

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
      blueprintType: "scriptwriter",
    });

    for await (const chunk of stream) {
      if (chunk.type === "text" && chunk.data.text) {
        fullContent += chunk.data.text;
        yield chunk;
      } else if (chunk.type === "progress" && chunk.data.percent) {
        yield* this.reportProgress(
          "content",
          10 + chunk.data.percent * 0.8,
          chunk.data.step ?? "生成分镜中...",
        );
      }
    }

    yield* this.reportProgress("content", 100, "分镜脚本生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为输出格式
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<ScriptwriterOutput> {
    const outline = context.outline;
    const sections = this.parseContentToSections(rawContent, outline);
    const targetDuration = this.getTargetDurationFromContext(context);
    const estimatedDuration = sections.reduce(
      (sum, s) => sum + s.totalDuration,
      0,
    );

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      videoTitle: outline?.title ?? this.extractVideoTitle(rawContent),
      videoType: this.extractVideoType(context),
      targetDuration,
      estimatedDuration,
      openingHook: this.extractOpeningHook(rawContent, sections),
      sections,
      closingCta: this.extractClosingCta(rawContent, sections),
      style: this.extractStyle(context),
      musicSuggestions: this.extractMusicSuggestions(rawContent),
      equipmentNotes: this.extractEquipmentNotes(rawContent),
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
        videoTitle: { type: "string" },
        videoType: {
          type: "string",
          enum: ["explainer", "vlog", "promotional", "documentary"],
        },
        targetDuration: { type: "number", minimum: 0 },
        estimatedDuration: { type: "number", minimum: 0 },
        openingHook: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: {
                type: "string",
                enum: ["hook", "intro", "body", "conclusion", "cta"],
              },
              shots: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    shotNumber: { type: "number", minimum: 1 },
                    timestamp: { type: "number", minimum: 0 },
                    duration: { type: "number", minimum: 0 },
                    visual: { type: "string" },
                    narration: { type: "string" },
                    brollSuggestions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    transition: { type: "string" },
                    audioNotes: { type: "string" },
                  },
                  required: [
                    "shotNumber",
                    "timestamp",
                    "duration",
                    "visual",
                    "narration",
                  ],
                },
              },
              totalDuration: { type: "number", minimum: 0 },
            },
            required: ["id", "name", "type", "shots", "totalDuration"],
          },
        },
        closingCta: { type: "string" },
        style: { type: "string" },
        musicSuggestions: { type: "array", items: { type: "string" } },
        equipmentNotes: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "videoTitle",
        "videoType",
        "targetDuration",
        "estimatedDuration",
        "openingHook",
        "sections",
        "closingCta",
        "style",
      ],
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 获取目标时长（秒）
   */
  private getTargetDuration(input: EnhancedBlueprintInput): number {
    const durationAnswer =
      input.briefingContext?.answers?.target_duration ?? "medium";
    const durationMap: Record<string, number> = {
      short: 120, // 2分钟
      medium: 420, // 7分钟
      long: 1200, // 20分钟
    };
    return durationMap[durationAnswer as string] ?? 420;
  }

  /**
   * 从上下文获取目标时长
   */
  private getTargetDurationFromContext(
    _context: BlueprintExecutionContext,
  ): number {
    // 默认7分钟
    return 420;
  }

  /**
   * 解析内容为视频段落
   */
  private parseContentToSections(
    content: string,
    outline?: BlueprintOutline,
  ): VideoSection[] {
    const sections: VideoSection[] = [];
    let shotNumber = 1;
    let currentTimestamp = 0;

    // 定义段落类型映射
    const sectionTypes: Array<{
      type: VideoSection["type"];
      name: string;
      defaultDuration: number;
    }> = [
      { type: "hook", name: "开场 Hook", defaultDuration: 5 },
      { type: "intro", name: "引入段", defaultDuration: 25 },
      { type: "body", name: "正文段", defaultDuration: 180 },
      { type: "conclusion", name: "总结段", defaultDuration: 30 },
      { type: "cta", name: "结尾 CTA", defaultDuration: 10 },
    ];

    if (outline?.nodes) {
      for (let i = 0; i < outline.nodes.length; i++) {
        const node = outline.nodes[i];
        const sectionType =
          sectionTypes[i] ?? sectionTypes[sectionTypes.length - 1];
        const sectionContent = this.extractSectionContent(content, node.title);
        const shots = this.parseShotsFromContent(
          sectionContent,
          shotNumber,
          currentTimestamp,
        );

        const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
        currentTimestamp += totalDuration;
        shotNumber += shots.length;

        sections.push({
          id: node.id,
          name: node.title,
          type: sectionType.type,
          shots,
          totalDuration,
        });
      }
    } else {
      // 如果没有大纲，使用默认结构
      for (const sectionType of sectionTypes) {
        const shots: Shot[] = [
          {
            shotNumber: shotNumber++,
            timestamp: currentTimestamp,
            duration: sectionType.defaultDuration,
            visual: `${sectionType.name}画面`,
            narration: `${sectionType.name}旁白内容`,
          },
        ];
        currentTimestamp += sectionType.defaultDuration;

        sections.push({
          id: `section-${sectionType.type}`,
          name: sectionType.name,
          type: sectionType.type,
          shots,
          totalDuration: sectionType.defaultDuration,
        });
      }
    }

    return sections;
  }

  /**
   * 从内容中解析分镜
   */
  private parseShotsFromContent(
    content: string,
    startingShotNumber: number,
    startingTimestamp: number,
  ): Shot[] {
    const shots: Shot[] = [];
    let currentTimestamp = startingTimestamp;
    let shotNumber = startingShotNumber;

    // 尝试解析分镜标记
    const shotRegex =
      /(?:分镜|Shot|镜头)\s*(\d+)[：:]\s*([\s\S]*?)(?=(?:分镜|Shot|镜头)\s*\d+|$)/gi;
    let match;

    while ((match = shotRegex.exec(content)) !== null) {
      const shotContent = match[2];
      const duration = this.estimateShotDuration(shotContent);

      shots.push({
        shotNumber: shotNumber++,
        timestamp: currentTimestamp,
        duration,
        visual: this.extractVisual(shotContent),
        narration: this.extractNarration(shotContent),
        brollSuggestions: this.extractBrollSuggestions(shotContent),
        transition: this.extractTransition(shotContent),
        audioNotes: this.extractAudioNotes(shotContent),
      });

      currentTimestamp += duration;
    }

    // 如果没有找到分镜标记，创建默认分镜
    if (shots.length === 0) {
      const defaultDuration = 30;
      shots.push({
        shotNumber: shotNumber,
        timestamp: currentTimestamp,
        duration: defaultDuration,
        visual: this.extractVisual(content) || "主画面",
        narration: this.extractNarration(content) || content.slice(0, 200),
      });
    }

    return shots;
  }

  /**
   * 提取章节内容
   */
  private extractSectionContent(content: string, title: string): string {
    const escapedTitle = this.escapeRegex(title);
    const titleRegex = new RegExp(
      `#{1,3}\\s*${escapedTitle}[\\s\\S]*?(?=#{1,3}\\s|$)`,
      "i",
    );
    const match = content.match(titleRegex);
    return match ? match[0].trim() : "";
  }

  /**
   * 估算分镜时长
   */
  private estimateShotDuration(content: string): number {
    // 基于文字长度估算（假设每秒5个字）
    const charCount = content.replace(/\s/g, "").length;
    const estimatedSeconds = Math.ceil(charCount / 5);
    return Math.max(3, Math.min(60, estimatedSeconds));
  }

  /**
   * 提取画面描述
   */
  private extractVisual(content: string): string {
    const visualMatch = content.match(/(?:画面|Visual)[：:]\s*(.+)/i);
    return visualMatch?.[1]?.trim() ?? "";
  }

  /**
   * 提取旁白
   */
  private extractNarration(content: string): string {
    const narrationMatch = content.match(
      /(?:旁白|台词|Narration|Script)[：:]\s*(.+)/i,
    );
    return narrationMatch?.[1]?.trim() ?? "";
  }

  /**
   * 提取 B-roll 建议
   */
  private extractBrollSuggestions(content: string): string[] {
    const brollMatch = content.match(/(?:B-?roll|素材)[：:]\s*(.+)/i);
    if (brollMatch) {
      return brollMatch[1]
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * 提取转场
   */
  private extractTransition(content: string): string | undefined {
    const transitionMatch = content.match(/(?:转场|Transition)[：:]\s*(.+)/i);
    return transitionMatch?.[1]?.trim();
  }

  /**
   * 提取音效/音乐提示
   */
  private extractAudioNotes(content: string): string | undefined {
    const audioMatch = content.match(/(?:音效|音乐|Audio|Music)[：:]\s*(.+)/i);
    return audioMatch?.[1]?.trim();
  }

  /**
   * 提取视频标题
   */
  private extractVideoTitle(content: string): string {
    const titleMatch = content.match(/(?:标题|Title)[：:]\s*(.+)/i);
    return titleMatch?.[1]?.trim() ?? "未命名视频";
  }

  /**
   * 提取视频类型
   */
  private extractVideoType(_context: BlueprintExecutionContext): string {
    return "explainer";
  }

  /**
   * 提取开场 Hook
   */
  private extractOpeningHook(
    content: string,
    sections: VideoSection[],
  ): string {
    const hookSection = sections.find((s) => s.type === "hook");
    if (hookSection && hookSection.shots.length > 0) {
      return hookSection.shots[0].narration;
    }

    const hookMatch = content.match(/(?:Hook|开场)[：:]\s*(.+)/i);
    return hookMatch?.[1]?.trim() ?? "欢迎收看本期视频！";
  }

  /**
   * 提取结尾 CTA
   */
  private extractClosingCta(content: string, sections: VideoSection[]): string {
    const ctaSection = sections.find((s) => s.type === "cta");
    if (ctaSection && ctaSection.shots.length > 0) {
      return ctaSection.shots[0].narration;
    }

    const ctaMatch = content.match(/(?:CTA|号召|行动)[：:]\s*(.+)/i);
    return ctaMatch?.[1]?.trim() ?? "如果觉得有用，记得点赞关注！";
  }

  /**
   * 提取风格
   */
  private extractStyle(_context: BlueprintExecutionContext): string {
    return "casual";
  }

  /**
   * 提取音乐建议
   */
  private extractMusicSuggestions(content: string): string[] {
    const musicMatch = content.match(/(?:背景音乐|BGM)[：:]\s*(.+)/i);
    if (musicMatch) {
      return musicMatch[1]
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return ["轻快的电子音乐", "温馨的钢琴曲"];
  }

  /**
   * 提取设备建议
   */
  private extractEquipmentNotes(content: string): string[] {
    const equipMatch = content.match(/(?:设备|器材|Equipment)[：:]\s*(.+)/i);
    if (equipMatch) {
      return equipMatch[1]
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);
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
    return ["视频", "分镜", "脚本"];
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 Scriptwriter 蓝图实例
 */
export function createScriptwriterBlueprint(): ScriptwriterBlueprint {
  return new ScriptwriterBlueprint();
}
