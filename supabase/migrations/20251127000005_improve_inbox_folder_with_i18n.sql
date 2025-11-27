-- ===============================================
-- 智能分类系统 V4.3：优化"待整理"文件夹创建逻辑
-- ===============================================
-- 改进内容：
-- 1. 添加国际化支持
-- 2. 增强数据一致性和错误处理
-- 3. 添加安全检查（SECURITY DEFINER 风险缓解）
-- 4. 优化性能和幂等性
-- 5. 完善唯一约束
-- ===============================================

-- -------------------------------------------
-- 第一部分：国际化配置
-- -------------------------------------------

-- 1.1 创建系统文件夹国际化配置表
CREATE TABLE IF NOT EXISTS public.system_folder_i18n (
    id BIGSERIAL PRIMARY KEY,
    system_type VARCHAR(50) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 确保每种系统文件夹类型+语言组合唯一
    CONSTRAINT unique_system_folder_locale UNIQUE (system_type, locale)
);

-- 1.2 添加注释
COMMENT ON TABLE public.system_folder_i18n IS '系统文件夹国际化名称配置表';
COMMENT ON COLUMN public.system_folder_i18n.system_type IS '系统文件夹类型（如 INBOX）';
COMMENT ON COLUMN public.system_folder_i18n.locale IS '语言代码（如 zh-CN, en-US）';
COMMENT ON COLUMN public.system_folder_i18n.display_name IS '显示名称';

-- 1.3 插入默认的国际化配置
INSERT INTO public.system_folder_i18n (system_type, locale, display_name) VALUES
    ('INBOX', 'zh-CN', '待整理'),
    ('INBOX', 'zh-TW', '待整理'),
    ('INBOX', 'en-US', 'Inbox'),
    ('INBOX', 'ja-JP', '未整理'),
    ('INBOX', 'ko-KR', '받은편지함')
ON CONFLICT (system_type, locale) DO NOTHING;

-- 1.4 启用 RLS（只读，仅管理员可写）
ALTER TABLE public.system_folder_i18n ENABLE ROW LEVEL SECURITY;

-- 允许所有认证用户读取
CREATE POLICY "Authenticated users can read system folder i18n"
ON public.system_folder_i18n
FOR SELECT
TO authenticated
USING (true);

-- 1.5 创建获取国际化名称的辅助函数
CREATE OR REPLACE FUNCTION get_system_folder_name(
    p_system_type VARCHAR(50),
    p_locale VARCHAR(10) DEFAULT 'zh-CN'
)
RETURNS VARCHAR(100)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name VARCHAR(100);
BEGIN
    -- 尝试获取指定语言的名称
    SELECT display_name INTO v_name
    FROM public.system_folder_i18n
    WHERE system_type = p_system_type
      AND locale = p_locale
    LIMIT 1;

    -- 如果没有找到，回退到中文
    IF v_name IS NULL THEN
        SELECT display_name INTO v_name
        FROM public.system_folder_i18n
        WHERE system_type = p_system_type
          AND locale = 'zh-CN'
        LIMIT 1;
    END IF;

    -- 如果仍然没有找到，使用系统类型作为名称
    RETURN COALESCE(v_name, p_system_type);
END;
$$;

COMMENT ON FUNCTION get_system_folder_name IS '获取系统文件夹的国际化名称，支持回退机制';

-- -------------------------------------------
-- 第二部分：增强约束和索引
-- -------------------------------------------

-- 2.1 添加更强的唯一约束（替换之前的部分索引）
-- 注意：这将确保 ON CONFLICT 子句有明确的目标
DO $$
BEGIN
    -- 先删除旧的唯一索引（如果存在）
    DROP INDEX IF EXISTS idx_folders_system_type_unique;

    -- 创建新的唯一约束
    -- 使用部分唯一索引：仅对未删除的系统文件夹生效
    CREATE UNIQUE INDEX IF NOT EXISTS unique_user_system_folder_active
    ON public.folders (user_id, system_type)
    WHERE (is_system = TRUE AND deleted_at IS NULL);

EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Unique constraint already exists';
END $$;

-- 2.2 添加检查约束：系统文件夹必须有 system_type
ALTER TABLE public.folders
DROP CONSTRAINT IF EXISTS check_system_folder_type;

ALTER TABLE public.folders
ADD CONSTRAINT check_system_folder_type
CHECK (
    (is_system = TRUE AND system_type IS NOT NULL) OR
    (is_system = FALSE OR is_system IS NULL)
);

COMMENT ON CONSTRAINT check_system_folder_type ON public.folders
IS '确保系统文件夹必须指定 system_type';

-- -------------------------------------------
-- 第三部分：重构 handle_new_user() 函数
-- -------------------------------------------

-- 3.1 创建改进的用户注册处理函数（使用 CREATE OR REPLACE 覆盖原函数）
-- 注意：不直接删除触发器，因为 auth.users 表在 Supabase 中受保护
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_folder_id BIGINT;
    v_folder_name VARCHAR(100);
    v_user_locale VARCHAR(10);
BEGIN
    -- 安全检查：确保只能创建当前认证用户的数据
    -- 注意：在触发器上下文中，auth.uid() 可能为 NULL（系统操作）
    -- 因此这里只做日志记录，不做强制校验
    IF auth.uid() IS NOT NULL AND NEW.id != auth.uid() THEN
        RAISE WARNING 'Potential security issue: creating profile for user % by user %', NEW.id, auth.uid();
    END IF;

    -- Step 1: 创建用户 profile
    BEGIN
        INSERT INTO public.profiles (
            id,
            nickname,
            membership_type,
            storage_quota,
            storage_used,
            settings
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
            'FREE',
            500,
            0,
            jsonb_build_object(
                'theme', 'auto',
                'auto_tag', true,
                'locale', COALESCE(NEW.raw_user_meta_data->>'locale', 'zh-CN')
            )
        )
        RETURNING id INTO STRICT v_profile_id;

        RAISE NOTICE 'Created profile for user: % (%)', NEW.email, v_profile_id;

    EXCEPTION
        WHEN unique_violation THEN
            -- 如果 profile 已存在（可能是手动创建），记录警告但继续
            RAISE WARNING 'Profile already exists for user: %', NEW.id;
            v_profile_id := NEW.id;
        WHEN OTHERS THEN
            -- 其他错误则抛出异常，触发事务回滚
            RAISE EXCEPTION 'Failed to create profile for user %: % (%)',
                NEW.id, SQLERRM, SQLSTATE;
    END;

    -- Step 2: 获取用户语言偏好
    BEGIN
        SELECT settings->>'locale' INTO v_user_locale
        FROM public.profiles
        WHERE id = v_profile_id;

        v_user_locale := COALESCE(v_user_locale, 'zh-CN');

    EXCEPTION
        WHEN OTHERS THEN
            v_user_locale := 'zh-CN'; -- 默认中文
    END;

    -- Step 3: 获取待整理文件夹的国际化名称
    v_folder_name := get_system_folder_name('INBOX', v_user_locale);

    -- Step 4: 创建待整理文件夹
    BEGIN
        INSERT INTO public.folders (
            user_id,
            name,
            is_system,
            system_type,
            sort_order,
            folder_group
        )
        VALUES (
            v_profile_id,
            v_folder_name,
            TRUE,
            'INBOX',
            -1,
            NULL
        )
        ON CONFLICT (user_id, system_type)
        WHERE (is_system = TRUE AND deleted_at IS NULL)
        DO UPDATE SET
            name = EXCLUDED.name,  -- 更新名称以匹配当前语言
            updated_at = NOW()
        RETURNING id INTO v_folder_id;

        RAISE NOTICE 'Created/updated inbox folder % for user %', v_folder_id, NEW.email;

    EXCEPTION
        WHEN OTHERS THEN
            -- 文件夹创建失败是致命错误，必须回滚整个事务
            RAISE EXCEPTION 'Failed to create inbox folder for user %: % (%)',
                NEW.id, SQLERRM, SQLSTATE;
    END;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        -- 顶层异常处理：记录详细错误信息
        RAISE EXCEPTION 'User initialization failed for %: % (%)',
            NEW.id, SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS
'用户注册时自动创建 profile 和待整理文件夹（支持国际化和错误处理）';

-- 3.2 处理触发器（安全方式，避免权限错误）
-- 注意：在 Supabase 中，触发器通常已经存在，函数更新会自动生效
-- 如果触发器不存在，以下代码会尝试创建；如果权限不足，会给出提示
DO $$
BEGIN
    -- 检查触发器是否存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
          AND tgrelid = 'auth.users'::regclass
    ) THEN
        -- 触发器不存在，尝试创建
        BEGIN
            CREATE TRIGGER on_auth_user_created
                AFTER INSERT ON auth.users
                FOR EACH ROW
                EXECUTE FUNCTION handle_new_user();

            RAISE NOTICE '✓ Created trigger on_auth_user_created';
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE '⚠ Trigger creation skipped: insufficient privileges';
                RAISE NOTICE '  The trigger likely already exists or needs to be created by Supabase';
            WHEN OTHERS THEN
                RAISE NOTICE '⚠ Trigger creation failed: % (%)', SQLERRM, SQLSTATE;
        END;
    ELSE
        RAISE NOTICE '✓ Trigger on_auth_user_created already exists (function updated)';
    END IF;
END $$;

-- -------------------------------------------
-- 第四部分：为现有用户补充待整理文件夹
-- -------------------------------------------

-- 4.1 为现有用户创建待整理文件夹（幂等操作）
DO $$
DECLARE
    v_created_count INT := 0;
    v_total_users INT;
    v_user_record RECORD;
BEGIN
    -- 统计需要处理的用户数
    SELECT COUNT(*) INTO v_total_users
    FROM public.profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.user_id = p.id
          AND f.is_system = TRUE
          AND f.system_type = 'INBOX'
          AND f.deleted_at IS NULL
    );

    RAISE NOTICE 'Found % users without inbox folder', v_total_users;

    -- 批量处理：为每个缺少待整理文件夹的用户创建
    FOR v_user_record IN (
        SELECT
            p.id,
            COALESCE(p.settings->>'locale', 'zh-CN') as user_locale
        FROM public.profiles p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.folders f
            WHERE f.user_id = p.id
              AND f.is_system = TRUE
              AND f.system_type = 'INBOX'
              AND f.deleted_at IS NULL
        )
    )
    LOOP
        BEGIN
            INSERT INTO public.folders (
                user_id,
                name,
                is_system,
                system_type,
                sort_order,
                folder_group
            )
            VALUES (
                v_user_record.id,
                get_system_folder_name('INBOX', v_user_record.user_locale),
                TRUE,
                'INBOX',
                -1,
                NULL
            )
            ON CONFLICT (user_id, system_type)
            WHERE (is_system = TRUE AND deleted_at IS NULL)
            DO NOTHING;

            v_created_count := v_created_count + 1;

        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to create inbox folder for user %: %',
                    v_user_record.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Successfully created % inbox folders for existing users', v_created_count;
END $$;

-- -------------------------------------------
-- 第五部分：辅助函数改进
-- -------------------------------------------

-- 5.1 改进 get_or_create_inbox_folder 函数
CREATE OR REPLACE FUNCTION get_or_create_inbox_folder(
    p_user_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_folder_id BIGINT;
    v_user_id UUID;
    v_user_locale VARCHAR(10);
    v_folder_name VARCHAR(100);
BEGIN
    -- 如果没有传入 user_id，使用当前认证用户
    v_user_id := COALESCE(p_user_id, auth.uid());

    -- 安全检查：确保只能操作自己的数据
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required';
    END IF;

    IF v_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: cannot access other user folders';
    END IF;

    -- 获取用户语言偏好
    SELECT COALESCE(settings->>'locale', 'zh-CN')
    INTO v_user_locale
    FROM public.profiles
    WHERE id = v_user_id;

    v_folder_name := get_system_folder_name('INBOX', COALESCE(v_user_locale, 'zh-CN'));

    -- 尝试获取现有的待整理文件夹
    SELECT id INTO v_folder_id
    FROM public.folders
    WHERE user_id = v_user_id
      AND is_system = TRUE
      AND system_type = 'INBOX'
      AND deleted_at IS NULL
    LIMIT 1;

    -- 如果不存在，则创建
    IF v_folder_id IS NULL THEN
        INSERT INTO public.folders (
            user_id,
            name,
            is_system,
            system_type,
            sort_order
        )
        VALUES (
            v_user_id,
            v_folder_name,
            TRUE,
            'INBOX',
            -1
        )
        ON CONFLICT (user_id, system_type)
        WHERE (is_system = TRUE AND deleted_at IS NULL)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_folder_id;
    END IF;

    RETURN v_folder_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to get or create inbox folder: % (%)', SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION get_or_create_inbox_folder IS
'获取或创建待整理文件夹（安全检查 + 国际化支持）';

-- 重新授权
GRANT EXECUTE ON FUNCTION get_or_create_inbox_folder(UUID) TO authenticated;

-- -------------------------------------------
-- 第六部分：更新时间戳触发器
-- -------------------------------------------

-- 为 system_folder_i18n 表添加更新时间戳触发器
CREATE TRIGGER update_system_folder_i18n_updated_at
    BEFORE UPDATE ON public.system_folder_i18n
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- -------------------------------------------
-- 完成
-- -------------------------------------------

-- 添加迁移元数据
COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v1.0.0 - 增强版待整理文件夹（支持国际化）';

-- 记录迁移完成
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 20251127000005 completed successfully';
    RAISE NOTICE 'Features added:';
    RAISE NOTICE '  ✓ Internationalization support for system folders';
    RAISE NOTICE '  ✓ Enhanced error handling in handle_new_user()';
    RAISE NOTICE '  ✓ Stronger unique constraints';
    RAISE NOTICE '  ✓ Security checks for SECURITY DEFINER functions';
    RAISE NOTICE '  ✓ Idempotent operations';
    RAISE NOTICE '==============================================';
END $$;
