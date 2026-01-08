/**
 * InboxTriageSkill 模块导出
 *
 * @module ai-skills/skills/inbox-triage
 * @version 1.0.0
 * @since 2025-01-08
 */

export { InboxTriageSkill, inboxTriageSkill } from "./inbox-triage.skill";
export {
  INBOX_TRIAGE_STEPS,
  InboxTriageInputSchema,
  InboxTriageOutputSchema,
  type InboxTriageInput,
  type InboxTriageOutput,
  type TriageSuggestion,
  type BookmarkCluster,
} from "./types";
