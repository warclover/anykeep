-- ============================================
-- 浏览器插件 OAuth 授权功能数据库迁移
-- 版本: 1.0.0
-- 日期: 2025-12-28
-- ============================================

-- 1. 插件授权记录表
CREATE TABLE IF NOT EXISTS plugin_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Token 信息
  refresh_token_hash TEXT NOT NULL,          -- SHA256 哈希存储
  access_token_jti UUID NOT NULL,            -- JWT ID，用于撤销检查

  -- 客户端信息
  browser TEXT NOT NULL,                      -- chrome | edge | firefox
  extension_version TEXT,                     -- 插件版本号
  user_agent TEXT,                            -- 完整 UA

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,            -- Refresh Token 过期时间
  revoked_at TIMESTAMPTZ,                     -- 撤销时间（NULL 表示有效）

  -- 约束
  CONSTRAINT valid_browser CHECK (browser IN ('chrome', 'edge', 'firefox', 'other')),
  CONSTRAINT unique_refresh_token UNIQUE (refresh_token_hash)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_plugin_auth_user_id
  ON plugin_authorizations(user_id);

CREATE INDEX IF NOT EXISTS idx_plugin_auth_jti
  ON plugin_authorizations(access_token_jti);

-- 有效授权查询优化（排除已撤销）
CREATE INDEX IF NOT EXISTS idx_plugin_auth_active
  ON plugin_authorizations(user_id, expires_at)
  WHERE revoked_at IS NULL;

-- 过期清理优化
CREATE INDEX IF NOT EXISTS idx_plugin_auth_expires
  ON plugin_authorizations(expires_at)
  WHERE revoked_at IS NULL;

-- 3. 启用 RLS
ALTER TABLE plugin_authorizations ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略
CREATE POLICY "Users can view own authorizations"
  ON plugin_authorizations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert authorizations"
  ON plugin_authorizations FOR INSERT
  WITH CHECK (true);  -- 仅 service_role 可插入

CREATE POLICY "Users can revoke own authorizations"
  ON plugin_authorizations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- 只允许设置 revoked_at
    revoked_at IS NOT NULL
  );

-- 5. OAuth 授权码临时表（5分钟过期）
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PKCE
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',

  -- 请求信息
  redirect_uri TEXT NOT NULL,
  scope TEXT DEFAULT 'bookmarks:read bookmarks:write',
  state TEXT NOT NULL,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,                        -- 使用后标记，防止重放

  -- 约束
  CONSTRAINT valid_challenge_method CHECK (code_challenge_method IN ('S256', 'plain'))
);

-- 授权码过期索引
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires
  ON oauth_authorization_codes(expires_at);

-- 6. 启用 RLS（授权码表）
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

-- 授权码只允许 service_role 操作
CREATE POLICY "Service role only for oauth codes"
  ON oauth_authorization_codes FOR ALL
  USING (false)
  WITH CHECK (false);

-- 7. 添加表注释
COMMENT ON TABLE plugin_authorizations IS '浏览器插件 OAuth 授权记录表';
COMMENT ON COLUMN plugin_authorizations.refresh_token_hash IS 'Refresh Token 的 SHA256 哈希';
COMMENT ON COLUMN plugin_authorizations.access_token_jti IS 'Access Token 的 JWT ID，用于撤销验证';
COMMENT ON COLUMN plugin_authorizations.browser IS '浏览器类型: chrome/edge/firefox/other';
COMMENT ON COLUMN plugin_authorizations.revoked_at IS '撤销时间，NULL 表示授权有效';

COMMENT ON TABLE oauth_authorization_codes IS 'OAuth 授权码临时存储（5分钟过期）';
COMMENT ON COLUMN oauth_authorization_codes.code_challenge IS 'PKCE code_challenge';
COMMENT ON COLUMN oauth_authorization_codes.used_at IS '授权码使用时间，防止重放攻击';

-- 8. 清理过期授权码的函数（可选，配合 pg_cron）
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_authorization_codes
  WHERE expires_at < NOW() OR used_at IS NOT NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 9. 验证 Refresh Token 并更新最后使用时间
CREATE OR REPLACE FUNCTION validate_refresh_token(
  p_token_hash TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  valid BOOLEAN,
  authorization_id UUID,
  browser TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE plugin_authorizations
  SET last_used_at = NOW()
  WHERE refresh_token_hash = p_token_hash
    AND user_id = p_user_id
    AND revoked_at IS NULL
    AND expires_at > NOW()
  RETURNING
    true AS valid,
    id AS authorization_id,
    plugin_authorizations.browser,
    plugin_authorizations.expires_at;

  -- 如果没有更新任何行，返回 valid = false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

-- 10. 撤销用户所有插件授权
CREATE OR REPLACE FUNCTION revoke_all_plugin_authorizations(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE plugin_authorizations
  SET revoked_at = NOW()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL;

  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth_codes() TO service_role;
GRANT EXECUTE ON FUNCTION validate_refresh_token(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION revoke_all_plugin_authorizations(UUID) TO authenticated;

-- ============================================
-- 迁移完成
-- 执行: supabase db push 或 supabase migration up
-- ============================================
