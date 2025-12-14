-- ===========================================
-- 修复: favicon 字段不存在问题
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-15
-- 说明: bookmarks 表没有 favicon 字段，修复相关函数
--       使用 NULL 代替，前端可通过 Google Favicon API 获取

-- -------------------------------------------
-- 1. 修复 get_related_bookmarks_with_details 函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.get_related_bookmarks_with_details(
    p_bookmark_id BIGINT,
    p_user_id UUID,
    p_limit INT DEFAULT 10,
    p_min_strength FLOAT DEFAULT 0.3,
    p_link_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    url TEXT,
    favicon TEXT,
    platform TEXT,
    link_type TEXT,
    strength FLOAT,
    shared_items TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH links AS (
        SELECT
            CASE
                WHEN kl.source_bookmark_id = p_bookmark_id THEN kl.target_bookmark_id
                ELSE kl.source_bookmark_id
            END as related_id,
            kl.link_type,
            kl.strength,
            kl.evidence,
            kl.created_at
        FROM public.knowledge_links kl
        WHERE (kl.source_bookmark_id = p_bookmark_id OR kl.target_bookmark_id = p_bookmark_id)
          AND kl.user_id = p_user_id
          AND kl.strength >= p_min_strength
          AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
        ORDER BY kl.strength DESC
        LIMIT p_limit
    )
    SELECT
        b.id as bookmark_id,
        b.title,
        b.url,
        NULL::TEXT as favicon,  -- bookmarks 表没有 favicon 字段
        b.platform,
        l.link_type,
        l.strength,
        COALESCE(
            CASE l.link_type
                WHEN 'entity' THEN (
                    SELECT ARRAY_AGG(e::TEXT)
                    FROM jsonb_array_elements_text(l.evidence->'details'->'sharedEntities') e
                )
                WHEN 'tag' THEN (
                    SELECT ARRAY_AGG(t::TEXT)
                    FROM jsonb_array_elements_text(l.evidence->'details'->'sharedTags') t
                )
                ELSE ARRAY[]::TEXT[]
            END,
            ARRAY[]::TEXT[]
        ) as shared_items,
        l.created_at
    FROM links l
    JOIN public.bookmarks b ON b.id = l.related_id
    WHERE b.deleted_at IS NULL
    ORDER BY l.strength DESC;
END;
$$;

COMMENT ON FUNCTION public.get_related_bookmarks_with_details IS '获取书签的相关内容（带完整详情）- 修复 favicon 字段';

-- -------------------------------------------
-- 2. 修复 get_user_knowledge_links 函数（如果存在）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_knowledge_links(
    p_user_id UUID,
    p_max_nodes INT DEFAULT 100,
    p_min_strength FLOAT DEFAULT 0.3,
    p_link_types TEXT[] DEFAULT NULL,
    p_include_isolated BOOLEAN DEFAULT false
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    url TEXT,
    favicon TEXT,
    platform TEXT,
    link_count BIGINT,
    links JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH bookmark_links AS (
        -- 获取所有符合条件的关联
        SELECT
            CASE
                WHEN kl.source_bookmark_id = b.id THEN kl.target_bookmark_id
                ELSE kl.source_bookmark_id
            END as related_id,
            b.id as bookmark_id,
            kl.link_type,
            kl.strength,
            kl.evidence
        FROM public.bookmarks b
        JOIN public.knowledge_links kl ON (
            kl.source_bookmark_id = b.id OR kl.target_bookmark_id = b.id
        )
        WHERE b.user_id = p_user_id
          AND b.deleted_at IS NULL
          AND kl.strength >= p_min_strength
          AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
    ),
    aggregated AS (
        SELECT
            bl.bookmark_id,
            COUNT(*) as link_count,
            jsonb_agg(jsonb_build_object(
                'targetId', bl.related_id,
                'type', bl.link_type,
                'strength', bl.strength
            )) as links
        FROM bookmark_links bl
        GROUP BY bl.bookmark_id
    )
    SELECT
        b.id as bookmark_id,
        b.title,
        b.url,
        NULL::TEXT as favicon,  -- bookmarks 表没有 favicon 字段
        b.platform,
        COALESCE(a.link_count, 0) as link_count,
        COALESCE(a.links, '[]'::JSONB) as links
    FROM public.bookmarks b
    LEFT JOIN aggregated a ON a.bookmark_id = b.id
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND (p_include_isolated OR a.link_count > 0)
    ORDER BY COALESCE(a.link_count, 0) DESC
    LIMIT p_max_nodes;
END;
$$;

COMMENT ON FUNCTION public.get_user_knowledge_links IS '获取用户知识图谱节点和边 - 修复 favicon 字段';
