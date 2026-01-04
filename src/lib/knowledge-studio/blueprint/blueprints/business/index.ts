/**
 * Business Blueprints Index (Epic 6)
 * @module knowledge-studio/blueprint/blueprints/business
 *
 * 商业蓝图 - 为商业分析师、投资人、创业者设计的专业蓝图。
 *
 * 包含 3 个蓝图：
 * - competitor_scout: 竞品侦察兵
 * - due_diligence: 尽调专家
 * - pitch_narrative: 故事线专家
 */

// Import for local use
import { createCompetitorScoutBlueprint } from "./competitor-scout";
import { createDueDiligenceBlueprint } from "./due-diligence";
import { createPitchNarrativeBlueprint } from "./pitch-narrative";

// CompetitorScout (Story 6.1)
export {
  CompetitorScoutBlueprint,
  createCompetitorScoutBlueprint,
  type CompetitorScoutOutput,
} from "./competitor-scout";

// DueDiligence (Story 6.2)
export {
  DueDiligenceBlueprint,
  createDueDiligenceBlueprint,
  type DueDiligenceOutput,
} from "./due-diligence";

// PitchNarrative (Story 6.3)
export {
  PitchNarrativeBlueprint,
  createPitchNarrativeBlueprint,
  type PitchNarrativeOutput,
} from "./pitch-narrative";

/**
 * 获取所有商业蓝图
 */
export function getAllBusinessBlueprints() {
  return [
    createCompetitorScoutBlueprint(),
    createDueDiligenceBlueprint(),
    createPitchNarrativeBlueprint(),
  ];
}
