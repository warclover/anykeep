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
 * 提供延迟初始化的 Supabase 客户端
 */
export abstract class BaseSupabaseService {
  private _supabase: SupabaseServerClient | null = null;

  /**
   * 获取 Supabase 客户端（延迟初始化）
   * @returns Supabase 服务端客户端实例
   */
  protected async getSupabase(): Promise<SupabaseServerClient> {
    if (!this._supabase) {
      this._supabase = await createServerSupabaseClient();
    }
    return this._supabase;
  }

  /**
   * 重置 Supabase 客户端
   * 用于测试或需要刷新连接的场景
   */
  protected resetSupabase(): void {
    this._supabase = null;
  }
}
