-- ===========================================
-- 创建内容书签和浏览器书签视图
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-20
-- 说明:
--   1. 创建 v_content_bookmarks 视图：排除浏览器书签
--   2. 创建 v_browser_bookmarks 视图：仅浏览器书签
--   3. 用于统计分析场景，确保数据一致性

-- -------------------------------------------
-- 1. 内容书签视图（排除浏览器书签）
-- -------------------------------------------
-- 用途：统计分析、内容展示
-- 条件：活跃书签 + 排除浏览器平台

CREATE OR REPLACE VIEW v_content_bookmarks AS
SELECT *
FROM bookmarks
WHERE deleted_at IS NULL
  AND (is_in_trash = FALSE OR is_in_trash IS NULL)
  AND platform NOT IN ('BROWSER_CHROME', 'BROWSER_EDGE', 'BROWSER_FIREFOX', 'BROWSER_SAFARI');

COMMENT ON VIEW v_content_bookmarks IS
  '内容书签视图：排除浏览器书签的活跃书签。
   用于统计分析、首页展示等场景。
   包含：微信公众号、B站、小红书等内容平台。
   创建于: 2025-12-20';

-- -------------------------------------------
-- 2. 浏览器书签视图（仅浏览器书签）
-- -------------------------------------------
-- 用途：浏览器书签管理、导入导出
-- 条件：活跃书签 + 仅浏览器平台

CREATE OR REPLACE VIEW v_browser_bookmarks AS
SELECT *
FROM bookmarks
WHERE deleted_at IS NULL
  AND (is_in_trash = FALSE OR is_in_trash IS NULL)
  AND platform IN ('BROWSER_CHROME', 'BROWSER_EDGE', 'BROWSER_FIREFOX', 'BROWSER_SAFARI');

COMMENT ON VIEW v_browser_bookmarks IS
  '浏览器书签视图：仅包含从浏览器导入的书签。
   用于浏览器书签管理、导出等场景。
   包含：Chrome、Edge、Firefox、Safari。
   创建于: 2025-12-20';

-- -------------------------------------------
-- 3. 验证视图创建
-- -------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_content_bookmarks') THEN
    RAISE NOTICE '✓ v_content_bookmarks 视图创建成功';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_browser_bookmarks') THEN
    RAISE NOTICE '✓ v_browser_bookmarks 视图创建成功';
  END IF;
END $$;

-- -------------------------------------------
-- 4. 数据一致性验证函数
-- -------------------------------------------
-- 用于验证内容书签 + 浏览器书签 = 全部活跃书签

CREATE OR REPLACE FUNCTION verify_bookmark_views_consistency(p_user_id UUID)
RETURNS TABLE (
  total_active INTEGER,
  content_count INTEGER,
  browser_count INTEGER,
  is_consistent BOOLEAN
) AS $$
DECLARE
  v_total INTEGER;
  v_content INTEGER;
  v_browser INTEGER;
BEGIN
  -- 计算活跃书签总数
  SELECT COUNT(*) INTO v_total
  FROM v_active_bookmarks
  WHERE user_id = p_user_id;

  -- 计算内容书签数
  SELECT COUNT(*) INTO v_content
  FROM v_content_bookmarks
  WHERE user_id = p_user_id;

  -- 计算浏览器书签数
  SELECT COUNT(*) INTO v_browser
  FROM v_browser_bookmarks
  WHERE user_id = p_user_id;

  -- 返回结果
  RETURN QUERY SELECT
    v_total,
    v_content,
    v_browser,
    (v_total = v_content + v_browser);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_bookmark_views_consistency(UUID) IS
  '验证书签视图数据一致性：total = content + browser';

-- -------------------------------------------
-- 回滚脚本（如需回滚，执行以下命令）
-- -------------------------------------------
-- DROP FUNCTION IF EXISTS verify_bookmark_views_consistency(UUID);
-- DROP VIEW IF EXISTS v_browser_bookmarks;
-- DROP VIEW IF EXISTS v_content_bookmarks;

-- -------------------------------------------
-- 完成
-- -------------------------------------------
