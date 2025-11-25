-- 添加全文搜索支持
-- 创建生成列来存储 tsvector，并添加 GIN 索引以提高搜索性能

-- 1. 添加全文搜索列（使用生成列自动更新）
-- 包含标题、摘要和作者的全文搜索向量（中英文混合）
ALTER TABLE bookmarks
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(ai_summary, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(author, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'D')
) STORED;

-- 2. 创建 GIN 索引以加速全文搜索
CREATE INDEX idx_bookmarks_search_vector
ON bookmarks
USING GIN (search_vector);

-- 3. 添加注释说明
COMMENT ON COLUMN bookmarks.search_vector IS '全文搜索向量（自动生成）：A=标题，B=AI摘要，C=作者，D=描述';
COMMENT ON INDEX idx_bookmarks_search_vector IS '全文搜索索引（GIN）';

-- 使用说明：
-- 查询示例：
-- SELECT * FROM bookmarks
-- WHERE search_vector @@ to_tsquery('simple', 'keyword')
-- ORDER BY ts_rank(search_vector, to_tsquery('simple', 'keyword')) DESC;
