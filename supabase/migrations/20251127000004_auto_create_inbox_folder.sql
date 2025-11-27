-- 智能分类系统 V4.2：用户注册时自动创建"待整理"文件夹
-- 扩展 handle_new_user() 函数功能

-- 1. 修改用户注册触发器函数，添加自动创建"待整理"文件夹的逻辑
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 创建用户 profile
    INSERT INTO public.profiles (id, nickname, membership_type, storage_quota, storage_used)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
        'FREE',
        500,
        0
    );

    -- 自动创建"待整理"系统文件夹
    INSERT INTO public.folders (user_id, name, is_system, system_type, sort_order, folder_group)
    VALUES (NEW.id, '待整理', TRUE, 'INBOX', -1, NULL);

    RETURN NEW;
END;
$$;

-- 2. 为现有用户补充创建"待整理"文件夹（如果不存在）
-- 注意：这是一次性操作，确保所有现有用户都有待整理文件夹
INSERT INTO public.folders (user_id, name, is_system, system_type, sort_order, folder_group)
SELECT
    p.id,
    '待整理',
    TRUE,
    'INBOX',
    -1,
    NULL
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.user_id = p.id
      AND f.is_system = TRUE
      AND f.system_type = 'INBOX'
      AND f.deleted_at IS NULL
)
ON CONFLICT DO NOTHING;

-- 3. 添加注释
COMMENT ON FUNCTION handle_new_user() IS '用户注册时自动创建 profile 和待整理文件夹';
