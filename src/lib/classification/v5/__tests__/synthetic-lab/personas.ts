/**
 * 智能分类 v5.0 - 典型用户画像定义
 *
 * 定义四类具有代表性的真实用户画像
 * @version 1.0.0
 * @date 2026-01-18
 */

import type { UserPersona } from './types';

/**
 * A：硬核开发者
 * 特征：垂直度极高，语义细微差别大
 * 测试重点：考察 v5.0 对细粒度语义的区分能力
 */
export const HARDCORE_DEVELOPER: UserPersona = {
  id: 'persona-hardcore-dev',
  type: 'hardcore-dev',
  name: '硬核开发者',
  description: '垂直度极高的技术专家，收藏内容聚焦于特定技术栈，对语义细微差别敏感',
  characteristics: [
    '技术深度高',
    '领域专注',
    '语义细分',
    '命名规范',
    '结构清晰',
  ],
  testFocus: [
    '细粒度语义区分（如 React Hooks vs React Server Components）',
    '技术栈垂直分类（如 Next.js/App Router vs Next.js/Pages Router）',
    '相似概念区分（如 useState vs useReducer）',
    '冷启动准确性（新建技术文件夹）',
  ],
  folders: [
    {
      id: 'folder-react-hooks',
      name: 'React/Hooks',
      description: 'React Hooks 相关文章和最佳实践',
      expectedTopics: ['useState', 'useEffect', 'useCallback', 'useMemo', 'custom hooks'],
      initialBookmarkCount: 25,
    },
    {
      id: 'folder-react-server-components',
      name: 'React/Server Components',
      description: 'React Server Components 和 RSC 架构',
      expectedTopics: ['RSC', 'Server Components', 'streaming', 'suspense'],
      initialBookmarkCount: 20,
    },
    {
      id: 'folder-nextjs-app-router',
      name: 'Next.js/App Router',
      description: 'Next.js 13+ App Router 相关内容',
      expectedTopics: ['app directory', 'layouts', 'loading', 'error handling'],
      initialBookmarkCount: 30,
    },
    {
      id: 'folder-nextjs-pages-router',
      name: 'Next.js/Pages Router',
      description: 'Next.js 传统 Pages Router',
      expectedTopics: ['pages', 'getServerSideProps', 'getStaticProps'],
      initialBookmarkCount: 15,
    },
    {
      id: 'folder-typescript-advanced',
      name: 'TypeScript/Advanced Types',
      description: 'TypeScript 高级类型系统',
      expectedTopics: ['generics', 'conditional types', 'mapped types', 'utility types'],
      initialBookmarkCount: 20,
    },
    {
      id: 'folder-performance-optimization',
      name: 'Performance/Web Vitals',
      description: 'Web 性能优化和 Core Web Vitals',
      expectedTopics: ['LCP', 'FID', 'CLS', 'optimization', 'lighthouse'],
      initialBookmarkCount: 18,
    },
  ],
};

/**
 * B：知识杂食者
 * 特征：领域跨度极大，文件夹多且杂
 * 测试重点：考察 v5.0 在多主题干扰下的召回率
 */
export const KNOWLEDGE_OMNIVORE: UserPersona = {
  id: 'persona-knowledge-omnivore',
  type: 'knowledge-omnivore',
  name: '知识杂食者',
  description: '兴趣广泛的学习者，收藏内容跨越多个领域，文件夹结构复杂',
  characteristics: [
    '兴趣广泛',
    '跨领域学习',
    '文件夹众多',
    '主题多样',
    '分类挑战大',
  ],
  testFocus: [
    '多主题干扰下的准确率',
    '跨领域内容区分（如美食 vs 健康）',
    '相似主题区分（如理财 vs 投资）',
    '文件夹数量对性能的影响',
  ],
  folders: [
    {
      id: 'folder-cooking',
      name: '美食/烹饪技巧',
      description: '烹饪方法、菜谱、厨艺技巧',
      expectedTopics: ['cooking', 'recipes', 'techniques', 'cuisine'],
      initialBookmarkCount: 30,
    },
    {
      id: 'folder-home-decoration',
      name: '装修/家居设计',
      description: '室内设计、装修案例、家居搭配',
      expectedTopics: ['interior design', 'decoration', 'furniture', 'home'],
      initialBookmarkCount: 25,
    },
    {
      id: 'folder-personal-finance',
      name: '理财/个人财务',
      description: '个人理财、预算管理、储蓄技巧',
      expectedTopics: ['budgeting', 'saving', 'personal finance', 'money management'],
      initialBookmarkCount: 20,
    },
    {
      id: 'folder-investment',
      name: '投资/股票基金',
      description: '投资策略、股票分析、基金配置',
      expectedTopics: ['stocks', 'funds', 'investment', 'portfolio'],
      initialBookmarkCount: 22,
    },
    {
      id: 'folder-ai-news',
      name: 'AI/行业动态',
      description: 'AI 行业新闻、技术趋势、产品发布',
      expectedTopics: ['AI news', 'trends', 'products', 'industry'],
      initialBookmarkCount: 35,
    },
    {
      id: 'folder-health-fitness',
      name: '健康/运动健身',
      description: '健康知识、运动方法、健身计划',
      expectedTopics: ['health', 'fitness', 'exercise', 'wellness'],
      initialBookmarkCount: 28,
    },
    {
      id: 'folder-travel',
      name: '旅行/攻略游记',
      description: '旅行攻略、游记分享、目的地推荐',
      expectedTopics: ['travel', 'destinations', 'guides', 'trips'],
      initialBookmarkCount: 24,
    },
    {
      id: 'folder-photography',
      name: '摄影/后期技巧',
      description: '摄影技巧、后期处理、器材评测',
      expectedTopics: ['photography', 'editing', 'cameras', 'techniques'],
      initialBookmarkCount: 18,
    },
    {
      id: 'folder-psychology',
      name: '心理学/自我成长',
      description: '心理学知识、个人成长、思维方式',
      expectedTopics: ['psychology', 'self-improvement', 'mindset', 'growth'],
      initialBookmarkCount: 26,
    },
    {
      id: 'folder-productivity',
      name: '效率/时间管理',
      description: '效率工具、时间管理、工作方法',
      expectedTopics: ['productivity', 'time management', 'tools', 'methods'],
      initialBookmarkCount: 21,
    },
  ],
};

/**
 * C：极简主义者
 * 特征：文件夹极少，依赖"影子分拣"
 * 测试重点：考察 v5.0 的置信度阈值和影子分拣体验
 */
export const MINIMALIST: UserPersona = {
  id: 'persona-minimalist',
  type: 'minimalist',
  name: '极简主义者',
  description: '追求简洁的用户，文件夹数量极少，依赖智能分拣和搜索',
  characteristics: [
    '文件夹极少',
    '依赖智能分拣',
    '高置信度要求',
    '容忍度低',
    '追求简洁',
  ],
  testFocus: [
    '影子分拣的触发准确性',
    '高置信度阈值的有效性',
    '待处理队列的管理体验',
    '少量文件夹下的分类准确率',
  ],
  folders: [
    {
      id: 'folder-inbox',
      name: '待处理',
      description: '未分类的书签，等待后续整理',
      expectedTopics: ['uncategorized', 'pending', 'inbox'],
      initialBookmarkCount: 50,
    },
    {
      id: 'folder-archive',
      name: '归档',
      description: '已处理完成的书签归档',
      expectedTopics: ['archived', 'completed', 'done'],
      initialBookmarkCount: 100,
    },
  ],
};

/**
 * D：混乱囤积者
 * 特征：文件夹命名模糊，冷启动多
 * 测试重点：考察 Gardener 园丁系统的新建文件夹能力
 */
export const CHAOTIC_HOARDER: UserPersona = {
  id: 'persona-chaotic-hoarder',
  type: 'chaotic-hoarder',
  name: '混乱囤积者',
  description: '收藏习惯混乱的用户，文件夹命名模糊，经常创建新文件夹',
  characteristics: [
    '命名模糊',
    '结构混乱',
    '频繁新建',
    '冷启动多',
    '整理困难',
  ],
  testFocus: [
    'Gardener 新建文件夹建议的准确性',
    '模糊命名下的语义理解',
    '冷启动文件夹的分类准确率',
    '文件夹合并建议的有效性',
  ],
  folders: [
    {
      id: 'folder-new-1',
      name: '新建文件夹1',
      description: '未命名的文件夹',
      expectedTopics: ['random', 'mixed'],
      initialBookmarkCount: 5,
    },
    {
      id: 'folder-that-project',
      name: '那个项目',
      description: '模糊命名的项目文件夹',
      expectedTopics: ['project', 'work'],
      initialBookmarkCount: 8,
    },
    {
      id: 'folder-stuff',
      name: '一些东西',
      description: '杂项内容',
      expectedTopics: ['misc', 'various'],
      initialBookmarkCount: 12,
    },
    {
      id: 'folder-later',
      name: '稍后阅读',
      description: '待阅读的内容',
      expectedTopics: ['reading', 'later'],
      initialBookmarkCount: 20,
    },
    {
      id: 'folder-important',
      name: '重要',
      description: '标记为重要的内容',
      expectedTopics: ['important', 'priority'],
      initialBookmarkCount: 15,
    },
    {
      id: 'folder-temp',
      name: '临时',
      description: '临时存放的内容',
      expectedTopics: ['temporary', 'temp'],
      initialBookmarkCount: 10,
    },
  ],
};

/**
 * 所有用户画像列表
 */
export const ALL_PERSONAS: UserPersona[] = [
  HARDCORE_DEVELOPER,
  KNOWLEDGE_OMNIVORE,
  MINIMALIST,
  CHAOTIC_HOARDER,
];

/**
 * 根据类型获取用户画像
 */
export function getPersonaByType(type: UserPersona['type']): UserPersona | undefined {
  return ALL_PERSONAS.find((p) => p.type === type);
}

/**
 * 根据ID获取用户画像
 */
export function getPersonaById(id: string): UserPersona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}
