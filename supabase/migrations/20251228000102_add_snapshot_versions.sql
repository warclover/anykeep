-- 快照历史版本表
-- 用于存储快照的历史版本，支持内容变更对比功能
-- 版本保留策略: 免费用户 1 个, Pro 用户 3 个

CREATE TABLE IF NOT EXISTS snapshot_versions (
    id BIGSERIAL PRIMARY KEY,

    -- 关联当前快照
    snapshot_id BIGINT NOT NULL REFERENCES bookmark_snapshots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- 存档的内容（从原快照复制）
    readable_content TEXT,
    readable_text_content TEXT,
    readable_excerpt TEXT,
    content_hash VARCHAR(64) NOT NULL,
    word_count INT,

    -- 存储路径（如果有）
    html_storage_path TEXT,

    -- 版本元数据
    version_number INT NOT NULL DEFAULT 1,
    original_captured_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束: 每个快照的版本号唯一
    CONSTRAINT unique_snapshot_version UNIQUE (snapshot_id, version_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_snapshot_versions_snapshot ON snapshot_versions(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_versions_user ON snapshot_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_versions_bookmark ON snapshot_versions(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_versions_archived ON snapshot_versions(archived_at);

-- RLS 策略
ALTER TABLE snapshot_versions ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的快照版本
CREATE POLICY "Users can view own snapshot versions"
    ON snapshot_versions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role 可以管理所有版本（用于后台任务）
CREATE POLICY "Service role can manage versions"
    ON snapshot_versions FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- 添加注释
COMMENT ON TABLE snapshot_versions IS '快照历史版本表，用于内容变更对比。版本保留策略: FREE=1, PRO=3';
COMMENT ON COLUMN snapshot_versions.version_number IS '版本号，从 1 开始递增';
COMMENT ON COLUMN snapshot_versions.original_captured_at IS '原始快照的捕获时间';
COMMENT ON COLUMN snapshot_versions.archived_at IS '归档到历史版本的时间';
