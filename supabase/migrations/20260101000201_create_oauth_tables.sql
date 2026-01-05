-- OAuth 状态表（用于 CSRF 防护）
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'notion', 'google', etc.
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- RLS
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own oauth states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);

-- OAuth Token 表（加密存储第三方 Token）
CREATE TABLE IF NOT EXISTS distribution_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'notion', 'google', etc.
  access_token TEXT NOT NULL, -- 加密存储
  refresh_token TEXT, -- 加密存储（如果有）
  workspace_id TEXT, -- Notion workspace ID
  workspace_name TEXT, -- Notion workspace 名称
  workspace_icon TEXT, -- Notion workspace 图标
  bot_id TEXT, -- Notion bot ID
  expires_at TIMESTAMPTZ, -- Token 过期时间（Notion 不过期）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, provider)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_distribution_oauth_tokens_user ON distribution_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_distribution_oauth_tokens_provider ON distribution_oauth_tokens(provider);

-- RLS
ALTER TABLE distribution_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own oauth tokens" ON distribution_oauth_tokens
  FOR ALL USING (auth.uid() = user_id);

-- 自动清理过期的 OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新时间戳触发器
CREATE TRIGGER update_distribution_oauth_tokens_updated_at
  BEFORE UPDATE ON distribution_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE oauth_states IS 'OAuth 授权状态表，用于 CSRF 防护';
COMMENT ON TABLE distribution_oauth_tokens IS '分发服务 OAuth Token 加密存储表';
