-- Migration: 添加文件夹路径查询函数
-- Description: 使用 CTE 递归查询替代客户端递归，优化详情页性能
-- Author: AI Assistant
-- Date: 2025-12-17

-- ============================================================================
-- 创建文件夹路径查询函数
-- ============================================================================

-- 函数：获取文件夹完整路径（从根到当前）
-- 返回：按层级排序的文件夹路径数组
CREATE OR REPLACE FUNCTION get_folder_path(p_folder_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  depth INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE folder_path AS (
    -- 基础情况：从目标文件夹开始
    SELECT
      f.id,
      f.name,
      f.parent_id,
      0 AS depth
    FROM folders f
    WHERE f.id = p_folder_id

    UNION ALL

    -- 递归情况：向上遍历父文件夹
    SELECT
      f.id,
      f.name,
      f.parent_id,
      fp.depth + 1
    FROM folders f
    INNER JOIN folder_path fp ON f.id = fp.parent_id
  )
  -- 按深度降序排列（根文件夹在前，当前文件夹在后）
  SELECT
    folder_path.id,
    folder_path.name,
    folder_path.depth
  FROM folder_path
  ORDER BY depth DESC;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_folder_path(INTEGER) IS
'获取文件夹的完整路径，从根文件夹到目标文件夹。
使用 CTE 递归查询，单次数据库往返替代多次客户端递归查询。
返回按层级排序的路径数组（根在前，目标在后）。';

-- ============================================================================
-- 授予执行权限
-- ============================================================================

-- 允许认证用户执行此函数
GRANT EXECUTE ON FUNCTION get_folder_path(INTEGER) TO authenticated;
