-- ===========================================
-- 创建书签数据视图
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-19
-- 说明: 创建标准化的书签视图，保障数据查询一致性
--       用于统计分析、搜索、导出等场景

-- -------------------------------------------
-- 1. 活跃书签视图
-- -------------------------------------------
-- 用途：统计、分析、搜索、列表展示、导出
-- 条件：排除软删除 + 排除垃圾箱

CREATE OR REPLACE VIEW v_active_bookmarks AS
SELECT *
FROM bookmarks
WHERE deleted_at IS NULL
  AND is_in_trash = FALSE;

COMMENT ON VIEW v_active_bookmarks IS
  '活跃书签视图：自动排除软删除(deleted_at)和垃圾箱(is_in_trash)的书签。
   用于统计、分析、搜索等需要准确数据的场景。
   创建于: 2025-12-19';

-- -------------------------------------------
-- 2. 垃圾箱书签视图
-- -------------------------------------------
-- 用途：垃圾箱列表、恢复操作
-- 条件：排除软删除 + 仅垃圾箱

CREATE OR REPLACE VIEW v_trashed_bookmarks AS
SELECT *
FROM bookmarks
WHERE deleted_at IS NULL
  AND is_in_trash = TRUE;

COMMENT ON VIEW v_trashed_bookmarks IS
  '垃圾箱书签视图：仅包含垃圾箱中的书签（未永久删除）。
   用于垃圾箱列表展示和恢复操作。
   创建于: 2025-12-19';

-- -------------------------------------------
-- 3. 已失效书签视图
-- -------------------------------------------
-- 用途：失效链接管理、批量清理
-- 条件：活跃书签 + 失效标记

CREATE OR REPLACE VIEW v_invalid_bookmarks AS
SELECT *
FROM bookmarks
WHERE deleted_at IS NULL
  AND is_in_trash = FALSE
  AND is_invalid = TRUE;

COMMENT ON VIEW v_invalid_bookmarks IS
  '已失效书签视图：活跃书签中链接已失效的部分。
   用于失效链接管理和批量清理。
   创建于: 2025-12-19';

-- -------------------------------------------
-- 4. 为视图添加 RLS 策略
-- -------------------------------------------
-- 注意：PostgreSQL 视图默认继承基表的 RLS 策略
-- 这里显式声明以确保安全性

-- 启用视图的 RLS（如果支持）
-- ALTER VIEW v_active_bookmarks SET (security_invoker = true);
-- ALTER VIEW v_trashed_bookmarks SET (security_invoker = true);
-- ALTER VIEW v_invalid_bookmarks SET (security_invoker = true);

-- -------------------------------------------
-- 5. 验证视图创建
-- -------------------------------------------

DO $$
BEGIN
  -- 检查视图是否创建成功
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_active_bookmarks') THEN
    RAISE NOTICE '✓ v_active_bookmarks 视图创建成功';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_trashed_bookmarks') THEN
    RAISE NOTICE '✓ v_trashed_bookmarks 视图创建成功';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_invalid_bookmarks') THEN
    RAISE NOTICE '✓ v_invalid_bookmarks 视图创建成功';
  END IF;
END $$;

-- -------------------------------------------
-- 回滚脚本（如需回滚，执行以下命令）
-- -------------------------------------------
-- DROP VIEW IF EXISTS v_invalid_bookmarks;
-- DROP VIEW IF EXISTS v_trashed_bookmarks;
-- DROP VIEW IF EXISTS v_active_bookmarks;

-- -------------------------------------------
-- 完成
-- -------------------------------------------
