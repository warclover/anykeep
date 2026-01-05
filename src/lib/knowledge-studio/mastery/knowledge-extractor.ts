/**
 * Knowledge Studio - 知识点提取服务
 * @module knowledge-studio/mastery
 * @description P4 实现 - 从报告提取知识点
 * @version 1.1.0
 * @since 2026-01-02
 * @updated 2026-01-05 - 集成 AI 服务进行智能知识点提取
 */

import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type { IKnowledgeExtractor, KnowledgePoint } from "./types";
import type { Database } from "@/types/supabase";

// ============================================================================
// 数据库类型别名（使用 Database 类型）
// ============================================================================

type KnowledgePointRow =
  Database["public"]["Tables"]["ks_knowledge_points"]["Row"];
type KnowledgePointInsert =
  Database["public"]["Tables"]["ks_knowledge_points"]["Insert"];
type KnowledgePointUpdate =
  Database["public"]["Tables"]["ks_knowledge_points"]["Update"];
type SynthesisReportRow =
  Database["public"]["Tables"]["synthesis_reports"]["Row"];

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToKnowledgePoint(row: KnowledgePointRow): KnowledgePoint {
  return {
    id: row.id,
    reportId: row.report_id,
    content: row.content,
    keywords: row.keywords ?? [],
    paragraphIndex: row.paragraph_index,
    sourceBookmarkIds: row.source_bookmark_ids ?? [],
    difficulty: row.difficulty,
    importance: row.importance,
    createdAt: new Date(row.created_at),
  };
}

// ============================================================================
// 知识点提取服务实现
// ============================================================================

/**
 * 知识点提取服务
 *
 * @example
 * ```typescript
 * const extractor = new KnowledgeExtractor();
 *
 * // 提取知识点
 * const points = await extractor.extractFromReport('report-123');
 * console.log(`提取了 ${points.length} 个知识点`);
 * ```
 */
export class KnowledgeExtractor implements IKnowledgeExtractor {
  /**
   * 从报告提取知识点
   *
   * 注意：此方法会解析报告内容并提取知识点
   * 实际的 AI 提取逻辑需要调用 LLM API
   */
  async extractFromReport(reportId: string): Promise<KnowledgePoint[]> {
    const supabase = await createClient();

    // 检查是否已有知识点
    const existing = await this.getReportKnowledgePoints(reportId);
    if (existing.length > 0) {
      logger.info(
        { reportId, count: existing.length },
        "Knowledge points already extracted",
      );
      return existing;
    }

    // 获取报告内容（使用 synthesis_reports 表）
    const { data: report, error: reportError } = await supabase
      .from("synthesis_reports")
      .select("content, generation_metadata")
      .eq("id", reportId)
      .single();

    if (reportError) {
      // 如果报告表不存在，返回空数组
      if (reportError.code === "42P01") {
        logger.warn({ reportId }, "ks_reports table not found");
        return [];
      }
      if (reportError.code === "PGRST116") {
        logger.warn({ reportId }, "Report not found");
        return [];
      }
      throw new Error(`获取报告失败: ${reportError.message}`);
    }

    type ReportPick = Pick<
      SynthesisReportRow,
      "content" | "generation_metadata"
    >;
    const typedReport = report as ReportPick | null;

    // 解析 generation_metadata 获取 source_bookmark_ids
    const metadata = typedReport?.generation_metadata as
      | { source_bookmark_ids?: string[] }
      | undefined;
    const sourceBookmarkIds = metadata?.source_bookmark_ids ?? [];

    // 解析报告内容提取知识点（使用 AI）
    const extractedPoints = await this.parseReportContentWithAI(
      (typedReport?.content as string) ?? "",
      reportId,
      sourceBookmarkIds,
    );

    if (extractedPoints.length === 0) {
      logger.info({ reportId }, "No knowledge points extracted");
      return [];
    }

    // 批量插入知识点
    const pointsToInsert: KnowledgePointInsert[] = extractedPoints.map(
      (point) => ({
        report_id: point.reportId,
        content: point.content,
        keywords: point.keywords,
        paragraph_index: point.paragraphIndex,
        source_bookmark_ids: point.sourceBookmarkIds,
        difficulty: point.difficulty,
        importance: point.importance,
      }),
    );

    const { data, error } = await supabase
      .from("ks_knowledge_points")
      .insert(pointsToInsert)
      .select();

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to insert knowledge points",
      );
      throw new Error(`保存知识点失败: ${error.message}`);
    }

    const resultData = data as KnowledgePointRow[] | null;

    logger.info(
      { reportId, count: resultData?.length ?? 0 },
      "Knowledge points extracted and saved",
    );

    return (resultData ?? []).map((row) => rowToKnowledgePoint(row));
  }

  /**
   * 解析报告内容提取知识点（AI 增强版）
   *
   * 使用 AI 智能提取知识点，包含关键词、难度和重要性评估。
   * 如果 AI 调用失败，回退到规则提取。
   */
  private async parseReportContentWithAI(
    content: string,
    reportId: string,
    sourceBookmarkIds: string[],
  ): Promise<Omit<KnowledgePoint, "id" | "createdAt">[]> {
    const selection = aiProviderRouter.selectProvider({
      taskType: "chat",
      preferredProvider: "deepseek",
    });

    if (!selection) {
      logger.warn(
        { reportId },
        "No AI provider available, using rule-based extraction",
      );
      return this.parseReportContent(content, reportId, sourceBookmarkIds);
    }

    try {
      const systemPrompt = `你是一个专业的知识提取助手。请从给定的报告内容中提取关键知识点。

对于每个知识点，请提供：
1. content: 知识点的核心内容（50-200字）
2. keywords: 3-5个关键词（数组）
3. difficulty: 难度评分（1-5，1最简单，5最难）
4. importance: 重要性评分（1-5，1最低，5最高）

请以 JSON 数组格式输出，例如：
[
  {
    "content": "知识点内容...",
    "keywords": ["关键词1", "关键词2"],
    "difficulty": 3,
    "importance": 4
  }
]

只输出 JSON，不要添加任何解释。`;

      const userPrompt = `请从以下报告内容中提取知识点：

${content.slice(0, 8000)}`; // 限制长度

      logger.debug(
        { reportId, provider: selection.provider.name },
        "Extracting knowledge points with AI",
      );

      const result = await generateText({
        model: selection.model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 2048,
        temperature: 0.5,
      });

      const responseText = result.text.trim();

      // 解析 JSON 响应
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("AI response is not valid JSON array");
      }

      const extractedPoints = JSON.parse(jsonMatch[0]) as Array<{
        content: string;
        keywords: string[];
        difficulty: number;
        importance: number;
      }>;

      logger.info(
        { reportId, count: extractedPoints.length },
        "AI extracted knowledge points",
      );

      return extractedPoints.map((point, index) => ({
        reportId,
        content: point.content,
        keywords: point.keywords || [],
        paragraphIndex: index,
        sourceBookmarkIds,
        difficulty: Math.min(5, Math.max(1, point.difficulty || 3)),
        importance: Math.min(5, Math.max(1, point.importance || 3)),
      }));
    } catch (error) {
      logger.error(
        {
          reportId,
          error: error instanceof Error ? error.message : String(error),
        },
        "AI extraction failed, falling back to rule-based",
      );
      return this.parseReportContent(content, reportId, sourceBookmarkIds);
    }
  }

  /**
   * 解析报告内容提取知识点（规则版）
   *
   * 简单实现：按段落分割，每个有意义的段落作为一个知识点
   * 作为 AI 提取失败时的回退方案
   */
  private parseReportContent(
    content: string,
    reportId: string,
    sourceBookmarkIds: string[],
  ): Omit<KnowledgePoint, "id" | "createdAt">[] {
    const points: Omit<KnowledgePoint, "id" | "createdAt">[] = [];

    // 按段落分割
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20); // 过滤太短的段落

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      // 跳过标题和格式化内容
      if (paragraph.startsWith("#") || paragraph.startsWith("---")) {
        continue;
      }

      // 提取关键词（简单实现：提取名词短语）
      const keywords = this.extractKeywords(paragraph);

      // 评估难度和重要性（简单实现）
      const difficulty = this.assessDifficulty(paragraph);
      const importance = this.assessImportance(paragraph, i);

      points.push({
        reportId,
        content: paragraph,
        keywords,
        paragraphIndex: i,
        sourceBookmarkIds,
        difficulty,
        importance,
      });
    }

    return points;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单实现：提取引号内的内容和加粗的内容
    const keywords: string[] = [];

    // 提取引号内容
    const quotedMatches = text.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/g);
    if (quotedMatches) {
      keywords.push(...quotedMatches.map((m) => m.replace(/[「」""'']/g, "")));
    }

    // 提取加粗内容
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g);
    if (boldMatches) {
      keywords.push(...boldMatches.map((m) => m.replace(/\*\*/g, "")));
    }

    // 去重并限制数量
    return [...new Set(keywords)].slice(0, 5);
  }

  /**
   * 评估难度
   */
  private assessDifficulty(text: string): number {
    // 简单实现：基于专业术语密度和句子长度
    const professionalTerms = text.match(/[\u4e00-\u9fa5]{4,}/g) || [];
    const avgSentenceLength =
      text.length / (text.split(/[。！？]/).length || 1);

    let difficulty = 3; // 默认中等

    if (professionalTerms.length > 5 || avgSentenceLength > 100) {
      difficulty = 4;
    }
    if (professionalTerms.length > 10 || avgSentenceLength > 150) {
      difficulty = 5;
    }
    if (professionalTerms.length < 2 && avgSentenceLength < 50) {
      difficulty = 2;
    }

    return difficulty;
  }

  /**
   * 评估重要性
   */
  private assessImportance(text: string, index: number): number {
    // 简单实现：基于位置和强调词
    let importance = 3;

    // 开头段落通常更重要
    if (index < 3) {
      importance = 4;
    }

    // 包含强调词
    const emphasisWords = [
      "重要",
      "关键",
      "核心",
      "必须",
      "注意",
      "记住",
      "总结",
      "结论",
    ];
    if (emphasisWords.some((word) => text.includes(word))) {
      importance = Math.min(5, importance + 1);
    }

    return importance;
  }

  /**
   * 获取报告知识点
   */
  async getReportKnowledgePoints(reportId: string): Promise<KnowledgePoint[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_knowledge_points")
      .select("*")
      .eq("report_id", reportId)
      .order("paragraph_index", { ascending: true });

    if (error) {
      logger.error({ error: error.message }, "Failed to get knowledge points");
      throw new Error(`获取知识点失败: ${error.message}`);
    }

    const typedData = data as KnowledgePointRow[] | null;
    return (typedData ?? []).map((row) => rowToKnowledgePoint(row));
  }

  /**
   * 更新知识点
   */
  async updateKnowledgePoint(
    pointId: string,
    updates: Partial<KnowledgePoint>,
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: KnowledgePointUpdate = {};

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.keywords !== undefined) updateData.keywords = updates.keywords;
    if (updates.difficulty !== undefined)
      updateData.difficulty = updates.difficulty;
    if (updates.importance !== undefined)
      updateData.importance = updates.importance;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await supabase
      .from("ks_knowledge_points")
      .update(updateData)
      .eq("id", pointId);

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to update knowledge point",
      );
      throw new Error(`更新知识点失败: ${error.message}`);
    }

    logger.info(
      { pointId, updates: Object.keys(updateData) },
      "Knowledge point updated",
    );
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建知识点提取服务实例
 */
export function createKnowledgeExtractor(): IKnowledgeExtractor {
  return new KnowledgeExtractor();
}

// 保留旧名称以兼容
export { KnowledgeExtractor as KnowledgeExtractorStub };
