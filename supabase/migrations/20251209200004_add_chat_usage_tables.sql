-- Phase 4.4: AI 对话成本控制数据库表
-- 用量追踪与响应缓存
-- @version 1.0.0
-- @since 2025-12-09

/**
 * chat_usage - 对话用量统计表
 *
 * 按用户按日期记录对话次数和 Token 使用量
 * 用于实现每日配额限制
 */
CREATE TABLE IF NOT EXISTS public.chat_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  conversation_count INT NOT NULL DEFAULT 0,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 每个用户每天只有一条记录
  CONSTRAINT chat_usage_user_date_unique UNIQUE (user_id, date)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date
  ON public.chat_usage(user_id, date);

CREATE INDEX IF NOT EXISTS idx_chat_usage_date
  ON public.chat_usage(date);

-- 添加表注释
COMMENT ON TABLE public.chat_usage IS '用户对话用量统计表，按日期记录对话次数和 Token 使用量';
COMMENT ON COLUMN public.chat_usage.conversation_count IS '当日对话次数';
COMMENT ON COLUMN public.chat_usage.tokens_used IS '当日 Token 使用总量';

-- 启用 RLS
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的用量
CREATE POLICY "Users can view own chat usage"
  ON public.chat_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：服务端可以插入和更新（通过 service_role）
CREATE POLICY "Service can manage chat usage"
  ON public.chat_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);


/**
 * chat_cache - 对话响应缓存表
 *
 * 缓存 AI 响应，减少重复查询成本
 * 基于查询哈希进行匹配
 */
CREATE TABLE IF NOT EXISTS public.chat_cache (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 每个用户的每个查询哈希只保留一条缓存
  CONSTRAINT chat_cache_user_hash_unique UNIQUE (user_id, query_hash)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_chat_cache_user_hash
  ON public.chat_cache(user_id, query_hash);

CREATE INDEX IF NOT EXISTS idx_chat_cache_created_at
  ON public.chat_cache(created_at);

-- 添加表注释
COMMENT ON TABLE public.chat_cache IS '对话响应缓存表，用于减少重复查询的 AI 调用成本';
COMMENT ON COLUMN public.chat_cache.query_hash IS '查询内容的哈希值';
COMMENT ON COLUMN public.chat_cache.response IS '缓存的 AI 响应';

-- 启用 RLS
ALTER TABLE public.chat_cache ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的缓存
CREATE POLICY "Users can view own chat cache"
  ON public.chat_cache
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat cache"
  ON public.chat_cache
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat cache"
  ON public.chat_cache
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


/**
 * increment_chat_usage - 增量更新对话用量
 *
 * 原子操作：如果当日记录不存在则创建，否则增量更新
 *
 * @param p_user_id - 用户 ID
 * @param p_date - 日期
 * @param p_tokens - 本次使用的 Token 数量
 */
CREATE OR REPLACE FUNCTION public.increment_chat_usage(
  p_user_id UUID,
  p_date DATE,
  p_tokens INT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chat_usage (user_id, date, conversation_count, tokens_used)
  VALUES (p_user_id, p_date, 1, p_tokens)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    conversation_count = chat_usage.conversation_count + 1,
    tokens_used = chat_usage.tokens_used + p_tokens,
    updated_at = NOW();
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.increment_chat_usage IS
'原子更新用户对话用量：增加对话次数和 Token 使用量';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.increment_chat_usage TO authenticated;


/**
 * cleanup_old_chat_cache - 清理过期缓存
 *
 * 定期任务：删除超过指定天数的缓存记录
 *
 * @param p_days - 保留天数（默认 7 天）
 * @returns 删除的记录数
 */
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_cache(
  p_days INT DEFAULT 7
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM chat_cache
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.cleanup_old_chat_cache IS
'清理过期的对话缓存记录，默认保留 7 天';


/**
 * get_user_chat_stats - 获取用户对话统计
 *
 * 获取用户在指定时间范围内的对话统计
 *
 * @param p_user_id - 用户 ID
 * @param p_start_date - 开始日期
 * @param p_end_date - 结束日期
 */
CREATE OR REPLACE FUNCTION public.get_user_chat_stats(
  p_user_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_conversations INT,
  total_tokens INT,
  avg_tokens_per_chat FLOAT,
  active_days INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(conversation_count), 0)::INT AS total_conversations,
    COALESCE(SUM(tokens_used), 0)::INT AS total_tokens,
    CASE
      WHEN SUM(conversation_count) > 0
      THEN (SUM(tokens_used)::FLOAT / SUM(conversation_count))
      ELSE 0
    END AS avg_tokens_per_chat,
    COUNT(DISTINCT date)::INT AS active_days
  FROM chat_usage
  WHERE user_id = p_user_id
    AND date BETWEEN p_start_date AND p_end_date;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_user_chat_stats IS
'获取用户在指定时间范围内的对话统计数据';

-- 授予权限
GRANT EXECUTE ON FUNCTION public.get_user_chat_stats TO authenticated;
