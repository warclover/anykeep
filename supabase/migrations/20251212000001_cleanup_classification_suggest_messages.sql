-- ============================================================================
-- V4.3 消息系统重构 - 清理旧的 classification_suggest 消息
-- ============================================================================
--
-- 背景：
-- V4.2 中，中等置信度分类已改为使用 pending_confirmations 表
-- 旧的 classification_suggest 消息不再需要，应该清理
--
-- 变更：
-- 1. 删除所有 classification_suggest 类型的消息
-- 2. ��加注释说明该类型已弃用
--
-- 影响：
-- - 删除历史的 classification_suggest 消息
-- - 不影响其他消息类型
-- - 不影响 pending_confirmations 表
--
-- @version 1.0.0
-- @since 2025-12-12
-- ============================================================================

-- 记录清理前的数量（用于日志）
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 删除 classification_suggest 类型的消息
  DELETE FROM messages
  WHERE type = 'classification_suggest';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'V4.3: Deleted % classification_suggest messages', deleted_count;
END $$;

-- 添加注释说明该类型已弃用
COMMENT ON COLUMN messages.type IS 'Message type. Note: classification_suggest is deprecated since V4.2, use pending_confirmations table for classification confirmations.';

-- ============================================================================
-- 说明：不修改 messages 表的 type 约束
-- 原因：保持向后兼容性，旧代码可能仍会尝试创建此类型消息（会被忽略）
-- ============================================================================
