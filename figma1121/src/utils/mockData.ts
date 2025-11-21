export interface Collection {
  id: string;
  title: string;
  description: string;
  platform: 'wechat' | 'xiaohongshu' | 'bilibili' | 'zhihu' | 'xingqiu';
  type: 'article' | 'video' | 'image' | 'product';
  url: string;
  coverImage: string;
  author: string;
  createdAt: string;
  tags: string[];
  aiTags?: string[];
  aiSummary?: string;
  folder?: string;
}

export const platformNames = {
  wechat: '微信',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  zhihu: '知乎',
  xingqiu: '知识星球',
};

export const platformColors = {
  wechat: 'bg-green-500',
  xiaohongshu: 'bg-red-500',
  bilibili: 'bg-pink-500',
  zhihu: 'bg-blue-500',
  xingqiu: 'bg-orange-500',
};

export const mockCollections: Collection[] = [
  {
    id: '1',
    title: '2024年产品设计趋势：AI驱动的用户体验',
    description: '深入探讨人工智能如何重塑产品设计流程，从用户研究到界面生成的全链路优化...',
    platform: 'wechat',
    type: 'article',
    url: 'https://mp.weixin.qq.com/example1',
    coverImage: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=400',
    author: '设计师小王',
    createdAt: '2025-01-15T10:30:00Z',
    tags: ['产品设计', 'AI', 'UX'],
    aiTags: ['人工智能', '用户体验', '设计趋势', '产品管理'],
    aiSummary: '文章探讨AI在产品设计中的应用，包括自动化设计、智能推荐和用户行为预测等方面，为产品经理提供实践指南。',
    folder: '产品学习',
  },
  {
    id: '2',
    title: '成都探店｜这家咖啡店绝了！',
    description: '隐藏在巷子里的宝藏咖啡店，手冲咖啡超好喝，环境也特别适合拍照📷',
    platform: 'xiaohongshu',
    type: 'image',
    url: 'https://xiaohongshu.com/example2',
    coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    author: '成都美食探店',
    createdAt: '2025-01-14T15:20:00Z',
    tags: ['咖啡', '成都', '探店'],
    aiTags: ['美食', '咖啡馆', '旅行', '摄影'],
    aiSummary: '推荐成都一家特色咖啡店，环境优雅适合拍照，手冲咖啡品质优秀，是周末休闲的好去处。',
    folder: '生活方式',
  },
  {
    id: '3',
    title: 'React 19新特性完全解析',
    description: 'React 19 带来了服务器组件、并发渲染优化等重要更新，本视频详细讲解...',
    platform: 'bilibili',
    type: 'video',
    url: 'https://bilibili.com/example3',
    coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
    author: '前端技术分享',
    createdAt: '2025-01-13T09:00:00Z',
    tags: ['React', '前端开发', '教程'],
    aiTags: ['编程', 'Web开发', 'JavaScript', '技术学习'],
    aiSummary: '详细介绍React 19的新特性，包括服务器组件、Suspense改进和性能优化，适合前端开发者学习。',
    folder: '技术学习',
  },
  {
    id: '4',
    title: '如何在大厂做好跨部门协作？',
    description: '从项目管理的角度，分享在大型互联网公司如何高效推动跨部门项目...',
    platform: 'zhihu',
    type: 'article',
    url: 'https://zhihu.com/example4',
    coverImage: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400',
    author: '互联网产品经理',
    createdAt: '2025-01-12T14:30:00Z',
    tags: ['项目管理', '团队协作', '职场'],
    aiTags: ['管理技巧', '沟通', '效率', '职业发展'],
    aiSummary: '探讨大厂跨部门协作的挑战与解决方案，包括沟通机制、项目管理工具和利益平衡等实用技巧。',
    folder: '职场技能',
  },
  {
    id: '5',
    title: 'Figma插件开发实战：从0到1',
    description: 'Figma插件开发完整教程，包括环境搭建、API使用和实际案例...',
    platform: 'wechat',
    type: 'article',
    url: 'https://mp.weixin.qq.com/example5',
    coverImage: 'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=400',
    author: '设计工具研究所',
    createdAt: '2025-01-11T11:00:00Z',
    tags: ['Figma', '插件开发', '设计工具'],
    aiTags: ['设计', '开发', '工具', '教程'],
    aiSummary: 'Figma插件开发入门指南，涵盖开发环境配置、核心API使用和实战案例，帮助设计师和开发者扩展工作流。',
    folder: '技术学习',
  },
  {
    id: '6',
    title: '日本京都5日游攻略（超详细）',
    description: '京都旅行完整规划，包括交通、住宿、景点、美食推荐🍜',
    platform: 'xiaohongshu',
    type: 'article',
    url: 'https://xiaohongshu.com/example6',
    coverImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
    author: '旅行达人小红',
    createdAt: '2025-01-10T16:45:00Z',
    tags: ['日本', '京都', '旅行攻略'],
    aiTags: ['旅游', '行程规划', '美食', '文化'],
    aiSummary: '详细的京都5日游行程规划，包含景点推荐、交通指南、住宿建议和特色美食，适合第一次去京都的旅行者。',
    folder: '旅行计划',
  },
  {
    id: '7',
    title: '2024年B站年度报告解读',
    description: 'B站发布2024年度数据报告，揭示年轻人的内容消费趋势...',
    platform: 'bilibili',
    type: 'video',
    url: 'https://bilibili.com/example7',
    coverImage: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400',
    author: '数据分析师',
    createdAt: '2025-01-09T13:20:00Z',
    tags: ['数据分析', 'B站', '行业报告'],
    aiTags: ['内容平台', '趋势分析', '用户研究', '商业洞察'],
    aiSummary: '解读B站年度报告数据，分析用户增长、内容趋势和商业化进展，为内容创作者和运营人员提供参考。',
    folder: '行业资讯',
  },
  {
    id: '8',
    title: 'ChatGPT提示词工程最佳实践',
    description: '如何写出高质量的GPT提示词？分享20个实用技巧和案例...',
    platform: 'zhihu',
    type: 'article',
    url: 'https://zhihu.com/example8',
    coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400',
    author: 'AI应用研究员',
    createdAt: '2025-01-08T10:15:00Z',
    tags: ['ChatGPT', 'AI', '提示词'],
    aiTags: ['人工智能', '效率工具', '学习方法', '技巧'],
    aiSummary: '系统介绍ChatGPT提示词编写技巧，包括角色设定、上下文构建和输出格式控制等，帮助用户更高效使用AI工具。',
    folder: '技术学习',
  },
];

export const folders = [
  { id: 'f1', name: '产品学习', count: 3, icon: '📚' },
  { id: 'f2', name: '技术学习', count: 4, icon: '💻' },
  { id: 'f3', name: '生活方式', count: 2, icon: '☕' },
  { id: 'f4', name: '旅行计划', count: 1, icon: '✈️' },
  { id: 'f5', name: '职场技能', count: 1, icon: '💼' },
  { id: 'f6', name: '行业资讯', count: 2, icon: '📰' },
];

export const platforms = [
  { id: 'wechat', name: '微信', icon: '💬', connected: true, count: 245 },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', connected: true, count: 128 },
  { id: 'bilibili', name: 'B站', icon: '📺', connected: true, count: 89 },
  { id: 'zhihu', name: '知乎', icon: '🎓', connected: true, count: 156 },
  { id: 'xingqiu', name: '知识星球', icon: '⭐', connected: false, count: 0 },
];
