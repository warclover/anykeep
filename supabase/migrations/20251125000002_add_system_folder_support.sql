-- 智能分类系统 V4.2：添加系统文件夹支持
-- 用于实现"待整理"等系统级文件夹

-- 1. 添加系统文件夹字段
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS system_type VARCHAR(50);

-- 2. 添加注释
COMMENT ON COLUMN public.folders.is_system IS '是否为系统文件夹（不可删除、不可重命名）';
COMMENT ON COLUMN public.folders.system_type IS '系统文件夹类型：INBOX(待整理)';

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_folders_system
ON public.folders(user_id, is_system)
WHERE deleted_at IS NULL;

-- 4. 创建唯一约束：每个用户每种系统文件夹类型只能有一个
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_system_type_unique
ON public.folders(user_id, system_type)
WHERE is_system = TRUE AND deleted_at IS NULL;

-- 5. 创建获取或创建待整理文件夹的函数
CREATE OR REPLACE FUNCTION get_or_create_inbox_folder(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_folder_id BIGINT;
BEGIN
  -- 尝试获取现有的待整理文件夹
  SELECT id INTO v_folder_id
  FROM public.folders
  WHERE user_id = p_user_id
    AND is_system = TRUE
    AND system_type = 'INBOX'
    AND deleted_at IS NULL
  LIMIT 1;

  -- 如果不存在，则创建
  IF v_folder_id IS NULL THEN
    INSERT INTO public.folders (user_id, name, is_system, system_type, sort_order)
    VALUES (p_user_id, '待整理', TRUE, 'INBOX', -1)
    RETURNING id INTO v_folder_id;
  END IF;

  RETURN v_folder_id;
END;
$$;

-- 6. 授予函数执行权限
GRANT EXECUTE ON FUNCTION get_or_create_inbox_folder(UUID) TO authenticated;
