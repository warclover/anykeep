/**
 * SeoPillar Blueprint - SEO霸屏专家 (Story 7.3)
 * @module knowledge-studio/blueprint/blueprints/professional
 *
 * 将碎片化内容转换为长青 SEO 内容架构。
 *
 * 目标用户: 内容营销人员、SEO专家、独立博主
 * 输入: 碎片化笔记、灵感、关键词列表
 * 输出: 结构化 Pillar-Cluster 内容策略
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
 * Pillar 页面结构
 */
interface PillarPage {
  /** 页面ID */
  id: string;
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description: string;
  /** 目标关键词 */
  targetKeyword: string;
  /** 次要关键词 */
  secondaryKeywords: string[];
  /** 预估字数 */
  estimatedWordCount: number;
  /** 内容大纲 */
  outline: string[];
  /** H2 章节 */
  sections: PillarSection[];
  /** 元描述 */
  metaDescription: string;
  /** URL Slug 建议 */
  suggestedSlug: string;
}

/**
 * Pillar 页面章节
 */
interface PillarSection {
  /** 章节ID */
  id: string;
  /** 章节标题 (H2) */
  title: string;
  /** 章节摘要 */
  summary: string;
  /** 关联的 Cluster 页面ID */
  relatedClusterIds: string[];
}

/**
 * Cluster 页面
 */
interface ClusterPage {
  /** 页面ID */
  id: string;
  /** 所属 Pillar 页面ID */
  pillarId: string;
  /** 页面标题 */
  title: string;
  /** 目标长尾关键词 */
  targetKeyword: string;
  /** 预估字数 */
  estimatedWordCount: number;
  /** 内容大纲 */
  outline: string[];
  /** 搜索意图 */
  searchIntent:
    | "informational"
    | "navigational"
    | "transactional"
    | "commercial";
  /** 难度评估: easy | medium | hard */
  difficulty: "easy" | "medium" | "hard";
  /** 优先级: low | medium | high */
  priority: "low" | "medium" | "high";
  /** URL Slug 建议 */
  suggestedSlug: string;
}

/**
 * 关键词建议
 */
interface KeywordSuggestion {
  /** 关键词 */
  keyword: string;
  /** 搜索量级别: low | medium | high */
  searchVolume: "low" | "medium" | "high";
  /** 竞争程度: low | medium | high */
  competition: "low" | "medium" | "high";
  /** 搜索意图 */
  intent: "informational" | "navigational" | "transactional" | "commercial";
  /** 是否为长尾词 */
  isLongTail: boolean;
  /** 建议页面类型: pillar | cluster */
  suggestedType: "pillar" | "cluster";
}

/**
 * 内部链接策略
 */
interface InternalLinkStrategy {
  /** 来源页面ID */
  fromPageId: string;
  /** 目标页面ID */
  toPageId: string;
  /** 锚文本建议 */
  anchorText: string;
  /** 链接位置建议 */
  placementSuggestion: string;
  /** 优先级: low | medium | high */
  priority: "low" | "medium" | "high";
}

/**
 * 内容日历条目
 */
interface ContentCalendarEntry {
  /** 页面ID */
  pageId: string;
  /** 页面类型 */
  pageType: "pillar" | "cluster";
  /** 页面标题 */
  title: string;
  /** 建议发布周次 */
  suggestedWeek: number;
  /** 发布原因 */
  publishReason: string;
  /** 预估工时（小时） */
  estimatedHours: number;
  /** 依赖项（其他页面ID） */
  dependencies: string[];
}

/**
 * SeoPillar 输出类型
 */
export interface SeoPillarOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 蓝图ID */
  blueprintId: string;
  /** 策略标题 */
  title: string;
  /** 主题领域 */
  topicDomain: string;
  /** 策略概述 */
  strategyOverview: string;
  /** Pillar 页面列表 */
  pillarPages: PillarPage[];
  /** Cluster 页面列表 */
  clusterPages: ClusterPage[];
  /** 关键词建议 */
  keywordSuggestions: KeywordSuggestion[];
  /** 内部链接策略 */
  internalLinkStrategy: InternalLinkStrategy[];
  /** 内容日历 */
  contentCalendar: ContentCalendarEntry[];
  /** 预计总工时 */
  totalEstimatedHours: number;
  /** 预计覆盖关键词数量 */
  estimatedKeywordCoverage: number;
  /** 标签 */
  tags?: string[];
}

// ============================================================
// Blueprint Implementation
// ============================================================

/**
 * SeoPillar 蓝图
 *
 * 将碎片化内容转换为结构化的 SEO Pillar-Cluster 内容架构。
 *
 * 生成内容包含：
 * - Pillar 主页面结构设计
 * - Cluster 子页面规划
 * - 关键词建议和分析
 * - 内部链接策略
 * - 内容发布日历
 */
export class SeoPillarBlueprint extends EnhancedBlueprintEngine<SeoPillarOutput> {
  // ============================================================
  // Required Abstract Properties
  // ============================================================

  readonly blueprintId = "professional-seo_pillar";
  readonly displayName = "SEO 文章";
  readonly description =
    "将碎片化内容转换为 Pillar-Cluster SEO 架构，规划长青内容策略、关键词布局和内部链接";
  readonly icon = "🔍";
  readonly tier: BlueprintTier = "pro";
  readonly targetUsers: TargetUserGroup[] = [
    "marketer",
    "content_creator",
    "blogger",
  ];
  readonly creditsCost = 2; // Standard complexity blueprint

  // ============================================================
  // Optional Properties
  // ============================================================

  readonly category = "professional" as const;
  readonly priority = 3;
  readonly isNew = true;
  readonly tags = ["SEO", "内容策略", "关键词", "长青内容"];
  readonly examplePrompts = [
    "帮我规划一个关于 '远程工作' 的 SEO 内容架构",
    "将这些笔记转换为 SEO Pillar 页面大纲",
    "为我的博客规划一套 Python 教程的内容策略",
  ];

  // ============================================================
  // Briefing Configuration
  // ============================================================

  readonly briefingConfig: BriefingConfig = {
    enabled: true,
    maxQuestions: 3,
    questions: [
      {
        id: "content_goal",
        type: "single_choice",
        category: "objective",
        question: "内容策略的主要目标是什么？",
        options: [
          {
            value: "traffic",
            label: "流量增长",
            description: "最大化搜索流量和曝光",
          },
          {
            value: "authority",
            label: "建立权威",
            description: "成为领域专家和意见领袖",
          },
          {
            value: "conversion",
            label: "转化导向",
            description: "吸引潜在客户，提高转化率",
          },
          {
            value: "education",
            label: "教育用户",
            description: "帮助用户解决问题和学习",
          },
        ],
        required: true,
        defaultValue: "traffic",
      },
      {
        id: "content_scale",
        type: "single_choice",
        category: "constraint",
        question: "内容生产能力如何？",
        options: [
          {
            value: "solo",
            label: "个人独立",
            description: "每周 1-2 篇文章",
          },
          {
            value: "small_team",
            label: "小团队",
            description: "每周 3-5 篇文章",
          },
          {
            value: "content_team",
            label: "内容团队",
            description: "每周 5-10 篇文章",
          },
          {
            value: "agency",
            label: "代理/大团队",
            description: "每周 10+ 篇文章",
          },
        ],
        required: true,
        defaultValue: "solo",
      },
      {
        id: "time_horizon",
        type: "single_choice",
        category: "constraint",
        question: "内容规划的时间跨度？",
        options: [
          {
            value: "quarter",
            label: "一个季度",
            description: "3 个月内容计划",
          },
          {
            value: "half_year",
            label: "半年",
            description: "6 个月内容计划",
          },
          {
            value: "year",
            label: "一年",
            description: "12 个月全年规划",
          },
        ],
        required: false,
        defaultValue: "quarter",
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
   * 生成 SEO 内容架构大纲
   */
  async *generateOutline(
    _context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
    yield* this.reportProgress("outline", 10, "分析内容素材...");

    const briefingPrompt = input.briefingContext
      ? injectBriefingToPrompt(
          "",
          input.briefingContext,
          this.briefingConfig.questions,
        )
      : "";

    const outlinePrompt = `
你是一位资深 SEO 内容策略师，正在为以下素材设计 Pillar-Cluster 内容架构。

${briefingPrompt}

请生成包含以下章节的 SEO 策略大纲：
1. Pillar 页面设计 - 确定 1-3 个核心主题页面
2. Cluster 页面规划 - 每个 Pillar 下的 5-8 个长尾内容
3. 关键词策略 - 主关键词和长尾关键词建议
4. 内部链接架构 - 页面之间的链接结构
5. 内容日历 - 发布顺序和时间安排

每个章节需要包含具体可执行的要点。
`;

    yield* this.reportProgress("outline", 30, "生成 SEO 架构...");

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
   * 生成 SEO 内容架构详情
   */
  protected async *generateContent(
    context: BlueprintExecutionContext,
    input: EnhancedBlueprintInput,
  ): AsyncGenerator<OrchestrationStreamChunk, string, unknown> {
    yield* this.reportProgress("content", 10, "开始生成 SEO 策略...");

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

    yield* this.reportProgress("content", 100, "SEO 策略生成完成");

    return fullContent;
  }

  /**
   * 将内容结构化为 SeoPillarOutput
   */
  protected async structureOutput(
    context: BlueprintExecutionContext,
    rawContent: string,
  ): Promise<SeoPillarOutput> {
    const outline = context.outline;
    const title =
      this.extractTitle(rawContent) ?? outline?.title ?? "SEO 内容策略";

    const pillarPages = this.extractPillarPages(rawContent);
    const clusterPages = this.extractClusterPages(rawContent, pillarPages);
    const contentCalendar = this.generateContentCalendar(
      pillarPages,
      clusterPages,
    );

    return {
      version: "1.0.0",
      generatedAt: new Date(),
      blueprintId: this.blueprintId,
      title,
      topicDomain: this.extractTopicDomain(rawContent),
      strategyOverview: this.extractStrategyOverview(rawContent),
      pillarPages,
      clusterPages,
      keywordSuggestions: this.extractKeywordSuggestions(rawContent),
      internalLinkStrategy: this.generateInternalLinkStrategy(
        pillarPages,
        clusterPages,
      ),
      contentCalendar,
      totalEstimatedHours: this.calculateTotalHours(contentCalendar),
      estimatedKeywordCoverage: pillarPages.length + clusterPages.length,
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
        topicDomain: { type: "string" },
        strategyOverview: { type: "string" },
        pillarPages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              targetKeyword: { type: "string" },
              secondaryKeywords: { type: "array", items: { type: "string" } },
              estimatedWordCount: { type: "number" },
              outline: { type: "array", items: { type: "string" } },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    summary: { type: "string" },
                    relatedClusterIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["id", "title", "summary"],
                },
              },
              metaDescription: { type: "string" },
              suggestedSlug: { type: "string" },
            },
            required: [
              "id",
              "title",
              "targetKeyword",
              "estimatedWordCount",
              "outline",
              "sections",
            ],
          },
        },
        clusterPages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              pillarId: { type: "string" },
              title: { type: "string" },
              targetKeyword: { type: "string" },
              estimatedWordCount: { type: "number" },
              outline: { type: "array", items: { type: "string" } },
              searchIntent: {
                type: "string",
                enum: [
                  "informational",
                  "navigational",
                  "transactional",
                  "commercial",
                ],
              },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              suggestedSlug: { type: "string" },
            },
            required: [
              "id",
              "pillarId",
              "title",
              "targetKeyword",
              "estimatedWordCount",
              "outline",
            ],
          },
        },
        keywordSuggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              searchVolume: { type: "string", enum: ["low", "medium", "high"] },
              competition: { type: "string", enum: ["low", "medium", "high"] },
              intent: {
                type: "string",
                enum: [
                  "informational",
                  "navigational",
                  "transactional",
                  "commercial",
                ],
              },
              isLongTail: { type: "boolean" },
              suggestedType: { type: "string", enum: ["pillar", "cluster"] },
            },
            required: [
              "keyword",
              "searchVolume",
              "competition",
              "intent",
              "isLongTail",
              "suggestedType",
            ],
          },
        },
        internalLinkStrategy: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fromPageId: { type: "string" },
              toPageId: { type: "string" },
              anchorText: { type: "string" },
              placementSuggestion: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: [
              "fromPageId",
              "toPageId",
              "anchorText",
              "placementSuggestion",
              "priority",
            ],
          },
        },
        contentCalendar: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pageId: { type: "string" },
              pageType: { type: "string", enum: ["pillar", "cluster"] },
              title: { type: "string" },
              suggestedWeek: { type: "number" },
              publishReason: { type: "string" },
              estimatedHours: { type: "number" },
              dependencies: { type: "array", items: { type: "string" } },
            },
            required: [
              "pageId",
              "pageType",
              "title",
              "suggestedWeek",
              "publishReason",
              "estimatedHours",
            ],
          },
        },
        totalEstimatedHours: { type: "number" },
        estimatedKeywordCoverage: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: [
        "version",
        "blueprintId",
        "title",
        "topicDomain",
        "strategyOverview",
        "pillarPages",
        "clusterPages",
        "keywordSuggestions",
        "internalLinkStrategy",
        "contentCalendar",
        "totalEstimatedHours",
        "estimatedKeywordCoverage",
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
   * 提取主题领域
   */
  private extractTopicDomain(content: string): string {
    const domainMatch = content.match(
      /(?:领域|主题|Topic|Domain)[：:]\s*([^\n]+)/i,
    );
    return domainMatch?.[1]?.trim() ?? "待确定";
  }

  /**
   * 提取策略概述
   */
  private extractStrategyOverview(content: string): string {
    const overviewMatch = content.match(
      /(?:概述|策略|Overview|Strategy)[：:]\s*([^#]+)/i,
    );
    return (
      overviewMatch?.[1]?.trim().slice(0, 500) ??
      "基于 Pillar-Cluster 模型的 SEO 内容策略"
    );
  }

  /**
   * 提取 Pillar 页面
   */
  private extractPillarPages(content: string): PillarPage[] {
    const pillars: PillarPage[] = [];

    // 尝试匹配 Pillar 相关内容
    const pillarRegex = /(?:Pillar|主页面|支柱页)\s*(\d+)?[：:]\s*([^\n]+)/gi;
    let match;
    let index = 0;

    while ((match = pillarRegex.exec(content)) !== null) {
      index++;
      const title = match[2].trim();
      pillars.push({
        id: `pillar-${index}`,
        title,
        description: `关于 ${title} 的权威指南`,
        targetKeyword: this.generateSlug(title),
        secondaryKeywords: [],
        estimatedWordCount: 3000,
        outline: [
          "什么是" + title,
          title + "的重要性",
          "如何" + title,
          "常见问题解答",
        ],
        sections: [
          {
            id: `pillar-${index}-section-1`,
            title: "概述",
            summary: "介绍核心概念",
            relatedClusterIds: [],
          },
          {
            id: `pillar-${index}-section-2`,
            title: "详细指南",
            summary: "深入讲解",
            relatedClusterIds: [],
          },
        ],
        metaDescription: `全面了解 ${title} - 完整指南`,
        suggestedSlug: this.generateSlug(title),
      });
    }

    // 默认 Pillar 页面
    if (pillars.length === 0) {
      pillars.push({
        id: "pillar-1",
        title: "核心主题指南",
        description: "关于核心主题的权威指南",
        targetKeyword: "核心关键词",
        secondaryKeywords: ["次要关键词1", "次要关键词2"],
        estimatedWordCount: 3000,
        outline: ["什么是", "为什么重要", "如何实现", "最佳实践", "常见问题"],
        sections: [
          {
            id: "pillar-1-section-1",
            title: "基础概念",
            summary: "介绍核心概念和定义",
            relatedClusterIds: ["cluster-1", "cluster-2"],
          },
          {
            id: "pillar-1-section-2",
            title: "实践指南",
            summary: "详细的操作步骤",
            relatedClusterIds: ["cluster-3", "cluster-4"],
          },
        ],
        metaDescription: "全面了解核心主题的完整指南",
        suggestedSlug: "complete-guide",
      });
    }

    return pillars;
  }

  /**
   * 提取 Cluster 页面
   */
  private extractClusterPages(
    content: string,
    pillars: PillarPage[],
  ): ClusterPage[] {
    const clusters: ClusterPage[] = [];
    const pillarId = pillars[0]?.id ?? "pillar-1";

    // 尝试匹配 Cluster 相关内容
    const clusterRegex = /(?:Cluster|子页面|文章)\s*(\d+)?[：:]\s*([^\n]+)/gi;
    let match;
    let index = 0;

    while ((match = clusterRegex.exec(content)) !== null) {
      index++;
      const title = match[2].trim();
      clusters.push({
        id: `cluster-${index}`,
        pillarId,
        title,
        targetKeyword: title.toLowerCase(),
        estimatedWordCount: 1500,
        outline: ["介绍", "详细说明", "示例", "总结"],
        searchIntent: "informational",
        difficulty: index <= 3 ? "easy" : "medium",
        priority: index <= 3 ? "high" : "medium",
        suggestedSlug: this.generateSlug(title),
      });
    }

    // 默认 Cluster 页面
    if (clusters.length === 0) {
      const defaultClusters = [
        { title: "入门指南", difficulty: "easy", priority: "high" },
        { title: "进阶技巧", difficulty: "medium", priority: "high" },
        { title: "常见问题", difficulty: "easy", priority: "medium" },
        { title: "最佳实践", difficulty: "medium", priority: "medium" },
        { title: "案例分析", difficulty: "hard", priority: "low" },
      ];

      for (let i = 0; i < defaultClusters.length; i++) {
        const { title, difficulty, priority } = defaultClusters[i];
        clusters.push({
          id: `cluster-${i + 1}`,
          pillarId,
          title,
          targetKeyword: title.toLowerCase(),
          estimatedWordCount: 1500,
          outline: ["介绍", "详细说明", "示例", "总结"],
          searchIntent: "informational",
          difficulty: difficulty as "easy" | "medium" | "hard",
          priority: priority as "low" | "medium" | "high",
          suggestedSlug: this.generateSlug(title),
        });
      }
    }

    return clusters;
  }

  /**
   * 提取关键词建议
   */
  private extractKeywordSuggestions(content: string): KeywordSuggestion[] {
    const suggestions: KeywordSuggestion[] = [];

    // 尝试从内容提取关键词
    const keywordMatch = content.match(/(?:关键词|Keywords?)[^]*?(?=##|$)/i);
    if (keywordMatch) {
      const listItems = keywordMatch[0].match(/[-*]\s+(.+)/g);
      if (listItems) {
        for (let i = 0; i < Math.min(listItems.length, 10); i++) {
          const keyword = listItems[i].replace(/^[-*]\s+/, "").trim();
          suggestions.push({
            keyword,
            searchVolume: i < 3 ? "high" : i < 6 ? "medium" : "low",
            competition: i < 3 ? "high" : "medium",
            intent: "informational",
            isLongTail: keyword.split(" ").length > 3,
            suggestedType: i < 2 ? "pillar" : "cluster",
          });
        }
      }
    }

    // 默认关键词建议
    if (suggestions.length === 0) {
      suggestions.push(
        {
          keyword: "核心关键词",
          searchVolume: "high",
          competition: "high",
          intent: "informational",
          isLongTail: false,
          suggestedType: "pillar",
        },
        {
          keyword: "长尾关键词示例",
          searchVolume: "medium",
          competition: "low",
          intent: "informational",
          isLongTail: true,
          suggestedType: "cluster",
        },
      );
    }

    return suggestions;
  }

  /**
   * 生成内部链接策略
   */
  private generateInternalLinkStrategy(
    pillars: PillarPage[],
    clusters: ClusterPage[],
  ): InternalLinkStrategy[] {
    const links: InternalLinkStrategy[] = [];

    // Pillar -> Cluster 链接
    for (const pillar of pillars) {
      for (const cluster of clusters.filter((c) => c.pillarId === pillar.id)) {
        links.push({
          fromPageId: pillar.id,
          toPageId: cluster.id,
          anchorText: cluster.title,
          placementSuggestion: "在相关章节中自然引入",
          priority: "high",
        });

        // Cluster -> Pillar 链接
        links.push({
          fromPageId: cluster.id,
          toPageId: pillar.id,
          anchorText: pillar.title,
          placementSuggestion: "在介绍或总结部分链接回主页面",
          priority: "high",
        });
      }
    }

    // Cluster -> Cluster 链接
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length && j < i + 3; j++) {
        links.push({
          fromPageId: clusters[i].id,
          toPageId: clusters[j].id,
          anchorText: clusters[j].title,
          placementSuggestion: "在相关内容处引用",
          priority: "medium",
        });
      }
    }

    return links;
  }

  /**
   * 生成内容日历
   */
  private generateContentCalendar(
    pillars: PillarPage[],
    clusters: ClusterPage[],
  ): ContentCalendarEntry[] {
    const calendar: ContentCalendarEntry[] = [];
    let week = 1;

    // Pillar 页面优先
    for (const pillar of pillars) {
      calendar.push({
        pageId: pillar.id,
        pageType: "pillar",
        title: pillar.title,
        suggestedWeek: week,
        publishReason: "核心支柱页面，建立主题权威",
        estimatedHours: Math.ceil(pillar.estimatedWordCount / 500),
        dependencies: [],
      });
      week += 2;
    }

    // Cluster 页面按优先级排序
    const sortedClusters = [...clusters].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const cluster of sortedClusters) {
      calendar.push({
        pageId: cluster.id,
        pageType: "cluster",
        title: cluster.title,
        suggestedWeek: week,
        publishReason: `支持 Pillar 页面，覆盖长尾关键词 "${cluster.targetKeyword}"`,
        estimatedHours: Math.ceil(cluster.estimatedWordCount / 500),
        dependencies: [cluster.pillarId],
      });
      week += 1;
    }

    return calendar;
  }

  /**
   * 计算总工时
   */
  private calculateTotalHours(calendar: ContentCalendarEntry[]): number {
    return calendar.reduce((sum, entry) => sum + entry.estimatedHours, 0);
  }

  /**
   * 生成 URL Slug
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
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
    return ["SEO", "内容策略", "Pillar-Cluster"];
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 创建 SeoPillar 蓝图实例
 */
export function createSeoPillarBlueprint(): SeoPillarBlueprint {
  return new SeoPillarBlueprint();
}
