/**
 * Supabase 客户端导出
 */

// 浏览器客户端
export { createClient, supabase } from "./client";

// 服务端客户端
export {
  createClient as createServerClient,
  createServiceClient,
} from "./server";

// 中间件客户端
export { updateSession } from "./middleware";

// 缓存认证（性能优化）
export {
  getCachedUser,
  getAuthenticatedUser,
  isAuthenticated,
  getUserId,
} from "./cached-auth";
