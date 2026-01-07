/**
 * Knowledge Studio Refinement Module
 * @module knowledge-studio/refinement
 */

export {
  condenseContent,
  condenseContentStream,
  countWords,
  CONDENSE_PRESETS,
  type CondenseOptions,
  type CondenseResult,
  type CondenseStreamCallbacks,
  type CondensePreset,
} from "./condense-service";

// P1-1: 一稿多发风格适配
export {
  adaptStyleStream,
  countWords as countWordsForStyle,
  type AdaptStyleOptions,
  type AdaptStyleResult,
  type AdaptStyleStreamCallbacks,
} from "./adapt-style-service";
