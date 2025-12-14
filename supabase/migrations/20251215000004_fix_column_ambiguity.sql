-- ===========================================
-- 修复: 列名歧义问题
-- ===========================================
-- 版本: 1.0.1
-- 日期: 2025-12-15
-- 说明: 修复 CTE 列名与 RETURNS TABLE 冲突

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
    WITH links_cte AS (
        SELECT
            CASE
                WHEN kl.source_bookmark_id = p_bookmark_id THEN kl.target_bookmark_id
                ELSE kl.source_bookmark_id
            END as cte_related_id,
            kl.link_type as cte_link_type,
            kl.strength as cte_strength,
            kl.evidence as cte_evidence,
            kl.created_at as cte_created_at
        FROM public.knowledge_links kl
        WHERE (kl.source_bookmark_id = p_bookmark_id OR kl.target_bookmark_id = p_bookmark_id)
          AND kl.user_id = p_user_id
          AND kl.strength >= p_min_strength
          AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
        ORDER BY kl.strength DESC
        LIMIT p_limit
    )
    SELECT
        b.id::BIGINT as bookmark_id,
        b.title::TEXT as title,
        b.url::TEXT as url,
        NULL::TEXT as favicon,
        b.platform::TEXT as platform,
        lc.cte_link_type::TEXT as link_type,
        lc.cte_strength::FLOAT as strength,
        COALESCE(
            CASE lc.cte_link_type
                WHEN 'entity' THEN (
                    SELECT ARRAY_AGG(e::TEXT)
                    FROM jsonb_array_elements_text(lc.cte_evidence->'details'->'sharedEntities') e
                )
                WHEN 'tag' THEN (
                    SELECT ARRAY_AGG(t::TEXT)
                    FROM jsonb_array_elements_text(lc.cte_evidence->'details'->'sharedTags') t
                )
                ELSE ARRAY[]::TEXT[]
            END,
            ARRAY[]::TEXT[]
        )::TEXT[] as shared_items,
        lc.cte_created_at as created_at
    FROM links_cte lc
    JOIN public.bookmarks b ON b.id = lc.cte_related_id
    WHERE b.deleted_at IS NULL
    ORDER BY lc.cte_strength DESC;
END;
$$;

COMMENT ON FUNCTION public.get_related_bookmarks_with_details IS '获取书签的相关内容（带完整详情）- v1.0.1 修复列名歧义';

-- -------------------------------------------
-- 2. 修复 get_user_knowledge_links 函数
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
    WITH bookmark_links_cte AS (
        SELECT
            CASE
                WHEN kl.source_bookmark_id = b.id THEN kl.target_bookmark_id
                ELSE kl.source_bookmark_id
            END as cte_related_id,
            b.id as cte_bookmark_id,
            kl.link_type as cte_link_type,
            kl.strength as cte_strength
        FROM public.bookmarks b
        JOIN public.knowledge_links kl ON (
            kl.source_bookmark_id = b.id OR kl.target_bookmark_id = b.id
        )
        WHERE b.user_id = p_user_id
          AND b.deleted_at IS NULL
          AND kl.strength >= p_min_strength
          AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
    ),
    aggregated_cte AS (
        SELECT
            bl.cte_bookmark_id as agg_bookmark_id,
            COUNT(*)::BIGINT as agg_link_count,
            jsonb_agg(jsonb_build_object(
                'targetId', bl.cte_related_id,
                'type', bl.cte_link_type,
                'strength', bl.cte_strength
            )) as agg_links
        FROM bookmark_links_cte bl
        GROUP BY bl.cte_bookmark_id
    )
    SELECT
        b.id::BIGINT as bookmark_id,
        b.title::TEXT as title,
        b.url::TEXT as url,
        NULL::TEXT as favicon,
        b.platform::TEXT as platform,
        COALESCE(a.agg_link_count, 0::BIGINT) as link_count,
        COALESCE(a.agg_links, '[]'::JSONB) as links
    FROM public.bookmarks b
    LEFT JOIN aggregated_cte a ON a.agg_bookmark_id = b.id
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND (p_include_isolated OR a.agg_link_count > 0)
    ORDER BY COALESCE(a.agg_link_count, 0) DESC
    LIMIT p_max_nodes;
END;
$$;

COMMENT ON FUNCTION public.get_user_knowledge_links IS '获取用户知识图谱节点和边 - v1.0.1 修复列名歧义';
