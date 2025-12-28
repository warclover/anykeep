/**
 * 语义切片模块类型定义
 *
 * @module chunking/types
 * @version 1.0.0
 * @since 2025-12-28
 */

/**
 * 切片配置
 */
export interface ChunkConfig {
  /** 单个 child chunk 最大 token 数 */
  maxTokens: number;
  /** 重叠 token 数（保持上下文连续性） */
  overlapTokens: number;
  /** 是否按 Markdown 标题分割 */
  splitByHeaders: boolean;
  /** 是否保留代码块完整性 */
  preserveCodeBlocks: boolean;
  /** 最小 chunk token 数（避免过小的切片） */
  minTokens: number;
}

/**
 * 默认切片配置
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxTokens: 256, // Child chunk 大小
  overlapTokens: 32, // 重叠保持上下文
  splitByHeaders: true,
  preserveCodeBlocks: true,
  minTokens: 20, // 避免过小的切片
};

/**
 * 切片类型
 */
export type ChunkType = "parent" | "child";

/**
 * 切片结果
 */
export interface Chunk {
  /** 切片内容 */
  content: string;
  /** 切片索引（全局唯一） */
  index: number;
  /** Token 数量 */
  tokenCount: number;
  /** 在原文中的起始位置 */
  startOffset: number;
  /** 在原文中的结束位置 */
  endOffset: number;
  /** Parent chunk 索引（仅 child 类型有效） */
  parentIndex?: number;
  /** 切片类型 */
  type: ChunkType;
  /** 内容哈希（用于去重） */
  contentHash: string;
}

/**
 * 切片结果统计
 */
export interface ChunkingStats {
  /** 总切片数 */
  totalChunks: number;
  /** Parent 切片数 */
  parentChunks: number;
  /** Child 切片数 */
  childChunks: number;
  /** 总 Token 数 */
  totalTokens: number;
  /** 平均每个 Parent 的 Child 数 */
  avgChildrenPerParent: number;
}

/**
 * 数据库切片记录
 */
export interface ChunkRecord {
  id: string;
  bookmark_id: number;
  parent_chunk_id: string | null;
  chunk_index: number;
  content: string;
  content_hash: string;
  chunk_type: ChunkType;
  token_count: number;
  start_offset: number;
  end_offset: number;
  embedding: number[] | null;
  embedding_version: string | null;
  created_at: string;
  updated_at: string;
}
