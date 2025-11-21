/**
 * Supabase 浏览器客户端
 * 用于客户端组件中的数据操作
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

/**
 * 创建浏览器端 Supabase 客户端
 * 使用单例模式避免重复创建
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 导出默认客户端实例（用于简单场景）
export const supabase = createClient()
