-- ===============================================
-- 回滚脚本：智能分类系统 V4.3
-- ===============================================
-- 对应迁移：20251127000005_improve_inbox_folder_with_i18n.sql
-- 说明：此脚本将撤销国际化改进，恢复到原始状态
-- 注意：此操作不会删除已创建的待整理文件夹
-- ===============================================

-- 记录回滚开始
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Starting rollback of migration 20251127000005';
    RAISE NOTICE '==============================================';
END $$;

-- -------------------------------------------
-- 第一部分：删除改进的函数和触发器
-- -------------------------------------------

-- 1.1 删除触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

RAISE NOTICE 'Dropped trigger: on_auth_user_created';

-- 1.2 恢复原始的 handle_new_user() 函数
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

RAISE NOTICE 'Restored original handle_new_user() function';

-- 1.3 重新创建触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

RAISE NOTICE 'Recreated trigger with original function';

-- 1.4 恢复原始的 get_or_create_inbox_folder() 函数
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

RAISE NOTICE 'Restored original get_or_create_inbox_folder() function';

-- -------------------------------------------
-- 第二部分：删除国际化相关组件
-- -------------------------------------------

-- 2.1 删除国际化辅助函数
DROP FUNCTION IF EXISTS get_system_folder_name(VARCHAR, VARCHAR);

RAISE NOTICE 'Dropped function: get_system_folder_name';

-- 2.2 删除国际化配置表的触发器
DROP TRIGGER IF EXISTS update_system_folder_i18n_updated_at ON public.system_folder_i18n;

RAISE NOTICE 'Dropped trigger: update_system_folder_i18n_updated_at';

-- 2.3 删除国际化配置表的 RLS 策略
DROP POLICY IF EXISTS "Authenticated users can read system folder i18n" ON public.system_folder_i18n;

RAISE NOTICE 'Dropped RLS policy on system_folder_i18n';

-- 2.4 删除国际化配置表
DROP TABLE IF EXISTS public.system_folder_i18n CASCADE;

RAISE NOTICE 'Dropped table: system_folder_i18n';

-- -------------------------------------------
-- 第三部分：删除增强的约束
-- -------------------------------------------

-- 3.1 删除检查约束
ALTER TABLE public.folders
DROP CONSTRAINT IF EXISTS check_system_folder_type;

RAISE NOTICE 'Dropped constraint: check_system_folder_type';

-- 3.2 删除新的唯一索引
DROP INDEX IF EXISTS public.unique_user_system_folder_active;

RAISE NOTICE 'Dropped index: unique_user_system_folder_active';

-- 3.3 恢复原始的唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_system_type_unique
ON public.folders(user_id, system_type)
WHERE is_system = TRUE AND deleted_at IS NULL;

RAISE NOTICE 'Restored original unique index: idx_folders_system_type_unique';

-- -------------------------------------------
-- 第四部分：清理数据（可选）
-- -------------------------------------------

-- 注意：以下操作会修改数据，默认注释掉
-- 如果需要将所有待整理文件夹名称统一改回中文，取消注释以下代码：

/*
UPDATE public.folders
SET name = '待整理'
WHERE is_system = TRUE
  AND system_type = 'INBOX'
  AND deleted_at IS NULL;

RAISE NOTICE 'Reset all inbox folder names to Chinese';
*/

-- -------------------------------------------
-- 完成
-- -------------------------------------------

-- 恢复原始架构注释
COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v1.0.0';

-- 记录回滚完成
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Rollback of migration 20251127000005 completed';
    RAISE NOTICE 'Note: Existing inbox folders were NOT deleted';
    RAISE NOTICE 'To reset folder names, uncomment the UPDATE statement';
    RAISE NOTICE '==============================================';
END $$;
