/**
 * Supabase 客户端导出
 */

// 浏览器客户端
export { createClient, supabase } from './client'

// 服务端客户端
export { createClient as createServerClient, createServiceClient } from './server'

// 中间件客户端
export { updateSession } from './middleware'
