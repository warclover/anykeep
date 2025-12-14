-- ===========================================
-- 智能浓缩 v3.0 - 实体存储表
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-14
-- 说明: 创建 bookmark_entities 表，存储从书签内容中提取的实体
--       用于知识关联 (Phase 2) 的实体匹配

-- -------------------------------------------
-- 1. 创建实体表
-- -------------------------------------------

CREATE TABLE IF NOT EXISTS public.bookmark_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 实体信息
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'person',      -- 人名
        'company',     -- 公司/组织
        'tech',        -- 技术/框架
        'concept',     -- 概念/术语
        'product',     -- 产品
        'place',       -- 地点
        'other'        -- 其他
    )),
    normalized_name TEXT NOT NULL,   -- 小写标准化名称，用于匹配
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一约束：同一书签中同名同类型的实体只保留一个
    UNIQUE(bookmark_id, normalized_name, type)
);

-- 添加注释
COMMENT ON TABLE public.bookmark_entities IS '书签实体表 - 存储从内容中提取的实体（人名、公司、技术等）';
COMMENT ON COLUMN public.bookmark_entities.name IS '实体原始名称';
COMMENT ON COLUMN public.bookmark_entities.type IS '实体类型: person, company, tech, concept, product, place, other';
COMMENT ON COLUMN public.bookmark_entities.normalized_name IS '标准化名称（小写），用于跨书签匹配';
COMMENT ON COLUMN public.bookmark_entities.confidence IS '提取置信度 (0-1)';

-- -------------------------------------------
-- 2. 创建索引
-- -------------------------------------------

-- 用户索引（查询用户所有实体）
CREATE INDEX IF NOT EXISTS idx_bookmark_entities_user_id
    ON public.bookmark_entities(user_id);

-- 书签索引（查询书签的所有实体）
CREATE INDEX IF NOT EXISTS idx_bookmark_entities_bookmark_id
    ON public.bookmark_entities(bookmark_id);

-- 标准化名称索引（实体匹配查询）
CREATE INDEX IF NOT EXISTS idx_bookmark_entities_normalized_name
    ON public.bookmark_entities(normalized_name);

-- 用户+标准化名称复合索引（跨书签实体匹配）
CREATE INDEX IF NOT EXISTS idx_bookmark_entities_user_normalized
    ON public.bookmark_entities(user_id, normalized_name);

-- 类型索引（按类型筛选）
CREATE INDEX IF NOT EXISTS idx_bookmark_entities_type
    ON public.bookmark_entities(type);

-- -------------------------------------------
-- 3. 启用 RLS
-- -------------------------------------------

ALTER TABLE public.bookmark_entities ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的实体
CREATE POLICY "Users can view own entities"
    ON public.bookmark_entities
    FOR SELECT
    USING (auth.uid() = user_id);

-- 允许服务端插入（使用 service_role）
CREATE POLICY "Service can insert entities"
    ON public.bookmark_entities
    FOR INSERT
    WITH CHECK (true);

-- 用户可以删除自己的实体
CREATE POLICY "Users can delete own entities"
    ON public.bookmark_entities
    FOR DELETE
    USING (auth.uid() = user_id);

-- -------------------------------------------
-- 4. 创建辅助函数
-- -------------------------------------------

-- 批量保存书签实体（替换现有实体）
CREATE OR REPLACE FUNCTION public.save_bookmark_entities(
    p_bookmark_id BIGINT,
    p_user_id UUID,
    p_entities JSONB  -- [{"name": "实体名", "type": "tech", "confidence": 0.9}, ...]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_entity JSONB;
BEGIN
    -- 删除该书签的现有实体
    DELETE FROM public.bookmark_entities
    WHERE bookmark_id = p_bookmark_id;

    -- 插入新实体
    FOR v_entity IN SELECT * FROM jsonb_array_elements(p_entities)
    LOOP
        INSERT INTO public.bookmark_entities (
            bookmark_id,
            user_id,
            name,
            type,
            normalized_name,
            confidence
        ) VALUES (
            p_bookmark_id,
            p_user_id,
            v_entity->>'name',
            v_entity->>'type',
            LOWER(TRIM(v_entity->>'name')),
            COALESCE((v_entity->>'confidence')::FLOAT, 1.0)
        )
        ON CONFLICT (bookmark_id, normalized_name, type) DO UPDATE
        SET
            name = EXCLUDED.name,
            confidence = EXCLUDED.confidence;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.save_bookmark_entities IS '批量保存书签实体，替换现有实体';

GRANT EXECUTE ON FUNCTION public.save_bookmark_entities TO authenticated;

-- 获取书签的实体列表
CREATE OR REPLACE FUNCTION public.get_bookmark_entities(p_bookmark_id BIGINT)
RETURNS TABLE (
    name TEXT,
    type TEXT,
    confidence FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.name,
        e.type,
        e.confidence
    FROM public.bookmark_entities e
    WHERE e.bookmark_id = p_bookmark_id
    ORDER BY e.confidence DESC, e.name;
END;
$$;

COMMENT ON FUNCTION public.get_bookmark_entities IS '获取书签的实体列表';

GRANT EXECUTE ON FUNCTION public.get_bookmark_entities TO authenticated;

-- 查找共享实体的书签（用于知识关联 Phase 2）
CREATE OR REPLACE FUNCTION public.find_bookmarks_by_shared_entities(
    p_user_id UUID,
    p_entity_names TEXT[],
    p_exclude_bookmark_id BIGINT DEFAULT NULL,
    p_min_shared INT DEFAULT 1,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    bookmark_id BIGINT,
    shared_entities TEXT[],
    shared_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.bookmark_id,
        ARRAY_AGG(DISTINCT e.name) as shared_entities,
        COUNT(DISTINCT e.normalized_name)::INT as shared_count
    FROM public.bookmark_entities e
    WHERE e.user_id = p_user_id
      AND e.normalized_name = ANY(
          SELECT LOWER(TRIM(unnest(p_entity_names)))
      )
      AND (p_exclude_bookmark_id IS NULL OR e.bookmark_id != p_exclude_bookmark_id)
    GROUP BY e.bookmark_id
    HAVING COUNT(DISTINCT e.normalized_name) >= p_min_shared
    ORDER BY shared_count DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_bookmarks_by_shared_entities IS '查找共享实体的书签，用于知识关联';

GRANT EXECUTE ON FUNCTION public.find_bookmarks_by_shared_entities TO authenticated;
