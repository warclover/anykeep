import type { PredictionRule } from '../../types';

export const contentRules: PredictionRule[] = [
  {
    id: 'content_duplicates',
    name: '去重清理',
    icon: '🧹',
    priority: 88,
    category: 'content',
    enabled: true,
    condition: (selection) => {
      // 检查是否有重复 URL
      const urls = selection.map(b => b.url);
      return urls.length !== new Set(urls).size;
    },
    action: 'deduplicate',
    params: (selection) => ({
      bookmarkIds: selection.map(b => b.id),
    }),
  },
  {
    id: 'content_all_pdf',
    name: '提取文本',
    icon: '📄',
    priority: 90,
    category: 'content',
    enabled: true,
    condition: (selection) => {
      return selection.every(b =>
        b.url?.toLowerCase().endsWith('.pdf') ||
        b.content_type === 'pdf'
      );
    },
    action: 'extract_pdf_text',
  },
  {
    id: 'content_all_video',
    name: '提取字幕',
    icon: '🎬',
    priority: 88,
    category: 'content',
    enabled: true,
    condition: (selection) => {
      const videoHosts = ['youtube.com', 'bilibili.com', 'youtu.be'];
      return selection.every(b =>
        videoHosts.some(host => b.url?.includes(host))
      );
    },
    action: 'extract_subtitles',
  },
  {
    id: 'content_all_article',
    name: '生成摘要',
    icon: '📝',
    priority: 85,
    category: 'content',
    enabled: true,
    condition: (selection) => {
      return selection.every(b =>
        b.content_type === 'article' ||
        b.ai_content_type === 'article'
      );
    },
    action: 'generate_summary',
  },
  {
    id: 'content_tech',
    name: '技术摘要',
    icon: '💻',
    priority: 75,
    category: 'content',
    enabled: true,
    condition: (selection) => {
      const techKeywords = ['github', 'stackoverflow', 'dev.to', 'medium.com'];
      return selection.every(b =>
        techKeywords.some(kw => b.url?.includes(kw))
      );
    },
    action: 'generate_tech_summary',
  },
  {
    id: 'content_news',
    name: '新闻简报',
    icon: '📰',
    priority: 72,
    category: 'content',
    enabled: true,
    condition: (selection) => {
      const newsHosts = ['news.', 'bbc.', 'cnn.', 'reuters.'];
      return selection.every(b =>
        newsHosts.some(host => b.url?.includes(host))
      );
    },
    action: 'generate_news_brief',
  },
];
