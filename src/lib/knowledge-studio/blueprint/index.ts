/**
 * Blueprint Engine Module - 蓝图引擎模块
 * @module knowledge-studio/blueprint
 */

export { BlueprintEngine, blueprintEngine } from "./blueprint-engine";
export {
  buildPromptForBlueprint,
  getBlueprintOutputFormat,
  getAllBlueprintTypes,
} from "./prompt-builder";
export { BLUEPRINT_DISPLAY_CONFIG } from "./types";
export type {
  GenerationContext,
  MaterialInput,
  BlueprintEngineConfig,
  ProgressCallback,
  GenerationResult,
  BlueprintPromptTemplate,
  StageProgress,
} from "./types";
