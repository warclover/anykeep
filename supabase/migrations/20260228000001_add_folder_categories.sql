/**
 * 新增 folder_categories 表（用户自定义栏目）
 * - 栏目是文件夹的上级组织单元
 * - 用户可创建/编辑/删除栏目
 * - 自动迁移现有 folder_group 数据
 */

-- 1. 创建 folder_categories 表
CREATE TABLE IF NOT EXISTS public.folder_categories (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.folder_categories IS '用户自定义栏目（文件夹分组容器）';
COMMENT ON COLUMN public.folder_categories.icon IS 'lucide 图标名或 emoji';
COMMENT ON COLUMN public.folder_categories.color IS '主题色 hex 值';
COMMENT ON COLUMN public.folder_categories.is_default IS '是否为系统自动创建的默认栏目';

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_folder_categories_user
ON public.folder_categories(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_categories_user_sort
ON public.folder_categories(user_id, sort_order);

-- 3. RLS 策略
ALTER TABLE public.folder_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder_categories_select_own"
ON public.folder_categories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "folder_categories_insert_own"
ON public.folder_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folder_categories_update_own"
ON public.folder_categories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "folder_categories_delete_own"
ON public.folder_categories FOR DELETE
USING (auth.uid() = user_id);

-- 4. 添加 category_id 到 folders 表
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS category_id INT REFERENCES public.folder_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_folders_category_id
ON public.folders(category_id)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.folders.category_id IS '所属栏目 ID（关联 folder_categories 表）';

-- 5. 为已有用户创建默认栏目并迁移 folder_group 数据
DO $$
DECLARE
  _user_id UUID;
  _cat_work INT;
  _cat_study INT;
  _cat_life INT;
  _cat_entertainment INT;
  _cat_other INT;
BEGIN
  FOR _user_id IN
    SELECT DISTINCT user_id FROM public.folders WHERE deleted_at IS NULL
  LOOP
    -- 创建 5 个默认栏目
    INSERT INTO public.folder_categories (user_id, name, icon, color, sort_order, is_default)
    VALUES (_user_id, '工作相关', 'Briefcase', '#3B82F6', 0, TRUE)
    RETURNING id INTO _cat_work;

    INSERT INTO public.folder_categories (user_id, name, icon, color, sort_order, is_default)
    VALUES (_user_id, '学习成长', 'GraduationCap', '#10B981', 1, TRUE)
    RETURNING id INTO _cat_study;

    INSERT INTO public.folder_categories (user_id, name, icon, color, sort_order, is_default)
    VALUES (_user_id, '生活方式', 'Heart', '#EC4899', 2, TRUE)
    RETURNING id INTO _cat_life;

    INSERT INTO public.folder_categories (user_id, name, icon, color, sort_order, is_default)
    VALUES (_user_id, '休闲娱乐', 'Gamepad2', '#8B5CF6', 3, TRUE)
    RETURNING id INTO _cat_entertainment;

    INSERT INTO public.folder_categories (user_id, name, icon, color, sort_order, is_default)
    VALUES (_user_id, '其他收藏', 'MoreHorizontal', '#F87171', 4, TRUE)
    RETURNING id INTO _cat_other;

    -- 将现有文件夹的 folder_group 映射到 category_id
    UPDATE public.folders SET category_id = _cat_work
    WHERE user_id = _user_id AND folder_group = 'work' AND is_system = FALSE AND deleted_at IS NULL;

    UPDATE public.folders SET category_id = _cat_study
    WHERE user_id = _user_id AND folder_group = 'study' AND is_system = FALSE AND deleted_at IS NULL;

    UPDATE public.folders SET category_id = _cat_life
    WHERE user_id = _user_id AND folder_group = 'life' AND is_system = FALSE AND deleted_at IS NULL;

    UPDATE public.folders SET category_id = _cat_entertainment
    WHERE user_id = _user_id AND folder_group = 'entertainment' AND is_system = FALSE AND deleted_at IS NULL;

    UPDATE public.folders SET category_id = _cat_other
    WHERE user_id = _user_id AND folder_group = 'other' AND is_system = FALSE AND deleted_at IS NULL;

    -- 没有 folder_group 的非系统文件夹归入"其他收藏"
    UPDATE public.folders SET category_id = _cat_other
    WHERE user_id = _user_id AND category_id IS NULL AND is_system = FALSE AND deleted_at IS NULL;
  END LOOP;
END $$;

-- 6. 添加 folder_group 的 deprecated 注释
COMMENT ON COLUMN public.folders.folder_group IS '[DEPRECATED] 已被 category_id 替代。保留以兼容旧代码。';
