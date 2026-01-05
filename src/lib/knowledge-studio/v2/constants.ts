/**
 * Knowledge Studio v2 - Constants
 * @module knowledge-studio/v2
 */

// ============================================================
// Material Limits
// ============================================================

/** 素材选择器默认加载数量 */
export const MATERIAL_SELECTOR_LIMIT = 100;

/** 最少需要的素材数量 */
export const MIN_MATERIALS_REQUIRED = 2;

/** 最多允许的素材数量 */
export const MAX_MATERIALS_ALLOWED = 10;

// ============================================================
// SSE Configuration
// ============================================================

/** SSE chunk 发送间隔（毫秒），用于背压控制 */
export const SSE_CHUNK_DELAY_MS = 30;

// ============================================================
// Error Codes
// ============================================================

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_REQUEST: "INVALID_REQUEST",
  BLUEPRINT_NOT_FOUND: "BLUEPRINT_NOT_FOUND",
  ACCESS_DENIED: "ACCESS_DENIED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  OUTLINE_GENERATION_FAILED: "OUTLINE_GENERATION_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  STREAM_ERROR: "STREAM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// ============================================================
// UI Configuration
// ============================================================

/** 大纲编辑器默认最大高度 */
export const OUTLINE_EDITOR_MAX_HEIGHT = "400px";

/** 结构化输出查看器默认最大高度 */
export const STRUCTURED_OUTPUT_MAX_HEIGHT = "600px";
