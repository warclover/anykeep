/**
 * 智能分类 v5.0 - Entropy Reduction（熵减少）
 *
 * 功能说明：
 * - 计算文件夹的熵值（混乱程度）
 * - 识别高熵文件夹（内容过于杂乱）
 * - 建议熵减少方案（拆分、合并、重新分类）
 */

-- =====================================================
-- 1. 创建 folder_entropy_scores 表
-- =====================================================

CREATE TABLE IF NOT EXISTS folder_entropy_scores (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 熵值（0-1，越高越混乱）
  entropy_score DECIMAL(5,4) NOT NULL CHECK (entropy_score >= 0 AND entropy_score <= 1),

  -- 书签数量
  bookmark_count INTEGER NOT NULL DEFAULT 0,

  -- 平均相似度（文件夹内书签之间的平均相似度）
  avg_similarity DECIMAL(5,4),

  -- 标准差（相似度的标准差，越大越分散）
  similarity_stddev DECIMAL(5,4),

  -- 计算时间
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 唯一约束：每个文件夹只有一条最新记录
  UNIQUE(user_id, folder_id)
);

-- 索引优化
CREATE INDEX idx_folder_entropy_scores_user_id ON folder_entropy_scores(user_id);
CREATE INDEX idx_folder_entropy_scores_folder_id ON folder_entropy_scores(folder_id);
CREATE INDEX idx_folder_entropy_scores_entropy ON folder_entropy_scores(entropy_score DESC);

-- RLS 策略
ALTER TABLE folder_entropy_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own folder entropy scores"
  ON folder_entropy_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folder entropy scores"
  ON folder_entropy_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folder entropy scores"
  ON folder_entropy_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folder entropy scores"
  ON folder_entropy_scores FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. 创建 entropy_reduction_logs 表
-- =====================================================

CREATE TABLE IF NOT EXISTS entropy_reduction_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 操作类型：split(拆分), merge(合并), reclassify(重新分类)
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('split', 'merge', 'reclassify')),

  -- 操作前熵值
  before_entropy DECIMAL(5,4) NOT NULL,

  -- 操作后熵值
  after_entropy DECIMAL(5,4),

  -- 影响的书签数量
  affected_bookmark_count INTEGER DEFAULT 0,

  -- 操作详情（JSON，存储具体操作信息）
  action_details JSONB DEFAULT '{}'::jsonb,

  -- 执行时间
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_entropy_reduction_logs_user_id ON entropy_reduction_logs(user_id);
CREATE INDEX idx_entropy_reduction_logs_folder_id ON entropy_reduction_logs(folder_id);
CREATE INDEX idx_entropy_reduction_logs_executed_at ON entropy_reduction_logs(executed_at DESC);

-- RLS 策略
ALTER TABLE entropy_reduction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entropy reduction logs"
  ON entropy_reduction_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entropy reduction logs"
  ON entropy_reduction_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. RPC 函数：计算文件夹熵值
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_folder_entropy(
  p_folder_id BIGINT
)
RETURNS TABLE (
  entropy_score DECIMAL(5,4),
  bookmark_count INTEGER,
  avg_similarity DECIMAL(5,4),
  similarity_stddev DECIMAL(5,4)
) AS $$
DECLARE
  v_user_id UUID;
  v_bookmark_count INTEGER;
  v_avg_similarity DECIMAL(5,4);
  v_similarity_stddev DECIMAL(5,4);
  v_entropy DECIMAL(5,4);
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();

  -- 1. 获取文件夹内书签数量
  SELECT COUNT(*)
  INTO v_bookmark_count
  FROM bookmarks
  WHERE folder_id = p_folder_id AND user_id = v_user_id;

  -- 如果书签数量少于2，熵值为0
  IF v_bookmark_count < 2 THEN
    RETURN QUERY SELECT 0.0::DECIMAL(5,4), v_bookmark_count, NULL::DECIMAL(5,4), NULL::DECIMAL(5,4);
    RETURN;
  END IF;

  -- 2. 计算文件夹内书签之间的平均相似度
  -- 使用向量余弦相似度
  WITH bookmark_pairs AS (
    SELECT
      b1.id AS id1,
      b2.id AS id2,
      (1 - (b1.embedding <=> b2.embedding))::DECIMAL(5,4) AS similarity
    FROM bookmarks b1
    CROSS JOIN bookmarks b2
    WHERE b1.folder_id = p_folder_id
      AND b2.folder_id = p_folder_id
      AND b1.user_id = v_user_id
      AND b2.user_id = v_user_id
      AND b1.id < b2.id  -- 避免重复计算
      AND b1.embedding IS NOT NULL
      AND b2.embedding IS NOT NULL
  )
  SELECT
    AVG(similarity)::DECIMAL(5,4),
    STDDEV(similarity)::DECIMAL(5,4)
  INTO v_avg_similarity, v_similarity_stddev
  FROM bookmark_pairs;

  -- 3. 计算熵值
  -- 熵值 = 1 - 平均相似度
  -- 相似度越低，熵值越高（越混乱）
  IF v_avg_similarity IS NOT NULL THEN
    v_entropy := (1 - v_avg_similarity)::DECIMAL(5,4);
  ELSE
    v_entropy := 0.5::DECIMAL(5,4);  -- 默认中等熵值
  END IF;

  -- 确保熵值在 [0, 1] 范围内
  v_entropy := GREATEST(0.0, LEAST(1.0, v_entropy));

  RETURN QUERY SELECT v_entropy, v_bookmark_count, v_avg_similarity, v_similarity_stddev;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. RPC 函数：批量计算所有文件夹的熵值
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_all_folder_entropy()
RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR(255),
  entropy_score DECIMAL(5,4),
  bookmark_count INTEGER
) AS $$
DECLARE
  v_user_id UUID;
  v_folder RECORD;
  v_entropy_result RECORD;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();

  -- 遍历用户的所有文件夹
  FOR v_folder IN
    SELECT id, name
    FROM folders
    WHERE user_id = v_user_id
  LOOP
    -- 计算文件夹熵值
    SELECT *
    INTO v_entropy_result
    FROM calculate_folder_entropy(v_folder.id);

    -- 更新或插入熵值记录
    INSERT INTO folder_entropy_scores (
      user_id,
      folder_id,
      entropy_score,
      bookmark_count,
      avg_similarity,
      similarity_stddev,
      calculated_at
    )
    VALUES (
      v_user_id,
      v_folder.id,
      v_entropy_result.entropy_score,
      v_entropy_result.bookmark_count,
      v_entropy_result.avg_similarity,
      v_entropy_result.similarity_stddev,
      NOW()
    )
    ON CONFLICT (user_id, folder_id)
    DO UPDATE SET
      entropy_score = EXCLUDED.entropy_score,
      bookmark_count = EXCLUDED.bookmark_count,
      avg_similarity = EXCLUDED.avg_similarity,
      similarity_stddev = EXCLUDED.similarity_stddev,
      calculated_at = EXCLUDED.calculated_at;

    -- 返回结果
    RETURN QUERY SELECT
      v_folder.id,
      v_folder.name,
      v_entropy_result.entropy_score,
      v_entropy_result.bookmark_count;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
