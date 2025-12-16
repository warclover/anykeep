/**
 * API 工具统一导出
 * @description 客户端和服务端 API 工具
 */

// 客户端工具
export {
  fetchWithAuth,
  fetchJsonWithAuth,
  authFetcher,
  clearAuthCache,
} from "./fetch-with-auth";

// 服务端工具
export {
  withAuth,
  withAuthHandler,
  getUserId,
  unauthorizedResponse,
  type AuthResult,
} from "./auth-middleware";
