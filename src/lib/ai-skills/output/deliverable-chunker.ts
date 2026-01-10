/**
 * 大交付物分块传输器
 *
 * 当交付物内容超过 256KB 时，自动拆分为多个 64KB 的块进行传输
 * 避免前端一次性接收大数据导致的卡顿问题
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type {
  DeliverableChunk,
  DeliverableHeaderChunk,
  DeliverableChunkData,
} from "./types";

// ============================================
// Constants
// ============================================

/** Threshold for chunking (256KB) */
export const CHUNKING_THRESHOLD = 256 * 1024;

/** Size of each chunk (64KB) */
export const CHUNK_SIZE = 64 * 1024;

// ============================================
// Types
// ============================================

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  /** Threshold for chunking in bytes (default: 256KB) */
  threshold: number;
  /** Size of each chunk in bytes (default: 64KB) */
  chunkSize: number;
  /** Enable checksum for integrity verification */
  enableChecksum?: boolean;
}

/**
 * Chunking result statistics
 */
export interface ChunkingStats {
  /** Original content size in bytes */
  originalSize: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Actual chunk size used */
  chunkSize: number;
  /** Whether chunking was applied */
  wasChunked: boolean;
}

// ============================================
// DeliverableChunker Class
// ============================================

/**
 * Handles chunking of large deliverables for efficient streaming
 */
export class DeliverableChunker {
  private readonly config: Required<ChunkingConfig>;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      threshold: config.threshold ?? CHUNKING_THRESHOLD,
      chunkSize: config.chunkSize ?? CHUNK_SIZE,
      enableChecksum: config.enableChecksum ?? false,
    };
  }

  /**
   * Check if content should be chunked based on size
   */
  shouldChunk(content: unknown): boolean {
    const size = this.getContentSize(content);
    return size > this.config.threshold;
  }

  /**
   * Get the size of content in bytes
   */
  getContentSize(content: unknown): number {
    if (content === null || content === undefined) {
      return 0;
    }

    if (typeof content === "string") {
      return new TextEncoder().encode(content).length;
    }

    // For objects/arrays, serialize to JSON and measure
    try {
      const serialized = JSON.stringify(content);
      return new TextEncoder().encode(serialized).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get chunking statistics for content
   */
  getStats(content: unknown): ChunkingStats {
    const originalSize = this.getContentSize(content);
    const wasChunked = originalSize > this.config.threshold;
    const totalChunks = wasChunked
      ? Math.ceil(originalSize / this.config.chunkSize)
      : 1;

    return {
      originalSize,
      totalChunks,
      chunkSize: this.config.chunkSize,
      wasChunked,
    };
  }

  /**
   * Chunk a deliverable into header and data chunks
   *
   * @yields DeliverableHeaderChunk first, then DeliverableChunkData for each chunk
   */
  async *chunk(
    deliverable: DeliverableChunk,
  ): AsyncGenerator<DeliverableHeaderChunk | DeliverableChunkData> {
    const content = deliverable.data.content;
    const contentSize = this.getContentSize(content);

    // Serialize content to string
    const serialized =
      typeof content === "string" ? content : JSON.stringify(content);
    const encoded = new TextEncoder().encode(serialized);

    // Calculate chunks
    const totalChunks = Math.ceil(encoded.length / this.config.chunkSize);

    // Yield header first
    const header: DeliverableHeaderChunk = {
      type: "deliverable_header",
      data: {
        id: deliverable.data.id,
        type: deliverable.data.type,
        title: deliverable.data.title,
        format: deliverable.data.format,
        contentSize,
        isChunked: true,
        totalChunks,
        chunkSize: this.config.chunkSize,
        downloadable: deliverable.data.downloadable,
        shareable: deliverable.data.shareable,
        actions: deliverable.data.actions,
        metadata: deliverable.data.metadata,
      },
    };

    yield header;

    // Yield data chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, encoded.length);
      const chunkBytes = encoded.slice(start, end);

      // Convert to Base64
      const chunkData = this.bytesToBase64(chunkBytes);
      const isLast = i === totalChunks - 1;

      const chunkPayload: DeliverableChunkData = {
        type: "deliverable_chunk",
        data: {
          id: deliverable.data.id,
          chunkIndex: i,
          totalChunks,
          chunkData,
          chunkSize: chunkBytes.length,
          isLast,
          checksum: this.config.enableChecksum
            ? this.computeChecksum(chunkBytes)
            : undefined,
        },
      };

      yield chunkPayload;
    }
  }

  /**
   * Convert Uint8Array to Base64 string
   */
  private bytesToBase64(bytes: Uint8Array): string {
    // Node.js environment
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }

    // Browser environment
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Compute simple checksum for chunk verification
   * Uses a simple sum-based checksum for efficiency
   */
  private computeChecksum(bytes: Uint8Array): string {
    let sum = 0;
    for (let i = 0; i < bytes.length; i++) {
      sum = (sum + bytes[i]) % 65536;
    }
    return sum.toString(16).padStart(4, "0");
  }
}

// ============================================
// Chunk Reassembly Utilities
// ============================================

/**
 * Buffer for collecting chunks during reassembly
 */
export interface ChunkBuffer {
  header: DeliverableHeaderChunk["data"];
  chunks: string[];
  receivedSize: number;
}

/**
 * Reassemble Base64 chunks into original content
 *
 * @param chunks - Array of Base64 encoded chunk strings
 * @param format - Original output format (for JSON parsing)
 * @returns Reassembled content
 */
export function reassembleChunks(chunks: string[], format: string): unknown {
  // Decode all Base64 chunks
  const decodedArrays = chunks.map((chunk) => base64ToBytes(chunk));

  // Calculate total length
  const totalLength = decodedArrays.reduce((sum, arr) => sum + arr.length, 0);

  // Combine into single array
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of decodedArrays) {
    combined.set(arr, offset);
    offset += arr.length;
  }

  // Decode to string
  const decoded = new TextDecoder().decode(combined);

  // Parse JSON if needed
  if (format === "json" || format === "cards" || format === "mindmap") {
    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  }

  return decoded;
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  // Node.js environment
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  // Browser environment
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verify chunk checksum
 *
 * @param chunkData - Base64 encoded chunk data
 * @param expectedChecksum - Expected checksum value
 * @returns true if checksum matches
 */
export function verifyChecksum(
  chunkData: string,
  expectedChecksum: string,
): boolean {
  if (!expectedChecksum) return true;

  const bytes = base64ToBytes(chunkData);
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) % 65536;
  }
  const actualChecksum = sum.toString(16).padStart(4, "0");

  return actualChecksum === expectedChecksum;
}

// ============================================
// Default Export
// ============================================

export default DeliverableChunker;
