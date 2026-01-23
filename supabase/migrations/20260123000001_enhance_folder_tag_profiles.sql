-- 迁移文件：20260123000001_enhance_folder_tag_profiles.sql
-- AI 标签优先匹配系统 v1.1 优化 - 数据库增强
--
-- 新增字段：
-- 1. aliases - 文件夹别名（用于匹配）
-- 2. blacklist_tags - 黑名单标签（排除匹配）
-- 3. tag_source_stats - 标签来源统计

-- 1. 添加别名字段
ALTER TABLE folder_tag_profiles
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

COMMENT ON COLUMN folder_tag_profiles.aliases IS '文件夹别名列表（用于 AI 标签匹配），自动学习或手动添加';

-- 2. 添加黑名单字段
ALTER TABLE folder_tag_profiles
ADD COLUMN IF NOT EXISTS blacklist_tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN folder_tag_profiles.blacklist_tags IS '黑名单标签（排除匹配），防止误分类';

-- 3. 添加标签来源统计
ALTER TABLE folder_tag_profiles
ADD COLUMN IF NOT EXISTS tag_source_stats JSONB DEFAULT '{}';

COMMENT ON COLUMN folder_tag_profiles.tag_source_stats IS '标签来源统计: { "S": 高信标签数, "B": 中信标签数, "C": 低信标签数 }';

-- 4. 添加别名索引（GIN 索引支持数组包含��询）
CREATE INDEX IF NOT EXISTS idx_folder_tag_profiles_aliases
ON folder_tag_profiles USING GIN(aliases);

-- 5. 添加黑名单索引
CREATE INDEX IF NOT EXISTS idx_folder_tag_profiles_blacklist
ON folder_tag_profiles USING GIN(blacklist_tags);

-- 6. 添加更新函数：添加别名
CREATE OR REPLACE FUNCTION add_folder_alias(
  p_user_id UUID,
  p_folder_id INTEGER,
  p_alias TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 安全检查：验证调用者身份
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other user data';
  END IF;

  UPDATE folder_tag_profiles
  SET aliases = array_append(
    COALESCE(aliases, '{}'),
    lower(trim(p_alias))
  )
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id
    AND NOT (lower(trim(p_alias)) = ANY(COALESCE(aliases, '{}')));
END;
$$;

-- 7. 添加更新函数：移除别名
CREATE OR REPLACE FUNCTION remove_folder_alias(
  p_user_id UUID,
  p_folder_id INTEGER,
  p_alias TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 安全检查：验证调用者身份
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other user data';
  END IF;

  UPDATE folder_tag_profiles
  SET aliases = array_remove(
    COALESCE(aliases, '{}'),
    lower(trim(p_alias))
  )
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id;
END;
$$;

-- 8. 添加更新函数：添加黑名单标签
CREATE OR REPLACE FUNCTION add_folder_blacklist_tag(
  p_user_id UUID,
  p_folder_id INTEGER,
  p_tag TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 安全检查：验证调用者身份
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other user data';
  END IF;

  UPDATE folder_tag_profiles
  SET blacklist_tags = array_append(
    COALESCE(blacklist_tags, '{}'),
    lower(trim(p_tag))
  )
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id
    AND NOT (lower(trim(p_tag)) = ANY(COALESCE(blacklist_tags, '{}')));
END;
$$;

-- 9. 添加更新函数：移除黑名单标签
CREATE OR REPLACE FUNCTION remove_folder_blacklist_tag(
  p_user_id UUID,
  p_folder_id INTEGER,
  p_tag TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 安全检查：验证调用者身份
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other user data';
  END IF;

  UPDATE folder_tag_profiles
  SET blacklist_tags = array_remove(
    COALESCE(blacklist_tags, '{}'),
    lower(trim(p_tag))
  )
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id;
END;
$$;

-- 10. 授权 RPC 函数给认证用户
GRANT EXECUTE ON FUNCTION add_folder_alias(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_folder_alias(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_folder_blacklist_tag(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_folder_blacklist_tag(UUID, INTEGER, TEXT) TO authenticated;
