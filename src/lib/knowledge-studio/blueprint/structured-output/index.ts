/**
 * 结构化输出模块 (Story 3.1)
 * @module knowledge-studio/blueprint/structured-output
 *
 * 提供 JSON Schema 验证和结构化输出类型定义。
 */

// ============================================================
// Types
// ============================================================

export type {
  StructuredOutputType,
  StructuredOutputMeta,
  FeatureSupportLevel,
  FeatureMatrixRow,
  FeatureMatrixOutput,
  SwotQuadrant,
  SwotItem,
  SwotOutput,
  ScriptTimelineShot,
  ScriptTimelineOutput,
  SectionContent,
  SectionsOutput,
  ChecklistItemStatus,
  ChecklistItem,
  ChecklistOutput,
  MarkdownOutput,
  AnyStructuredOutput,
  SchemaValidationError,
  SchemaValidationResult,
} from "./types";

// ============================================================
// Schemas
// ============================================================

export {
  metaSchema,
  featureMatrixSchema,
  swotSchema,
  scriptTimelineSchema,
  sectionsSchema,
  checklistSchema,
  markdownSchema,
  schemaRegistry,
  getSchemaForType,
} from "./schemas";

// ============================================================
// Validator
// ============================================================

export {
  validateOutput,
  validateOutputAuto,
  validateOutputBatch,
  isValidOutput,
  inferOutputType,
  createEmptyMeta,
  createFallbackMeta,
  getSupportedOutputTypes,
  isOutputTypeSupported,
} from "./schema-validator";

// ============================================================
// Fallback Handler (Story 3.3)
// ============================================================

export {
  FallbackHandler,
  createFallbackHandler,
  validateAndFallbackToMarkdown,
  validateWithTypeInference,
  DEFAULT_FALLBACK_CONFIG,
  type FallbackStrategy,
  type FallbackContext,
  type FallbackConfig,
  type FallbackResult,
  type RetryGeneratorFn,
} from "./fallback-handler";
