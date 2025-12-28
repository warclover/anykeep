/**
 * System Prompt 模板索引
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { DESIGN_PROMPTS } from "./design.prompts";
import { PROFESSIONAL_PROMPTS } from "./professional.prompts";
import { ACADEMIC_PROMPTS } from "./academic.prompts";
import { GROWTH_PROMPTS } from "./growth.prompts";

// 导出各分组 Prompt
export { DESIGN_PROMPTS } from "./design.prompts";
export { PROFESSIONAL_PROMPTS } from "./professional.prompts";
export { ACADEMIC_PROMPTS } from "./academic.prompts";
export { GROWTH_PROMPTS } from "./growth.prompts";

// 导出单独的 Prompt
export { PM_PROMPT, UX_RESEARCHER_PROMPT } from "./design.prompts";
export { CONSULTANT_PROMPT, ANALYST_PROMPT } from "./professional.prompts";
export { TEACHER_PROMPT } from "./academic.prompts";
export { CERT_SEEKER_PROMPT } from "./growth.prompts";

/**
 * 所有 Prompt 模板映射
 */
export const ALL_PROMPTS: Record<string, string> = {
  ...DESIGN_PROMPTS,
  ...PROFESSIONAL_PROMPTS,
  ...ACADEMIC_PROMPTS,
  ...GROWTH_PROMPTS,
};

/**
 * 获取 Prompt 模板
 *
 * @param key Prompt 键名（如 "design.pm"）
 * @returns Prompt 模板，如果未找到则返回 undefined
 */
export function getPromptTemplate(key: string): string | undefined {
  return ALL_PROMPTS[key];
}

/**
 * 检查 Prompt 模板是否存在
 *
 * @param key Prompt 键名
 * @returns 是否存在
 */
export function hasPromptTemplate(key: string): boolean {
  return key in ALL_PROMPTS;
}
