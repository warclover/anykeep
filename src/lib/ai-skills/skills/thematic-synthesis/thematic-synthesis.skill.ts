/**
 * ThematicSynthesisSkill - 主题合成器 Skill
 *
 * 功能：
 * - 从多个书签中提取共同主题
 * - 生成四维结构化输出：概述、共识、分歧、盲区
 * - 支持三种深度模式：快读、标准、学术
 *
 * 执行流程：
 * 1. prepare - 收集源书签、提取内容、预处理
 * 2. analyze - 内容聚类、主题提取、关系建立
 * 3. synthesize - 生成概述和共识点
 * 4. conflict - 识别观点分歧、对抗性分析
 * 5. blindspot - 识别知识缺口、生成建议
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import { generateText } from "ai";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationContext,
  OrchestrationSkillMetadata,
} from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getModelByTask } from "@/lib/ai-providers";
import type {
  ThematicSynthesisInput,
  ThematicSynthesisOutput,
  PrepareStepResult,
  AnalyzeStepResult,
  TopicCluster,
  KeyEntity,
} from "./types";
import { SYNTHESIS_SKILL_STEPS } from "./types";
import type {
  ConsensusPoint,
  DivergencePoint,
  BlindSpot,
  BookmarkSource,
  SynthesisDepthMode,
} from "@/lib/synthesis";
import { MAX_TOTAL_INPUT_TOKENS } from "@/lib/synthesis/constants";
import {
  buildTopicAnalysisPrompt,
  buildSynthesisPrompt,
  buildDivergencePrompt,
  buildBlindspotPrompt,
} from "./synthesis-prompts";

// ============================================
// Schema 定义
// ============================================

const ThematicSynthesisInputSchema = z.object({
  sourceType: z
    .enum(["folder", "tag", "selection", "ai_recommend"])
    .describe("来源类型"),
  sourceId: z.string().optional().describe("来源 ID（文件夹 ID 或标签）"),
  bookmarkIds: z.array(z.string()).optional().describe("书签 ID 列表"),
  depthMode: z
    .enum(["quick", "standard", "academic"])
    .default("standard")
    .describe("深度模式"),
  reportId: z.string().optional().describe("报告 ID"),
  title: z.string().optional().describe("自定义标题"),
});

const ThematicSynthesisOutputSchema = z.object({
  reportId: z.string(),
  title: z.string(),
  overview: z.string(),
  consensus: z.array(z.any()),
  divergence: z.array(z.any()),
  blindSpots: z.array(z.any()),
  fullMarkdown: z.string(),
  sourceCount: z.number(),
  wordCount: z.number(),
  generatedAt: z.string(),
});

// ============================================
// Skill 实现
// ============================================

export class ThematicSynthesisSkill extends OrchestrationSkill<
  ThematicSynthesisInput,
  ThematicSynthesisOutput
> {
  /** Skill 元数据 */
  readonly metadata: OrchestrationSkillMetadata = {
    id: "thematic_synthesis",
    name: "主题合成器",
    description:
      "将多个收藏内容综合成结构化知识报告，包含概述、共识、分歧和盲区",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "content-synthesis",
      "consensus-extraction",
      "divergence-detection",
      "blindspot-discovery",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 120000, // 2 分钟
    maxExecutionTimeMs: 480000, // 8 分钟
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    steps: SYNTHESIS_SKILL_STEPS as unknown as {
      id: string;
      name: string;
      description: string;
      weight: number;
    }[],
  };

  /** 输入 Schema */
  readonly inputSchema = ThematicSynthesisInputSchema;

  /** 输出 Schema */
  readonly outputSchema = ThematicSynthesisOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<ThematicSynthesisInput> {
    // 解析深度模式
    let depthMode: "quick" | "standard" | "academic" = "standard";
    if (/快速|简要|概要|快读/.test(message)) {
      depthMode = "quick";
    } else if (/深度|学术|详细|完整/.test(message)) {
      depthMode = "academic";
    }

    // ============================================
    // 优先使用附件书签（用户显式选择的内容）
    // ============================================
    if (
      context.attachmentBookmarkIds &&
      context.attachmentBookmarkIds.length > 0
    ) {
      return {
        sourceType: "selection",
        bookmarkIds: context.attachmentBookmarkIds.map((id) => String(id)),
        depthMode,
      };
    }

    // 回退：使用页面上下文书签
    if (context.bookmarkIds && context.bookmarkIds.length > 0) {
      return {
        sourceType: "selection",
        bookmarkIds: context.bookmarkIds.map((id) => String(id)),
        depthMode,
      };
    }

    // 默认返回标准模式的选择类型（无书签）
    return {
      sourceType: "selection",
      depthMode,
    };
  }

  /**
   * 流式执行综述生成
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as ThematicSynthesisInput;
    const userId = context.userId;

    // 初始化进度
    this.initProgress(
      SYNTHESIS_SKILL_STEPS as unknown as {
        id: string;
        name: string;
        weight: number;
      }[],
    );

    logger.info(
      {
        skillId: this.metadata.id,
        userId,
        sourceType: input.sourceType,
        depthMode: input.depthMode,
      },
      "Starting thematic synthesis",
    );

    try {
      // Step 1: 准备阶段
      yield* this.reportProgress("prepare", 0, "正在收集书签数据...");
      yield* this.emitText("📚 正在收集书签数据，请稍候...\n\n");

      const prepareResult = await this.executePrepareStep(userId, input);
      yield* this.reportProgress(
        "prepare",
        100,
        `已加载 ${prepareResult.bookmarks.length} 个书签`,
      );

      if (prepareResult.bookmarks.length === 0) {
        yield* this.emitText("未找到符合条件的书签内容，无法生成综述。\n");
        yield* this.emitDone(true, "没有找到可合成的内容");
        return;
      }

      yield* this.emitText(
        `找到 **${prepareResult.bookmarks.length}** 个书签。\n\n`,
      );

      // Step 2: 分析阶段
      yield* this.reportProgress("analyze", 0, "正在分析内容主题...");
      yield* this.emitText("🔍 正在分析内容主题...\n\n");

      const analyzeResult = await this.executeAnalyzeStep(
        prepareResult.bookmarks,
        input,
      );
      yield* this.reportProgress(
        "analyze",
        100,
        `识别到 ${analyzeResult.topicClusters.length} 个主题`,
      );

      // Step 3: 合成阶段
      yield* this.reportProgress("synthesize", 0, "正在生成概述和共识...");
      yield* this.emitText("✍️ 正在生成概述和共识...\n\n");

      const synthesizeResult = await this.executeSynthesizeStep(
        prepareResult.bookmarks,
        analyzeResult,
        input,
      );
      yield* this.reportProgress("synthesize", 100, "概述和共识生成完成");

      // 流式输出概述
      yield* this.emitText(`## 📋 概述\n\n${synthesizeResult.overview}\n\n`);

      // Step 4: 冲突检测
      yield* this.reportProgress("conflict", 0, "正在识别观点分歧...");
      yield* this.emitText("⚖️ 正在识别观点分歧...\n\n");

      const divergenceResult = await this.executeConflictStep(
        prepareResult.bookmarks,
        analyzeResult,
        input,
        synthesizeResult.consensus,
      );
      yield* this.reportProgress(
        "conflict",
        100,
        `发现 ${divergenceResult.length} 个分歧点`,
      );

      // Step 5: 盲区发现
      yield* this.reportProgress("blindspot", 0, "正在分析知识盲区...");
      yield* this.emitText("🔍 正在分析知识盲区...\n\n");

      const blindSpotResult = await this.executeBlindSpotStep(
        prepareResult.bookmarks,
        analyzeResult,
        input,
        synthesizeResult.consensus,
        divergenceResult,
      );
      yield* this.reportProgress(
        "blindspot",
        100,
        `发现 ${blindSpotResult.length} 个盲区`,
      );

      // 构建完整输出
      const fullMarkdown = this.buildFullMarkdown(
        input.title || "主题综述",
        synthesizeResult.overview,
        synthesizeResult.consensus,
        divergenceResult,
        blindSpotResult,
        prepareResult.bookmarks,
      );

      const output: ThematicSynthesisOutput = {
        reportId: input.reportId || "",
        title: input.title || "主题综述",
        overview: synthesizeResult.overview,
        consensus: synthesizeResult.consensus,
        divergence: divergenceResult,
        blindSpots: blindSpotResult,
        fullMarkdown,
        sourceCount: prepareResult.bookmarks.length,
        wordCount: this.countWords(fullMarkdown),
        generatedAt: new Date().toISOString(),
      };

      // 保存到数据库（如果有 reportId）
      if (input.reportId) {
        await this.saveToDatabase(userId, input.reportId, output);
      }

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        output.title,
        output,
        "markdown",
        {
          downloadable: true,
          shareable: true,
        },
      );
      yield* this.emitDeliverable(deliverable);

      yield* this.emitDone(true, "综述生成完成");

      const duration = Date.now() - startTime;
      logger.info(
        {
          skillId: this.metadata.id,
          userId,
          duration,
          sourceCount: output.sourceCount,
          wordCount: output.wordCount,
        },
        "Thematic synthesis completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Thematic synthesis failed",
      );
      throw error;
    }
  }

  // ============================================
  // 步骤实现（骨架版本）
  // ============================================

  /**
   * 步骤 1: 准备阶段 - 收集书签内容
   */
  private async executePrepareStep(
    userId: string,
    input: ThematicSynthesisInput,
  ): Promise<PrepareStepResult> {
    const supabase = await createClient();

    let bookmarks: BookmarkSource[] = [];

    // 根据来源类型查询书签
    if (input.sourceType === "folder" && input.sourceId) {
      const { data } = await supabase
        .from("bookmarks")
        .select("id, title, url, description, ai_summary, platform, created_at")
        .eq("user_id", userId)
        .eq("folder_id", parseInt(input.sourceId, 10))
        .order("created_at", { ascending: false })
        .limit(100);

      bookmarks = (data || []).map((b) => ({
        id: String(b.id),
        title: b.title,
        url: b.url || "",
        content: b.description || "",
        aiSummary: b.ai_summary || undefined,
        platform: b.platform,
        createdAt: b.created_at || "",
      }));
    } else if (input.sourceType === "tag" && input.sourceId) {
      const { data } = await supabase
        .from("bookmarks")
        .select(
          "id, title, url, description, ai_summary, platform, created_at, ai_tags",
        )
        .eq("user_id", userId)
        .contains("ai_tags", [input.sourceId])
        .order("created_at", { ascending: false })
        .limit(100);

      bookmarks = (data || []).map((b) => ({
        id: String(b.id),
        title: b.title,
        url: b.url || "",
        content: b.description || "",
        aiSummary: b.ai_summary || undefined,
        platform: b.platform,
        createdAt: b.created_at || "",
      }));
    } else if (input.sourceType === "selection" && input.bookmarkIds) {
      const { data } = await supabase
        .from("bookmarks")
        .select("id, title, url, description, ai_summary, platform, created_at")
        .eq("user_id", userId)
        .in(
          "id",
          input.bookmarkIds.map((id) => parseInt(id, 10)),
        );

      bookmarks = (data || []).map((b) => ({
        id: String(b.id),
        title: b.title,
        url: b.url || "",
        content: b.description || "",
        aiSummary: b.ai_summary || undefined,
        platform: b.platform,
        createdAt: b.created_at || "",
      }));
    }

    // Token 估算（简单版本）
    const estimatedTokens = bookmarks.reduce((sum, b) => {
      const text = (b.content + (b.aiSummary || "")).length;
      return sum + Math.ceil(text / 4); // 粗略估算
    }, 0);

    return {
      bookmarks,
      estimatedTokens,
      needsTruncation: estimatedTokens > MAX_TOTAL_INPUT_TOKENS,
      truncatedCount:
        estimatedTokens > MAX_TOTAL_INPUT_TOKENS
          ? Math.floor(
              bookmarks.length * (MAX_TOTAL_INPUT_TOKENS / estimatedTokens),
            )
          : undefined,
    };
  }

  /**
   * 步骤 2: 分析阶段 - 内容聚类和主题提取
   */
  private async executeAnalyzeStep(
    bookmarks: BookmarkSource[],
    _input: ThematicSynthesisInput,
  ): Promise<AnalyzeStepResult> {
    // 转换为 Prompt 格式
    const bookmarksForPrompt = bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      content: b.aiSummary || b.content || "（内容不可用）",
      platform: b.platform,
    }));

    // 构建 Prompt
    const prompt = buildTopicAnalysisPrompt(bookmarksForPrompt);

    // 获取 AI 模型 - 使用深度推理模型进行主题分析
    const model = getModelByTask("theme-discovery");

    if (!model) {
      logger.warn("No AI model available for topic analysis, using fallback");
      return this.buildFallbackAnalyzeResult(bookmarks);
    }

    try {
      const { text } = await generateText({
        model,
        prompt,
        maxOutputTokens: 2000,
        temperature: 0.3,
      });

      // 解析 JSON 响应
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("无法解析 LLM 响应");
      }

      const response = JSON.parse(jsonMatch[0]) as {
        topicClusters: TopicCluster[];
        keyEntities: KeyEntity[];
        domainSummary: string;
      };

      // 统计平台分布
      const platformDistribution: Record<string, number> = {};
      for (const bookmark of bookmarks) {
        platformDistribution[bookmark.platform] =
          (platformDistribution[bookmark.platform] || 0) + 1;
      }

      const contentStats = {
        totalWords: bookmarks.reduce(
          (sum, b) => sum + (b.content?.split(/\s+/).length || 0),
          0,
        ),
        avgWords: 0,
        platformDistribution,
        timeDistribution: {},
      };
      contentStats.avgWords =
        Math.round(contentStats.totalWords / bookmarks.length) || 0;

      return {
        topicClusters: response.topicClusters || [],
        keyEntities: response.keyEntities || [],
        contentStats,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Topic analysis failed, using fallback",
      );
      return this.buildFallbackAnalyzeResult(bookmarks);
    }
  }

  /**
   * 构建降级分析结果
   */
  private buildFallbackAnalyzeResult(
    bookmarks: BookmarkSource[],
  ): AnalyzeStepResult {
    const platformDistribution: Record<string, number> = {};
    for (const bookmark of bookmarks) {
      platformDistribution[bookmark.platform] =
        (platformDistribution[bookmark.platform] || 0) + 1;
    }

    return {
      topicClusters: [],
      keyEntities: [],
      contentStats: {
        totalWords: bookmarks.reduce(
          (sum, b) => sum + (b.content?.split(/\s+/).length || 0),
          0,
        ),
        avgWords:
          Math.round(
            bookmarks.reduce(
              (sum, b) => sum + (b.content?.split(/\s+/).length || 0),
              0,
            ) / bookmarks.length,
          ) || 0,
        platformDistribution,
        timeDistribution: {},
      },
    };
  }

  /**
   * 步骤 3: 合成阶段 - 生成概述和共识
   */
  private async executeSynthesizeStep(
    bookmarks: BookmarkSource[],
    analyzeResult: AnalyzeStepResult,
    input: ThematicSynthesisInput,
  ): Promise<{ overview: string; consensus: ConsensusPoint[] }> {
    // 转换为 Prompt 格式
    const bookmarksForPrompt = bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      content: b.aiSummary || b.content || "（内容不可用）",
      platform: b.platform,
    }));

    // 构建主题分析摘要
    const topicAnalysis =
      analyzeResult.topicClusters.length > 0
        ? analyzeResult.topicClusters
            .map((c) => `- ${c.name}: ${c.description || ""}`)
            .join("\n")
        : "（自动分析主题）";

    // 确定主题名称
    const topic =
      input.title || analyzeResult.topicClusters[0]?.name || "综合内容";

    const depthMode = (input.depthMode || "standard") as SynthesisDepthMode;

    // 构建 Prompt
    const prompt = buildSynthesisPrompt(
      bookmarksForPrompt,
      topic,
      topicAnalysis,
      depthMode,
    );

    // 获取 AI 模型 - 使用深度推理模型进行合成
    const model = getModelByTask("theme-discovery");

    if (!model) {
      logger.warn("No AI model available for synthesis, using fallback");
      return this.buildFallbackSynthesisResult(bookmarks, analyzeResult);
    }

    try {
      const { text } = await generateText({
        model,
        prompt,
        maxOutputTokens: 3000,
        temperature: 0.5,
      });

      // 解析 JSON 响应
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("无法解析 LLM 响应");
      }

      const response = JSON.parse(jsonMatch[0]) as {
        overview: string;
        consensus: Array<{
          point: string;
          confidence: number;
          sources: Array<{
            bookmarkId: string;
            title: string;
            quote?: string;
          }>;
          reasoning?: string;
        }>;
      };

      // 转换为 ConsensusPoint 格式
      const consensus: ConsensusPoint[] = (response.consensus || []).map(
        (c) => ({
          point: c.point,
          confidence: c.confidence,
          sources: (c.sources || []).map((s) => ({
            id: s.bookmarkId,
            title: s.title,
            quote: s.quote,
          })),
        }),
      );

      return {
        overview: response.overview || "概述生成失败",
        consensus,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Synthesis failed, using fallback",
      );
      return this.buildFallbackSynthesisResult(bookmarks, analyzeResult);
    }
  }

  /**
   * 构建降级合成结果
   */
  private buildFallbackSynthesisResult(
    bookmarks: BookmarkSource[],
    analyzeResult: AnalyzeStepResult,
  ): { overview: string; consensus: ConsensusPoint[] } {
    const overview =
      `本综述基于 ${bookmarks.length} 篇收藏内容生成。` +
      `涵盖 ${Object.keys(analyzeResult.contentStats.platformDistribution).length} 个平台的内容。` +
      (analyzeResult.topicClusters.length > 0
        ? `主要主题包括：${analyzeResult.topicClusters.map((c) => c.name).join("、")}。`
        : "");

    return { overview, consensus: [] };
  }

  /**
   * 步骤 4: 冲突检测 - 识别观点分歧
   */
  private async executeConflictStep(
    bookmarks: BookmarkSource[],
    analyzeResult: AnalyzeStepResult,
    input: ThematicSynthesisInput,
    consensus: ConsensusPoint[],
  ): Promise<DivergencePoint[]> {
    // 转换为 Prompt 格式
    const bookmarksForPrompt = bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      content: b.aiSummary || b.content || "（内容不可用）",
      platform: b.platform,
    }));

    // 确定主题名称
    const topic =
      input.title || analyzeResult.topicClusters[0]?.name || "综合内容";

    const depthMode = (input.depthMode || "standard") as SynthesisDepthMode;

    // 构建共识点摘要
    const consensusPoints =
      consensus.length > 0
        ? consensus
            .map(
              (c) =>
                `- ${c.point} (置信度: ${Math.round(c.confidence * 100)}%)`,
            )
            .join("\n")
        : "（暂无明确共识）";

    // 构建 Prompt
    const prompt = buildDivergencePrompt(
      bookmarksForPrompt,
      topic,
      consensusPoints,
      depthMode,
    );

    // 获取 AI 模型 - 使用深度推理模型进行分歧检测
    const model = getModelByTask("theme-discovery");

    if (!model) {
      logger.warn("No AI model available for divergence detection");
      return [];
    }

    try {
      const { text } = await generateText({
        model,
        prompt,
        maxOutputTokens: 2000,
        temperature: 0.4,
      });

      // 解析 JSON 响应
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("无法解析 LLM 响应");
      }

      const response = JSON.parse(jsonMatch[0]) as {
        divergence: Array<{
          topic: string;
          type?: string;
          point_a: string;
          point_b: string;
          sources_a: Array<{ bookmarkId: string; title: string }>;
          sources_b: Array<{ bookmarkId: string; title: string }>;
          analysis: string;
        }>;
      };

      // 转换为 DivergencePoint 格式
      return (response.divergence || []).map((d) => ({
        topic: d.topic,
        point_a: d.point_a,
        point_b: d.point_b,
        sources_a: (d.sources_a || []).map((s) => ({
          id: s.bookmarkId,
          title: s.title,
        })),
        sources_b: (d.sources_b || []).map((s) => ({
          id: s.bookmarkId,
          title: s.title,
        })),
        analysis: d.analysis,
      }));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Divergence detection failed",
      );
      return [];
    }
  }

  /**
   * 步骤 5: 盲区发现 - 识别知识缺口
   */
  private async executeBlindSpotStep(
    bookmarks: BookmarkSource[],
    analyzeResult: AnalyzeStepResult,
    input: ThematicSynthesisInput,
    consensus: ConsensusPoint[],
    divergence: DivergencePoint[],
  ): Promise<BlindSpot[]> {
    // 确定主题名称
    const topic =
      input.title || analyzeResult.topicClusters[0]?.name || "综合内容";

    const depthMode = (input.depthMode || "standard") as SynthesisDepthMode;

    // 构建共识点摘要
    const consensusPoints =
      consensus.length > 0
        ? consensus.map((c) => `- ${c.point}`).join("\n")
        : "（暂无明确共识）";

    // 构建分歧点摘要
    const divergencePoints =
      divergence.length > 0
        ? divergence
            .map((d) => `- ${d.topic}: ${d.point_a} vs ${d.point_b}`)
            .join("\n")
        : "（暂无明显分歧）";

    // 构建主题群摘要
    const topicClusters =
      analyzeResult.topicClusters.length > 0
        ? analyzeResult.topicClusters.map((c) => c.name).join("、")
        : "（待识别）";

    // 构建 Prompt
    const prompt = buildBlindspotPrompt(
      topic,
      consensusPoints,
      divergencePoints,
      bookmarks.length,
      analyzeResult.contentStats.platformDistribution,
      topicClusters,
      depthMode,
    );

    // 获取 AI 模型 - 使用深度推理模型进行盲区检测
    const model = getModelByTask("theme-discovery");

    if (!model) {
      logger.warn("No AI model available for blindspot detection");
      return [];
    }

    try {
      const { text } = await generateText({
        model,
        prompt,
        maxOutputTokens: 1500,
        temperature: 0.5,
      });

      // 解析 JSON 响应
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("无法解析 LLM 响应");
      }

      const response = JSON.parse(jsonMatch[0]) as {
        blindSpots: Array<{
          topic: string;
          type?: string;
          description?: string;
          suggestion: string;
          search_keywords: string[];
        }>;
      };

      // 转换为 BlindSpot 格式
      return (response.blindSpots || []).map((b) => ({
        topic: b.topic,
        suggestion: b.suggestion,
        search_keywords: b.search_keywords || [],
      }));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Blindspot detection failed",
      );
      return [];
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 构建完整 Markdown 输出
   */
  private buildFullMarkdown(
    title: string,
    overview: string,
    consensus: ConsensusPoint[],
    divergence: DivergencePoint[],
    blindSpots: BlindSpot[],
    bookmarks: BookmarkSource[],
  ): string {
    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`> 生成于 ${new Date().toLocaleString("zh-CN")}`);
    lines.push(`> 来源：${bookmarks.length} 篇收藏`);
    lines.push("");

    lines.push("## 📋 概述");
    lines.push("");
    lines.push(overview);
    lines.push("");

    if (consensus.length > 0) {
      lines.push("## ✅ 共识观点");
      lines.push("");
      for (const point of consensus) {
        lines.push(`### ${point.point}`);
        lines.push(`**置信度**: ${Math.round(point.confidence * 100)}%`);
        lines.push("");
      }
    }

    if (divergence.length > 0) {
      lines.push("## ⚖️ 分歧观点");
      lines.push("");
      for (const point of divergence) {
        lines.push(`### ${point.topic}`);
        lines.push(`**观点 A**: ${point.point_a}`);
        lines.push(`**观点 B**: ${point.point_b}`);
        lines.push(`**分析**: ${point.analysis}`);
        lines.push("");
      }
    }

    if (blindSpots.length > 0) {
      lines.push("## 🔍 盲区提示");
      lines.push("");
      for (const spot of blindSpots) {
        lines.push(`### ${spot.topic}`);
        lines.push(`**建议**: ${spot.suggestion}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * 计算字数
   */
  private countWords(text: string): number {
    // 中文按字符计数，英文按空格分词
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text
      .replace(/[\u4e00-\u9fa5]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    return chineseChars + englishWords;
  }

  /**
   * 保存到数据库
   */
  private async saveToDatabase(
    userId: string,
    reportId: string,
    output: ThematicSynthesisOutput,
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("synthesis_reports")
      .update({
        title: output.title,
        overview: output.overview,
        consensus: JSON.parse(JSON.stringify(output.consensus)),
        divergence: JSON.parse(JSON.stringify(output.divergence)),
        blind_spots: JSON.parse(JSON.stringify(output.blindSpots)),
        full_markdown: output.fullMarkdown,
        word_count: output.wordCount,
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .eq("user_id", userId);
  }
}

// 导出 Skill 实例
export const thematicSynthesisSkill = new ThematicSynthesisSkill();
