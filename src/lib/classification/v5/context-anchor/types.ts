/**
 * 智能分类 v5.0 - Context Anchor 类型定义
 */

/**
 * 锚点类型
 */
export type AnchorType = "series" | "author" | "source" | "topic";

/**
 * 上下文锚点
 */
export interface ContextAnchor {
  id: number;
  userId: string;
  anchorType: AnchorType;
  anchorName: string;
  anchorMetadata: Record<string, unknown>;
  embedding: number[] | null;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 提取的锚点信息
 */
export interface ExtractedAnchor {
  anchorType: AnchorType;
  anchorName: string;
  anchorMetadata: Record<string, unknown>;
  confidence: number; // 0-1
}

/**
 * 相似锚点结果
 */
export interface SimilarAnchor {
  anchorId: number;
  anchorType: AnchorType;
  anchorName: string;
  anchorMetadata: Record<string, unknown>;
  bookmarkCount: number;
  similarity: number; // 0-1
}

/**
 * 锚点提取参数
 */
export interface AnchorExtractionParams {
  bookmarkId: number;
  title: string;
  url: string;
  content?: string;
  embedding: number[];
}

/**
 * 锚点关联结果
 */
export interface AnchorLinkResult {
  success: boolean;
  anchorId?: number;
  anchorName?: string;
  isNewAnchor?: boolean;
  error?: string;
}
