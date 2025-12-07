-- ===========================================
-- AnyKeep 用户兴趣画像 V2 - 数据库迁移
-- ===========================================
-- 版本: 2.1.0
-- 日期: 2025-12-05
-- 说明: 实现渐进式学习的用户兴趣画像系统
--       核心设计原则：
--       1. 零障碍 - 用户什么都不填也能工作
--       2. 渐进式 - 随使用越来越精准
--       3. 多来源 - 手动/导入/学习三种方式互补

-- -------------------------------------------
-- 1. 用户兴趣画像表 (user_interest_profiles)
-- -------------------------------------------
-- 存储用户的兴趣画像，支持多来源渐进式学习

CREATE TABLE IF NOT EXISTS public.user_interest_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 兴趣来源详情 (JSONB 存储灵活结构)
  -- {
  --   "manual": { "rawText": "...", "parsedAt": "..." },
  --   "imported": { "bookmarkCount": 100, "analyzedAt": "...", "importSource": "chrome" },
  --   "learned": { "bookmarkCount": 50, "lastUpdatedAt": "..." }
  -- }
  sources JSONB DEFAULT '{}',

  -- 兴趣关键词数组 (JSONB 存储)
  -- [{ "keyword": "前端开发", "weight": 0.85, "source": "imported", "bookmarkCount": 20 }, ...]
  interests JSONB DEFAULT '[]',

  -- 用户阶段: cold_start | learning | mature
  stage VARCHAR(20) DEFAULT 'cold_start',

  -- 整体置信度 (0-100)
  confidence INT DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：每个用户只有一个兴趣画像
  UNIQUE(user_id),

  -- 阶段枚举约束
  CONSTRAINT valid_stage CHECK (stage IN ('cold_start', 'learning', 'mature'))
);

-- 注释
COMMENT ON TABLE public.user_interest_profiles IS '用户兴趣画像表 V2，支持渐进式学习';
COMMENT ON COLUMN public.user_interest_profiles.sources IS '兴趣来源详情: manual(手动输入), imported(导入分析), learned(行为学习)';
COMMENT ON COLUMN public.user_interest_profiles.interests IS '兴趣关键词数组，按权重降序排列';
COMMENT ON COLUMN public.user_interest_profiles.stage IS '用户阶段: cold_start(冷启动), learning(学习期), mature(成熟期)';
COMMENT ON COLUMN public.user_interest_profiles.confidence IS '整体置信度 (0-100)，基于数据充分度计算';

-- 索引
CREATE INDEX IF NOT EXISTS idx_interest_profiles_user
ON public.user_interest_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_interest_profiles_stage
ON public.user_interest_profiles(stage);

-- GIN 索引用于 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_interest_profiles_interests
ON public.user_interest_profiles USING GIN (interests);

-- RLS
ALTER TABLE public.user_interest_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interest profile"
  ON public.user_interest_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interest profile"
  ON public.user_interest_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interest profile"
  ON public.user_interest_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interest profile"
  ON public.user_interest_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- 更新时间戳触发器
CREATE TRIGGER update_interest_profiles_updated_at
  BEFORE UPDATE ON public.user_interest_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -------------------------------------------
-- 2. 获取或创建用户兴趣画像函数
-- -------------------------------------------
-- 如果用户没有兴趣画像，则创建一个空的默认画像

CREATE OR REPLACE FUNCTION get_or_create_interest_profile(p_user_id UUID)
RETURNS public.user_interest_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile public.user_interest_profiles;
BEGIN
  -- 尝试获取现有画像
  SELECT * INTO v_profile
  FROM public.user_interest_profiles
  WHERE user_id = p_user_id;

  -- 如果不存在，创建默认画像
  IF NOT FOUND THEN
    INSERT INTO public.user_interest_profiles (
      user_id,
      sources,
      interests,
      stage,
      confidence
    ) VALUES (
      p_user_id,
      '{}',
      '[]',
      'cold_start',
      0
    )
    RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$;

COMMENT ON FUNCTION get_or_create_interest_profile IS '获取或创建用户兴趣画像，确保每个用户都有画像记录';

GRANT EXECUTE ON FUNCTION get_or_create_interest_profile(UUID) TO authenticated;

-- -------------------------------------------
-- 3. 更新用户阶段函数
-- -------------------------------------------
-- 根据书签数量自动更新用户阶段

CREATE OR REPLACE FUNCTION update_user_interest_stage(p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bookmark_count INT;
  v_new_stage VARCHAR(20);
  v_old_stage VARCHAR(20);
  v_confidence INT;
BEGIN
  -- 获取用户书签数量（排除浏览器书签）
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND platform NOT IN ('chrome', 'edge', 'firefox', 'safari', 'browser');

  -- 计算新阶段
  IF v_bookmark_count <= 20 THEN
    v_new_stage := 'cold_start';
    v_confidence := LEAST(v_bookmark_count * 5, 100); -- 0-20 书签 -> 0-100 置信度
  ELSIF v_bookmark_count <= 100 THEN
    v_new_stage := 'learning';
    v_confidence := 50 + ((v_bookmark_count - 20) * 50 / 80); -- 21-100 书签 -> 50-100 置信度
  ELSE
    v_new_stage := 'mature';
    v_confidence := 100;
  END IF;

  -- 获取当前阶段
  SELECT stage INTO v_old_stage
  FROM public.user_interest_profiles
  WHERE user_id = p_user_id;

  -- 确保画像存在
  IF v_old_stage IS NULL THEN
    PERFORM get_or_create_interest_profile(p_user_id);
  END IF;

  -- 更新阶段和置信度
  UPDATE public.user_interest_profiles
  SET stage = v_new_stage,
      confidence = v_confidence,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_new_stage;
END;
$$;

COMMENT ON FUNCTION update_user_interest_stage IS '根据书签数量更新用户阶段和置信度';

GRANT EXECUTE ON FUNCTION update_user_interest_stage(UUID) TO authenticated;

-- -------------------------------------------
-- 4. 从导入书签分析兴趣函数
-- -------------------------------------------
-- 分析用户的导入书签，提取兴趣关键词

CREATE OR REPLACE FUNCTION analyze_imported_bookmarks(
  p_user_id UUID,
  p_import_source VARCHAR DEFAULT 'browser'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bookmark_count INT;
  v_keywords JSONB;
  v_result JSONB;
BEGIN
  -- 统计导入书签数量
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND platform IN ('chrome', 'edge', 'firefox', 'safari', 'browser');

  IF v_bookmark_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No imported bookmarks found',
      'bookmarkCount', 0
    );
  END IF;

  -- 提取高频标签作为兴趣关键词
  SELECT jsonb_agg(
    jsonb_build_object(
      'keyword', tag,
      'count', cnt,
      'weight', ROUND((cnt::numeric / v_bookmark_count)::numeric, 3)
    )
    ORDER BY cnt DESC
  )
  INTO v_keywords
  FROM (
    SELECT UNNEST(ai_tags) AS tag, COUNT(*) AS cnt
    FROM public.bookmarks
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND platform IN ('chrome', 'edge', 'firefox', 'safari', 'browser')
      AND ai_tags IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 20
  ) t;

  -- 更新用户兴趣画像
  UPDATE public.user_interest_profiles
  SET
    sources = jsonb_set(
      COALESCE(sources, '{}'),
      '{imported}',
      jsonb_build_object(
        'bookmarkCount', v_bookmark_count,
        'analyzedAt', NOW(),
        'importSource', p_import_source
      )
    ),
    interests = COALESCE(v_keywords, '[]'),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 如果没有更新任何行，创建新画像
  IF NOT FOUND THEN
    INSERT INTO public.user_interest_profiles (
      user_id,
      sources,
      interests,
      stage,
      confidence
    ) VALUES (
      p_user_id,
      jsonb_build_object(
        'imported', jsonb_build_object(
          'bookmarkCount', v_bookmark_count,
          'analyzedAt', NOW(),
          'importSource', p_import_source
        )
      ),
      COALESCE(v_keywords, '[]'),
      CASE
        WHEN v_bookmark_count > 100 THEN 'mature'
        WHEN v_bookmark_count > 20 THEN 'learning'
        ELSE 'cold_start'
      END,
      LEAST(v_bookmark_count, 100)
    );
  END IF;

  -- 更新用户阶段
  PERFORM update_user_interest_stage(p_user_id);

  v_result := jsonb_build_object(
    'success', true,
    'bookmarkCount', v_bookmark_count,
    'keywordsExtracted', jsonb_array_length(COALESCE(v_keywords, '[]')),
    'keywords', v_keywords
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION analyze_imported_bookmarks IS '分析用户导入的书签，提取兴趣关键词并更新画像';

GRANT EXECUTE ON FUNCTION analyze_imported_bookmarks(UUID, VARCHAR) TO authenticated;

-- -------------------------------------------
-- 5. 从行为学习兴趣函数
-- -------------------------------------------
-- 根据用户的书签整理行为学习兴趣偏好

CREATE OR REPLACE FUNCTION learn_from_user_behavior(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bookmark_count INT;
  v_keywords JSONB;
  v_existing_interests JSONB;
  v_merged_interests JSONB;
  v_result JSONB;
BEGIN
  -- 统计已分类书签数量（排除浏览器书签和待整理）
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks b
  INNER JOIN public.folders f ON f.id = b.folder_id
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL
    AND b.folder_id IS NOT NULL
    AND f.is_system = FALSE
    AND b.platform NOT IN ('chrome', 'edge', 'firefox', 'safari', 'browser');

  IF v_bookmark_count < 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Not enough classified bookmarks for learning',
      'bookmarkCount', v_bookmark_count,
      'minRequired', 5
    );
  END IF;

  -- 提取用户主动整理的书签标签
  SELECT jsonb_agg(
    jsonb_build_object(
      'keyword', tag,
      'count', cnt,
      'weight', ROUND((cnt::numeric / v_bookmark_count)::numeric, 3),
      'source', 'learned',
      'bookmarkCount', cnt
    )
    ORDER BY cnt DESC
  )
  INTO v_keywords
  FROM (
    SELECT UNNEST(ai_tags) AS tag, COUNT(*) AS cnt
    FROM public.bookmarks b
    INNER JOIN public.folders f ON f.id = b.folder_id
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND b.folder_id IS NOT NULL
      AND f.is_system = FALSE
      AND b.ai_tags IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 20
  ) t;

  -- 获取现有兴趣
  SELECT interests INTO v_existing_interests
  FROM public.user_interest_profiles
  WHERE user_id = p_user_id;

  -- 合并兴趣（学习到的兴趣权重提升）
  -- 简化实现：直接用学习到的兴趣覆盖，实际可以更复杂地合并
  v_merged_interests := COALESCE(v_keywords, '[]');

  -- 更新用户兴趣画像
  UPDATE public.user_interest_profiles
  SET
    sources = jsonb_set(
      COALESCE(sources, '{}'),
      '{learned}',
      jsonb_build_object(
        'bookmarkCount', v_bookmark_count,
        'lastUpdatedAt', NOW()
      )
    ),
    interests = v_merged_interests,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 如果没有更新任何行，创建新画像
  IF NOT FOUND THEN
    PERFORM get_or_create_interest_profile(p_user_id);

    UPDATE public.user_interest_profiles
    SET
      sources = jsonb_build_object(
        'learned', jsonb_build_object(
          'bookmarkCount', v_bookmark_count,
          'lastUpdatedAt', NOW()
        )
      ),
      interests = v_merged_interests
    WHERE user_id = p_user_id;
  END IF;

  -- 更新用户阶段
  PERFORM update_user_interest_stage(p_user_id);

  v_result := jsonb_build_object(
    'success', true,
    'bookmarkCount', v_bookmark_count,
    'keywordsLearned', jsonb_array_length(COALESCE(v_keywords, '[]')),
    'keywords', v_keywords
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION learn_from_user_behavior IS '根据用户书签整理行为学习兴趣偏好';

GRANT EXECUTE ON FUNCTION learn_from_user_behavior(UUID) TO authenticated;

-- -------------------------------------------
-- 6. 更新 get_user_classification_stage 函数
-- -------------------------------------------
-- 优化阶段判断，集成兴趣画像

CREATE OR REPLACE FUNCTION get_user_classification_stage(p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_bookmark_count INT;
  v_imported_count INT;
  v_profile_stage VARCHAR(20);
BEGIN
  -- 先检查兴趣画像中的阶段
  SELECT stage INTO v_profile_stage
  FROM public.user_interest_profiles
  WHERE user_id = p_user_id;

  -- 如果有画像且已经是成熟期，直接返回
  IF v_profile_stage = 'mature' THEN
    RETURN 'mature';
  END IF;

  -- 获取用户普通书签数量（排除浏览器书签）
  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND platform NOT IN ('chrome', 'edge', 'firefox', 'safari', 'browser');

  -- 获取导入书签数量（用于快速跳过冷启动）
  SELECT COUNT(*) INTO v_imported_count
  FROM public.bookmarks
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND platform IN ('chrome', 'edge', 'firefox', 'safari', 'browser');

  -- 判断阶段
  -- 如果导入了大量书签，可以更快进入学习期
  IF v_bookmark_count <= 20 THEN
    -- 如果导入了 50+ 书签，认为用户有足够的历史数据，跳过冷启动
    IF v_imported_count >= 50 THEN
      RETURN 'learning';
    END IF;
    RETURN 'cold_start';
  ELSIF v_bookmark_count <= 100 THEN
    RETURN 'learning';
  ELSE
    RETURN 'mature';
  END IF;
END;
$$;

-- -------------------------------------------
-- 7. 兴趣画像统计视图
-- -------------------------------------------

CREATE OR REPLACE VIEW interest_profile_stats AS
SELECT
  uip.user_id,
  uip.stage,
  uip.confidence,
  jsonb_array_length(uip.interests) AS interest_count,
  (uip.sources ? 'manual') AS has_manual,
  (uip.sources ? 'imported') AS has_imported,
  (uip.sources ? 'learned') AS has_learned,
  (uip.sources->'imported'->>'bookmarkCount')::INT AS imported_bookmark_count,
  (uip.sources->'learned'->>'bookmarkCount')::INT AS learned_bookmark_count,
  uip.created_at,
  uip.updated_at
FROM public.user_interest_profiles uip;

COMMENT ON VIEW interest_profile_stats IS '用户兴趣画像统计视图';

GRANT SELECT ON interest_profile_stats TO authenticated;

-- -------------------------------------------
-- 完成
-- -------------------------------------------

COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v2.1.0 - 包含用户兴趣画像 V2';
