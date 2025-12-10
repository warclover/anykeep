-- ===========================================
-- V4.2 Phase 2.1.1: folder_profiles 表扩展
-- ===========================================
-- 添加 AI 文件夹进化所需的元数据字段

-- 1. 添加 AI 可重命名标记
-- 标记该文件夹是否允许 AI 自动重命名
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS is_ai_renamable BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.folder_profiles.is_ai_renamable IS '是否允许 AI 自动重命名此文件夹';

-- 2. 添加系统锁定标记
-- 被锁定的文件夹 AI 不会进行任何操作
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.folder_profiles.is_system_locked IS '是否被用户锁定，锁定后 AI 不会操作';

-- 3. 添加最近添加数量
-- 跟踪最近一段时间内添加的书签数量，用于热度判断
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS recent_additions INT DEFAULT 0;

COMMENT ON COLUMN public.folder_profiles.recent_additions IS '最近 7 天内添加的书签数量';

-- 4. 添加热度分数
-- 综合评估文件夹活跃度
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS heat_score FLOAT DEFAULT 0;

COMMENT ON COLUMN public.folder_profiles.heat_score IS '热度分数 (0-100)，基于最近活跃度计算';

-- 5. 添加上次热度计算时间
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS heat_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.folder_profiles.heat_computed_at IS '上次热度计算时间';

-- 6. 添加命名建议
-- 存储 AI 建议的更好名称（用于半托管模式展示）
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS suggested_name VARCHAR(100);

COMMENT ON COLUMN public.folder_profiles.suggested_name IS 'AI 建议的文件夹名称（半托管模式下展示）';

-- 7. 添加命名建议原因
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS suggested_name_reason TEXT;

COMMENT ON COLUMN public.folder_profiles.suggested_name_reason IS 'AI 建议重命名的原因';

-- 8. 添加分拆候选标记
-- 标记该文件夹是否为分拆候选
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS is_split_candidate BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.folder_profiles.is_split_candidate IS '是否为分拆候选（内部相似度低）';

-- 9. 添加合并候选标记
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS is_merge_candidate BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.folder_profiles.is_merge_candidate IS '是否为合并候选（与其他文件夹相似）';

-- 10. 添加相似文件夹 ID（合并候选时使用）
ALTER TABLE public.folder_profiles
ADD COLUMN IF NOT EXISTS similar_folder_ids BIGINT[];

COMMENT ON COLUMN public.folder_profiles.similar_folder_ids IS '相似文件夹 ID 列表（合并候选时使用）';

-- 11. 创建热度计算函数
CREATE OR REPLACE FUNCTION compute_folder_heat(p_folder_id BIGINT)
RETURNS FLOAT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_recent_count INT;
  v_total_count INT;
  v_last_addition TIMESTAMPTZ;
  v_heat FLOAT;
  v_recency_factor FLOAT;
  v_frequency_factor FLOAT;
BEGIN
  -- 获取最近 7 天添加数量
  SELECT COUNT(*) INTO v_recent_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND created_at > NOW() - INTERVAL '7 days';

  -- 获取总数量
  SELECT COUNT(*) INTO v_total_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 获取最后添加时间
  SELECT MAX(created_at) INTO v_last_addition
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 如果没有书签，热度为 0
  IF v_total_count = 0 OR v_last_addition IS NULL THEN
    RETURN 0;
  END IF;

  -- 计算时间衰减因子（30 天半衰期）
  v_recency_factor := EXP(-0.693 * EXTRACT(EPOCH FROM (NOW() - v_last_addition)) / (30 * 24 * 3600));

  -- 计算频率因子（最近活跃度）
  v_frequency_factor := LEAST(v_recent_count / 5.0, 1.0);  -- 5 个/周为满分

  -- 综合热度分数 (0-100)
  v_heat := (v_recency_factor * 0.6 + v_frequency_factor * 0.4) * 100;

  RETURN ROUND(v_heat::NUMERIC, 2);
END;
$$;

COMMENT ON FUNCTION compute_folder_heat IS '计算文件夹热度分数 (0-100)';
GRANT EXECUTE ON FUNCTION compute_folder_heat(BIGINT) TO authenticated;

-- 12. 更新文件夹热度的函数
CREATE OR REPLACE FUNCTION update_folder_heat(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_heat FLOAT;
  v_recent_count INT;
BEGIN
  -- 计算热度
  v_heat := compute_folder_heat(p_folder_id);

  -- 获取最近添加数量
  SELECT COUNT(*) INTO v_recent_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND created_at > NOW() - INTERVAL '7 days';

  -- 更新 folder_profiles
  UPDATE public.folder_profiles
  SET heat_score = v_heat,
      recent_additions = v_recent_count,
      heat_computed_at = NOW()
  WHERE folder_id = p_folder_id;
END;
$$;

COMMENT ON FUNCTION update_folder_heat IS '更新指定文件夹的热度分数';
GRANT EXECUTE ON FUNCTION update_folder_heat(BIGINT) TO authenticated;

-- 13. 批量更新用户所有文件夹热度
CREATE OR REPLACE FUNCTION update_user_folder_heats(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_folder_id BIGINT;
  v_count INT := 0;
BEGIN
  FOR v_folder_id IN
    SELECT fp.folder_id
    FROM public.folder_profiles fp
    WHERE fp.user_id = p_user_id
  LOOP
    PERFORM update_folder_heat(v_folder_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION update_user_folder_heats IS '批量更新用户所有文件夹的热度分数';
GRANT EXECUTE ON FUNCTION update_user_folder_heats(UUID) TO authenticated;

-- 14. 创建热度索引（用于查询热门/冷门文件夹）
CREATE INDEX IF NOT EXISTS idx_folder_profiles_heat
ON public.folder_profiles(user_id, heat_score DESC)
WHERE heat_score IS NOT NULL;

-- 15. 创建分拆/合并候选索引
CREATE INDEX IF NOT EXISTS idx_folder_profiles_split_candidate
ON public.folder_profiles(user_id)
WHERE is_split_candidate = TRUE;

CREATE INDEX IF NOT EXISTS idx_folder_profiles_merge_candidate
ON public.folder_profiles(user_id)
WHERE is_merge_candidate = TRUE;

-- ===========================================
-- 完成
-- ===========================================
