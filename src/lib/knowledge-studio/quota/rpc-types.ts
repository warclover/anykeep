/**
 * Supabase RPC 函数类型定义
 * @module knowledge-studio/quota/rpc-types
 * @description 为配额管理相关的 RPC 函数定义类型，减少 as any 使用
 */

/**
 * deduct_quota 函数参数
 */
export interface DeductQuotaParams {
  p_user_id: string;
  p_operation_type: string;
  p_request_id: string;
  p_cost: number;
}

/**
 * deduct_quota 函数返回值（operation_id UUID）
 */
export type DeductQuotaResult = string;

/**
 * confirm_quota 函数参数
 */
export interface ConfirmQuotaParams {
  p_request_id: string;
  p_synthesis_report_id?: string | null;
}

/**
 * confirm_quota 函数返回值（boolean）
 */
export type ConfirmQuotaResult = boolean;

/**
 * refund_quota 函数参数
 */
export interface RefundQuotaParams {
  p_request_id: string;
  p_error_message?: string | null;
}

/**
 * refund_quota 函数返回值（boolean）
 */
export type RefundQuotaResult = boolean;

/**
 * get_quota_usage_summary 函数参数
 */
export interface GetQuotaUsageSummaryParams {
  p_user_id: string;
  p_period_start?: string;
  p_period_end?: string;
}

/**
 * get_quota_usage_summary 函数返回值
 */
export interface GetQuotaUsageSummaryResult {
  total_consumed: number;
  total_pending: number;
  total_refunded: number;
  operation_count: number;
}
