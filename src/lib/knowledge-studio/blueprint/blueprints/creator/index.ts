/**
 * Creator Blueprints Index (Epic 5)
 * @module knowledge-studio/blueprint/blueprints/creator
 *
 * 创作者蓝图 - 为内容创作者、播客主持人、Newsletter作者设计的专业蓝图。
 *
 * 包含 3 个蓝图：
 * - scriptwriter: 视频编剧
 * - newsletter: 周刊策展人
 * - interview_prep: 访谈准备官
 */

// Import for local use
import { createScriptwriterBlueprint } from "./scriptwriter";
import { createNewsletterBlueprint } from "./newsletter";
import { createInterviewPrepBlueprint } from "./interview-prep";

// Scriptwriter (Story 5.1)
export {
  ScriptwriterBlueprint,
  createScriptwriterBlueprint,
  type ScriptwriterOutput,
} from "./scriptwriter";

// Newsletter (Story 5.2)
export {
  NewsletterBlueprint,
  createNewsletterBlueprint,
  type NewsletterOutput,
} from "./newsletter";

// InterviewPrep (Story 5.3)
export {
  InterviewPrepBlueprint,
  createInterviewPrepBlueprint,
  type InterviewPrepOutput,
} from "./interview-prep";

/**
 * 获取所有创作者蓝图
 */
export function getAllCreatorBlueprints() {
  return [
    createScriptwriterBlueprint(),
    createNewsletterBlueprint(),
    createInterviewPrepBlueprint(),
  ];
}
