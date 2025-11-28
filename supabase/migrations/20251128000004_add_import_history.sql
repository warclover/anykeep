-- ===========================================
-- 添加导入历史记录表
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-28
-- 说明: 记录书签导入操作的历史信息

-- -------------------------------------------
-- 1. 创建 import_history 表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 导入信息
    import_source TEXT NOT NULL,  -- 导入来源: browser_chrome, browser_edge, etc.
    import_batch_id UUID NOT NULL,  -- 导入批次 ID

    -- 统计信息
    total_count INTEGER NOT NULL DEFAULT 0,  -- 总数
    success_count INTEGER NOT NULL DEFAULT 0,  -- 成功数
    failed_count INTEGER NOT NULL DEFAULT 0,  -- 失败数
    skipped_count INTEGER NOT NULL DEFAULT 0,  -- 跳过数（重复）

    -- 详细信息
    folders_created INTEGER NOT NULL DEFAULT 0,  -- 创建的文件夹数
    duration_ms INTEGER,  -- 耗时（毫秒）
    error_details JSONB,  -- 错误详情 [{ url, title, reason }]

    -- 配置信息
    options JSONB,  -- 导入配置选项

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束
    CONSTRAINT import_history_import_source_check CHECK (
        import_source IN (
            'browser_chrome',
            'browser_edge',
            'browser_firefox',
            'browser_safari',
            'api',
            'share_sheet',
            'manual'
        )
    )
);

-- -------------------------------------------
-- 2. 添加索引
-- -------------------------------------------
-- 用户 ID 索引（按用户查询历史）
CREATE INDEX IF NOT EXISTS idx_import_history_user_id
ON public.import_history(user_id);

-- 创建时间索引（按时间排序）
CREATE INDEX IF NOT EXISTS idx_import_history_created_at
ON public.import_history(created_at DESC);

-- 批次 ID 索引（查询特定批次）
CREATE INDEX IF NOT EXISTS idx_import_history_batch_id
ON public.import_history(import_batch_id);

-- -------------------------------------------
-- 3. 添加 RLS 策略
-- -------------------------------------------
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的导入历史
CREATE POLICY "Users can view own import history"
ON public.import_history
FOR SELECT
USING (auth.uid() = user_id);

-- 用户只能插入自己的导入历史
CREATE POLICY "Users can insert own import history"
ON public.import_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的导入历史
CREATE POLICY "Users can delete own import history"
ON public.import_history
FOR DELETE
USING (auth.uid() = user_id);

-- -------------------------------------------
-- 4. 添加注释
-- -------------------------------------------
COMMENT ON TABLE public.import_history IS '书签导入历史记录表';
COMMENT ON COLUMN public.import_history.import_source IS '导入来源标识';
COMMENT ON COLUMN public.import_history.import_batch_id IS '导入批次 ID，与 bookmarks 表关联';
COMMENT ON COLUMN public.import_history.total_count IS '导入总数';
COMMENT ON COLUMN public.import_history.success_count IS '成功导入数';
COMMENT ON COLUMN public.import_history.failed_count IS '导入失败数';
COMMENT ON COLUMN public.import_history.skipped_count IS '跳过数（重复）';
COMMENT ON COLUMN public.import_history.folders_created IS '创建的文件夹数';
COMMENT ON COLUMN public.import_history.duration_ms IS '导入耗时（毫秒）';
COMMENT ON COLUMN public.import_history.error_details IS '错误详情 JSON 数组';
COMMENT ON COLUMN public.import_history.options IS '导入配置选项';

-- -------------------------------------------
-- 完成
-- -------------------------------------------
