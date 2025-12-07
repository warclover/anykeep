-- ===========================================
-- AnyKeep 智能分类系统 V2 - 数据库迁移
-- ===========================================
-- 版本: 2.0.0
-- 日期: 2025-12-05
-- 说明: 实现智能分类系统 V2 的核心数据结构
--       - 用户自定义兴趣
--       - 文件夹画像系统
--       - 整理建议系统
--       - 用户阶段判断

-- -------------------------------------------
-- 1. 用户自定义兴趣表 (user_custom_interests)
-- -------------------------------------------
-- 存储用户自定义的兴趣领域

CREATE TABLE IF NOT EXISTS public.user_custom_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(20) NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '🎯',
  keywords TEXT[] DEFAULT '{}',
  suggested_folders TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束：关键词最多 10 个，建议文件夹最多 3 个
  CONSTRAINT max_keywords CHECK (cardinality(keywords) <= 10),
  CONSTRAINT max_suggested_folders CHECK (cardinality(suggested_folders) <= 3)
);

-- 注释
COMMENT ON TABLE public.user_custom_interests IS '用户自定义兴趣领域表';
COMMENT ON COLUMN public.user_custom_interests.name IS '兴趣领域名称（最长 20 字符）';
COMMENT ON COLUMN public.user_custom_interests.icon IS 'emoji 图标';
COMMENT ON COLUMN public.user_custom_interests.keywords IS '关键词列表（最多 10 个）';
COMMENT ON COLUMN public.user_custom_interests.suggested_folders IS '建议创建的文件夹（最多 3 个）';

-- 索引
CREATE INDEX IF NOT EXISTS idx_custom_interests_user
ON public.user_custom_interests(user_id);

-- RLS
ALTER TABLE public.user_custom_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own custom interests"
  ON public.user_custom_interests FOR ALL
  USING (auth.uid() = user_id);

-- 更新时间戳触发器
CREATE TRIGGER update_custom_interests_updated_at
  BEFORE UPDATE ON public.user_custom_interests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -------------------------------------------
-- 2. 文件夹画像表 (folder_profiles)
-- -------------------------------------------
-- 存储文件夹的语义画像，用于智能分类匹配

CREATE TABLE IF NOT EXISTS public.folder_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,

  -- 画像向量 (1024 维，与 bookmarks.embedding 一致)
  profile_embedding vector(1024),

  -- 统计信息
  bookmark_count INT DEFAULT 0,
  last_bookmark_at TIMESTAMPTZ,

  -- 画像元数据
  top_tags TEXT[],           -- 高频标签（前 10）
  sample_titles TEXT[],      -- 示例书签标题（前 5）
  internal_similarity FLOAT, -- 内部一致性分数（0-1）

  -- 来源标记
  source VARCHAR(50),        -- interest_onboarding | manual | auto_created | clustering

  -- 时间戳
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：每个文件夹只有一个画像
  UNIQUE(folder_id)
);

-- 注释
COMMENT ON TABLE public.folder_profiles IS '文件夹语义画像表，用于智能分类';
COMMENT ON COLUMN public.folder_profiles.profile_embedding IS '文件夹画像向量（1024 维），为文件夹内书签向量的加权平均';
COMMENT ON COLUMN public.folder_profiles.top_tags IS '文件夹高频标签（前 10）';
COMMENT ON COLUMN public.folder_profiles.sample_titles IS '示例书签标题（前 5）';
COMMENT ON COLUMN public.folder_profiles.internal_similarity IS '文件夹内部书签相似度（内聚性指标）';
COMMENT ON COLUMN public.folder_profiles.source IS '画像来源: interest_onboarding-兴趣初始化, manual-手动创建, auto_created-自动创建, clustering-聚类创建';

-- 索引
CREATE INDEX IF NOT EXISTS idx_folder_profiles_user
ON public.folder_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_profiles_folder
ON public.folder_profiles(folder_id);

-- HNSW 向量索引（用于快速相似度搜索）
CREATE INDEX IF NOT EXISTS idx_folder_profiles_embedding_hnsw
ON public.folder_profiles
USING hnsw (profile_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- RLS
ALTER TABLE public.folder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folder profiles"
  ON public.folder_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folder profiles"
  ON public.folder_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folder profiles"
  ON public.folder_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folder profiles"
  ON public.folder_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- 更新时间戳触发器
CREATE TRIGGER update_folder_profiles_updated_at
  BEFORE UPDATE ON public.folder_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -------------------------------------------
-- 3. 整理建议表 (organization_suggestions)
-- -------------------------------------------
-- 存储待整理文件夹的智能整理建议

CREATE TABLE IF NOT EXISTS public.organization_suggestions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 建议类型
  suggestion_type VARCHAR(20) NOT NULL,

  -- 涉及的书签
  bookmark_ids BIGINT[] NOT NULL,

  -- 目标文件夹（移动到现有文件夹时使用）
  target_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,

  -- 建议的新文件夹名称（创建新文件夹时使用）
  suggested_folder_name VARCHAR(100),

  -- 置信度和原因
  confidence INT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reason TEXT,

  -- 示例标题（用于 UI 展示）
  sample_titles TEXT[],

  -- 状态管理
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  -- 约束
  CONSTRAINT valid_suggestion_type CHECK (
    suggestion_type IN ('move_to_existing', 'create_new', 'merge', 'split')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'accepted', 'rejected', 'expired')
  )
);

-- 注释
COMMENT ON TABLE public.organization_suggestions IS '智能整理建议表';
COMMENT ON COLUMN public.organization_suggestions.suggestion_type IS '建议类型: move_to_existing-移动到现有文件夹, create_new-创建新文件夹, merge-合并文件夹, split-拆分文件夹';
COMMENT ON COLUMN public.organization_suggestions.bookmark_ids IS '涉及的书签 ID 数组';
COMMENT ON COLUMN public.organization_suggestions.target_folder_id IS '目标文件夹 ID（移动建议时使用）';
COMMENT ON COLUMN public.organization_suggestions.suggested_folder_name IS '建议的新文件夹名称（创建建议时使用）';
COMMENT ON COLUMN public.organization_suggestions.confidence IS '置信度分数（0-100）';
COMMENT ON COLUMN public.organization_suggestions.status IS '状态: pending-待处理, accepted-已接受, rejected-已拒绝, expired-已过期';

-- 索引
CREATE INDEX IF NOT EXISTS idx_org_suggestions_user_status
ON public.organization_suggestions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_org_suggestions_created
ON public.organization_suggestions(created_at DESC);

-- RLS
ALTER TABLE public.organization_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own suggestions"
  ON public.organization_suggestions FOR ALL
  USING (auth.uid() = user_id);

-- -------------------------------------------
-- 4. folders 表扩展
-- -------------------------------------------
-- 添加 source 字段标记文件夹来源

ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS source VARCHAR(50);

COMMENT ON COLUMN public.folders.source IS '文件夹来源: interest_onboarding-兴趣初始化, manual-手动创建, auto_created-自动创建, clustering-聚类创建';

-- -------------------------------------------
-- 5. 用户阶段判断函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION get_user_classification_stage(p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_bookmark_count INT;
  v_settings JSONB;
  v_onboarding_completed BOOLEAN;
BEGIN
  -- 获取用户书签数量
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  -- 获取用户设置
  SELECT settings INTO v_settings
  FROM public.profiles
  WHERE id = p_user_id;

  -- 检查是否完成引导
  v_onboarding_completed := (v_settings->>'onboarding_completed_at') IS NOT NULL;

  -- 判断阶段
  IF NOT v_onboarding_completed AND v_bookmark_count = 0 THEN
    RETURN 'onboarding';
  ELSIF v_bookmark_count <= 20 THEN
    RETURN 'cold_start';
  ELSIF v_bookmark_count <= 100 THEN
    RETURN 'growing';
  ELSE
    RETURN 'mature';
  END IF;
END;
$$;

COMMENT ON FUNCTION get_user_classification_stage IS '获取用户分类阶段: onboarding-新手期, cold_start-冷启动期, growing-成长期, mature-成熟期';

GRANT EXECUTE ON FUNCTION get_user_classification_stage(UUID) TO authenticated;

-- -------------------------------------------
-- 6. 文件夹画像计算函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION compute_folder_profile(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_count INT;
  v_avg_embedding vector(1024);
  v_top_tags TEXT[];
  v_sample_titles TEXT[];
  v_internal_sim FLOAT;
  v_last_bookmark_at TIMESTAMPTZ;
BEGIN
  -- 获取文件夹所属用户
  SELECT user_id INTO v_user_id
  FROM public.folders
  WHERE id = p_folder_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Folder not found: %', p_folder_id;
  END IF;

  -- 计算书签数量
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 如果没有书签，删除画像（如果存在）
  IF v_bookmark_count = 0 THEN
    DELETE FROM public.folder_profiles WHERE folder_id = p_folder_id;
    RETURN;
  END IF;

  -- 计算平均向量
  SELECT AVG(embedding)::vector(1024) INTO v_avg_embedding
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 获取高频标签（前 10）
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC)
  INTO v_top_tags
  FROM (
    SELECT UNNEST(ai_tags) AS tag, COUNT(*) AS cnt
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND ai_tags IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  ) t;

  -- 获取示例标题（最近 5 个）
  SELECT ARRAY_AGG(title ORDER BY created_at DESC)
  INTO v_sample_titles
  FROM (
    SELECT title, created_at
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) t;

  -- 获取最后书签时间
  SELECT MAX(created_at) INTO v_last_bookmark_at
  FROM public.bookmarks
  WHERE folder_id = p_folder_id
    AND deleted_at IS NULL;

  -- 计算内部相似度（如果有足够的书签）
  IF v_bookmark_count >= 2 AND v_avg_embedding IS NOT NULL THEN
    SELECT AVG(1 - (embedding <=> v_avg_embedding))::FLOAT INTO v_internal_sim
    FROM public.bookmarks
    WHERE folder_id = p_folder_id
      AND deleted_at IS NULL
      AND embedding IS NOT NULL;
  ELSE
    v_internal_sim := NULL;
  END IF;

  -- 插入或更新画像
  INSERT INTO public.folder_profiles (
    user_id,
    folder_id,
    profile_embedding,
    bookmark_count,
    last_bookmark_at,
    top_tags,
    sample_titles,
    internal_similarity,
    computed_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_folder_id,
    v_avg_embedding,
    v_bookmark_count,
    v_last_bookmark_at,
    COALESCE(v_top_tags, '{}'),
    COALESCE(v_sample_titles, '{}'),
    v_internal_sim,
    NOW(),
    NOW()
  )
  ON CONFLICT (folder_id) DO UPDATE SET
    profile_embedding = EXCLUDED.profile_embedding,
    bookmark_count = EXCLUDED.bookmark_count,
    last_bookmark_at = EXCLUDED.last_bookmark_at,
    top_tags = EXCLUDED.top_tags,
    sample_titles = EXCLUDED.sample_titles,
    internal_similarity = EXCLUDED.internal_similarity,
    computed_at = NOW(),
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION compute_folder_profile IS '计算或更新指定文件夹的画像（向量、统计、元数据）';

GRANT EXECUTE ON FUNCTION compute_folder_profile(BIGINT) TO authenticated;

-- -------------------------------------------
-- 7. 批量计算用户所有文件夹画像函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION compute_user_folder_profiles(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_folder_id BIGINT;
  v_count INT := 0;
BEGIN
  -- 遍历用户的所有非删除文件夹
  FOR v_folder_id IN
    SELECT id
    FROM public.folders
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
  LOOP
    PERFORM compute_folder_profile(v_folder_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_user_folder_profiles IS '批量计算用户所有文件夹的画像，返回处理的文件夹数量';

GRANT EXECUTE ON FUNCTION compute_user_folder_profiles(UUID) TO authenticated;

-- -------------------------------------------
-- 8. 相似文件夹搜索函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION search_similar_folders(
  query_embedding vector(1024),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR(100),
  bookmark_count INT,
  top_tags TEXT[],
  sample_titles TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name AS folder_name,
    fp.bookmark_count,
    fp.top_tags,
    fp.sample_titles,
    (1 - (fp.profile_embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.folder_profiles fp
  INNER JOIN public.folders f ON f.id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND f.deleted_at IS NULL
    AND fp.profile_embedding IS NOT NULL
    AND (1 - (fp.profile_embedding <=> query_embedding)) > match_threshold
  ORDER BY fp.profile_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_folders IS '搜索与给定向量最相似的文件夹，用于智能分类';

GRANT EXECUTE ON FUNCTION search_similar_folders(vector, UUID, FLOAT, INT) TO authenticated;

-- -------------------------------------------
-- 9. 历史相似书签查询函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION find_similar_bookmarks_with_folders(
  query_embedding vector(1024),
  p_user_id UUID,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  bookmark_id BIGINT,
  bookmark_title VARCHAR(500),
  folder_id BIGINT,
  folder_name VARCHAR(100),
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bookmark_id,
    b.title AS bookmark_title,
    b.folder_id,
    f.name AS folder_name,
    (1 - (b.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.bookmarks b
  LEFT JOIN public.folders f ON f.id = b.folder_id AND f.deleted_at IS NULL
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND b.folder_id IS NOT NULL  -- 只考虑已分类的书签
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION find_similar_bookmarks_with_folders IS '查找与给定向量最相似的已分类书签及其所属文件夹，用于历史行为匹配';

GRANT EXECUTE ON FUNCTION find_similar_bookmarks_with_folders(vector, UUID, INT) TO authenticated;

-- -------------------------------------------
-- 10. 获取用户文件夹统计函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION get_user_folder_stats(p_user_id UUID)
RETURNS TABLE (
  total_folders INT,
  folders_today INT,
  can_create_more BOOLEAN,
  daily_remaining INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_today INT;
  v_max_folders INT := 16;       -- 总上限
  v_max_daily INT := 8;          -- 单日上限
BEGIN
  -- 获取总文件夹数（不含系统文件夹）
  SELECT COUNT(*) INTO v_total
  FROM public.folders
  WHERE user_id = p_user_id
    AND is_system = FALSE
    AND deleted_at IS NULL;

  -- 获取今日创建数
  SELECT COUNT(*) INTO v_today
  FROM public.folders
  WHERE user_id = p_user_id
    AND is_system = FALSE
    AND deleted_at IS NULL
    AND created_at >= CURRENT_DATE;

  RETURN QUERY SELECT
    v_total,
    v_today,
    (v_total < v_max_folders AND v_today < v_max_daily),
    LEAST(v_max_folders - v_total, v_max_daily - v_today);
END;
$$;

COMMENT ON FUNCTION get_user_folder_stats IS '获取用户文件夹统计信息，用于检查创建限制';

GRANT EXECUTE ON FUNCTION get_user_folder_stats(UUID) TO authenticated;

-- -------------------------------------------
-- 11. 过期建议清理函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION expire_old_suggestions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- 将 7 天前的待处理建议标记为过期
  UPDATE public.organization_suggestions
  SET status = 'expired',
      responded_at = NOW()
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_old_suggestions IS '将超过 7 天的待处理建议标记为过期';

-- -------------------------------------------
-- 12. 统计视图
-- -------------------------------------------

CREATE OR REPLACE VIEW classification_stats AS
SELECT
  p.id AS user_id,
  get_user_classification_stage(p.id) AS stage,
  (SELECT COUNT(*) FROM public.bookmarks b WHERE b.user_id = p.id AND b.deleted_at IS NULL) AS total_bookmarks,
  (SELECT COUNT(*) FROM public.folders f WHERE f.user_id = p.id AND f.is_system = FALSE AND f.deleted_at IS NULL) AS total_folders,
  (SELECT COUNT(*) FROM public.folder_profiles fp WHERE fp.user_id = p.id) AS profiled_folders,
  (SELECT COUNT(*) FROM public.organization_suggestions os WHERE os.user_id = p.id AND os.status = 'pending') AS pending_suggestions,
  (SELECT COUNT(*) FROM public.user_custom_interests ci WHERE ci.user_id = p.id) AS custom_interests
FROM public.profiles p;

COMMENT ON VIEW classification_stats IS '智能分类系统统计视图';

GRANT SELECT ON classification_stats TO authenticated;

-- -------------------------------------------
-- 完成
-- -------------------------------------------

COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v2.0.0 - 包含智能分类系统 V2';
