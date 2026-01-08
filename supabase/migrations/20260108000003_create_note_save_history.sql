-- Migration: 20260108000003_create_note_save_history.sql
-- Save to Note 功能：创建保存历史表

-- ============================================
-- 1. 创建保存历史表
-- ============================================
CREATE TABLE IF NOT EXISTS note_save_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id BIGINT NOT NULL REFERENCES md_collections(id) ON DELETE CASCADE,

  -- 来源信息
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(100),
  source_conversation_id VARCHAR(100),

  -- 元数据
  content_hash VARCHAR(64),
  generated_title VARCHAR(200),
  is_duplicate_save BOOLEAN DEFAULT FALSE,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_note_save_history_user_id
ON note_save_history(user_id);

CREATE INDEX IF NOT EXISTS idx_note_save_history_note_id
ON note_save_history(note_id);

CREATE INDEX IF NOT EXISTS idx_note_save_history_created_at
ON note_save_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_note_save_history_content_hash
ON note_save_history(user_id, content_hash);

-- ============================================
-- 3. 启用 RLS
-- ============================================
ALTER TABLE note_save_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own save history"
ON note_save_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own save history"
ON note_save_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. 添加注释
-- ============================================
COMMENT ON TABLE note_save_history IS 'Save to Note 功能的保存历史记录';
COMMENT ON COLUMN note_save_history.source_type IS '来源类型：ai_response/deliverable/synthesis/report';
COMMENT ON COLUMN note_save_history.source_id IS '来源 ID（消息ID、交付物ID等）';
COMMENT ON COLUMN note_save_history.source_conversation_id IS '来源对话 ID';
COMMENT ON COLUMN note_save_history.content_hash IS '内容哈希，用于重复检测';
COMMENT ON COLUMN note_save_history.generated_title IS 'AI 生成的标题';
COMMENT ON COLUMN note_save_history.is_duplicate_save IS '是否为重复保存（用户选择仍然保存）';
