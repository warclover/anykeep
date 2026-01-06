/**
 * KnowledgeExtractor - 知识萃取引擎
 *
 * 从多篇收藏内容中提取、整合知识
 * 支持 Perplexity 风格的来源标注
 *
 * @module ai-skills/skills/knowledge-extract
 * @version 1.0.0
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  KnowledgeExtractInput,
  KnowledgeExtraction,
  BookmarkContent,
  KeyPoint,
  ConceptDefinition,
  SourceInfo,
  Citation,
  RawKeyPointResponse,
  RawConceptResponse,
} from "./types";

// ============================================
// 配置常量
// ============================================

const DEFAULT_MAX_KEY_POINTS = 7;
const MAX_CONTENT_LENGTH_PER_ARTICLE = 2000;
const MAX_ARTICLES_TO_PROCESS = 20;

// ============================================
// LLM Prompt 模板
// ============================================

const TOPIC_IDENTIFICATION_PROMPT = `你是一个知识分析专家。分析以下文章的标题和摘要，识别它们的共同主题。

文章列表：
{articles}

请直接输出主题名称（2-6 个字），不要其他解释。
示例输出：AI 编程、前端开发、产品设计、投资理财`;

const KEY_POINTS_EXTRACTION_PROMPT = `你是一个知识萃取专家。从以下 {count} 篇关于「{topic}」的内容中提取核心要点。

## 输入文档

{documents}

## 提取要求

1. 提取 3-{maxPoints} 个核心要点
2. 每个要点用 [来源N] 标注出处（N 是文章编号）
3. 如果是综合多个来源得出的结论，标注所有相关来源，并标记为综合推断
4. 合并相似观点，避免重复
5. 按重要性排序

## 输出格式（严格 JSON，不要任何其他内容）

{
  "keyPoints": [
    {
      "content": "要点内容描述（一句话）",
      "citations": [1, 3],
      "importance": "high",
      "synthesized": false
    }
  ]
}`;

const CONCEPTS_EXTRACTION_PROMPT = `你是一个知识整理专家。从以下关于「{topic}」的文章中，提取 3-5 个核心概念及其定义。

文章列表：
{articles}

## 输出格式（严格 JSON，不要任何其他内容）

{
  "concepts": [
    {
      "term": "概念名称",
      "definition": "简明定义（不超过 50 字）",
      "relatedConcepts": ["相关概念1", "相关概念2"],
      "sourceIds": [1, 2]
    }
  ]
}`;

const CONCLUSION_GENERATION_PROMPT = `基于以下关于「{topic}」的要点和概念，生成一段综合结论（50-100 字）。

## 核心要点
{keyPoints}

## 核心概念
{concepts}

直接输出结论，不要额外解释或前缀。`;

const ACTION_ITEMS_PROMPT = `基于以下关于「{topic}」的知识要点，生成 3-5 条可执行的学习/行动建议。

## 核心要点
{keyPoints}

## 输出格式（严格 JSON，不要任何其他内容）

{
  "actionItems": [
    "建议1",
    "建议2",
    "建议3"
  ]
}`;

// ============================================
// KnowledgeExtractor 类
// ============================================

export class KnowledgeExtractor {
  private readonly openai;
  private readonly model: string;

  constructor(apiKey?: string, model: string = "qwen-turbo") {
    // 使用阿里云百炼 (DashScope) 替代 OpenAI
    this.openai = createOpenAI({
      apiKey: apiKey || process.env.DASHSCOPE_API_KEY,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
    this.model = model;
  }

  /**
   * 知识萃取主流程
   */
  async extract(
    input: KnowledgeExtractInput,
    userId: string,
  ): Promise<KnowledgeExtraction> {
    const startTime = Date.now();

    logger.info(
      {
        userId,
        bookmarkCount: input.bookmarkIds.length,
        topic: input.topic,
        format: input.format,
      },
      "KnowledgeExtractor: Starting extraction",
    );

    // 1. 获取书签内容
    const contents = await this.fetchContents(input.bookmarkIds, userId);

    if (contents.length === 0) {
      throw new Error("未找到有效的收藏内容");
    }

    // 2. 识别主题（如未指定）
    const topic = input.topic || (await this.identifyTopic(contents));

    // 3. 提取要点（带来源）
    const keyPoints = await this.extractKeyPoints(
      contents,
      topic,
      input.options?.maxKeyPoints ?? DEFAULT_MAX_KEY_POINTS,
    );

    // 4. 提取概念定义（可选）
    const concepts =
      input.options?.includeConceptDefinitions !== false
        ? await this.extractConcepts(contents, topic)
        : [];

    // 5. 生成综合结论
    const conclusion = await this.generateConclusion(
      keyPoints,
      concepts,
      topic,
    );

    // 6. 生成行动建议（可选）
    const actionItems = input.options?.includeActionItems
      ? await this.generateActionItems(keyPoints, topic)
      : undefined;

    // 7. 构建结果
    const extraction: KnowledgeExtraction = {
      id: `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: this.generateTitle(topic, contents.length),
      topic,
      keyPoints,
      concepts,
      conclusion,
      actionItems,
      sources: this.buildSourceList(contents),
      metadata: {
        sourceCount: contents.length,
        extractedAt: new Date(),
        format: input.format,
        llmModel: this.model,
        processingTimeMs: Date.now() - startTime,
      },
    };

    logger.info(
      {
        userId,
        extractionId: extraction.id,
        keyPointCount: keyPoints.length,
        conceptCount: concepts.length,
        processingTimeMs: extraction.metadata.processingTimeMs,
      },
      "KnowledgeExtractor: Extraction completed",
    );

    return extraction;
  }

  /**
   * 获取书签内容
   */
  async fetchContents(
    bookmarkIds: number[],
    userId: string,
  ): Promise<BookmarkContent[]> {
    const supabase = await createClient();

    // 限制处理数量
    const limitedIds = bookmarkIds.slice(0, MAX_ARTICLES_TO_PROCESS);

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, ai_summary, description, created_at")
      .eq("user_id", userId)
      .in("id", limitedIds)
      .is("deleted_at", null);

    if (error) {
      logger.error({ error }, "KnowledgeExtractor: Failed to fetch bookmarks");
      throw new Error(`获取收藏内容失败: ${error.message}`);
    }

    return (data || []).map((item) => ({
      bookmarkId: item.id,
      title: item.title || "无标题",
      content:
        item.description?.substring(0, MAX_CONTENT_LENGTH_PER_ARTICLE) || null,
      summary: item.ai_summary || null,
      url: item.url,
      platform: item.platform || "未知",
      savedAt: new Date(item.created_at || Date.now()),
    }));
  }

  /**
   * 主题识别
   */
  async identifyTopic(contents: BookmarkContent[]): Promise<string> {
    const articles = contents
      .map(
        (c, i) =>
          `${i + 1}. ${c.title}\n   摘要：${c.summary?.substring(0, 200) || "无"}`,
      )
      .join("\n");

    const prompt = TOPIC_IDENTIFICATION_PROMPT.replace("{articles}", articles);

    const { text } = await generateText({
      // 使用 .chat() 强制使用 Chat Completions API
      model: this.openai.chat(this.model),
      prompt,
      maxOutputTokens: 50,
    });

    return text
      .trim()
      .replace(/[""'']/g, "")
      .substring(0, 20);
  }

  /**
   * 要点提取（带来源标注）
   */
  async extractKeyPoints(
    contents: BookmarkContent[],
    topic: string,
    maxPoints: number,
  ): Promise<KeyPoint[]> {
    const documents = contents
      .map(
        (c, i) => `
### 【${i + 1}】${c.title}
${c.content || c.summary || "（内容不可用）"}
`,
      )
      .join("\n---\n");

    const prompt = KEY_POINTS_EXTRACTION_PROMPT.replace(
      "{count}",
      String(contents.length),
    )
      .replace("{topic}", topic)
      .replace("{documents}", documents)
      .replace("{maxPoints}", String(maxPoints));

    const { text } = await generateText({
      // 使用 .chat() 强制使用 Chat Completions API
      model: this.openai.chat(this.model),
      prompt,
      maxOutputTokens: 2000,
    });

    try {
      // 提取 JSON 部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("无法解析 LLM 响应");
      }

      const response = JSON.parse(jsonMatch[0]) as {
        keyPoints: RawKeyPointResponse[];
      };

      return response.keyPoints.map((kp, idx) => ({
        id: `kp-${idx + 1}`,
        content: kp.content,
        citations: kp.citations.map((srcIdx) =>
          this.buildCitation(srcIdx, contents),
        ),
        importance: kp.importance || "medium",
        synthesized: kp.synthesized || kp.citations.length > 1,
      }));
    } catch (parseError) {
      logger.error(
        { error: parseError, rawText: text.substring(0, 500) },
        "KnowledgeExtractor: Failed to parse key points",
      );
      // 回退：返回简单的要点
      return [
        {
          id: "kp-1",
          content: `关于「${topic}」的核心要点需要手动整理`,
          citations: contents
            .slice(0, 3)
            .map((c, i) => this.buildCitation(i + 1, contents)),
          importance: "medium",
          synthesized: true,
        },
      ];
    }
  }

  /**
   * 概念提取
   */
  async extractConcepts(
    contents: BookmarkContent[],
    topic: string,
  ): Promise<ConceptDefinition[]> {
    const articles = contents
      .map((c, i) => `【${i + 1}】${c.title}: ${c.summary || "无摘要"}`)
      .join("\n");

    const prompt = CONCEPTS_EXTRACTION_PROMPT.replace("{topic}", topic).replace(
      "{articles}",
      articles,
    );

    const { text } = await generateText({
      // 使用 .chat() 强制使用 Chat Completions API
      model: this.openai.chat(this.model),
      prompt,
      maxOutputTokens: 1500,
    });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("无法解析 LLM 响应");
      }

      const response = JSON.parse(jsonMatch[0]) as {
        concepts: RawConceptResponse[];
      };
      return response.concepts;
    } catch (parseError) {
      logger.error(
        { error: parseError },
        "KnowledgeExtractor: Failed to parse concepts",
      );
      return [];
    }
  }

  /**
   * 生成综合结论
   */
  async generateConclusion(
    keyPoints: KeyPoint[],
    concepts: ConceptDefinition[],
    topic: string,
  ): Promise<string> {
    const keyPointsStr = keyPoints.map((kp) => `- ${kp.content}`).join("\n");
    const conceptsStr = concepts
      .map((c) => `- ${c.term}: ${c.definition}`)
      .join("\n");

    const prompt = CONCLUSION_GENERATION_PROMPT.replace("{topic}", topic)
      .replace("{keyPoints}", keyPointsStr)
      .replace("{concepts}", conceptsStr || "（无概念提取）");

    const { text } = await generateText({
      // 使用 .chat() 强制使用 Chat Completions API
      model: this.openai.chat(this.model),
      prompt,
      maxOutputTokens: 300,
    });

    return text.trim();
  }

  /**
   * 生成行动建议
   */
  async generateActionItems(
    keyPoints: KeyPoint[],
    topic: string,
  ): Promise<string[]> {
    const keyPointsStr = keyPoints.map((kp) => `- ${kp.content}`).join("\n");

    const prompt = ACTION_ITEMS_PROMPT.replace("{topic}", topic).replace(
      "{keyPoints}",
      keyPointsStr,
    );

    const { text } = await generateText({
      // 使用 .chat() 强制使用 Chat Completions API
      model: this.openai.chat(this.model),
      prompt,
      maxOutputTokens: 500,
    });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const response = JSON.parse(jsonMatch[0]) as { actionItems: string[] };
      return response.actionItems || [];
    } catch {
      return [];
    }
  }

  /**
   * 构建引用标注
   */
  private buildCitation(
    sourceIndex: number,
    contents: BookmarkContent[],
  ): Citation {
    const content = contents[sourceIndex - 1];
    return {
      id: sourceIndex,
      sourceId: content?.bookmarkId || 0,
      sourceTitle: content?.title || `来源 ${sourceIndex}`,
      confidence: 0.9,
    };
  }

  /**
   * 构建来源列表
   */
  private buildSourceList(contents: BookmarkContent[]): SourceInfo[] {
    return contents.map((c, i) => ({
      id: c.bookmarkId,
      index: i + 1,
      title: c.title,
      url: c.url,
      platform: c.platform,
      savedAt: c.savedAt,
    }));
  }

  /**
   * 生成萃取结果标题
   */
  private generateTitle(topic: string, sourceCount: number): string {
    return `${topic} 知识萃取 (${sourceCount} 篇)`;
  }
}

// ============================================
// 导出
// ============================================

export const knowledgeExtractor = new KnowledgeExtractor();
