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

// ArxivDecoder (Story 4.1)
export {
  ArxivDecoderBlueprint,
  createArxivDecoderBlueprint,
  type ArxivDecoderOutput,
} from "./arxiv-decoder";

// TutorialArchitect (Story 4.2)
export {
  TutorialArchitectBlueprint,
  createTutorialArchitectBlueprint,
  type TutorialArchitectOutput,
} from "./tutorial-architect";

// PrdMaster (Story 4.3)
export {
  PrdMasterBlueprint,
  createPrdMasterBlueprint,
  type PrdMasterOutput,
} from "./prd-master";

// SystemDesignReview (Story 4.4)
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
