/**
 * 画像配置索引
 *
 * Phase 3: 完整覆盖 25 类画像
 *
 * @version 2.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig, PersonaType } from "../types";

// Phase 1-2 画像配置
import { PM_CONFIG } from "./pm.config";
import { CONSULTANT_CONFIG } from "./consultant.config";
import { TEACHER_CONFIG } from "./teacher.config";
import { ANALYST_CONFIG } from "./analyst.config";
import { CERT_SEEKER_CONFIG } from "./cert-seeker.config";
import { UX_RESEARCHER_CONFIG } from "./ux-researcher.config";

// Phase 3 新增画像配置
import { RESEARCHER_CONFIG } from "./researcher.config";
import { ONLINE_TEACHER_CONFIG } from "./online-teacher.config";
import { CURATOR_CONFIG } from "./curator.config";
import { SECURITY_RESEARCHER_CONFIG } from "./security-researcher.config";
import { ARCHITECT_CONFIG } from "./architect.config";
import { LAWYER_CONFIG } from "./lawyer.config";
import { MEDICAL_CONFIG } from "./medical.config";
import { JOURNALIST_CONFIG } from "./journalist.config";
import { GAME_PLANNER_CONFIG } from "./game-planner.config";
import { TRAINER_CONFIG } from "./trainer.config";
import { LIFELONG_LEARNER_CONFIG } from "./lifelong-learner.config";
import { CAREER_CHANGER_CONFIG } from "./career-changer.config";
import { LANGUAGE_LEARNER_CONFIG } from "./language-learner.config";
import { GENERAL_CONFIG } from "./general.config";

// 导出所有配置 - Phase 1-2
export { PM_CONFIG } from "./pm.config";
export { CONSULTANT_CONFIG } from "./consultant.config";
export { TEACHER_CONFIG } from "./teacher.config";
export { ANALYST_CONFIG } from "./analyst.config";
export { CERT_SEEKER_CONFIG } from "./cert-seeker.config";
export { UX_RESEARCHER_CONFIG } from "./ux-researcher.config";

// 导出所有配置 - Phase 3 新增
export { RESEARCHER_CONFIG } from "./researcher.config";
export { ONLINE_TEACHER_CONFIG } from "./online-teacher.config";
export { CURATOR_CONFIG } from "./curator.config";
export { SECURITY_RESEARCHER_CONFIG } from "./security-researcher.config";
export { ARCHITECT_CONFIG } from "./architect.config";
export { LAWYER_CONFIG } from "./lawyer.config";
export { MEDICAL_CONFIG } from "./medical.config";
export { JOURNALIST_CONFIG } from "./journalist.config";
export { GAME_PLANNER_CONFIG } from "./game-planner.config";
export { TRAINER_CONFIG } from "./trainer.config";
export { LIFELONG_LEARNER_CONFIG } from "./lifelong-learner.config";
export { CAREER_CHANGER_CONFIG } from "./career-changer.config";
export { LANGUAGE_LEARNER_CONFIG } from "./language-learner.config";
export { GENERAL_CONFIG } from "./general.config";

/**
 * Phase 3 画像配置注册表
 *
 * 包含全部 20 类已配置画像（25 类画像中有 5 类使用通用行为信号）
 */
export const PERSONA_CONFIGS: Partial<Record<PersonaType, PersonaConfig>> = {
  // 产品设计型
  pm: PM_CONFIG,
  ux_researcher: UX_RESEARCHER_CONFIG,
  game_planner: GAME_PLANNER_CONFIG,
  trainer: TRAINER_CONFIG,

  // 专业服务型
  consultant: CONSULTANT_CONFIG,
  analyst: ANALYST_CONFIG,
  lawyer: LAWYER_CONFIG,
  medical: MEDICAL_CONFIG,
  journalist: JOURNALIST_CONFIG,

  // 学术研究型
  teacher: TEACHER_CONFIG,
  researcher: RESEARCHER_CONFIG,

  // 内容创作型
  online_teacher: ONLINE_TEACHER_CONFIG,
  curator: CURATOR_CONFIG,

  // 技术实践型
  security_researcher: SECURITY_RESEARCHER_CONFIG,
  architect: ARCHITECT_CONFIG,

  // 自我提升型
  cert_seeker: CERT_SEEKER_CONFIG,
  lifelong_learner: LIFELONG_LEARNER_CONFIG,
  career_changer: CAREER_CHANGER_CONFIG,
  language_learner: LANGUAGE_LEARNER_CONFIG,

  // 通用
  general: GENERAL_CONFIG,
};

/**
 * 获取画像配置
 *
 * @param type 画像类型
 * @returns 画像配置，如果未定义则返回 undefined
 */
export function getPersonaConfig(type: PersonaType): PersonaConfig | undefined {
  return PERSONA_CONFIGS[type];
}

/**
 * 检查画像是否有配置
 *
 * @param type 画像类型
 * @returns 是否有配置
 */
export function hasPersonaConfig(type: PersonaType): boolean {
  return type in PERSONA_CONFIGS;
}

/**
 * 获取所有已配置的画像类型
 */
export function getConfiguredPersonas(): PersonaType[] {
  return Object.keys(PERSONA_CONFIGS) as PersonaType[];
}

/**
 * 获取指定分组的已配置画像
 *
 * @param group 画像分组
 * @returns 该分组下已配置的画像列表
 */
export function getConfiguredPersonasByGroup(group: string): PersonaConfig[] {
  return Object.values(PERSONA_CONFIGS).filter(
    (config): config is PersonaConfig => config?.group === group,
  );
}
