-- ===========================================
-- 知识关联 Phase 2 - 关联查询函数
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-15
-- 说明: 创建知识关联所需的数据库函数
--       包括按标签查找关联、语义相似度查询等

-- -------------------------------------------
-- 1. 按共享标签查找关联书签
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.find_bookmarks_by_tags(
    p_user_id UUID,
    p_tags TEXT[],
    p_exclude_id BIGINT DEFAULT NULL,
    p_min_shared INT DEFAULT 2,
    p_limit INT DEFAULT 20
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
            b.id,
            b.title,
            ARRAY_AGG(t.tag) as matched_tags
        FROM public.bookmarks b
        CROSS JOIN LATERAL unnest(b.ai_tags) AS t(tag)
        WHERE b.user_id = p_user_id
          AND b.is_deleted = false
          AND (p_exclude_id IS NULL OR b.id != p_exclude_id)
          AND t.tag = ANY(p_tags)
        GROUP BY b.id, b.title
    )
    SELECT
        tm.id as bookmark_id,
        tm.title,
        array_length(tm.matched_tags, 1) as shared_count,
        tm.matched_tags as shared_tags
    FROM tag_matches tm
    WHERE array_length(tm.matched_tags, 1) >= p_min_shared
    ORDER BY shared_count DESC, tm.id DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_bookmarks_by_tags IS '查找共享标签的书签，用于知识关联';

GRANT EXECUTE ON FUNCTION public.find_bookmarks_by_tags TO authenticated;

-- -------------------------------------------
-- 2. 按向量相似度查找关联书签
-- -------------------------------------------

-- 注意：此函数依赖 pgvector 扩展和 bookmarks 表的 embedding 字段
-- 使用子查询方式避免显式声明 vector 类型变量，解决 pgvector 类型路径问题

CREATE OR REPLACE FUNCTION public.find_similar_bookmarks_for_linking(
    p_user_id UUID,
    p_bookmark_id BIGINT,
    p_min_similarity FLOAT DEFAULT 0.7,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    bookmark_id BIGINT,
    title TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 使用子查询获取源书签 embedding，避免声明 vector 类型变量
    -- 这样可以绕过 pgvector 类型在 DECLARE 块中不可用的问题
    RETURN QUERY
    WITH source AS (
        SELECT b.embedding as src_embedding
        FROM public.bookmarks b
        WHERE b.id = p_bookmark_id
          AND b.user_id = p_user_id
          AND b.embedding IS NOT NULL
        LIMIT 1
    )
    SELECT
        b.id as bookmark_id,
        b.title,
        (1 - (b.embedding <=> source.src_embedding)) as similarity
    FROM public.bookmarks b
    CROSS JOIN source
    WHERE b.user_id = p_user_id
      AND b.id != p_bookmark_id
      AND b.embedding IS NOT NULL
      AND b.is_deleted = false
      AND (1 - (b.embedding <=> source.src_embedding)) >= p_min_similarity
    ORDER BY b.embedding <=> source.src_embedding
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_similar_bookmarks_for_linking IS '按向量相似度查找关联书签';

GRANT EXECUTE ON FUNCTION public.find_similar_bookmarks_for_linking TO authenticated;

-- -------------------------------------------
-- 3. 综合发现书签关联（主入口函数）
-- -------------------------------------------

CREATE OR REPLACE FUNCTION public.discover_bookmark_links(
    p_user_id UUID,
    p_bookmark_id BIGINT,
    p_options JSONB DEFAULT '{}'::JSONB
    -- p_options 可选参数:
    -- {
    --   "semantic": { "enabled": true, "minSimilarity": 0.7, "limit": 10 },
    --   "entity": { "enabled": true, "minShared": 1, "limit": 10 },
    --   "tag": { "enabled": true, "minShared": 2, "limit": 10 }
    -- }
)
RETURNS TABLE (
    related_bookmark_id BIGINT,
    link_type TEXT,
    strength FLOAT,
    evidence JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_semantic_enabled BOOLEAN;
    v_entity_enabled BOOLEAN;
    v_tag_enabled BOOLEAN;
    v_semantic_min FLOAT;
    v_entity_min INT;
    v_tag_min INT;
    v_limit INT;
    v_tags TEXT[];
    v_entities TEXT[];
BEGIN
    -- 解析选项
    v_semantic_enabled := COALESCE((p_options->'semantic'->>'enabled')::BOOLEAN, true);
    v_entity_enabled := COALESCE((p_options->'entity'->>'enabled')::BOOLEAN, true);
    v_tag_enabled := COALESCE((p_options->'tag'->>'enabled')::BOOLEAN, true);

    v_semantic_min := COALESCE((p_options->'semantic'->>'minSimilarity')::FLOAT, 0.7);
    v_entity_min := COALESCE((p_options->'entity'->>'minShared')::INT, 1);
    v_tag_min := COALESCE((p_options->'tag'->>'minShared')::INT, 2);
    v_limit := COALESCE((p_options->>'limit')::INT, 10);

    -- 获取书签的标签
    SELECT ai_tags INTO v_tags
    FROM public.bookmarks
    WHERE id = p_bookmark_id AND user_id = p_user_id;

    -- 获取书签的实体名称
    SELECT ARRAY_AGG(name) INTO v_entities
    FROM public.bookmark_entities
    WHERE bookmark_id = p_bookmark_id AND user_id = p_user_id;

    -- 语义相似度关联
    IF v_semantic_enabled THEN
        RETURN QUERY
        SELECT
            fsb.bookmark_id as related_bookmark_id,
            'semantic'::TEXT as link_type,
            fsb.similarity as strength,
            jsonb_build_object(
                'type', 'semantic',
                'score', fsb.similarity,
                'details', jsonb_build_object('similarityScore', fsb.similarity)
            ) as evidence
        FROM public.find_similar_bookmarks_for_linking(
            p_user_id, p_bookmark_id, v_semantic_min, v_limit
        ) fsb;
    END IF;

    -- 实体匹配关联
    IF v_entity_enabled AND v_entities IS NOT NULL AND array_length(v_entities, 1) > 0 THEN
        RETURN QUERY
        SELECT
            fbe.bookmark_id as related_bookmark_id,
            'entity'::TEXT as link_type,
            LEAST(fbe.shared_count::FLOAT / 3.0, 1.0) as strength,
            jsonb_build_object(
                'type', 'entity',
                'score', fbe.shared_count::FLOAT / GREATEST(array_length(v_entities, 1), 1),
                'details', jsonb_build_object('sharedEntities', fbe.shared_entities)
            ) as evidence
        FROM public.find_bookmarks_by_shared_entities(
            p_user_id, v_entities, p_bookmark_id, v_entity_min, v_limit
        ) fbe;
    END IF;

    -- 标签匹配关联
    IF v_tag_enabled AND v_tags IS NOT NULL AND array_length(v_tags, 1) > 0 THEN
        RETURN QUERY
        SELECT
            fbt.bookmark_id as related_bookmark_id,
            'tag'::TEXT as link_type,
            LEAST(fbt.shared_count::FLOAT / 3.0, 1.0) as strength,
            jsonb_build_object(
                'type', 'tag',
                'score', fbt.shared_count::FLOAT / GREATEST(array_length(v_tags, 1), 1),
                'details', jsonb_build_object('sharedTags', fbt.shared_tags)
            ) as evidence
        FROM public.find_bookmarks_by_tags(
            p_user_id, v_tags, p_bookmark_id, v_tag_min, v_limit
        ) fbt;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.discover_bookmark_links IS '综合发现书签关联（语义+实体+标签）';

GRANT EXECUTE ON FUNCTION public.discover_bookmark_links TO authenticated;

-- -------------------------------------------
-- 4. 获取书签的相关内容（带详情）
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
        b.favicon,
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
    WHERE b.is_deleted = false
    ORDER BY l.strength DESC;
END;
$$;

COMMENT ON FUNCTION public.get_related_bookmarks_with_details IS '获取书签的相关内容（带完整详情）';

GRANT EXECUTE ON FUNCTION public.get_related_bookmarks_with_details TO authenticated;
