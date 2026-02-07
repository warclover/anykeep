-- MD 收藏全文搜索优化
-- 为 md_collections 表添加 tsvector 列和 GIN 索引
-- 解决 raw_content.ilike 全表扫描性能问题
--
-- 注意：由于 to_tsvector 不是 IMMUTABLE，无法使用 GENERATED ALWAYS AS
-- 改用触发器方式维护 search_vector 列

-- 1. 添加 search_vector 列（非生成列）
ALTER TABLE public.md_collections
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. 创建更新 search_vector 的函数
CREATE OR REPLACE FUNCTION update_md_collections_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.ai_summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.ai_tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建触发器（INSERT 和 UPDATE 时自动更新）
DROP TRIGGER IF EXISTS trg_md_collections_search_vector ON public.md_collections;
CREATE TRIGGER trg_md_collections_search_vector
  BEFORE INSERT OR UPDATE OF title, ai_summary, ai_tags
  ON public.md_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_md_collections_search_vector();

-- 4. 为现有数据填充 search_vector
UPDATE public.md_collections
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(ai_summary, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(ai_tags, ' '), '')), 'C')
WHERE search_vector IS NULL;

-- 5. 创建 GIN 索引加速全文搜索
CREATE INDEX IF NOT EXISTS idx_md_collections_search_vector
ON public.md_collections USING gin(search_vector)
WHERE deleted_at IS NULL;

-- 6. 添加复合索引优化常用查询（用户+删除状态+创建时间）
CREATE INDEX IF NOT EXISTS idx_md_collections_user_deleted_created
ON public.md_collections(user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 7. 添加标题索引支持 ILIKE 回退查询（需要 pg_trgm 扩展）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_md_collections_title_trgm
ON public.md_collections USING gin(title gin_trgm_ops)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.md_collections.search_vector IS '全文搜索向量 (title:A + ai_summary:B + ai_tags:C)，由触发器自动维护';
