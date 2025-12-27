/**
 * 链接健康检测 Skill 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

// 类型导出
export type {
  HealthStatus,
  HealthErrorType,
  CheckScope,
  CheckStatus,
  FixAction,
  LinkCheckResult,
  BookmarkForCheck,
  HealthCheckStats,
  WaybackResult,
  LinkHealthCheckInput,
  LinkHealthCheckOutput,
  FixActionRequest,
  FixActionResult,
  UrlCheckOptions,
  HealthCheckRecord,
} from "./types";

// 配置常量导出
export { LINK_HEALTH_CONFIG, ERROR_HANDLING_CONFIG } from "./types";

// Schema 导出
export {
  HealthStatusSchema,
  HealthErrorTypeSchema,
  CheckScopeSchema,
  CheckStatusSchema,
  FixActionSchema,
  LinkCheckResultSchema,
  HealthCheckStatsSchema,
  LinkHealthCheckInputSchema,
  LinkHealthCheckOutputSchema,
  FixActionRequestSchema,
  BatchFixRequestSchema,
  FixActionResultSchema,
  BatchFixResponseSchema,
  CheckRequestSchema,
  HealthStatusResponseSchema,
  HistoryResponseSchema,
} from "./schema";

// Schema 类型推导导出
export type {
  LinkHealthCheckInputType,
  LinkHealthCheckOutputType,
  LinkCheckResultType,
  HealthCheckStatsType,
  FixActionRequestType,
  BatchFixRequestType,
  CheckRequestType,
} from "./schema";

// 服务导出
export { UrlChecker, urlChecker } from "./services/url-checker";
export { WaybackFinder, waybackFinder } from "./services/wayback-finder";

// Skill 导出
export {
  LinkHealthCheckSkill,
  linkHealthCheckSkill,
} from "./link-health-check.skill";
