-- ===========================================
-- 批量减少存储使用量函数
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-24
-- 说明: 支持批量删除时一次性减少多个收藏的存储计数

-- 覆盖原有的 decrement_storage_used 函数，添加可选的 decrement_by 参数
CREATE OR REPLACE FUNCTION decrement_storage_used(
    target_user_id uuid,
    decrement_by integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET storage_used = GREATEST(storage_used - decrement_by, 0),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;

COMMENT ON FUNCTION decrement_storage_used(uuid, integer) IS '减少用户存储使用量，支持批量减少';
