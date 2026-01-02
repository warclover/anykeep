/**
 * Knowledge Studio - 知识点提取服务
 * @module knowledge-studio/mastery
 * @description Phase 3 存根 - 从报告提取知识点
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - AI 知识点识别
 * - 关键词提取
 * - 难度评估
 * - 知识图谱构建
 */

import { logger } from "@/lib/logger";
import type { IKnowledgeExtractor, KnowledgePoint } from "./types";

// ============================================================================
// 存根实现
// ============================================================================

/**
 * 知识点提取服务（Phase 3 存根）
 *
 * @example
 * ```typescript
 * const extractor = new KnowledgeExtractorStub();
 *
 * // 提取知识点
 * const points = await extractor.extractFromReport('report-123');
 * console.log(`提取了 ${points.length} 个知识点`);
 * ```
 */
export class KnowledgeExtractorStub implements IKnowledgeExtractor {
  /**
   * 从报告提取知识点
   * @stub 返回空数组，Phase 3 实现 AI 提取
   */
  async extractFromReport(reportId: string): Promise<KnowledgePoint[]> {
    logger.info(
      `[KnowledgeExtractor] extractFromReport(${reportId}) - Phase 3 存根`,
    );
    return [];
  }

  /**
   * 获取报告知识点
   * @stub 返回空数组，Phase 3 实现查询
   */
  async getReportKnowledgePoints(reportId: string): Promise<KnowledgePoint[]> {
    logger.info(
      `[KnowledgeExtractor] getReportKnowledgePoints(${reportId}) - Phase 3 存根`,
    );
    return [];
  }

  /**
   * 更新知识点
   * @stub 仅记录日志，Phase 3 实现更新
   */
  async updateKnowledgePoint(
    pointId: string,
    updates: Partial<KnowledgePoint>,
  ): Promise<void> {
    logger.info(
      `[KnowledgeExtractor] updateKnowledgePoint(${pointId}) - Phase 3 存根, updates: ${JSON.stringify(updates)}`,
    );
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建知识点提取服务实例
 * @stub Phase 3 实现完整服务
 */
export function createKnowledgeExtractor(): IKnowledgeExtractor {
  return new KnowledgeExtractorStub();
}
