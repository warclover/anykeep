-- ===========================================
-- V10.0: 创建智能列表表
-- ===========================================
-- 版本: 10.0.0
-- 日期: 2025-12-13
-- 说明: 智能列表功能核心数据表，支持保存筛选条件组合

-- -------------------------------------------
-- 1. 创建 smart_lists 主表
-- -------------------------------------------

CREATE TABLE IF NOT EXISTS public.smart_lists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 基本信息
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'filter',
    color VARCHAR(20) DEFAULT 'default',

    -- 筛选条件 (JSONB，支持完整条件)
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 排序设置
    sort_by VARCHAR(50) DEFAULT 'created_desc',

    -- 显示设置
    view_mode VARCHAR(20) DEFAULT 'inherit',
    sort_order INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_preset BOOLEAN DEFAULT false,

    -- 统计信息
    bookmark_count INT DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- 生命周期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- -------------------------------------------
-- 2. 添加约束
-- -------------------------------------------

-- 唯一约束：同一用户下智能列表名称唯一（软删除后可重用）
-- 注意：PostgreSQL 的 UNIQUE 约束不支持 WHERE 子句，使用唯一索引代替
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_lists_unique_name
    ON public.smart_lists(user_id, name)
    WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 3. 创建索引
-- -------------------------------------------

-- 用户智能列表查询（按排序顺序）
CREATE INDEX IF NOT EXISTS idx_smart_lists_user_active
    ON public.smart_lists(user_id, sort_order)
    WHERE deleted_at IS NULL;

-- 用户置顶智能列表查询
CREATE INDEX IF NOT EXISTS idx_smart_lists_user_pinned
    ON public.smart_lists(user_id, is_pinned DESC, sort_order)
    WHERE deleted_at IS NULL;

-- 用户预设智能列表查询
CREATE INDEX IF NOT EXISTS idx_smart_lists_user_presets
    ON public.smart_lists(user_id, is_preset)
    WHERE deleted_at IS NULL AND is_preset = true;

-- -------------------------------------------
-- 4. 添加字段注释
-- -------------------------------------------

COMMENT ON TABLE public.smart_lists IS '智能列表：保存筛选条件组合的快捷入口';
COMMENT ON COLUMN public.smart_lists.id IS '智能列表ID';
COMMENT ON COLUMN public.smart_lists.user_id IS '所属用户ID';
COMMENT ON COLUMN public.smart_lists.name IS '智能列表名称';
COMMENT ON COLUMN public.smart_lists.description IS '智能列表描述';
COMMENT ON COLUMN public.smart_lists.icon IS '图标名称（Lucide 图标）';
COMMENT ON COLUMN public.smart_lists.color IS '颜色主题（default/blue/green/orange/purple/red/cyan/pink/amber/emerald）';
COMMENT ON COLUMN public.smart_lists.filters IS '筛选条件 JSON（SmartListFilters 类型）';
COMMENT ON COLUMN public.smart_lists.sort_by IS '排序方式（created_desc/created_asc/title_asc/title_desc/rating_desc）';
COMMENT ON COLUMN public.smart_lists.view_mode IS '视图模式（inherit/card/list/compact）';
COMMENT ON COLUMN public.smart_lists.sort_order IS '排列顺序（数值越小越靠前）';
COMMENT ON COLUMN public.smart_lists.is_pinned IS '是否置顶';
COMMENT ON COLUMN public.smart_lists.is_preset IS '是否为系统预设模板';
COMMENT ON COLUMN public.smart_lists.bookmark_count IS '符合条件的书签数量（缓存）';
COMMENT ON COLUMN public.smart_lists.last_accessed_at IS '最后访问时间';
COMMENT ON COLUMN public.smart_lists.created_at IS '创建时间';
COMMENT ON COLUMN public.smart_lists.updated_at IS '更新时间';
COMMENT ON COLUMN public.smart_lists.deleted_at IS '软删除时间';

-- -------------------------------------------
-- 5. 启用 RLS（行级安全策略）
-- -------------------------------------------

ALTER TABLE public.smart_lists ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的智能列表
CREATE POLICY "smart_lists_user_select" ON public.smart_lists
    FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "smart_lists_user_insert" ON public.smart_lists
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "smart_lists_user_update" ON public.smart_lists
    FOR UPDATE
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "smart_lists_user_delete" ON public.smart_lists
    FOR DELETE
    USING (auth.uid() = user_id);

-- -------------------------------------------
-- 6. 创建更新时间触发器
-- -------------------------------------------

-- 创建触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_smart_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_smart_lists_updated_at ON public.smart_lists;
CREATE TRIGGER trigger_smart_lists_updated_at
    BEFORE UPDATE ON public.smart_lists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_smart_lists_updated_at();

-- -------------------------------------------
-- 7. 创建初始化预设智能列表的存储过程
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.init_smart_list_presets(p_user_id UUID)
RETURNS INT AS $$
DECLARE
    inserted_count INT := 0;
BEGIN
    -- 检查用户是否已有预设智能列表
    IF EXISTS (
        SELECT 1 FROM public.smart_lists
        WHERE user_id = p_user_id
        AND is_preset = true
        AND deleted_at IS NULL
    ) THEN
        RETURN 0; -- 已有预设，不重复创建
    END IF;

    -- 插入 6 个预设智能列表
    INSERT INTO public.smart_lists (user_id, name, description, icon, color, filters, sort_by, sort_order, is_preset)
    VALUES
    -- 1. 最近一周
    (p_user_id, '最近一周', '过去7天内收藏的内容', 'calendar', 'blue',
     '{"dateRange": {"type": "relative", "value": 7, "unit": "day"}}'::jsonb,
     'created_desc', 0, true),

    -- 2. 高价值收藏
    (p_user_id, '高价值收藏', '评分为5星的精选内容', 'star', 'amber',
     '{"isHighValue": true}'::jsonb,
     'created_desc', 1, true),

    -- 3. 待阅读
    (p_user_id, '待阅读', '尚未阅读的收藏内容', 'book-open', 'green',
     '{"isRead": false}'::jsonb,
     'created_desc', 2, true),

    -- 4. 优质经验
    (p_user_id, '优质经验', '标记为优质经验的内容', 'award', 'orange',
     '{"usageTags": ["优质经验"]}'::jsonb,
     'created_desc', 3, true),

    -- 5. 推荐关注
    (p_user_id, '推荐关注', '值得持续关注的来源', 'eye', 'purple',
     '{"usageTags": ["值得关注"]}'::jsonb,
     'created_desc', 4, true),

    -- 6. 值得复读
    (p_user_id, '值得复读', '需要反复阅读的精华内容', 'refresh-ccw', 'emerald',
     '{"usageTags": ["值得复读"]}'::jsonb,
     'created_desc', 5, true)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.init_smart_list_presets IS '为用户初始化 6 个预设智能列表模板';

-- -------------------------------------------
-- 完成
-- -------------------------------------------

-- 更新表统计信息
ANALYZE public.smart_lists;
