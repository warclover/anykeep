/**
 * Blueprint Engine Module - 蓝图引擎模块
 * @module knowledge-studio/blueprint
 */

// ============================================================
// Core Engine
// ============================================================

export { BlueprintEngine, blueprintEngine } from "./blueprint-engine";
export {
  buildPromptForBlueprint,
  getBlueprintOutputFormat,
  getAllBlueprintTypes,
} from "./prompt-builder";

// ============================================================
// Enhanced Blueprint System (v2.0)
// ============================================================

export { EnhancedBlueprintEngine } from "./enhanced-blueprint-engine";
export type {
  BlueprintStage,
  BlueprintExecutionContext,
} from "./enhanced-blueprint-engine";

export { BlueprintRegistry, getBlueprintRegistry } from "./blueprint-registry";
export type {
  BlueprintCategory,
  BlueprintAccessInfo,
  BlueprintWithAccessInfo,
} from "./blueprint-registry";

// ============================================================
// Outline Generator (Story 2.1)
// ============================================================

export {
  generateOutline,
  generateOutlineStream,
  countOutlineNodes,
  flattenOutlineNodes,
  getOutlineDepth,
  createEmptyOutline,
  isOutlineEmpty,
  OutlineParseError,
  OutlineValidationError,
} from "./outline-generator";
export type {
  OutlineGeneratorOptions,
  OutlineGenerationResult,
} from "./outline-generator";

// ============================================================
// Outline Prompts
// ============================================================

export {
  buildOutlinePrompt,
  buildOutlineUserPrompt,
  OUTLINE_SYSTEM_PROMPT,
  OUTLINE_JSON_SCHEMA,
} from "./prompts/outline.prompt";
export type { OutlineGenerationConfig } from "./prompts/outline.prompt";

// ============================================================
// Content Generator (Story 2.4)
// ============================================================

export {
  generateContent,
  generateContentStream,
  validateContentStructure,
  extractHeadingsFromContent,
} from "./content-generator";
export type {
  ContentGeneratorOptions,
  ContentGenerationResult,
  ContentStreamChunk,
} from "./content-generator";

// ============================================================
// Content Prompts (Story 2.4)
// ============================================================

export {
  buildContentPrompt,
  buildContentUserPrompt,
  CONTENT_SYSTEM_PROMPT,
  estimateTotalWords,
  countSections,
} from "./prompts/content.prompt";
export type { ContentGenerationConfig } from "./prompts/content.prompt";

// ============================================================
// Briefing System
// ============================================================

export {
  formatBriefingResponse,
  injectBriefingToPrompt,
  isBriefingContextEmpty,
  createEmptyBriefingContext,
  restoreBriefingContext,
  createQuickModeContext,
  createQuickModeStorageFormat,
  isQuickModeStorage,
  determineGenerationMode,
  createGenerationModeMetadata,
} from "./briefing-injector";
export type {
  FormattedBriefingResponse,
  BriefingStorageFormat,
  QuickModeStorageFormat,
  GenerationModeMetadata,
} from "./briefing-injector";

// ============================================================
// Outline Version Manager (Story 2.5)
// ============================================================

export {
  OutlineVersionManager,
  createOutlineVersionManager,
  formatVersionTimestamp,
  MAX_VERSIONS,
} from "./outline-version-manager";
export type {
  OutlineVersion,
  OutlineVersionState,
  OutlineVersionManagerConfig,
  OutlineVersionDiff,
} from "./outline-version-manager";

// ============================================================
// Structured Output (Story 3.1)
// ============================================================

export {
  // Validator
  validateOutput,
  validateOutputAuto,
  validateOutputBatch,
  isValidOutput,
  inferOutputType,
  createEmptyMeta,
  createFallbackMeta,
  getSupportedOutputTypes,
  isOutputTypeSupported,
  // Schemas
  schemaRegistry,
  getSchemaForType,
  featureMatrixSchema,
  swotSchema,
  scriptTimelineSchema,
  sectionsSchema,
  checklistSchema,
  markdownSchema,
} from "./structured-output";
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
} from "./structured-output";

// ============================================================
// Types
// ============================================================

export { BLUEPRINT_DISPLAY_CONFIG } from "./types";
export type {
  // Legacy types
  GenerationContext,
  MaterialInput,
  BlueprintEngineConfig,
  ProgressCallback,
  GenerationResult,
  BlueprintPromptTemplate,
  StageProgress,
  // Enhanced types (v2.0)
  BriefingQuestionType,
  BriefingQuestionCategory,
  BriefingQuestion,
  BriefingConfig,
  BriefingContext,
  EnhancedBlueprintInput,
  StructuredOutput,
  OutlineNode,
  BlueprintOutline,
  BlueprintTier,
  TargetUserGroup,
  EnhancedBlueprintMetadata,
  GenerationMode,
  GenerationRequest,
  MaterialAnalysisResult,
  ConditionalQuestionRule,
} from "./types";
