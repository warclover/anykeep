-- =============================================================================
-- Migration: Fix AI Session Memory Function Grants
-- Description: 为 ai_session_memory 相关函数添加 GRANT EXECUTE 权限
-- Version: Phase 4 - Issue #2 Fix
-- Date: 2025-12-26
-- =============================================================================

-- =============================================================================
-- 1. 授权 authenticated 用户调用会话管理函数
-- =============================================================================

-- 获取或创建会话记忆（用户可以管理自己的会话）
GRANT EXECUTE ON FUNCTION get_or_create_session_memory(UUID, TEXT) TO authenticated;

-- 保存会话状态（用户可以保存自己的会话状态）
GRANT EXECUTE ON FUNCTION save_session_state(UUID, TEXT, JSONB, INT, TEXT) TO authenticated;

-- 获取用户活跃会话（用户可以查看自己的活跃会话）
GRANT EXECUTE ON FUNCTION get_user_active_sessions(UUID) TO authenticated;

-- =============================================================================
-- 2. 清理函数仅授权给 service_role（定时任务使用）
-- =============================================================================

-- 清理过期会话（仅后台任务可调用）
GRANT EXECUTE ON FUNCTION cleanup_expired_session_memory() TO service_role;

-- =============================================================================
-- 3. 注释更新
-- =============================================================================

COMMENT ON FUNCTION get_or_create_session_memory(UUID, TEXT) IS '获取或创建会话记忆记录 - 已授权 authenticated';
COMMENT ON FUNCTION save_session_state(UUID, TEXT, JSONB, INT, TEXT) IS '保存会话状态到数据库 - 已授权 authenticated';
COMMENT ON FUNCTION cleanup_expired_session_memory() IS '清理过期的会话记忆 - 仅授权 service_role';
COMMENT ON FUNCTION get_user_active_sessions(UUID) IS '获取用户的活跃会话列表 - 已授权 authenticated';
