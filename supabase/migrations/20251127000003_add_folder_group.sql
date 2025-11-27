/**
 * 添加文件夹分组字段
 * 支持将文件夹分配到不同类别：工作、学习、生活、娱乐、其他
 */

-- 1. 添加 folder_group 字段
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS folder_group VARCHAR(20) DEFAULT 'other';

-- 2. 添加注释
COMMENT ON COLUMN public.folders.folder_group IS '文件夹分组：work(工作相关), study(学习成长), life(生活方式), entertainment(休闲娱乐), other(其他收藏)';

-- 3. 添加检查约束
ALTER TABLE public.folders
ADD CONSTRAINT check_folder_group
CHECK (folder_group IN ('work', 'study', 'life', 'entertainment', 'other'));

-- 4. 创建索引（优化按分组查询）
CREATE INDEX IF NOT EXISTS idx_folders_group
ON public.folders(user_id, folder_group)
WHERE deleted_at IS NULL AND is_system = FALSE;

-- 5. 迁移现有数据（根据名称关键词自动分配分组）
UPDATE public.folders
SET folder_group = CASE
  -- 工作相关关键词
  WHEN name ~* '工作|职场|项目|公司|业务|办公|会议|客户|行业' THEN 'work'
  -- 学习成长关键词
  WHEN name ~* '学习|技术|产品|教程|课程|知识|笔记|读书|教育|培训' THEN 'study'
  -- 生活方式关键词
  WHEN name ~* '生活|旅行|美食|健康|运动|家庭|购物|时尚|美妆' THEN 'life'
  -- 休闲娱乐关键词
  WHEN name ~* '娱乐|游戏|电影|音乐|视频|动漫|小说|综艺' THEN 'entertainment'
  -- 其他
  ELSE 'other'
END
WHERE is_system = FALSE AND deleted_at IS NULL;

-- 6. 系统文件夹不参与分组，设置为 NULL
UPDATE public.folders
SET folder_group = NULL
WHERE is_system = TRUE;
