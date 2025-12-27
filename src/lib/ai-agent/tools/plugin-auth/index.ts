/**
 * Plugin Authorization Tools
 *
 * 浏览器插件授权管理 Tools
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// Types
export * from "./types";

// Tools
export { listPluginAuthorizationsTool } from "./list-plugin-authorizations.tool";
export { revokePluginAuthorizationTool } from "./revoke-plugin-authorization.tool";
export { revokeAllPluginAuthorizationsTool } from "./revoke-all-plugin-authorizations.tool";
export { getPluginAuthStatsTool } from "./get-plugin-auth-stats.tool";

// Tools 数组（用于批量注册）
import { listPluginAuthorizationsTool } from "./list-plugin-authorizations.tool";
import { revokePluginAuthorizationTool } from "./revoke-plugin-authorization.tool";
import { revokeAllPluginAuthorizationsTool } from "./revoke-all-plugin-authorizations.tool";
import { getPluginAuthStatsTool } from "./get-plugin-auth-stats.tool";

export const pluginAuthTools = [
  listPluginAuthorizationsTool,
  revokePluginAuthorizationTool,
  revokeAllPluginAuthorizationsTool,
  getPluginAuthStatsTool,
];
