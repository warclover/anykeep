-- ===========================================
-- 修复 is_in_trash NULL 值问题
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-20
-- 说明:
--   1. 更新视图以正确处理 is_in_trash = NULL 的情况
--   2. 将历史数据中的 NULL 值更新为 FALSE
--   3. 确保数据一致性

-- -------------------------------------------
-- 1. 更新现有数据：将 is_in_trash = NULL 改为 FALSE
-- -------------------------------------------
-- 这些是在添加 is_in_trash 字段迁移之前创建的书签

UPDATE bookmarks
SET is_in_trash = FALSE
WHERE is_in_trash IS NULL;

-- 记录更新数量
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '✓ 已将 % 条书签的 is_in_trash 从 NULL 更新为 FALSE', updated_count;
  ELSE
    RAISE NOTICE '✓ 无需更新：所有书签的 is_in_trash 字段均已有值';
  END IF;
END $$;

-- -------------------------------------------
-- 2. 更新视图定义（兼容 NULL 值，作为防护措施）
-- -------------------------------------------

CREATE OR REPLACE VIEW v_active_bookmarks AS
SELECT *
FROM bookmarks
WHERE deleted_at IS NULL
  AND (is_in_trash = FALSE OR is_in_trash IS NULL);

COMMENT ON VIEW v_active_bookmarks IS
  '活跃书签视图：自动排除软删除(deleted_at)和垃圾箱(is_in_trash)的书签。
   兼容 is_in_trash 为 NULL 的历史数据。
   更新于: 2025-12-20';

-- -------------------------------------------
-- 3. 验证修复结果
-- -------------------------------------------

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM bookmarks
  WHERE is_in_trash IS NULL;

  IF null_count = 0 THEN
    RAISE NOTICE '✓ 验证通过：无 is_in_trash = NULL 的记录';
  ELSE
    RAISE WARNING '⚠ 仍有 % 条记录的 is_in_trash 为 NULL', null_count;
  END IF;
END $$;

-- -------------------------------------------
-- 回滚脚本（如需回滚，执行以下命令）
-- -------------------------------------------
-- 注意：数据更新无法完全回滚，因为无法区分原本就是 FALSE 还是从 NULL 更新的
-- CREATE OR REPLACE VIEW v_active_bookmarks AS
-- SELECT * FROM bookmarks WHERE deleted_at IS NULL AND is_in_trash = FALSE;

-- -------------------------------------------
-- 完成
-- -------------------------------------------
