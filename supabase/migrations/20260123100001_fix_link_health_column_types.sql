-- ============================================
-- 修复 link_health_checks 表的列类型
-- 版本: 1.0.0
-- 日期: 2026-01-23
-- 问题: folder_id 和 bookmark_ids 使用 INTEGER 而非 BIGINT
-- ============================================

-- 1. 修复 folder_id 类型: INTEGER -> BIGINT
-- 需要先删除外键约束，修改类型，再重建外键
DO $$
BEGIN
  -- 检查列是否存在且类型为 integer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'link_health_checks'
    AND column_name = 'folder_id'
    AND data_type = 'integer'
  ) THEN
    -- 删除外键约束（如果存在）
    ALTER TABLE link_health_checks
      DROP CONSTRAINT IF EXISTS link_health_checks_folder_id_fkey;

    -- 修改列类型为 BIGINT
    ALTER TABLE link_health_checks
      ALTER COLUMN folder_id TYPE BIGINT;

    -- 重建外键约束
    ALTER TABLE link_health_checks
      ADD CONSTRAINT link_health_checks_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;

    RAISE NOTICE 'Fixed folder_id column type: INTEGER -> BIGINT';
  ELSE
    RAISE NOTICE 'folder_id column already BIGINT or does not exist';
  END IF;
END $$;

-- 2. 修复 bookmark_ids 类型: INTEGER[] -> BIGINT[]
DO $$
BEGIN
  -- 检查列是否存在且类型为 integer[]
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'link_health_checks'
    AND column_name = 'bookmark_ids'
    AND udt_name = '_int4'  -- integer[] 的内部类型名
  ) THEN
    -- 修改列类型为 BIGINT[]
    ALTER TABLE link_health_checks
      ALTER COLUMN bookmark_ids TYPE BIGINT[];

    RAISE NOTICE 'Fixed bookmark_ids column type: INTEGER[] -> BIGINT[]';
  ELSE
    RAISE NOTICE 'bookmark_ids column already BIGINT[] or does not exist';
  END IF;
END $$;

-- 3. 添加注释说明修复
COMMENT ON COLUMN link_health_checks.folder_id IS '文件夹 ID (BIGINT, 与 folders.id 类型一致)';
COMMENT ON COLUMN link_health_checks.bookmark_ids IS '书签 ID 数组 (BIGINT[], 与 bookmarks.id 类型一致)';
