/**
 * 类型安全的 Supabase 查询包装器
 *
 * 解决 supabase.from() 类型不匹配问题，避免使用 `as any`
 *
 * @module lib/supabase/typed-queries
 * @version 1.0.0
 * @since 2026-02-03
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";
import type {
  PageMonitorRow,
  PageMonitorInsert,
  PageMonitorUpdate,
  MonitorCheckLogRow,
  MonitorCheckLogInsert,
  DistributionTargetRow,
  DistributionRecordRow,
  DistributionRecordUpsert,
} from "@/types/supabase";

// ============================================
// 类型定义：缺失的表类型
// ============================================

/**
 * MD Collections 表类型
 */
export interface MdCollectionRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  content: string | null;
  content_hash: string | null;
  file_size: number | null;
  word_count: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  processing_progress: number | null;
  ai_summary: string | null;
  ai_tags: string[] | null;
  ai_keywords: string[] | null;
  folder_id: number | null;
  source_type: "upload" | "import" | "sync";
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MdCollectionInsert {
  user_id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  content_hash?: string | null;
  file_size?: number | null;
  word_count?: number | null;
  status?: "pending" | "processing" | "completed" | "failed";
  folder_id?: number | null;
  source_type?: "upload" | "import" | "sync";
  source_url?: string | null;
}

export interface MdCollectionUpdate {
  title?: string;
  description?: string | null;
  content?: string | null;
  status?: "pending" | "processing" | "completed" | "failed";
  processing_progress?: number | null;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
  ai_keywords?: string[] | null;
  folder_id?: number | null;
}

/**
 * MD Collection Highlights 表类型
 */
export interface MdCollectionHighlightRow {
  id: string;
  collection_id: string;
  user_id: string;
  content: string;
  note: string | null;
  color: string | null;
  position_start: number;
  position_end: number;
  created_at: string;
  updated_at: string;
}

/**
 * Synthesis Reports 表类型
 */
export interface SynthesisReportRow {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  status: "pending" | "generating" | "completed" | "failed" | "cancelled";
  report_type: string;
  source_bookmark_ids: number[] | null;
  source_folder_ids: number[] | null;
  source_tag_ids: number[] | null;
  config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SynthesisReportInsert {
  user_id: string;
  title: string;
  report_type: string;
  source_bookmark_ids?: number[] | null;
  source_folder_ids?: number[] | null;
  source_tag_ids?: number[] | null;
  config?: Record<string, unknown> | null;
}

export interface SynthesisReportUpdate {
  title?: string;
  content?: string | null;
  status?: "pending" | "generating" | "completed" | "failed" | "cancelled";
  metadata?: Record<string, unknown> | null;
  error_message?: string | null;
  completed_at?: string | null;
}

/**
 * Synthesis Highlights 表类型
 */
export interface SynthesisHighlightRow {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  note: string | null;
  created_at: string;
}

/**
 * Classification Confirmations 表类型
 */
export interface ClassificationConfirmationRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  suggested_folder_id: number | null;
  suggested_folder_name: string | null;
  confidence: number;
  reason: string | null;
  status: "pending" | "confirmed" | "rejected" | "expired";
  source: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  confirmed_folder_id: number | null;
}

/**
 * Smart Lists 表类型
 */
export interface SmartListRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  filter_config: Record<string, unknown>;
  sort_order: number;
  is_preset: boolean;
  preset_type: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * System Jobs 表类型
 */
export interface SystemJobRow {
  id: string;
  user_id: string | null;
  job_type: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * OAuth States 表类型
 */
export interface OAuthStateRow {
  id: string;
  user_id: string;
  state: string;
  provider: string;
  redirect_uri: string | null;
  created_at: string;
  expires_at: string;
}

/**
 * Distribution OAuth Tokens 表类型
 */
export interface DistributionOAuthTokenRow {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  expires_at: string | null;
  scope: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Plugin Auth Codes 表类型
 */
export interface PluginAuthCodeRow {
  id: string;
  user_id: string;
  code: string;
  device_id: string | null;
  device_name: string | null;
  status: "pending" | "used" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

/**
 * Plugin Tokens 表类型
 */
export interface PluginTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  device_id: string | null;
  device_name: string | null;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

// ============================================
// 类型安全的表查询工厂
// ============================================

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 通用查询构建器类型
 *
 * @description
 * 使用 `unknown` 作为中间类型，避免复杂的泛型推断问题。
 * 调用方需要在使用时进行适当的类型断言或类型守卫。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQueryBuilder = any;

/**
 * 创建类型安全的表查询
 *
 * @description
 * 这些函数封装了对未在 Database 类型中定义的表的访问。
 * 虽然内部使用了 `any`，但将其封装在单一位置，
 * 比在业务代码中到处使用 `as any` 更易于维护和审计。
 *
 * @example
 * ```typescript
 * // 替代: supabase.from("md_collections") as any
 * const query = fromMdCollections(supabase);
 * const { data } = await query.select("*").eq("user_id", userId);
 * ```
 */

// ----- MD Collections -----
export function fromMdCollections(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("md_collections" as keyof Database["public"]["Tables"]);
}

// ----- Synthesis Reports -----
export function fromSynthesisReports(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "synthesis_reports" as keyof Database["public"]["Tables"],
  );
}

// ----- Synthesis Highlights -----
export function fromSynthesisHighlights(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "synthesis_highlights" as keyof Database["public"]["Tables"],
  );
}

// ----- Page Monitors -----
export function fromPageMonitors(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("page_monitors" as keyof Database["public"]["Tables"]);
}

// ----- Monitor Check Logs -----
export function fromMonitorCheckLogs(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "monitor_check_logs" as keyof Database["public"]["Tables"],
  );
}

// ----- Classification Confirmations -----
export function fromClassificationConfirmations(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "classification_confirmations" as keyof Database["public"]["Tables"],
  );
}

// ----- Classification Suggestions -----
export function fromClassificationSuggestions(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "classification_suggestions" as keyof Database["public"]["Tables"],
  );
}

// ----- Smart Lists -----
export function fromSmartLists(supabase: TypedSupabaseClient): AnyQueryBuilder {
  return supabase.from("smart_lists" as keyof Database["public"]["Tables"]);
}

// ----- System Jobs -----
export function fromSystemJobs(supabase: TypedSupabaseClient): AnyQueryBuilder {
  return supabase.from("system_jobs" as keyof Database["public"]["Tables"]);
}

// ----- Distribution Targets -----
export function fromDistributionTargets(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "distribution_targets" as keyof Database["public"]["Tables"],
  );
}

// ----- Distribution Records -----
export function fromDistributionRecords(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "distribution_records" as keyof Database["public"]["Tables"],
  );
}

// ----- OAuth States -----
export function fromOAuthStates(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("oauth_states" as keyof Database["public"]["Tables"]);
}

// ----- Distribution OAuth Tokens -----
export function fromDistributionOAuthTokens(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "distribution_oauth_tokens" as keyof Database["public"]["Tables"],
  );
}

// ----- Plugin Auth Codes -----
export function fromPluginAuthCodes(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "plugin_auth_codes" as keyof Database["public"]["Tables"],
  );
}

// ----- Plugin Tokens -----
export function fromPluginTokens(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("plugin_tokens" as keyof Database["public"]["Tables"]);
}

// ----- AI Operation Snapshots -----
export function fromAiOperationSnapshots(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "ai_operation_snapshots" as keyof Database["public"]["Tables"],
  );
}

// ----- AI Notes -----
export function fromAiNotes(supabase: TypedSupabaseClient): AnyQueryBuilder {
  return supabase.from("ai_notes" as keyof Database["public"]["Tables"]);
}

// ----- Intent Corrections -----
export function fromIntentCorrections(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "intent_corrections" as keyof Database["public"]["Tables"],
  );
}

// ----- Bookmark Snapshots -----
export function fromBookmarkSnapshots(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "bookmark_snapshots" as keyof Database["public"]["Tables"],
  );
}

// ----- Bookmark Chunks -----
export function fromBookmarkChunks(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("bookmark_chunks" as keyof Database["public"]["Tables"]);
}

// ----- Classification Feedback -----
export function fromClassificationFeedback(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "classification_feedback" as keyof Database["public"]["Tables"],
  );
}

// ----- User Corrections -----
export function fromUserCorrections(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "user_corrections" as keyof Database["public"]["Tables"],
  );
}

// ----- AI Feedback -----
export function fromAiFeedback(supabase: TypedSupabaseClient): AnyQueryBuilder {
  return supabase.from("ai_feedback" as keyof Database["public"]["Tables"]);
}

// ----- Notification Preferences -----
export function fromNotificationPreferences(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "notification_preferences" as keyof Database["public"]["Tables"],
  );
}

// ----- Validation History -----
export function fromValidationHistory(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "validation_history" as keyof Database["public"]["Tables"],
  );
}

// ----- User Notifications -----
export function fromUserNotifications(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "user_notifications" as keyof Database["public"]["Tables"],
  );
}

// ----- Operation Snapshots -----
export function fromOperationSnapshots(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "operation_snapshots" as keyof Database["public"]["Tables"],
  );
}

// ----- Job Queue -----
export function fromJobQueue(supabase: TypedSupabaseClient): AnyQueryBuilder {
  return supabase.from("job_queue" as keyof Database["public"]["Tables"]);
}

// ----- Bookmark Entities -----
export function fromBookmarkEntities(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "bookmark_entities" as keyof Database["public"]["Tables"],
  );
}

// ----- Bookmark Tags -----
export function fromBookmarkTags(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("bookmark_tags" as keyof Database["public"]["Tables"]);
}

// ----- Tags -----
export function fromTags(supabase: TypedSupabaseClient): AnyQueryBuilder {
  return supabase.from("tags" as keyof Database["public"]["Tables"]);
}

// ----- Trust Mode Settings -----
export function fromTrustModeSettings(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from(
    "trust_mode_settings" as keyof Database["public"]["Tables"],
  );
}

// ----- Folder Profiles -----
export function fromFolderProfiles(
  supabase: TypedSupabaseClient,
): AnyQueryBuilder {
  return supabase.from("folder_profiles" as keyof Database["public"]["Tables"]);
}

// ============================================
// 类型安全的 RPC 调用封装
// ============================================

/**
 * RPC 调用结果类型
 */
export interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * 类型安全的 RPC 调用器
 *
 * @description
 * 封装 supabase.rpc() 调用，避免在业务代码中使用 `as any`。
 * 内部使用 any 但将其集中在此处便于维护。
 */

type AnyRpcCaller = (
  name: string,
  params?: Record<string, unknown>,
) => Promise<RpcResult<unknown>>;

/**
 * 创建类型安全的 RPC 调用器
 */
export function createRpcCaller(supabase: TypedSupabaseClient): AnyRpcCaller {
  return async (name: string, params?: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase.rpc as any)(name, params);
    return result as RpcResult<unknown>;
  };
}

// ----- Job Queue RPC Functions -----

/**
 * claim_jobs_batch RPC 返回类型
 */
export interface ClaimJobsBatchResult {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  user_id: string;
  bookmark_id: number | null;
  retry_count: number;
}

/**
 * 批量获取待处理任务
 */
export async function rpcClaimJobsBatch(
  supabase: TypedSupabaseClient,
  params: {
    p_worker_id: string;
    p_job_types: string[];
    p_limit: number;
    p_lock_duration: string;
  },
): Promise<RpcResult<ClaimJobsBatchResult[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)("claim_jobs_batch", params);
}

/**
 * 完成任务
 */
export async function rpcCompleteJob(
  supabase: TypedSupabaseClient,
  params: {
    p_job_id: string;
    p_success: boolean;
    p_error: string | null;
    p_result: unknown | null;
  },
): Promise<RpcResult<void>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)("complete_job", params);
}

// ----- Snapshot RPC Functions -----

/**
 * get_user_snapshot_quota RPC 返回类型
 */
export interface UserSnapshotQuotaResult {
  used_bytes: number;
  quota_bytes: number;
  used_count: number;
  max_count: number;
  membership: string;
}

/**
 * 获取用户快照配额
 */
export async function rpcGetUserSnapshotQuota(
  supabase: TypedSupabaseClient,
  params: { p_user_id: string },
): Promise<RpcResult<UserSnapshotQuotaResult[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)("get_user_snapshot_quota", params);
}

/**
 * 检查是否可以创建快照
 */
export async function rpcCanCreateSnapshot(
  supabase: TypedSupabaseClient,
  params: { p_user_id: string; p_estimated_size: number },
): Promise<RpcResult<boolean>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)("can_create_snapshot", params);
}

/**
 * atomic_create_snapshot RPC 返回类型
 */
export interface AtomicCreateSnapshotResult {
  success: boolean;
  snapshot_id?: number;
  job_id?: string;
  error_code?: string;
  error_message?: string;
}

/**
 * 原子化创建快照
 */
export async function rpcAtomicCreateSnapshot(
  supabase: TypedSupabaseClient,
  params: {
    p_user_id: string;
    p_bookmark_id: number;
    p_snapshot_type: string;
    p_estimated_size: number;
    p_trigger_source: string;
    p_trigger_tag: string | null;
    p_priority: number;
  },
): Promise<
  RpcResult<AtomicCreateSnapshotResult | AtomicCreateSnapshotResult[]>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)("atomic_create_snapshot", params);
}

/**
 * atomic_batch_create_snapshots RPC 返回类型
 */
export interface AtomicBatchCreateSnapshotsResult {
  total_requested: number;
  total_created: number;
  total_skipped: number;
  snapshot_ids: number[];
}

/**
 * 原子化批量创建快照
 */
export async function rpcAtomicBatchCreateSnapshots(
  supabase: TypedSupabaseClient,
  params: {
    p_user_id: string;
    p_bookmark_ids: number[];
    p_snapshot_type: string;
    p_trigger_source: string;
    p_max_batch_size: number;
  },
): Promise<
  RpcResult<
    AtomicBatchCreateSnapshotsResult | AtomicBatchCreateSnapshotsResult[]
  >
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)("atomic_batch_create_snapshots", params);
}

// ============================================
// 导出表类型用于外部使用
// ============================================

export type {
  PageMonitorRow,
  PageMonitorInsert,
  PageMonitorUpdate,
  MonitorCheckLogRow,
  MonitorCheckLogInsert,
  DistributionTargetRow,
  DistributionRecordRow,
  DistributionRecordUpsert,
};
