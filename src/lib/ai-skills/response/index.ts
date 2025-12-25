/**
 * 响应风格化模块导出
 *
 * @module ai-skills/response
 * @version 1.0.0
 * @since 2025-12-25
 */

// 风格配置
export {
  BANNED_PHRASES,
  RESPONSE_TEMPLATES,
  FOLLOW_UP_CONFIGS,
  detectBannedPhrases,
  removeBannedPhrases,
  getResponseTemplate,
  renderTemplate,
  getFollowUpSuggestions,
  type ResponseTemplate,
  type FollowUpSuggestion,
  type FollowUpConfig,
} from "./style-config";

// 响应风格化处理器
export {
  ResponseStyler,
  createResponseStyler,
  responseStyler,
  type ResponseStylerConfig,
  type StyledResponse,
} from "./response-styler";
