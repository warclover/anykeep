/**
 * Base Supabase Service
 * 提供延迟初始化的 Supabase 客户端基类
 *
 * 使用场景：
 * - 单例服务需要延迟获取 Supabase 客户端
 * - 避免在模块加载时创建数据库连接
 *
 * 继承此类的服务可以通过 `getSupabase()` 获取客户端
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Supabase 客户端类型
 */
export type SupabaseServerClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

/**
 * 基础 Supabase 服务类
 * 提供按请求创建的 Supabase 客户端
 *
 * 注意：不可缓存客户端实例。createServerSupabaseClient 依赖当前请求的
 * cookies 进行鉴权，缓存会导致后续请求使用过期的 auth context，
 * 进而被 RLS 静默拦截或返回鉴权错误。
 */
export abstract class BaseSupabaseService {
  /**
   * 获取 Supabase 客户端（每次调用都创建新实例）
   * @returns Supabase 服务端客户端实例
   */
  protected async getSupabase(): Promise<SupabaseServerClient> {
    return await createServerSupabaseClient();
  }

  /**
   * 重置 Supabase 客户端
   * @deprecated 客户端已不再缓存，此方法仅为兼容保留
   */
  protected resetSupabase(): void {
    // no-op: 客户端不再缓存
  }
}
