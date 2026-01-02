/**
 * Blueprint Prompts 索引
 * @module knowledge-studio/blueprint/prompts
 * @description 导出所有 5 种蓝图 Prompt 模板
 */

export { debaterPrompt } from "./debater.prompt";
export { bloggerPrompt } from "./blogger.prompt";
export { threadPrompt } from "./thread.prompt";
export { tutorialPrompt } from "./tutorial.prompt";
export { feynmanPrompt } from "./feynman.prompt";

import { debaterPrompt } from "./debater.prompt";
import { bloggerPrompt } from "./blogger.prompt";
import { threadPrompt } from "./thread.prompt";
import { tutorialPrompt } from "./tutorial.prompt";
import { feynmanPrompt } from "./feynman.prompt";
import type { BlueprintType } from "../../types";
import type { BlueprintPromptTemplate } from "../types";

/**
 * 所有蓝图 Prompt 模板映射
 */
export const BLUEPRINT_PROMPTS: Record<BlueprintType, BlueprintPromptTemplate> =
  {
    debater: debaterPrompt,
    blogger: bloggerPrompt,
    thread: threadPrompt,
    tutorial: tutorialPrompt,
    feynman: feynmanPrompt,
  };

/**
 * 获取蓝图 Prompt 模板
 */
export function getBlueprintPrompt(
  type: BlueprintType,
): BlueprintPromptTemplate {
  return BLUEPRINT_PROMPTS[type];
}

/**
 * 获取所有可用蓝图类型
 */
export function getAvailableBlueprintTypes(isPro: boolean): BlueprintType[] {
  return Object.entries(BLUEPRINT_PROMPTS)
    .filter(([, prompt]) => !prompt.isPro || isPro)
    .map(([type]) => type as BlueprintType);
}

/**
 * 检查蓝图是否需要 Pro
 */
export function isBlueprintProOnly(type: BlueprintType): boolean {
  return BLUEPRINT_PROMPTS[type]?.isPro ?? false;
}
