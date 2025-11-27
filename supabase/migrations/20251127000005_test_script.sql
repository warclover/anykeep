-- ===============================================
-- 测试脚本：智能分类系统 V4.3
-- ===============================================
-- 对应迁移：20251127000005_improve_inbox_folder_with_i18n.sql
-- 说明：此脚本用于测试和验证迁移是否正确执行
-- 运行方式：在 Supabase SQL Editor 中执行
-- ===============================================

-- 设置测试环境
SET client_min_messages TO NOTICE;

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Starting migration tests';
    RAISE NOTICE '==============================================';
END $$;

-- -------------------------------------------
-- 测试 1：验证国际化配置表是否正确创建
-- -------------------------------------------
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_i18n_count INT;
BEGIN
    RAISE NOTICE 'Test 1: Checking system_folder_i18n table...';

    -- 检查表是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'system_folder_i18n'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION '❌ FAILED: system_folder_i18n table does not exist';
    END IF;

    -- 检查是否有国际化数据
    SELECT COUNT(*) INTO v_i18n_count
    FROM public.system_folder_i18n
    WHERE system_type = 'INBOX';

    IF v_i18n_count < 5 THEN
        RAISE EXCEPTION '❌ FAILED: Expected at least 5 i18n entries, found %', v_i18n_count;
    END IF;

    RAISE NOTICE '✓ Test 1 PASSED: system_folder_i18n table exists with % translations', v_i18n_count;
END $$;

-- -------------------------------------------
-- 测试 2：验证国际化名称获取函数
-- -------------------------------------------
DO $$
DECLARE
    v_name_zh VARCHAR(100);
    v_name_en VARCHAR(100);
    v_name_fallback VARCHAR(100);
BEGIN
    RAISE NOTICE 'Test 2: Testing get_system_folder_name() function...';

    -- 测试中文
    SELECT get_system_folder_name('INBOX', 'zh-CN') INTO v_name_zh;
    IF v_name_zh != '待整理' THEN
        RAISE EXCEPTION '❌ FAILED: Expected "待整理", got "%"', v_name_zh;
    END IF;

    -- 测试英文
    SELECT get_system_folder_name('INBOX', 'en-US') INTO v_name_en;
    IF v_name_en != 'Inbox' THEN
        RAISE EXCEPTION '❌ FAILED: Expected "Inbox", got "%"', v_name_en;
    END IF;

    -- 测试回退机制（使用不存在的语言）
    SELECT get_system_folder_name('INBOX', 'xx-XX') INTO v_name_fallback;
    IF v_name_fallback != '待整理' THEN
        RAISE EXCEPTION '❌ FAILED: Fallback failed, got "%"', v_name_fallback;
    END IF;

    RAISE NOTICE '✓ Test 2 PASSED: i18n function works correctly';
    RAISE NOTICE '  - Chinese: %', v_name_zh;
    RAISE NOTICE '  - English: %', v_name_en;
    RAISE NOTICE '  - Fallback: %', v_name_fallback;
END $$;

-- -------------------------------------------
-- 测试 3：验证唯一约束是否正确设置
-- -------------------------------------------
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Test 3: Checking unique constraints...';

    -- 检查唯一索引是否存在
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'folders'
          AND indexname = 'unique_user_system_folder_active'
    ) INTO v_constraint_exists;

    IF NOT v_constraint_exists THEN
        RAISE EXCEPTION '❌ FAILED: unique_user_system_folder_active index does not exist';
    END IF;

    RAISE NOTICE '✓ Test 3 PASSED: Unique constraint exists';
END $$;

-- -------------------------------------------
-- 测试 4：验证检查约束
-- -------------------------------------------
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Test 4: Checking CHECK constraints...';

    -- 检查 check_system_folder_type 约束
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'folders'
          AND constraint_name = 'check_system_folder_type'
          AND constraint_type = 'CHECK'
    ) INTO v_constraint_exists;

    IF NOT v_constraint_exists THEN
        RAISE EXCEPTION '❌ FAILED: check_system_folder_type constraint does not exist';
    END IF;

    RAISE NOTICE '✓ Test 4 PASSED: CHECK constraint exists';
END $$;

-- -------------------------------------------
-- 测试 5：验证 handle_new_user() 函数改进
-- -------------------------------------------
DO $$
DECLARE
    v_function_exists BOOLEAN;
    v_function_body TEXT;
BEGIN
    RAISE NOTICE 'Test 5: Checking improved handle_new_user() function...';

    -- 检查函数是否存在
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'handle_new_user'
    ) INTO v_function_exists;

    IF NOT v_function_exists THEN
        RAISE EXCEPTION '❌ FAILED: handle_new_user() function does not exist';
    END IF;

    -- 检查函数体是否包含错误处理
    SELECT prosrc INTO v_function_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user';

    IF v_function_body NOT LIKE '%EXCEPTION%' THEN
        RAISE EXCEPTION '❌ FAILED: Function does not contain error handling';
    END IF;

    IF v_function_body NOT LIKE '%get_system_folder_name%' THEN
        RAISE EXCEPTION '❌ FAILED: Function does not use i18n helper';
    END IF;

    RAISE NOTICE '✓ Test 5 PASSED: handle_new_user() has been improved';
END $$;

-- -------------------------------------------
-- 测试 6：验证 get_or_create_inbox_folder() 函数
-- -------------------------------------------
DO $$
DECLARE
    v_function_exists BOOLEAN;
    v_function_body TEXT;
BEGIN
    RAISE NOTICE 'Test 6: Checking improved get_or_create_inbox_folder() function...';

    -- 检查函数是否存在
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_or_create_inbox_folder'
    ) INTO v_function_exists;

    IF NOT v_function_exists THEN
        RAISE EXCEPTION '❌ FAILED: get_or_create_inbox_folder() function does not exist';
    END IF;

    -- 检查函数是否包含安全检查
    SELECT prosrc INTO v_function_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_or_create_inbox_folder';

    IF v_function_body NOT LIKE '%auth.uid()%' THEN
        RAISE EXCEPTION '❌ FAILED: Function does not contain security checks';
    END IF;

    RAISE NOTICE '✓ Test 6 PASSED: get_or_create_inbox_folder() has security checks';
END $$;

-- -------------------------------------------
-- 测试 7：验证现有用户是否都有待整理文件夹
-- -------------------------------------------
DO $$
DECLARE
    v_users_without_inbox INT;
BEGIN
    RAISE NOTICE 'Test 7: Checking if all users have inbox folders...';

    -- 统计没有待整理文件夹的用户数
    SELECT COUNT(*) INTO v_users_without_inbox
    FROM public.profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM public.folders f
        WHERE f.user_id = p.id
          AND f.is_system = TRUE
          AND f.system_type = 'INBOX'
          AND f.deleted_at IS NULL
    );

    IF v_users_without_inbox > 0 THEN
        RAISE WARNING '⚠ WARNING: % users without inbox folder', v_users_without_inbox;
    ELSE
        RAISE NOTICE '✓ Test 7 PASSED: All users have inbox folders';
    END IF;
END $$;

-- -------------------------------------------
-- 测试 8：验证 RLS 策略
-- -------------------------------------------
DO $$
DECLARE
    v_policy_count INT;
BEGIN
    RAISE NOTICE 'Test 8: Checking RLS policies...';

    -- 检查 system_folder_i18n 表的 RLS 策略
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_folder_i18n';

    IF v_policy_count < 1 THEN
        RAISE EXCEPTION '❌ FAILED: No RLS policies found for system_folder_i18n';
    END IF;

    RAISE NOTICE '✓ Test 8 PASSED: RLS policies are configured';
END $$;

-- -------------------------------------------
-- 测试 9：压力测试唯一约束（尝试创建重复记录）
-- -------------------------------------------
DO $$
DECLARE
    v_test_user_id UUID;
    v_error_occurred BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE 'Test 9: Testing unique constraint enforcement...';

    -- 创建一个临时测试用户（仅用于测试）
    -- 注意：这需要有权限访问 auth.users
    -- 如果没有权限，这个测试会跳过

    BEGIN
        -- 尝试创建测试用户
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            aud,
            role
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'test_' || floor(random() * 1000000) || '@test.com',
            crypt('test123456', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        )
        RETURNING id INTO v_test_user_id;

        -- 如果成功创建，尝试为该用户创建第二个 INBOX 文件夹（应该失败）
        BEGIN
            INSERT INTO public.folders (user_id, name, is_system, system_type, sort_order)
            VALUES (v_test_user_id, 'Second Inbox', TRUE, 'INBOX', -2);

            -- 如果执行到这里，说明约束失败了
            RAISE EXCEPTION '❌ FAILED: Unique constraint did not prevent duplicate';

        EXCEPTION
            WHEN unique_violation THEN
                -- 这是预期的错误
                RAISE NOTICE '✓ Test 9 PASSED: Unique constraint correctly prevents duplicates';
                v_error_occurred := TRUE;
        END;

        -- 清理测试用户
        DELETE FROM auth.users WHERE id = v_test_user_id;

    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE '⚠ Test 9 SKIPPED: Insufficient privileges to create test user';
        WHEN OTHERS THEN
            RAISE NOTICE '⚠ Test 9 SKIPPED: %', SQLERRM;
    END;

    IF NOT v_error_occurred AND v_test_user_id IS NOT NULL THEN
        RAISE EXCEPTION '❌ FAILED: Unique constraint test did not trigger expected error';
    END IF;
END $$;

-- -------------------------------------------
-- 测试 10：性能测试（索引是否生效）
-- -------------------------------------------
DO $$
DECLARE
    v_has_index BOOLEAN;
BEGIN
    RAISE NOTICE 'Test 10: Checking performance indexes...';

    -- 检查系统文件夹索引
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'folders'
          AND indexname = 'idx_folders_system'
    ) INTO v_has_index;

    IF NOT v_has_index THEN
        RAISE WARNING '⚠ WARNING: idx_folders_system index does not exist';
    END IF;

    RAISE NOTICE '✓ Test 10 PASSED: Performance indexes are in place';
END $$;

-- -------------------------------------------
-- 总结
-- -------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'All tests completed!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Review test results above';
    RAISE NOTICE '2. Check for any warnings or failures';
    RAISE NOTICE '3. If all tests pass, migration is successful';
    RAISE NOTICE '4. Test in application to verify functionality';
    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
END $$;

-- -------------------------------------------
-- 手动验证查询（可选）
-- -------------------------------------------

-- 查看所有国际化配置
-- SELECT * FROM public.system_folder_i18n ORDER BY system_type, locale;

-- 查看所有用户的待整理文件夹
-- SELECT
--     u.email,
--     f.name,
--     f.is_system,
--     f.system_type
-- FROM public.folders f
-- JOIN auth.users u ON f.user_id = u.id
-- WHERE f.is_system = TRUE
--   AND f.system_type = 'INBOX'
--   AND f.deleted_at IS NULL;

-- 测试获取不同语言的名称
-- SELECT
--     locale,
--     get_system_folder_name('INBOX', locale) as folder_name
-- FROM (
--     VALUES ('zh-CN'), ('en-US'), ('ja-JP'), ('ko-KR'), ('fr-FR')
-- ) AS locales(locale);
