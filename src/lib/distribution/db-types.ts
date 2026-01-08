/**
 * 分发模块数据库类型
 *
 * @description 定义 distribution_targets 和 distribution_records 表的类型
 * @deprecated P3 - 迁移至 @/types/supabase 后删除
 *   类型已存在于 Supabase 生成类型中 (src/types/supabase.ts:2028)
 *   需更新 3 个 API 路由的 import：
 *   - api/distribution/targets/route.ts
 *   - api/distribution/targets/[id]/route.ts
 *   - api/distribution/sync/route.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 分发目标数据库行类型
 */
export interface DistributionTargetRow {
  id: string;
  user_id: string;
  target_type: string;
  name: string;
  enabled: boolean;
  trigger_mode: string;
  schedule_interval_minutes: number | null;
  filter_platforms: string[] | null;
  filter_folders: string[] | null;
  filter_tags: string[] | null;
  include_ai_summary: boolean | null;
  target_config: Record<string, unknown>;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  synced_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 分发目标插入类型
 */
export interface DistributionTargetInsert {
  user_id: string;
  target_type: string;
  name: string;
  enabled?: boolean;
  trigger_mode?: string;
  schedule_interval_minutes?: number | null;
  filter_platforms?: string[] | null;
  filter_folders?: string[] | null;
  filter_tags?: string[] | null;
  include_ai_summary?: boolean;
  target_config?: Record<string, unknown>;
  status?: string;
  synced_count?: number;
}

/**
 * 分发目标更新类型
 */
export interface DistributionTargetUpdate {
  name?: string;
  enabled?: boolean;
  trigger_mode?: string;
  schedule_interval_minutes?: number | null;
  target_config?: Record<string, unknown>;
  status?: string;
  last_sync_at?: string;
  last_error?: string | null;
  synced_count?: number;
  updated_at?: string;
}

/**
 * 分发记录数据库行类型
 */
export interface DistributionRecordRow {
  id: string;
  target_id: string;
  bookmark_id: string;
  status: string;
  distributed_at: string | null;
  external_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/**
 * 获取用于 distribution_targets 表的类型安全查询客户端
 *
 * 由于 Supabase 类型尚未生成 distribution_targets 表，使用此函数获取类型安全的查询接口
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDistributionTargetsTable(supabase: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from("distribution_targets");
}
