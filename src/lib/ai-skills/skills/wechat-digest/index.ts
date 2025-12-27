/**
 * WechatDigestSkill 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

export { WechatDigestSkill, wechatDigestSkill } from "./wechat-digest.skill";
export type {
  WechatDigestInput,
  WechatDigestOutput,
  WechatArticleData,
  ArticleGroup,
  GroupSummary,
  DigestInsights,
  WechatDigestContext,
} from "./types";
export {
  WechatDigestInputSchema,
  WechatDigestOutputSchema,
  WECHAT_DIGEST_STEPS,
} from "./types";
