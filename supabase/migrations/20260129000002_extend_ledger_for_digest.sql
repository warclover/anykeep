-- Phase 2: Weekly Digest 融合 Ledger 扩展
-- 日期: 2026-01-29
-- 描述: 扩展现有的 ledgers 和 ledger_entries 表，以支持知识周报功能

-- 1. 扩展 ledgers 表 (支持不同类型的账本)
ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'financial' CHECK (type IN ('financial', 'knowledge'));

ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'none' CHECK (email_status IN ('none', 'pending', 'sent', 'failed'));

ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS ai_summary TEXT; -- 用于存储 AI 生成的周评

ALTER TABLE ledgers
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb; -- 用于存储 Persona、标签分布等元数据

-- 2. 扩展 ledger_entries 表 (支持引用书签和旧文回顾)
ALTER TABLE ledger_entries
ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'financial' CHECK (entry_type IN ('financial', 'bookmark', 'rediscover'));

ALTER TABLE ledger_entries
ADD COLUMN IF NOT EXISTS bookmark_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL;

ALTER TABLE ledger_entries
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb; -- 用于存储关联度、推荐理由等信息

-- 3. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_ledgers_type_week ON ledgers(user_id, type, start_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type ON ledger_entries(ledger_id, entry_type);
