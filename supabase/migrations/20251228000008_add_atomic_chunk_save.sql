-- ============================================
-- H8: 切片保存事务化
-- 使用数据库函数确保切片保存的原子性
-- ============================================

-- 切片数据类型
CREATE TYPE chunk_input AS (
  chunk_index INT,
  content TEXT,
  content_hash VARCHAR(64),
  chunk_type VARCHAR(20),
  token_count INT,
  start_offset INT,
  end_offset INT,
  parent_index INT,
  embedding TEXT -- JSON 格式的向量
);

-- 事务化保存切片函数
CREATE OR REPLACE FUNCTION save_bookmark_chunks_atomic(
  p_bookmark_id BIGINT,
  p_chunks chunk_input[],
  p_embedding_version VARCHAR(20) DEFAULT 'v1'
)
RETURNS TABLE (
  success BOOLEAN,
  parent_count INT,
  child_count INT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chunk chunk_input;
  v_parent_id UUID;
  v_parent_ids JSONB := '{}';
  v_parent_count INT := 0;
  v_child_count INT := 0;
BEGIN
  -- 验证书签所有权（通过 RLS 或服务角色）
  IF NOT EXISTS (
    SELECT 1 FROM bookmarks
    WHERE id = p_bookmark_id
    AND (user_id = auth.uid() OR auth.role() = 'service_role')
  ) THEN
    RETURN QUERY SELECT false, 0, 0, '无权访问此书签'::TEXT;
    RETURN;
  END IF;

  -- 开始事务（PostgreSQL 函数自动在事务中运行）

  -- 1. 删除旧的切片
  DELETE FROM bookmark_chunks WHERE bookmark_id = p_bookmark_id;

  -- 2. 先插入所有 Parent 切片
  FOREACH v_chunk IN ARRAY p_chunks
  LOOP
    IF v_chunk.chunk_type = 'parent' THEN
      INSERT INTO bookmark_chunks (
        bookmark_id,
        chunk_index,
        content,
        content_hash,
        chunk_type,
        token_count,
        start_offset,
        end_offset,
        embedding,
        embedding_version
      ) VALUES (
        p_bookmark_id,
        v_chunk.chunk_index,
        v_chunk.content,
        v_chunk.content_hash,
        'parent',
        v_chunk.token_count,
        v_chunk.start_offset,
        v_chunk.end_offset,
        CASE WHEN v_chunk.embedding IS NOT NULL AND v_chunk.embedding != ''
             THEN v_chunk.embedding::vector(1024)
             ELSE NULL
        END,
        p_embedding_version
      )
      RETURNING id INTO v_parent_id;

      -- 记录 parent_index -> parent_id 映射
      v_parent_ids := v_parent_ids || jsonb_build_object(v_chunk.chunk_index::text, v_parent_id::text);
      v_parent_count := v_parent_count + 1;
    END IF;
  END LOOP;

  -- 3. 插入所有 Child 切片
  FOREACH v_chunk IN ARRAY p_chunks
  LOOP
    IF v_chunk.chunk_type = 'child' THEN
      INSERT INTO bookmark_chunks (
        bookmark_id,
        parent_chunk_id,
        chunk_index,
        content,
        content_hash,
        chunk_type,
        token_count,
        start_offset,
        end_offset,
        embedding,
        embedding_version
      ) VALUES (
        p_bookmark_id,
        CASE WHEN v_chunk.parent_index IS NOT NULL
             THEN (v_parent_ids->>v_chunk.parent_index::text)::uuid
             ELSE NULL
        END,
        v_chunk.chunk_index,
        v_chunk.content,
        v_chunk.content_hash,
        'child',
        v_chunk.token_count,
        v_chunk.start_offset,
        v_chunk.end_offset,
        CASE WHEN v_chunk.embedding IS NOT NULL AND v_chunk.embedding != ''
             THEN v_chunk.embedding::vector(1024)
             ELSE NULL
        END,
        p_embedding_version
      );

      v_child_count := v_child_count + 1;
    END IF;
  END LOOP;

  -- 成功返回
  RETURN QUERY SELECT true, v_parent_count, v_child_count, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  -- 事务自动回滚
  RETURN QUERY SELECT false, 0, 0, SQLERRM;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION save_bookmark_chunks_atomic IS 'H8: 事务化保存书签切片，确保原子性';

-- 删除自定义类型（如果需要重新创建）
-- DROP TYPE IF EXISTS chunk_input CASCADE;
