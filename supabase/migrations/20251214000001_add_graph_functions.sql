-- ===========================================
-- 知识图谱扩展函数
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-14
-- 说明: 添加知识图谱可视化和分析所需的数据库函数

-- -------------------------------------------
-- 1. 获取用户所有知识关联（用于图谱可视化）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_knowledge_links(
    p_user_id UUID,
    p_min_strength FLOAT DEFAULT 0.3,
    p_link_types TEXT[] DEFAULT NULL,
    p_limit INT DEFAULT 1000
)
RETURNS TABLE (
    source_bookmark_id BIGINT,
    target_bookmark_id BIGINT,
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
        kl.source_bookmark_id,
        kl.target_bookmark_id,
        kl.link_type,
        kl.strength,
        kl.evidence,
        kl.created_at
    FROM public.knowledge_links kl
    WHERE kl.user_id = p_user_id
      AND kl.strength >= p_min_strength
      AND (p_link_types IS NULL OR kl.link_type = ANY(p_link_types))
    ORDER BY kl.strength DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_user_knowledge_links IS '获取用户所有知识关联，用于图谱可视化';

GRANT EXECUTE ON FUNCTION public.get_user_knowledge_links TO authenticated;

-- -------------------------------------------
-- 2. 获取相关书签（带详情）
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
    shared_items TEXT[]
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
            kl.evidence
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
        b.favicon,
        b.platform,
        l.link_type,
        l.strength,
        COALESCE(
            CASE
                WHEN l.link_type = 'entity' THEN
                    ARRAY(SELECT jsonb_array_elements_text(l.evidence->'details'->'sharedEntities'))
                WHEN l.link_type = 'tag' THEN
                    ARRAY(SELECT jsonb_array_elements_text(l.evidence->'details'->'sharedTags'))
                ELSE ARRAY[]::TEXT[]
            END,
            ARRAY[]::TEXT[]
        ) as shared_items
    FROM links l
    JOIN public.bookmarks b ON b.id = l.related_id
    WHERE b.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_related_bookmarks_with_details IS '获取书签的相关内容，带标题、URL等详情';

GRANT EXECUTE ON FUNCTION public.get_related_bookmarks_with_details TO authenticated;

-- -------------------------------------------
-- 3. 获取中心节点（连接最多的书签）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.get_central_bookmarks(
    p_user_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    url TEXT,
    platform TEXT,
    connection_count BIGINT,
    avg_strength FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH bookmark_connections AS (
        SELECT
            b.id as bid,
            COUNT(kl.id) as conn_count,
            COALESCE(AVG(kl.strength), 0) as avg_str
        FROM public.bookmarks b
        LEFT JOIN public.knowledge_links kl
            ON (kl.source_bookmark_id = b.id OR kl.target_bookmark_id = b.id)
            AND kl.user_id = p_user_id
        WHERE b.user_id = p_user_id
        GROUP BY b.id
        HAVING COUNT(kl.id) > 0
        ORDER BY conn_count DESC, avg_str DESC
        LIMIT p_limit
    )
    SELECT
        b.id as bookmark_id,
        b.title,
        b.url,
        b.platform,
        bc.conn_count as connection_count,
        bc.avg_str as avg_strength
    FROM bookmark_connections bc
    JOIN public.bookmarks b ON b.id = bc.bid;
END;
$$;

COMMENT ON FUNCTION public.get_central_bookmarks IS '获取知识图谱中连接最多的书签';

GRANT EXECUTE ON FUNCTION public.get_central_bookmarks TO authenticated;

-- -------------------------------------------
-- 4. 按标签查找关联书签
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.find_bookmarks_by_tags(
    p_user_id UUID,
    p_tags TEXT[],
    p_exclude_id BIGINT,
    p_min_shared INT DEFAULT 2,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    shared_count INT,
    shared_tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH tag_matches AS (
        SELECT
            b.id as bid,
            b.title,
            ARRAY_AGG(tag ORDER BY tag) as matching_tags
        FROM public.bookmarks b
        CROSS JOIN LATERAL unnest(b.ai_tags) as tag
        WHERE b.user_id = p_user_id
          AND b.id != p_exclude_id
          AND tag = ANY(p_tags)
        GROUP BY b.id, b.title
    )
    SELECT
        tm.bid as bookmark_id,
        tm.title,
        array_length(tm.matching_tags, 1) as shared_count,
        tm.matching_tags as shared_tags
    FROM tag_matches tm
    WHERE array_length(tm.matching_tags, 1) >= p_min_shared
    ORDER BY array_length(tm.matching_tags, 1) DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_bookmarks_by_tags IS '根据共享标签查找相关书签';

GRANT EXECUTE ON FUNCTION public.find_bookmarks_by_tags TO authenticated;
