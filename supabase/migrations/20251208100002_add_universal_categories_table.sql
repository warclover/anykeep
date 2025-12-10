-- ============================================================================
-- V4.0 配置中心化: 通用分类表
-- ============================================================================
-- 将硬编码的 30 个通用分类迁移到数据库，支持热更新

-- 1. 创建分类组枚举类型
CREATE TYPE classification_category_group AS ENUM (
  'tech',      -- 技术开发
  'design',    -- 产品设计
  'business',  -- 商业财经
  'content',   -- 内容创作
  'lifestyle', -- 生活方式
  'learning',  -- 学习成长
  'other'      -- 其他
);

-- 2. 创建通用分类表
CREATE TABLE IF NOT EXISTS universal_categories (
  id TEXT PRIMARY KEY,                            -- 分类 ID (如 'tech/frontend')
  name TEXT NOT NULL,                             -- 分类名称 (中文)
  synonyms TEXT[] NOT NULL DEFAULT '{}',          -- 同义词列表
  category_group classification_category_group NOT NULL,
  suggested_folder_name TEXT NOT NULL,            -- 推荐的文件夹名称
  icon TEXT NOT NULL DEFAULT '📁',                -- 图标 (emoji)
  sort_order INTEGER NOT NULL DEFAULT 0,          -- 排序权重
  is_active BOOLEAN NOT NULL DEFAULT true,        -- 是否启用
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX idx_universal_categories_group ON universal_categories(category_group);
CREATE INDEX idx_universal_categories_active ON universal_categories(is_active) WHERE is_active = true;

-- 4. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_universal_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_universal_categories_updated_at
  BEFORE UPDATE ON universal_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_universal_categories_updated_at();

-- 5. 插入初始数据 (30 个通用分类)
INSERT INTO universal_categories (id, name, synonyms, category_group, suggested_folder_name, icon, sort_order) VALUES
-- 技术开发 (7 个)
('tech/frontend', '前端开发', ARRAY['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'CSS', 'Tailwind', 'JavaScript', 'TypeScript', 'HTML', '前端', 'Web开发', '网页开发', 'UI组件', '响应式'], 'tech', '前端开发', '🌐', 100),
('tech/backend', '后端开发', ARRAY['Node.js', 'Python', 'Java', 'Go', 'Rust', 'PHP', 'Spring', 'Django', 'FastAPI', 'Express', 'NestJS', '后端', '服务端', 'API', '微服务', '数据库'], 'tech', '后端开发', '⚙️', 101),
('tech/mobile', '移动开发', ARRAY['iOS', 'Android', 'Flutter', 'React Native', 'Swift', 'Kotlin', '移动端', 'App开发', '小程序', '跨平台', '原生开发'], 'tech', '移动开发', '📱', 102),
('tech/ai', 'AI/机器学习', ARRAY['LLM', 'GPT', 'Claude', 'ChatGPT', '深度学习', '神经网络', 'NLP', 'AIGC', '大模型', 'Prompt', 'RAG', '向量数据库', '机器学习', '人工智能', 'AI', 'ML', 'Computer Vision'], 'tech', 'AI 技术', '🤖', 103),
('tech/data', '数据工程', ARRAY['数据库', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'ETL', '数据分析', 'BI', '数仓', '数据治理', '大数据', 'Spark', 'Flink', '数据可视化', 'Tableau'], 'tech', '数据工程', '📊', 104),
('tech/devops', '运维/云原生', ARRAY['Docker', 'Kubernetes', 'K8s', 'CI/CD', 'Linux', 'AWS', '微服务', 'Serverless', '云计算', '容器化', 'DevOps', 'Jenkins', 'GitHub Actions', 'Terraform', '监控'], 'tech', '运维云原生', '☁️', 105),
('tech/security', '网络安全', ARRAY['渗透测试', '加密', '漏洞', '安全', '防护', 'CTF', '逆向', 'Web安全', '密码学', '身份认证', 'OAuth'], 'tech', '网络安全', '🔐', 106),

-- 产品设计 (4 个)
('design/ui', 'UI/视觉设计', ARRAY['Figma', 'Sketch', 'UI设计', '视觉设计', '界面设计', '配色', '图标', '组件库', '设计系统', 'Design System'], 'design', 'UI 设计', '🎨', 200),
('design/ux', '用户体验', ARRAY['UX', '交互设计', '用研', '可用性', '用户旅程', '原型', '体验设计', '信息架构', '用户测试'], 'design', '用户体验', '✨', 201),
('design/product', '产品思维', ARRAY['PRD', '产品需求', '产品经理', '竞品分析', '用户故事', '产品设计', 'MVP', '需求分析', '产品规划', '商业分析'], 'design', '产品思维', '💡', 202),
('design/creative', '创意设计', ARRAY['品牌设计', '平面设计', '插画', '动效', '3D', '视频剪辑', 'Motion', '海报', 'Logo', 'VI'], 'design', '创意设计', '🎭', 203),

-- 商业财经 (4 个)
('business/startup', '创业/商业', ARRAY['创业', '融资', '商业模式', '创始人', 'VC', '增长黑客', 'PMF', '赛道', '商业计划书'], 'business', '创业商业', '🚀', 300),
('business/marketing', '营销增长', ARRAY['营销', '增长', '运营', 'SEO', 'SEM', '私域', '品牌营销', '内容营销', '社群运营', '用户增长'], 'business', '营销增长', '📈', 301),
('business/investment', '投资理财', ARRAY['投资', '理财', '股票', '基金', 'ETF', '财务自由', '资产配置', '定投', '复利', '财报分析'], 'business', '投资理财', '💰', 302),
('business/management', '管理/领导力', ARRAY['管理', '领导力', '团队管理', 'OKR', '绩效', '招聘', '组织架构', '企业文化', '向上管理'], 'business', '管理领导力', '👔', 303),

-- 内容创作 (4 个)
('content/writing', '写作/文案', ARRAY['写作', '文案', '公众号', '自媒体', '内容创作', '文章', '爆款', '标题党', '写作技巧', '文笔'], 'content', '写作文案', '✍️', 400),
('content/video', '视频创作', ARRAY['视频', '剪辑', 'Premiere', 'Final Cut', '达芬奇', 'B站', '抖音', 'Vlog', '短视频', '直播'], 'content', '视频创作', '🎬', 401),
('content/audio', '音频/播客', ARRAY['播客', 'Podcast', '音频', '小宇宙', '喜马拉雅', '声音', '录音', '音乐制作', '混音'], 'content', '音频播客', '🎙️', 402),
('content/knowledge', '知识管理', ARRAY['笔记', 'Notion', 'Obsidian', '知识库', '第二大脑', 'PKM', '卡片笔记', '知识图谱', '信息管理'], 'content', '知识管理', '🧠', 403),

-- 生活方式 (5 个)
('lifestyle/health', '健康/健身', ARRAY['健身', '减肥', '健康', '运动', '跑步', '瑜伽', '饮食', '营养', '睡眠', '冥想', '心理健康'], 'lifestyle', '健康健身', '💪', 500),
('lifestyle/travel', '旅行/出行', ARRAY['旅行', '旅游', '攻略', '酒店', '机票', '自驾', '签证', '目的地', '探店', '民宿'], 'lifestyle', '旅行出行', '✈️', 501),
('lifestyle/food', '美食/烹饪', ARRAY['美食', '烹饪', '菜谱', '食谱', '做饭', '烘焙', '餐厅', '探店', '饮品', '咖啡'], 'lifestyle', '美食烹饪', '🍳', 502),
('lifestyle/home', '家居/装修', ARRAY['家居', '装修', '室内设计', '收纳', '整理', '智能家居', '软装', '家电', '绿植'], 'lifestyle', '家居生活', '🏠', 503),
('lifestyle/hobby', '兴趣爱好', ARRAY['爱好', '摄影', '绘画', '音乐', '电影', '游戏', '阅读', '手工', '收藏', '养宠'], 'lifestyle', '兴趣爱好', '🎯', 504),

-- 学习成长 (4 个)
('learning/language', '语言学习', ARRAY['英语', '日语', '语言学习', '口语', '听力', '词汇', '语法', '外语', '雅思', '托福'], 'learning', '语言学习', '🗣️', 600),
('learning/career', '职业发展', ARRAY['职业', '求职', '面试', '简历', '跳槽', '晋升', '职场', '副业', '转行', '职业规划'], 'learning', '职业发展', '📋', 601),
('learning/skill', '技能提升', ARRAY['技能', '学习', '课程', '教程', '培训', '认证', '考试', '自学', '在线课程'], 'learning', '技能提升', '📚', 602),
('learning/thinking', '思维/效率', ARRAY['思维', '效率', '时间管理', 'GTD', '番茄钟', '心智模型', '批判性思维', '决策', '习惯'], 'learning', '思维效率', '⚡', 603),

-- 其他 (2 个)
('other/tools', '工具/资源', ARRAY['工具', '软件', 'App', '网站', '资源', '插件', 'Chrome扩展', '效率工具', '免费资源'], 'other', '工具资源', '🔧', 700),
('other/news', '新闻/资讯', ARRAY['新闻', '资讯', '热点', '趋势', '行业动态', '科技新闻', '产品发布', '快讯'], 'other', '资讯动态', '📰', 701);

-- 6. 添加 RLS 策略 (公开只读访问，管理员可写)
ALTER TABLE universal_categories ENABLE ROW LEVEL SECURITY;

-- 所有已认证用户可读取
CREATE POLICY "universal_categories_select_policy" ON universal_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- 管理员可写 (通过 service_role)
-- Note: 实际管理操作应通过后端 API 使用 service_role 完成

-- 7. 添加注释
COMMENT ON TABLE universal_categories IS 'V4.0 通用分类配置表，支持热更新';
COMMENT ON COLUMN universal_categories.synonyms IS '同义词数组，用于关键词匹配';
COMMENT ON COLUMN universal_categories.sort_order IS '排序权重，数字越小越靠前';
