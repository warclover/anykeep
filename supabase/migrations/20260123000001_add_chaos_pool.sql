-- ===========================================
-- AnyKeep v5.5 晶体生长系统 - 混沌池表
-- ===========================================
-- 版本: 5.5.0
-- 日期: 2026-01-23
-- 说明: 创建 chaos_pool 表，仅存储书签引用（书签本身仍在 inbox）

-- -------------------------------------------
-- 1. 混沌池表 (chaos_pool)
-- -------------------------------------------
-- 设计原则：仅存引用，不改变 folder_id
-- 书签本身仍在 inbox，避免数据双轨

CREATE TABLE IF NOT EXISTS public.chaos_pool (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

  -- 处理状态
  crystal_processed BOOLEAN DEFAULT FALSE,  -- v5.5 是否已处理
  processed_at TIMESTAMPTZ,                 -- 处理时间
  result_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,  -- 结果文件夹 ID

  -- TTL 管理
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- 唯一约束：每个用户的每个书签只能有一条记录
  CONSTRAINT chaos_pool_unique UNIQUE(user_id, bookmark_id)
);

-- 添加注释
COMMENT ON TABLE public.chaos_pool IS
  'V5.5 混沌池：存储未分类书签引用，用于晶核检测。书签本身仍在 inbox，此表仅作为检测队列。';
COMMENT ON COLUMN public.chaos_pool.crystal_processed IS '是否已被晶体生长算法处理';
COMMENT ON COLUMN public.chaos_pool.result_folder_id IS '处理后归入的文件夹 ID';
COMMENT ON COLUMN public.chaos_pool.expires_at IS '记录过期时间，30 天后自动清理';

-- -------------------------------------------
-- 2. 索引
-- -------------------------------------------

-- 用于晶核检测的未处理书签查询
CREATE INDEX idx_chaos_pool_user_unprocessed
  ON public.chaos_pool (user_id, created_at DESC)
  WHERE crystal_processed = FALSE;

-- 用于定期清理过期记录
CREATE INDEX idx_chaos_pool_expires
  ON public.chaos_pool (expires_at)
  WHERE expires_at IS NOT NULL;

-- 用于快速查找特定书签
CREATE INDEX idx_chaos_pool_bookmark
  ON public.chaos_pool (bookmark_id);

-- -------------------------------------------
-- 3. RLS 策略
-- -------------------------------------------

ALTER TABLE public.chaos_pool ENABLE ROW LEVEL SECURITY;

-- 用户只能管理自己的混沌池记录
CREATE POLICY "Users can manage own chaos pool" ON public.chaos_pool
  FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------
-- 4. 清理过期记录的函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_expired_chaos_pool()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.chaos_pool
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_chaos_pool() IS
  '清理过期的混沌池记录，返回删除的记录数';

-- -------------------------------------------
-- 完成
-- -------------------------------------------
