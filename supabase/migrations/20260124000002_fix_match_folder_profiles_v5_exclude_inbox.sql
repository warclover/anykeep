-- =====================================================
-- 修复: match_folder_profiles_v5 排除系统文件夹
-- 问题: "待整理"(INBOX) 系统文件夹不应参与向量匹配
-- 原因: 系统文件夹是兜底选项，只有其他文件夹都不匹配时才使用
-- 日期: 2026-01-24
-- 版本: V5.1.4
-- =====================================================

-- 删除旧函数
DROP FUNCTION IF EXISTS match_folder_profiles_v5(UUID, vector(1024), vector(1024), FLOAT, FLOAT, INT);

-- 创建修复后的双源向量搜索函数
CREATE OR REPLACE FUNCTION match_folder_profiles_v5(
  p_user_id UUID,
  p_content_embedding vector(1024),
  p_behavior_embedding vector(1024),
  p_alpha FLOAT,
  p_match_threshold FLOAT,
  p_match_count INT
)
RETURNS TABLE (
  profile_id UUID,
  folder_id BIGINT,
  folder_name TEXT,
  similarity FLOAT,
  match_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  content_weight FLOAT;
  behavior_weight FLOAT;
BEGIN
  -- 计算权重：α = 0 表示纯内容，α = 1 表示纯行为
  content_weight := 1.0 - COALESCE(p_alpha, 0.5);
  behavior_weight := COALESCE(p_alpha, 0.5);

  RETURN QUERY
  WITH scored_profiles AS (
    SELECT
      cfp.id AS p_id,
      cfp.folder_id AS f_id,
      f.name::TEXT AS f_name,
      CASE
        -- 纯内容搜索（α = 0 或 behavior_embedding 为 NULL）
        WHEN p_behavior_embedding IS NULL OR p_alpha = 0 THEN
          1 - (cfp.content_embedding <=> p_content_embedding)
        -- 纯行为搜索（α = 1 或 content_embedding 为 NULL）
        WHEN p_content_embedding IS NULL OR p_alpha = 1 THEN
          1 - (cfp.behavior_embedding <=> p_behavior_embedding)
        -- 混合搜索：加权平均
        ELSE
          content_weight * (1 - (cfp.content_embedding <=> p_content_embedding)) +
          behavior_weight * (1 - (cfp.behavior_embedding <=> p_behavior_embedding))
      END AS sim,
      CASE
        WHEN p_behavior_embedding IS NULL OR p_alpha = 0 THEN 'content'
        WHEN p_content_embedding IS NULL OR p_alpha = 1 THEN 'behavior'
        ELSE 'hybrid'
      END AS m_type
    FROM classification_folder_profiles_v5 cfp
    INNER JOIN folders f ON f.id = cfp.folder_id
    WHERE cfp.user_id = p_user_id
      -- V5.1.4: 排除系统文件夹（如"待整理"），系统文件夹是兜底选项
      AND (f.system_type IS NULL OR f.system_type != 'INBOX')
  )
  SELECT
    sp.p_id AS profile_id,
    sp.f_id AS folder_id,
    sp.f_name AS folder_name,
    sp.sim AS similarity,
    sp.m_type AS match_type
  FROM scored_profiles sp
  WHERE sp.sim > p_match_threshold
  ORDER BY sp.sim DESC
  LIMIT p_match_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION match_folder_profiles_v5(UUID, vector(1024), vector(1024), FLOAT, FLOAT, INT)
  IS 'V5.1.4: 双源向量搜索函数，排除系统文件夹（INBOX等），系统文件夹作为兜底选项';
