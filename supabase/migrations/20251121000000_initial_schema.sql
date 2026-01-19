-- ===========================================
-- AnyKeep 初始数据库架构
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-21
-- 说明: 创建核心表结构、RLS 策略和索引

-- -------------------------------------------
-- 1. 启用扩展
-- -------------------------------------------

-- 启用 pgvector 扩展（用于语义搜索）
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 启用 pg_trgm 扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- -------------------------------------------
-- 2. 用户扩展表 (profiles)
-- -------------------------------------------
-- 关联 auth.users，存储用户扩展信息

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) UNIQUE,
    nickname VARCHAR(50),
    avatar_url TEXT,
    membership_type VARCHAR(20) DEFAULT 'FREE' CHECK (membership_type IN ('FREE', 'PRO')),
    storage_quota INT DEFAULT 500,
    storage_used INT DEFAULT 0,
    settings JSONB DEFAULT '{"theme": "auto", "auto_tag": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE public.profiles IS '用户扩展资料表';
COMMENT ON COLUMN public.profiles.membership_type IS '会员类型: FREE-免费用户, PRO-付费用户';
COMMENT ON COLUMN public.profiles.storage_quota IS '存储配额（收藏条数上限）';
COMMENT ON COLUMN public.profiles.storage_used IS '已使用的存储量';

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看和更新自己的资料
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- -------------------------------------------
-- 3. 文件夹表 (folders)
-- -------------------------------------------

CREATE TABLE IF NOT EXISTS public.folders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES public.folders(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 添加注释
COMMENT ON TABLE public.folders IS '收藏文件夹表';
COMMENT ON COLUMN public.folders.parent_id IS '父文件夹ID，支持嵌套';

-- 启用 RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能管理自己的文件夹
CREATE POLICY "Users can manage own folders" ON public.folders
    FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 索引
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id) WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 4. 收藏表 (bookmarks)
-- -------------------------------------------

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 基础信息
    title VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,

    -- 平台信息
    platform VARCHAR(50) NOT NULL CHECK (platform IN (
        'WECHAT_OFFICIAL_ACCOUNT',
        'BILIBILI',
        'XIAOHONGSHU',
        'UNKNOWN'
    )),
    platform_content_id VARCHAR(200),

    -- AI 生成内容
    ai_summary TEXT,
    ai_tags TEXT[],

    -- 用户管理
    folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
    user_tags TEXT[],
    notes TEXT,

    -- 元数据
    author VARCHAR(200),
    publish_time TIMESTAMP WITH TIME ZONE,
    content_type VARCHAR(50) CHECK (content_type IN ('ARTICLE', 'VIDEO', 'IMAGE', 'UNKNOWN')),

    -- 向量搜索（pgvector）
    embedding extensions.vector(1024),

    -- 状态
    status VARCHAR(20) DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 添加注释
COMMENT ON TABLE public.bookmarks IS '收藏记录表';
COMMENT ON COLUMN public.bookmarks.platform IS '来源平台: WECHAT_OFFICIAL_ACCOUNT, BILIBILI, XIAOHONGSHU, UNKNOWN';
COMMENT ON COLUMN public.bookmarks.ai_summary IS 'AI 生成的摘要（50字内）';
COMMENT ON COLUMN public.bookmarks.ai_tags IS 'AI 生成的标签数组';
COMMENT ON COLUMN public.bookmarks.embedding IS '文本向量嵌入（用于语义搜索）';
COMMENT ON COLUMN public.bookmarks.status IS '处理状态: PROCESSING-处理中, COMPLETED-完成, FAILED-失败';

-- 启用 RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create own bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_platform ON public.bookmarks(platform) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_id ON public.bookmarks(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON public.bookmarks(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON public.bookmarks(status) WHERE deleted_at IS NULL;

-- 向量搜索索引（HNSW 算法）
CREATE INDEX IF NOT EXISTS idx_bookmarks_embedding ON public.bookmarks
    USING hnsw (embedding vector_cosine_ops)
    WHERE deleted_at IS NULL AND embedding IS NOT NULL;

-- -------------------------------------------
-- 5. 平台授权表 (platform_authorizations)
-- -------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_authorizations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('WECHAT', 'BILIBILI', 'XIAOHONGSHU')),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, platform)
);

-- 添加注释
COMMENT ON TABLE public.platform_authorizations IS '第三方平台授权表';
COMMENT ON COLUMN public.platform_authorizations.status IS '授权状态: ACTIVE-有效, EXPIRED-过期, REVOKED-已撤销';

-- 启用 RLS
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can manage own authorizations" ON public.platform_authorizations
    FOR ALL USING (auth.uid() = user_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_platform_auth_user_id ON public.platform_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_auth_status ON public.platform_authorizations(status);

-- -------------------------------------------
-- 6. 数据库函数
-- -------------------------------------------

-- 向量语义搜索函数
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
    query_embedding extensions.vector(1024),
    search_user_id uuid,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id bigint,
    title varchar,
    url text,
    description text,
    cover_url text,
    platform varchar,
    ai_summary text,
    ai_tags text[],
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.cover_url,
        b.platform,
        b.ai_summary,
        b.ai_tags,
        b.created_at,
        1 - (b.embedding <=> query_embedding) as similarity
    FROM public.bookmarks b
    WHERE b.user_id = search_user_id
        AND b.deleted_at IS NULL
        AND b.embedding IS NOT NULL
        AND 1 - (b.embedding <=> query_embedding) > match_threshold
    ORDER BY b.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 增加用户存储使用量函数
CREATE OR REPLACE FUNCTION increment_storage_used(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET storage_used = storage_used + 1,
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;

-- 减少用户存储使用量函数
CREATE OR REPLACE FUNCTION decrement_storage_used(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET storage_used = GREATEST(storage_used - 1, 0),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;

-- 自动创建用户资料触发器函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, nickname, membership_type, storage_quota, storage_used)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
        'FREE',
        500,
        0
    );
    RETURN NEW;
END;
$$;

-- 创建触发器：新用户注册时自动创建 profile
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 为各表添加更新时间戳触发器
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bookmarks_updated_at
    BEFORE UPDATE ON public.bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_platform_authorizations_updated_at
    BEFORE UPDATE ON public.platform_authorizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -------------------------------------------
-- 完成
-- -------------------------------------------

COMMENT ON SCHEMA public IS 'AnyKeep 应用数据库架构 v1.0.0';
