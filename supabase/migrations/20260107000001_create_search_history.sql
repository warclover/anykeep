-- 搜索历史表
-- Phase 3: 个性化搜索推荐
-- 记录用户搜索历史，用于个性化推荐和搜索建议

-- ============================================
-- 创建搜索历史表
-- ============================================

CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 搜索内容
  query TEXT NOT NULL,                    -- 原始搜索查询
  keywords TEXT[] DEFAULT '{}',           -- 解析后的关键词

  -- 搜索结果
  result_count INTEGER DEFAULT 0,         -- 结果数量
  clicked_bookmark_ids INTEGER[] DEFAULT '{}',  -- 用户点击的书签 ID

  -- 搜索上下文
  platform_filter TEXT,                   -- 平台过滤（如果有）
  time_filter TEXT,                       -- 时间过滤（如果有）

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- 索引优化
  CONSTRAINT search_history_query_not_empty CHECK (query <> '')
);

-- ============================================
-- 索引
-- ============================================

-- 用户搜索历史查询（按时间倒序）
CREATE INDEX IF NOT EXISTS idx_search_history_user_time
ON search_history(user_id, created_at DESC);

-- 关键词搜索（用于统计热门关键词）
CREATE INDEX IF NOT EXISTS idx_search_history_keywords
ON search_history USING GIN(keywords);

-- ============================================
-- RLS 策略
-- ============================================

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的搜索历史
CREATE POLICY "用户可以查看自己的搜索历史"
ON search_history FOR SELECT
USING (auth.uid() = user_id);

-- 用户只能插入自己的搜索历史
CREATE POLICY "用户可以创建自己的搜索历史"
ON search_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的搜索历史（记录点击）
CREATE POLICY "用户可以更新自己的搜索历史"
ON search_history FOR UPDATE
USING (auth.uid() = user_id);

-- 用户只能删除自己的搜索历史
CREATE POLICY "用户可以删除自己的搜索历史"
ON search_history FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 辅助函数
-- ============================================

-- 获取用户热门搜索关键词
CREATE OR REPLACE FUNCTION get_user_hot_keywords(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(keyword TEXT, count BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT
    unnest(keywords) as keyword,
    COUNT(*) as count
  FROM search_history
  WHERE user_id = p_user_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY keyword
  ORDER BY count DESC
  LIMIT p_limit;
$$;

-- 获取用户最近搜索
CREATE OR REPLACE FUNCTION get_recent_searches(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  query TEXT,
  result_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (query)
    id,
    query,
    result_count,
    created_at
  FROM search_history
  WHERE user_id = p_user_id
  ORDER BY query, created_at DESC
  LIMIT p_limit;
$$;

-- 记录搜索点击
CREATE OR REPLACE FUNCTION record_search_click(
  p_search_id UUID,
  p_bookmark_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE search_history
  SET clicked_bookmark_ids = array_append(clicked_bookmark_ids, p_bookmark_id)
  WHERE id = p_search_id
    AND user_id = auth.uid()
    AND NOT (p_bookmark_id = ANY(clicked_bookmark_ids));
END;
$$;

-- ============================================
-- 注释
-- ============================================

COMMENT ON TABLE search_history IS '用户搜索历史记录，用于个性化推荐';
COMMENT ON COLUMN search_history.query IS '用户输入的原始搜索查询';
COMMENT ON COLUMN search_history.keywords IS '从查询中解析出的关键词数组';
COMMENT ON COLUMN search_history.result_count IS '搜索返回的结果数量';
COMMENT ON COLUMN search_history.clicked_bookmark_ids IS '用户点击查看的书签ID数组';
COMMENT ON FUNCTION get_user_hot_keywords IS '获取用户最近N天内的热门搜索关键词';
COMMENT ON FUNCTION get_recent_searches IS '获取用户最近的不重复搜索记录';
COMMENT ON FUNCTION record_search_click IS '记录用户对搜索结果的点击行为';
