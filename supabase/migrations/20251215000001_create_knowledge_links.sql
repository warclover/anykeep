-- ===========================================
-- 知识关联 Phase 2 - 知识关联表
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-15
-- 说明: 创建 knowledge_links 表，存储书签之间的知识关联关系
--       支持多种关联类型：语义相似、实体匹配、标签匹配、主题聚类

-- -------------------------------------------
-- 1. 创建知识关联表
-- -------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 关联的两个书签（有序对，source_id < target_id）
    source_bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
    target_bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

    -- 关联信息
    link_type TEXT NOT NULL CHECK (link_type IN (
        'semantic',     -- 语义相似（向量距离）
        'entity',       -- 共享实体
        'tag',          -- 共享标签
        'topic'         -- 同主题聚类
    )),
    strength FLOAT NOT NULL CHECK (strength >= 0 AND strength <= 1),

    -- 关联依据（JSON 格式存储详细信息）
    evidence JSONB NOT NULL DEFAULT '{}',
    -- evidence 结构示例:
    -- {
    --   "type": "entity",
    --   "score": 0.8,
    --   "details": {
    --     "sharedEntities": ["React", "Next.js"],
    --     "similarityScore": null,
    --     "sharedTags": null,
    --     "topicCluster": null
    --   }
    -- }

    -- 生成算法标识
    algorithm TEXT,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 确保不重复（有序对）
    -- 同一对书签同一类型只能有一条关联记录
    UNIQUE(source_bookmark_id, target_bookmark_id, link_type),

    -- 确保有序对：source_id 必须小于 target_id
    -- 这样可以避免 (A,B) 和 (B,A) 重复
    CHECK (source_bookmark_id < target_bookmark_id)
);

-- 添加注释
COMMENT ON TABLE public.knowledge_links IS '知识关联表 - 存储书签之间的关联关系';
COMMENT ON COLUMN public.knowledge_links.source_bookmark_id IS '源书签ID（较小的ID）';
COMMENT ON COLUMN public.knowledge_links.target_bookmark_id IS '目标书签ID（较大的ID）';
COMMENT ON COLUMN public.knowledge_links.link_type IS '关联类型: semantic, entity, tag, topic';
COMMENT ON COLUMN public.knowledge_links.strength IS '关联强度 (0-1)，越高越相关';
COMMENT ON COLUMN public.knowledge_links.evidence IS '关联依据，包含共享实体/标签/相似度等详情';
COMMENT ON COLUMN public.knowledge_links.algorithm IS '生成该关联的算法标识';

-- -------------------------------------------
-- 2. 创建索引
-- -------------------------------------------

-- 用户索引（查询用户所有关联）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_user_id
    ON public.knowledge_links(user_id);

-- 源书签索引（查询某书签的所有关联）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_source
    ON public.knowledge_links(source_bookmark_id);

-- 目标书签索引（查询某书签的所有关联）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_target
    ON public.knowledge_links(target_bookmark_id);

-- 关联强度索引（按强度排序查询）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_strength
    ON public.knowledge_links(strength DESC);

-- 关联类型索引（按类型筛选）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_type
    ON public.knowledge_links(link_type);

-- 用户+类型复合索引（查询用户特定类型的关联）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_user_type
    ON public.knowledge_links(user_id, link_type);

-- 用户+强度复合索引（查询用户强关联）
CREATE INDEX IF NOT EXISTS idx_knowledge_links_user_strength
    ON public.knowledge_links(user_id, strength DESC);

-- -------------------------------------------
-- 3. 启用 RLS
-- -------------------------------------------

ALTER TABLE public.knowledge_links ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的关联
CREATE POLICY "Users can view own links"
    ON public.knowledge_links
    FOR SELECT
    USING (auth.uid() = user_id);

-- 允许服务端插入（使用 service_role）
CREATE POLICY "Service can insert links"
    ON public.knowledge_links
    FOR INSERT
    WITH CHECK (true);

-- 允许服务端更新（用于更新关联强度）
CREATE POLICY "Service can update links"
    ON public.knowledge_links
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 用户可以删除自己的关联
CREATE POLICY "Users can delete own links"
    ON public.knowledge_links
    FOR DELETE
    USING (auth.uid() = user_id);

-- -------------------------------------------
-- 4. 创建辅助函数
-- -------------------------------------------

-- 获取书签的所有关联（双向查询）
CREATE OR REPLACE FUNCTION public.get_bookmark_links(
    p_bookmark_id BIGINT,
    p_user_id UUID DEFAULT NULL,
    p_min_strength FLOAT DEFAULT 0.3,
    p_link_types TEXT[] DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    link_id UUID,
    related_bookmark_id BIGINT,
    link_type TEXT,
    strength FLOAT,
    evidence JSONB,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kl.id as link_id,
        CASE
            WHEN kl.source_bookmark_id = p_bookmark_id THEN kl.target_bookmark_id
            ELSE kl.source_bookmark_id
        END as related_bookmark_id,
        kl.link_type,
        kl.strength,
        kl.evidence,
        kl.created_at
    FROM public.knowledge_links kl
    WHERE (kl.source_bookmark_id = p_bookmark_id OR kl.target_bookmark_id = p_bookmark_id)
      AND kl.strength >= p_min_strength
      AND (p_user_id IS NULL OR kl.user_id = p_user_id)
      AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
    ORDER BY kl.strength DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_bookmark_links IS '获取书签的所有关联，支持按强度和类型筛选';

GRANT EXECUTE ON FUNCTION public.get_bookmark_links TO authenticated;

-- 保存或更新知识关联（处理有序对）
CREATE OR REPLACE FUNCTION public.upsert_knowledge_link(
    p_user_id UUID,
    p_bookmark_id_1 BIGINT,
    p_bookmark_id_2 BIGINT,
    p_link_type TEXT,
    p_strength FLOAT,
    p_evidence JSONB,
    p_algorithm TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source_id BIGINT;
    v_target_id BIGINT;
    v_link_id UUID;
BEGIN
    -- 确保有序对：source_id < target_id
    IF p_bookmark_id_1 < p_bookmark_id_2 THEN
        v_source_id := p_bookmark_id_1;
        v_target_id := p_bookmark_id_2;
    ELSE
        v_source_id := p_bookmark_id_2;
        v_target_id := p_bookmark_id_1;
    END IF;

    -- 插入或更新
    INSERT INTO public.knowledge_links (
        user_id,
        source_bookmark_id,
        target_bookmark_id,
        link_type,
        strength,
        evidence,
        algorithm
    ) VALUES (
        p_user_id,
        v_source_id,
        v_target_id,
        p_link_type,
        p_strength,
        p_evidence,
        p_algorithm
    )
    ON CONFLICT (source_bookmark_id, target_bookmark_id, link_type)
    DO UPDATE SET
        strength = EXCLUDED.strength,
        evidence = EXCLUDED.evidence,
        algorithm = EXCLUDED.algorithm
    RETURNING id INTO v_link_id;

    RETURN v_link_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_knowledge_link IS '保存或更新知识关联，自动处理有序对';

GRANT EXECUTE ON FUNCTION public.upsert_knowledge_link TO authenticated;

-- 批量保存知识关联
CREATE OR REPLACE FUNCTION public.batch_upsert_knowledge_links(
    p_user_id UUID,
    p_links JSONB
    -- p_links 格式:
    -- [
    --   {
    --     "bookmarkId1": 123,
    --     "bookmarkId2": 456,
    --     "linkType": "entity",
    --     "strength": 0.8,
    --     "evidence": {...},
    --     "algorithm": "entity-matching"
    --   }
    -- ]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_link JSONB;
BEGIN
    FOR v_link IN SELECT * FROM jsonb_array_elements(p_links)
    LOOP
        PERFORM public.upsert_knowledge_link(
            p_user_id,
            (v_link->>'bookmarkId1')::BIGINT,
            (v_link->>'bookmarkId2')::BIGINT,
            v_link->>'linkType',
            (v_link->>'strength')::FLOAT,
            COALESCE(v_link->'evidence', '{}'::JSONB),
            v_link->>'algorithm'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.batch_upsert_knowledge_links IS '批量保存知识关联';

GRANT EXECUTE ON FUNCTION public.batch_upsert_knowledge_links TO authenticated;

-- 获取用户知识图谱统计
CREATE OR REPLACE FUNCTION public.get_knowledge_graph_stats(p_user_id UUID)
RETURNS TABLE (
    total_bookmarks BIGINT,
    total_links BIGINT,
    avg_links_per_bookmark FLOAT,
    semantic_links BIGINT,
    entity_links BIGINT,
    tag_links BIGINT,
    topic_links BIGINT,
    strong_links BIGINT,  -- strength >= 0.7
    medium_links BIGINT,  -- 0.4 <= strength < 0.7
    weak_links BIGINT     -- strength < 0.4
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_bookmarks BIGINT;
    v_total_links BIGINT;
BEGIN
    -- 获取用户书签总数
    SELECT COUNT(*) INTO v_total_bookmarks
    FROM public.bookmarks
    WHERE user_id = p_user_id;

    -- 获取用户关联总数
    SELECT COUNT(*) INTO v_total_links
    FROM public.knowledge_links
    WHERE user_id = p_user_id;

    RETURN QUERY
    SELECT
        v_total_bookmarks as total_bookmarks,
        v_total_links as total_links,
        CASE
            WHEN v_total_bookmarks > 0 THEN (v_total_links::FLOAT * 2) / v_total_bookmarks
            ELSE 0
        END as avg_links_per_bookmark,
        COUNT(*) FILTER (WHERE link_type = 'semantic') as semantic_links,
        COUNT(*) FILTER (WHERE link_type = 'entity') as entity_links,
        COUNT(*) FILTER (WHERE link_type = 'tag') as tag_links,
        COUNT(*) FILTER (WHERE link_type = 'topic') as topic_links,
        COUNT(*) FILTER (WHERE strength >= 0.7) as strong_links,
        COUNT(*) FILTER (WHERE strength >= 0.4 AND strength < 0.7) as medium_links,
        COUNT(*) FILTER (WHERE strength < 0.4) as weak_links
    FROM public.knowledge_links
    WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_knowledge_graph_stats IS '获取用户知识图谱统计数据';

GRANT EXECUTE ON FUNCTION public.get_knowledge_graph_stats TO authenticated;

-- 删除书签的所有关联（级联删除时自动触发，也可手动调用）
CREATE OR REPLACE FUNCTION public.delete_bookmark_links(p_bookmark_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM public.knowledge_links
    WHERE source_bookmark_id = p_bookmark_id
       OR target_bookmark_id = p_bookmark_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.delete_bookmark_links IS '删除书签的所有关联';

GRANT EXECUTE ON FUNCTION public.delete_bookmark_links TO authenticated;
