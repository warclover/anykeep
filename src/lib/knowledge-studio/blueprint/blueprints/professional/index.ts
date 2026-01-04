/**
 * Professional Blueprints Index (Epic 7)
 * @module knowledge-studio/blueprint/blueprints/professional
 *
 * 专业蓝图 - 为专业人士设计的高级蓝图。
 *
 * 包含 4 个蓝图：
 * - tech_decider: 技术决策助手
 * - literature_matrix: 文献矩阵
 * - seo_pillar: SEO霸屏专家
 * - workshop_designer: 课程设计师
 */

// Import for local use
import { createTechDeciderBlueprint } from "./tech-decider";
import { createLiteratureMatrixBlueprint } from "./literature-matrix";
import { createSeoPillarBlueprint } from "./seo-pillar";
import { createWorkshopDesignerBlueprint } from "./workshop-designer";

// TechDecider (Story 7.1)
export {
  TechDeciderBlueprint,
  createTechDeciderBlueprint,
  type TechDeciderOutput,
} from "./tech-decider";

// LiteratureMatrix (Story 7.2)
export {
  LiteratureMatrixBlueprint,
  createLiteratureMatrixBlueprint,
  type LiteratureMatrixOutput,
} from "./literature-matrix";

// SeoPillar (Story 7.3)
export {
  SeoPillarBlueprint,
  createSeoPillarBlueprint,
  type SeoPillarOutput,
} from "./seo-pillar";

// WorkshopDesigner (Story 7.4)
export {
  WorkshopDesignerBlueprint,
  createWorkshopDesignerBlueprint,
  type WorkshopDesignerOutput,
} from "./workshop-designer";

/**
 * 获取所有专业蓝图
 */
export function getAllProfessionalBlueprints() {
  return [
    createTechDeciderBlueprint(),
    createLiteratureMatrixBlueprint(),
    createSeoPillarBlueprint(),
    createWorkshopDesignerBlueprint(),
  ];
}
