/**
 * FolderHealthCheckSkill 模块导出
 *
 * @module ai-skills/skills/folder-health-check
 * @version 1.0.0
 * @since 2025-01-08
 */

export {
  FolderHealthCheckSkill,
  folderHealthCheckSkill,
} from "./folder-health-check.skill";
export {
  FOLDER_HEALTH_STEPS,
  FolderHealthCheckInputSchema,
  FolderHealthCheckOutputSchema,
  type FolderHealthCheckInput,
  type FolderHealthCheckOutput,
  type HealthStatus,
  type MergeSuggestion,
  type SplitSuggestion,
} from "./types";
