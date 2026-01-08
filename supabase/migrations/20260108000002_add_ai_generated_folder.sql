-- Migration: 20260108000002_add_ai_generated_folder.sql
-- Save to Note 功能：添加 AI 生成文件夹支持

-- ============================================
-- 1. 创建获取或创建 AI 生成文件夹的函数
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_ai_generated_folder(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_folder_id BIGINT;
BEGIN
  -- 尝试获取现有的 AI 生成文件夹
  SELECT id INTO v_folder_id
  FROM public.folders
  WHERE user_id = p_user_id
    AND is_system = TRUE
    AND system_type = 'AI_GENERATED'
    AND deleted_at IS NULL
  LIMIT 1;

  -- 如果不存在，则创建
  IF v_folder_id IS NULL THEN
    INSERT INTO public.folders (user_id, name, is_system, system_type, icon, color, sort_order)
    VALUES (p_user_id, 'AI 生成', TRUE, 'AI_GENERATED', '✨', '#8B5CF6', -2)
    RETURNING id INTO v_folder_id;
  END IF;

  RETURN v_folder_id;
END;
$$;

-- ============================================
-- 2. 授予函数执行权限
-- ============================================
GRANT EXECUTE ON FUNCTION get_or_create_ai_generated_folder(UUID) TO authenticated;

-- ============================================
-- 3. 添加防止删除系统文件夹的触发器（如果不存在）
-- ============================================
CREATE OR REPLACE FUNCTION prevent_system_folder_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = TRUE THEN
    RAISE EXCEPTION 'Cannot delete system folder: %', OLD.name;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_system_folder_delete ON folders;
CREATE TRIGGER tr_prevent_system_folder_delete
BEFORE DELETE ON folders
FOR EACH ROW EXECUTE FUNCTION prevent_system_folder_delete();

-- ============================================
-- 4. 添加注释
-- ============================================
COMMENT ON FUNCTION get_or_create_ai_generated_folder(UUID) IS
'获取或创建用户的「AI 生成」系统文件夹，用于存储 AI 助手保存的笔记';
