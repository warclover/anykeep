-- ============================================
-- Classification v5.0 - 用户自定义分类规则表
-- 创建日期: 2026-01-18
-- 说明: 支持 Chat-to-Rule 功能，用户可通过自然语言定义分类规则
-- ============================================

-- ============================================
-- 表: user_classification_rules（用户分类规则）
-- ============================================

CREATE TABLE IF NOT EXISTS user_classification_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 规则类型
  type VARCHAR(20) NOT NULL CHECK (type IN ('positive', 'negative')),

  -- 规则模式（支持正则表达式）
  pattern TEXT NOT NULL,
  pattern_type VARCHAR(20) DEFAULT 'keyword' CHECK (pattern_type IN ('keyword', 'regex', 'domain')),

  -- 目标文件夹
  target_folder_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
  target_folder_name VARCHAR(255) NOT NULL,

  -- 优先级（数值越大越优先）
  priority INTEGER DEFAULT 100,

  -- 规则状态
  is_active BOOLEAN DEFAULT TRUE,

  -- 元数据
  source_text TEXT, -- 用户原始输入
  description TEXT, -- 规则描述
  match_count INTEGER DEFAULT 0, -- 匹配次数统计
  last_matched_at TIMESTAMPTZ, -- 最后匹配时间

  -- 审计
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE user_classification_rules IS '智能分类 v5.0 - 用户自定义分类规则表，支持 Chat-to-Rule 功能';
COMMENT ON COLUMN user_classification_rules.type IS '规则类型：positive（正向规则，匹配则分类到目标文件夹）、negative（负向规则，匹配则不分类到目标文件夹）';
COMMENT ON COLUMN user_classification_rules.pattern IS '匹配模式：关键词、正则表达式或域名';
COMMENT ON COLUMN user_classification_rules.pattern_type IS '模式类型：keyword（关键词）、regex（正则）、domain（域名）';
COMMENT ON COLUMN user_classification_rules.priority IS '优先级，数值越大越优先执行';
COMMENT ON COLUMN user_classification_rules.source_text IS '用户原始输入，用于 LLM 提取规则时保存';
COMMENT ON COLUMN user_classification_rules.match_count IS '规则匹配次数统计，用于分析规则有效性';

-- ============================================
-- 索引
-- ============================================

-- 用户查询索引（按优先级排序）
CREATE INDEX idx_user_rules_user_priority
ON user_classification_rules(user_id, priority DESC)
WHERE is_active = TRUE;

-- 文件夹关联索引
CREATE INDEX idx_user_rules_folder
ON user_classification_rules(target_folder_id)
WHERE target_folder_id IS NOT NULL;

-- 匹配统计索引
CREATE INDEX idx_user_rules_match_count
ON user_classification_rules(user_id, match_count DESC);

-- ============================================
-- RLS 策略
-- ============================================

ALTER TABLE user_classification_rules ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的规则
CREATE POLICY "Users can view own classification rules"
  ON user_classification_rules FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的规则
CREATE POLICY "Users can insert own classification rules"
  ON user_classification_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的规则
CREATE POLICY "Users can update own classification rules"
  ON user_classification_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的规则
CREATE POLICY "Users can delete own classification rules"
  ON user_classification_rules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_user_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_rules_updated_at
BEFORE UPDATE ON user_classification_rules
FOR EACH ROW
EXECUTE FUNCTION update_user_rules_updated_at();

-- ============================================
-- RPC 函数：增加规则匹配计数
-- ============================================

CREATE OR REPLACE FUNCTION increment_rule_match_count(
  p_rule_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_classification_rules
  SET
    match_count = match_count + 1,
    last_matched_at = NOW(),
    updated_at = NOW()
  WHERE id = p_rule_id;
END;
$$;

COMMENT ON FUNCTION increment_rule_match_count IS
'增加规则匹配计数，每次规则匹配成功时调用。';

-- ============================================
-- 授权
-- ============================================

GRANT EXECUTE ON FUNCTION increment_rule_match_count TO authenticated;
