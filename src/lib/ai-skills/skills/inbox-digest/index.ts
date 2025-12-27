/**
 * InboxDigest Skill 模块导出
 *
 * @module ai-skills/skills/inbox-digest
 * @version 1.0.0
 * @since 2025-12-27
 */

export type { InboxDigestInput, InboxDigestOutput, MessageRow } from "./types";

export {
  InboxDigestInputSchema,
  InboxDigestOutputSchema,
  INBOX_DIGEST_STEPS,
  MESSAGE_TYPE_LABELS,
  MESSAGE_LEVEL_LABELS,
} from "./types";

export { InboxDigestSkill, inboxDigestSkill } from "./inbox-digest.skill";
