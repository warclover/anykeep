-- 用户反馈主表
CREATE TABLE user_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础分类
  type TEXT NOT NULL CHECK (type IN ('bug', 'complaint', 'suggestion')),
  category TEXT,

  -- 核心内容
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),

  -- 动态上下文 (解耦的关键：不预定义业务字段)
  -- 示例: { "route": "/bookmarks", "bookmark_id": "xxx", "error_code": "500" }
  context JSONB DEFAULT '{}',

  -- 附件与状态
  attachments TEXT[] DEFAULT '{}', -- 存储 Supabase Storage 路径
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'in_progress', 'resolved', 'closed', 'rejected')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- 系统字段
  admin_notes TEXT,                -- 内部备注
  resolution TEXT,                 -- 解决方案说明（对用户可见）
  resolved_at TIMESTAMPTZ,
  is_anonymous BOOLEAN DEFAULT false,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_user_feedbacks_user_id ON user_feedbacks(user_id);
CREATE INDEX idx_user_feedbacks_type ON user_feedbacks(type);
CREATE INDEX idx_user_feedbacks_status ON user_feedbacks(status);
CREATE INDEX idx_user_feedbacks_created_at ON user_feedbacks(created_at DESC);

-- RLS 策略
ALTER TABLE user_feedbacks ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的反馈
CREATE POLICY "Users can view own feedbacks" ON user_feedbacks
  FOR SELECT USING (auth.uid() = user_id);

-- 管理员可以查看所有反馈 (假设有 admin_role 或类似机制，这里暂且允许所有 authenticated 用户查看自己的，后续配合 admin API 权限控制)
-- 为了支持管理员后台，这里先简单添加策略。
-- 注意：实际项目中通常有 roles 表或 user_metadata.role
-- 这里我们假设管理员也是通过 user_id 区分，或者在 API 层做鉴权。
-- 暂时先仅开放给本人。管理员权限通常通过 service_role key 绕过 RLS。

-- 用户可以创建反馈
CREATE POLICY "Users can create feedbacks" ON user_feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的待处理反馈（仅限 pending 状态）
CREATE POLICY "Users can update pending feedbacks" ON user_feedbacks
  FOR UPDATE USING (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- 用户可以删除自己的待处理反馈
CREATE POLICY "Users can delete pending feedbacks" ON user_feedbacks
  FOR DELETE USING (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- 确保 update_updated_at_column 函数存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新时间触发器
CREATE TRIGGER update_user_feedbacks_updated_at
  BEFORE UPDATE ON user_feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
