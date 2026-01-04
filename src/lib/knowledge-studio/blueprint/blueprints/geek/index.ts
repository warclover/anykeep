/**
 * Geek Blueprints Index (Epic 4)
 * @module knowledge-studio/blueprint/blueprints/geek
 *
 * 极客蓝图 - 为技术博主、开发者、研究员设计的专业蓝图。
 *
 * 包含 4 个蓝图：
 * - arxiv_decoder: 论文实战解码器
 * - tutorial_architect: 技术教程架构师
 * - prd_master: PRD大师
 * - system_design_review: 系统架构评审官
 */

// Import for local use
import { createArxivDecoderBlueprint } from "./arxiv-decoder";
import { createTutorialArchitectBlueprint } from "./tutorial-architect";
import { createPrdMasterBlueprint } from "./prd-master";
import { createSystemDesignReviewBlueprint } from "./system-design-review";

// Re-export everything
export {
  ArxivDecoderBlueprint,
  createArxivDecoderBlueprint,
  type ArxivDecoderOutput,
} from "./arxiv-decoder";

export {
  TutorialArchitectBlueprint,
  createTutorialArchitectBlueprint,
  type TutorialArchitectOutput,
} from "./tutorial-architect";

export {
  PrdMasterBlueprint,
  createPrdMasterBlueprint,
  type PrdMasterOutput,
} from "./prd-master";

export {
  SystemDesignReviewBlueprint,
  createSystemDesignReviewBlueprint,
  type SystemDesignReviewOutput,
} from "./system-design-review";

/**
 * 获取所有极客蓝图
 */
export function getAllGeekBlueprints() {
  return [
    createArxivDecoderBlueprint(),
    createTutorialArchitectBlueprint(),
    createPrdMasterBlueprint(),
    createSystemDesignReviewBlueprint(),
  ];
}
