-- =====================================================
-- 新增: folder_profiles.top_authors JSONB 字段
-- 用途: 存储文件夹中出现频率最高的作者/来源信息
-- 结构: [{"name": "少数派", "count": 12, "ratio": 0.24}, ...]
-- 日期: 2026-03-11
-- =====================================================

-- 1. 添加 top_authors 列
ALTER TABLE folder_profiles
  ADD COLUMN IF NOT EXISTS top_authors JSONB DEFAULT '[]'::JSONB;

COMMENT ON COLUMN folder_profiles.top_authors IS '高频作者/来源列表 [{"name":"xxx","count":N,"ratio":0.xx}]，前 10 个，按 count 降序';

-- 2. 创建用于重算单个文件夹 top_authors 的函数
CREATE OR REPLACE FUNCTION recompute_folder_top_authors(p_folder_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_count INT;
  v_top_authors JSONB;
BEGIN
  -- 获取文件夹所属用户
  SELECT user_id INTO v_user_id
  FROM folders
  WHERE id = p_folder_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 获取书签总数
  SELECT COUNT(*)
  INTO v_bookmark_count
  FROM bookmarks
  WHERE folder_id = p_folder_id
    AND is_deleted = false
    AND user_id = v_user_id;

  IF v_bookmark_count = 0 THEN
    UPDATE folder_profiles
    SET top_authors = '[]'::JSONB, updated_at = NOW()
    WHERE folder_id = p_folder_id;
    RETURN;
  END IF;

  -- 聚合 source_name（优先）/ author，取前 10
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', author_key,
        'count', cnt,
        'ratio', ROUND(cnt::NUMERIC / v_bookmark_count, 4)
      )
      ORDER BY cnt DESC
    ),
    '[]'::JSONB
  )
  INTO v_top_authors
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(source_name), ''), NULLIF(TRIM(author), '')) AS author_key,
      COUNT(*) AS cnt
    FROM bookmarks
    WHERE folder_id = p_folder_id
      AND is_deleted = false
      AND user_id = v_user_id
      AND (
        (source_name IS NOT NULL AND TRIM(source_name) <> '')
        OR (author IS NOT NULL AND TRIM(author) <> '')
      )
    GROUP BY author_key
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- 更新 folder_profiles
  UPDATE folder_profiles
  SET top_authors = v_top_authors, updated_at = NOW()
  WHERE folder_id = p_folder_id;

END;
$$;

COMMENT ON FUNCTION recompute_folder_top_authors(BIGINT) IS '重算文件夹的 top_authors（作者/来源频率统计）';
GRANT EXECUTE ON FUNCTION recompute_folder_top_authors(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION recompute_folder_top_authors(BIGINT) TO service_role;
