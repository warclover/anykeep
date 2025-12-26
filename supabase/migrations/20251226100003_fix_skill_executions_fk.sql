-- =============================================================================
-- Migration: Fix AI Skill Executions Foreign Key Constraint
-- Description: 移除 conversation_id 的外键约束，允许记录未持久化的会话 ID
-- Version: Phase 4 - Issue #1 Fix
-- Date: 2025-12-26
-- =============================================================================

-- =============================================================================
-- 问题背景
-- =============================================================================
-- ai_skill_executions.conversation_id 引用 ai_conversations.id，但前端可能使用
-- 临时生成的 UUID 作为 conversationId，这些 ID 不一定存在于 ai_conversations 表中。
-- 导致错误：violates foreign key constraint "ai_skill_executions_conversation_id_fkey"

-- =============================================================================
-- 1. 移除外键约束
-- =============================================================================

ALTER TABLE IF EXISTS public.ai_skill_executions
  DROP CONSTRAINT IF EXISTS ai_skill_executions_conversation_id_fkey;

-- =============================================================================
-- 2. 添加索引（如果不存在）以保持查询性能
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_skill_executions_conversation
  ON ai_skill_executions(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- =============================================================================
-- 3. 添加注释说明
-- =============================================================================

COMMENT ON COLUMN ai_skill_executions.conversation_id IS
  '会话 ID（可选，不强制外键约束，允许临时/客户端生成的 ID）';
