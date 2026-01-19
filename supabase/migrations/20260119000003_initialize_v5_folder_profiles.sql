-- ============================================
-- 初始化 v5.0 文件夹画像数据
-- 创建日期: 2026-01-19
-- 说明: 从现有书签数据计算并初始化 classification_folder_profiles_v5 表
-- ============================================

-- 创建初始化函数
CREATE OR REPLACE FUNCTION initialize_folder_profiles_v5()
RETURNS TABLE (
  initialized_count INTEGER,
  skipped_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_initialized INTEGER := 0;
  v_skipped INTEGER := 0;
  v_folder RECORD;
  v_user_id UUID;
  v_folder_id BIGINT;
  v_avg_embedding vector(1024);
  v_bookmark_count INTEGER;
BEGIN
  -- 遍历所有有书签的文件夹（按 user_id + folder_id 分组）
  FOR v_folder IN
    SELECT
      b.user_id,
      b.folder_id,
      COUNT(*) AS bookmark_count,
      AVG(b.embedding)::vector(1024) AS avg_embedding
    FROM bookmarks b
    WHERE b.folder_id IS NOT NULL
      AND b.deleted_at IS NULL
      AND b.embedding IS NOT NULL
    GROUP BY b.user_id, b.folder_id
    HAVING COUNT(*) > 0
  LOOP
    v_user_id := v_folder.user_id;
    v_folder_id := v_folder.folder_id;
    v_avg_embedding := v_folder.avg_embedding;
    v_bookmark_count := v_folder.bookmark_count;

    -- 检查是否已存在
    IF EXISTS (
      SELECT 1 FROM classification_folder_profiles_v5
      WHERE user_id = v_user_id AND folder_id = v_folder_id
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 验证文件夹存在
    IF NOT EXISTS (SELECT 1 FROM folders WHERE id = v_folder_id) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 插入新的 v5 文件夹画像
    -- 初始化时：content_embedding = behavior_embedding = 平均向量
    -- alpha_coefficient 默认 0.5（平衡内容和行为）
    INSERT INTO classification_folder_profiles_v5 (
      user_id,
      folder_id,
      content_embedding,
      behavior_embedding,
      alpha_coefficient,
      bookmark_count,
      last_updated_at,
      needs_update,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_folder_id,
      v_avg_embedding,           -- 内容向量 = 书签平均向量
      v_avg_embedding,           -- 行为向量初始化为相同值
      0.50,                      -- 默认 α 系数
      v_bookmark_count,
      NOW(),
      FALSE,
      NOW(),
      NOW()
    );

    v_initialized := v_initialized + 1;
  END LOOP;

  RETURN QUERY SELECT v_initialized, v_skipped;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION initialize_folder_profiles_v5()
  IS '智能分类 v5.0 - 初始化文件夹画像数据（从现有书签计算）';

-- 执行初始化
DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM initialize_folder_profiles_v5();
  RAISE NOTICE 'v5.0 文件夹画像初始化完成: 已初始化 % 个, 跳过 % 个',
    v_result.initialized_count, v_result.skipped_count;
END;
$$;

-- 验证初始化结果
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM classification_folder_profiles_v5;
  RAISE NOTICE 'classification_folder_profiles_v5 表当前记录数: %', v_count;
END;
$$;
