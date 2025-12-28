/**
 * API 版本化模块
 *
 * 提供 RPC 函数和 API 端点的版本化基础设施：
 * - RPC 函数注册表
 * - 版本协商
 * - 版本响应头
 * - 废弃警告
 *
 * @version 1.0.0
 * @since 2025-12-28
 *
 * @example
 * ```typescript
 * import { rpcRegistry, versionedRPC, withVersioning } from "@/lib/api-versioning";
 *
 * // 使用版本化 RPC 调用
 * const result = await versionedRPC(supabase, request, {
 *   family: "batch_add_tags",
 *   params: { p_bookmark_ids: ids, p_tags: tags },
 * });
 *
 * // 使用版本化 API 处理器
 * export const POST = withVersioning(async (request, { version }) => {
 *   // 根据 version 执行不同逻辑
 *   return successResponse(result);
 * });
 * ```
 */

// 类型导出
export type {
  SemanticVersion,
  VersionStatus,
  RPCVersionMeta,
  RPCFunctionDef,
  RPCRegistry,
  VersionNegotiationResult,
} from "./types";

export { VERSION_HEADERS, DEFAULT_VERSION_CONFIG } from "./types";

// 注册表导出
export {
  rpcRegistry,
  defineRPCFunction,
  parseVersion,
  compareVersions,
  formatVersion,
} from "./rpc-registry";

// 中间件导出
export {
  extractVersion,
  addVersionHeaders,
  versionedRPC,
  withVersioning,
  isVersionSupported,
} from "./version-middleware";

// 初始化函数导出
export { initializeRPCRegistry } from "./rpc-definitions";
