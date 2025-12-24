/**
 * Source Profile Module
 * V4.2 来源画像模块导出
 *
 * @version 1.1.0
 * @since 2025-12-11
 * @updated 2025-12-24 - Added type re-exports
 */

// ============================================================================
// 服务导出
// ============================================================================

export {
  SourceProfileService,
  sourceProfileService,
} from "./source-profile.service";

// ============================================================================
// 类型重新导出（从 @/types/source-profile）
// ============================================================================

export type {
  SourceProfile,
  SourceType,
  ContentType,
  SourceMatchResult,
  CreateSourceProfileInput,
  UpdateSourceProfileInput,
  ExtractedSourceInfo,
  SourceProfileRecord,
} from "@/types/source-profile";

export {
  extractSourceFromUrl,
  isValidSourceType,
  isValidContentType,
  DEFAULT_TRUST_SCORE,
  HIGH_TRUST_THRESHOLD,
  SOURCE_TYPE_INFO,
  CONTENT_TYPE_INFO,
} from "@/types/source-profile";
