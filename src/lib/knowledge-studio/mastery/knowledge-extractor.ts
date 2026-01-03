/**
 * Knowledge Studio - 知识点提取服务
 * @module knowledge-studio/mastery
 * @description P4 实现 - 从报告提取知识点
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { IKnowledgeExtractor, KnowledgePoint } from "./types";

// ============================================================================
// 数据库行类型
// ============================================================================

interface KnowledgePointRow {
  id: string;
  report_id: string;
  content: string;
  keywords: string[];
  paragraph_index: number;
  source_bookmark_ids: string[];
  difficulty: number;
  importance: number;
  created_at: string;
}

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
    type SynthesisReportRow =
      Database["public"]["Tables"]["synthesis_reports"]["Row"];
    const { data: report, error: reportError } = await (
      supabase.from("synthesis_reports") as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: Pick<
                SynthesisReportRow,
                "content" | "generation_metadata"
              > | null;
              error: { code?: string; message: string } | null;
            }>;
          };
        };
      }
    )
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

    // 解析报告内容提取知识点
    const extractedPoints = this.parseReportContent(
      report?.content ?? "",
      reportId,
      report?.source_bookmark_ids ?? [],
    );

    if (extractedPoints.length === 0) {
      logger.info({ reportId }, "No knowledge points extracted");
      return [];
    }

    // 批量插入知识点
    type KnowledgePointInsert =
      Database["public"]["Tables"]["ks_knowledge_points"]["Insert"];
    type KnowledgePointRow =
      Database["public"]["Tables"]["ks_knowledge_points"]["Row"];
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

    const { data, error } = await (
      supabase.from("ks_knowledge_points") as {
        insert: (values: KnowledgePointInsert[]) => {
          select: () => Promise<{
            data: KnowledgePointRow[] | null;
            error: { message: string } | null;
          }>;
        };
      }
    )
      .insert(pointsToInsert)
      .select();

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to insert knowledge points",
      );
      throw new Error(`保存知识点失败: ${error.message}`);
    }

    const resultData = data ?? [];

    logger.info(
      { reportId, count: resultData.length },
      "Knowledge points extracted and saved",
    );

    return resultData.map((row) =>
      rowToKnowledgePoint(row as KnowledgePointRow),
    );
  }

  /**
   * 解析报告内容提取知识点
   *
   * 简单实现：按段落分割，每个有意义的段落作为一个知识点
   * 实际生产中应该调用 LLM API 进行智能提取
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

    return (data ?? []).map((row) =>
      rowToKnowledgePoint(row as KnowledgePointRow),
    );
  }

  /**
   * 更新知识点
   */
  async updateKnowledgePoint(
    pointId: string,
    updates: Partial<KnowledgePoint>,
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {};

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.keywords !== undefined) updateData.keywords = updates.keywords;
    if (updates.difficulty !== undefined)
      updateData.difficulty = updates.difficulty;
    if (updates.importance !== undefined)
      updateData.importance = updates.importance;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    type KnowledgePointUpdate =
      Database["public"]["Tables"]["ks_knowledge_points"]["Update"];
    const { error } = await (
      supabase.from("ks_knowledge_points") as {
        update: (values: KnowledgePointUpdate) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{
            error: { message: string } | null;
          }>;
        };
      }
    )
      .update(updateData as KnowledgePointUpdate)
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
