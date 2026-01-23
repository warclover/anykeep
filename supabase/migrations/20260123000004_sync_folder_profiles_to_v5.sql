-- =====================================================
-- 同步: folder_profiles -> classification_folder_profiles_v5
-- 问题: v5 表的 embedding 是旧数据，与当前 embedding 模型不匹配
-- 解决方案: 从 folder_profiles 表同步最新的 embedding 数据
-- 日期: 2026-01-23
-- 版本: V5.0.4
-- =====================================================

-- 说明:
-- folder_profiles 表由 compute_folder_profile() 函数维护，包含最新的 profile_embedding
-- classification_folder_profiles_v5 表是 v5 分类系统专用，但数据已过期
-- 本迁移将 folder_profiles 的数据同步到 v5 表

-- 1. 更新已存在的记录
UPDATE classification_folder_profiles_v5 cfp5
SET
  content_embedding = fp.profile_embedding,
  behavior_embedding = fp.profile_embedding,  -- 暂时使用相同向量，后续由用户行为更新
  last_updated_at = NOW(),
  updated_at = NOW(),
  needs_update = FALSE
FROM folder_profiles fp
WHERE cfp5.folder_id = fp.folder_id
  AND cfp5.user_id = fp.user_id
  AND fp.profile_embedding IS NOT NULL;

-- 2. 插入新记录（folder_profiles 有但 v5 表没有的）
INSERT INTO classification_folder_profiles_v5 (
  user_id,
  folder_id,
  content_embedding,
  behavior_embedding,
  alpha_coefficient,
  last_updated_at,
  bookmark_count,
  needs_update,
  created_at,
  updated_at
)
SELECT
  fp.user_id,
  fp.folder_id,
  fp.profile_embedding AS content_embedding,
  fp.profile_embedding AS behavior_embedding,  -- 初始化时使用相同向量
  0.50 AS alpha_coefficient,
  NOW() AS last_updated_at,
  fp.bookmark_count,
  FALSE AS needs_update,
  NOW() AS created_at,
  NOW() AS updated_at
FROM folder_profiles fp
WHERE fp.profile_embedding IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM classification_folder_profiles_v5 cfp5
    WHERE cfp5.folder_id = fp.folder_id
      AND cfp5.user_id = fp.user_id
  );

-- 3. 删除 v5 表中 folder_profiles 没有的记录（孤立数据）
DELETE FROM classification_folder_profiles_v5 cfp5
WHERE NOT EXISTS (
  SELECT 1 FROM folder_profiles fp
  WHERE fp.folder_id = cfp5.folder_id
    AND fp.user_id = cfp5.user_id
);

-- 4. 创建触发器：当 folder_profiles 更新时自动同步到 v5 表
CREATE OR REPLACE FUNCTION sync_folder_profile_to_v5()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 插入或更新 v5 表
  INSERT INTO classification_folder_profiles_v5 (
    user_id,
    folder_id,
    content_embedding,
    behavior_embedding,
    alpha_coefficient,
    last_updated_at,
    bookmark_count,
    needs_update,
    created_at,
    updated_at
  ) VALUES (
    NEW.user_id,
    NEW.folder_id,
    NEW.profile_embedding,
    NEW.profile_embedding,  -- 初始化使用相同向量
    0.50,
    NOW(),
    NEW.bookmark_count,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, folder_id) DO UPDATE SET
    content_embedding = EXCLUDED.content_embedding,
    -- 注意：不更新 behavior_embedding，保留用户行为学习的结果
    last_updated_at = NOW(),
    bookmark_count = EXCLUDED.bookmark_count,
    needs_update = FALSE,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_sync_folder_profile_to_v5 ON folder_profiles;

-- 创建触发器
CREATE TRIGGER trigger_sync_folder_profile_to_v5
  AFTER INSERT OR UPDATE ON folder_profiles
  FOR EACH ROW
  WHEN (NEW.profile_embedding IS NOT NULL)
  EXECUTE FUNCTION sync_folder_profile_to_v5();

-- 添加注释
COMMENT ON FUNCTION sync_folder_profile_to_v5() IS 'V5.0.4: 自动同步 folder_profiles 到 classification_folder_profiles_v5';
COMMENT ON TRIGGER trigger_sync_folder_profile_to_v5 ON folder_profiles IS 'V5.0.4: folder_profiles 更新时自动同步到 v5 表';
