/**
 * 切片模块
 *
 * Parent-Child 语义切片系统
 *
 * @module chunking
 * @version 1.0.0
 * @since 2025-12-28
 */

export {
  SemanticChunker,
  getSemanticChunker,
  resetSemanticChunker,
} from "./semantic-chunker";

export {
  ChunkSearchService,
  getChunkSearchService,
  resetChunkSearchService,
  type ChunkSearchOptions,
  type ChunkSearchResultWithContext,
} from "./chunk-search.service";

export {
  DEFAULT_CHUNK_CONFIG,
  type ChunkConfig,
  type Chunk,
  type ChunkType,
  type ChunkingStats,
  type ChunkRecord,
} from "./types";
