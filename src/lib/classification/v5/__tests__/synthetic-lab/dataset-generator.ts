/**
 * 智能分类 v5.0 - 测试数据生成器
 *
 * 生成黄金评估集（Golden Dataset）
 * @version 1.0.0
 * @date 2026-01-18
 */

import type { TestBookmark, GoldenDataset, UserPersona } from './types';

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  /** 数据源名称 */
  name: string;
  /** 数据源URL */
  url?: string;
  /** 数据源类型 */
  type: 'awesome-list' | 'real-data' | 'synthetic';
  /** 主题标签 */
  topics: string[];
}

/**
 * 生成器配置
 */
export interface GeneratorConfig {
  /** 每个文件夹生成的书签数量 */
  bookmarksPerFolder: number;
  /** 是否包含边缘案例 */
  includeEdgeCases: boolean;
  /** 是否包含相似内容 */
  includeSimilarContent: boolean;
  /** 标准答案置信度阈值 */
  groundTruthConfidenceThreshold: number;
}

/**
 * 默认生成器配置
 */
const DEFAULT_CONFIG: GeneratorConfig = {
  bookmarksPerFolder: 20,
  includeEdgeCases: true,
  includeSimilarContent: true,
  groundTruthConfidenceThreshold: 0.95,
};

/**
 * 测试数据生成器
 */
export class DatasetGenerator {
  private config: GeneratorConfig;

  constructor(config?: Partial<GeneratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 为用户画像生成黄金评估集
   */
  async generateDataset(_persona: UserPersona): Promise<GoldenDataset> {
    const bookmarks: TestBookmark[] = [];

    // 为每个文件夹生成测试书签
    for (const folder of _persona.folders) {
      const folderBookmarks = await this.generateBookmarksForFolder(
        folder.id,
        folder.name,
        folder.expectedTopics,
        this.config.bookmarksPerFolder
      );
      bookmarks.push(...folderBookmarks);
    }

    // 添加边缘案例
    if (this.config.includeEdgeCases) {
      const edgeCases = await this.generateEdgeCases(_persona);
      bookmarks.push(...edgeCases);
    }

    // 添加相似内容测试
    if (this.config.includeSimilarContent) {
      const similarContent = await this.generateSimilarContent(_persona);
      bookmarks.push(...similarContent);
    }

    return {
      id: `dataset-${_persona.id}-${Date.now()}`,
      name: `${_persona.name} - 黄金评估集`,
      description: `为 ${_persona.name} 生成的测试数据集，包含 ${bookmarks.length} 条书签`,
      _persona,
      bookmarks,
      createdAt: new Date(),
      version: '1.0.0',
    };
  }

  /**
   * 为文件夹生成测试书签
   */
  private async generateBookmarksForFolder(
    folderId: string,
    folderName: string,
    topics: string[],
    count: number
  ): Promise<TestBookmark[]> {
    const bookmarks: TestBookmark[] = [];

    for (let i = 0; i < count; i++) {
      const topic = topics[i % topics.length];
      const bookmark = await this.generateBookmark(folderId, folderName, topic, i);
      bookmarks.push(bookmark);
    }

    return bookmarks;
  }

  /**
   * 生成单个测试书签
   */
  private async generateBookmark(
    folderId: string,
    folderName: string,
    topic: string,
    index: number
  ): Promise<TestBookmark> {
    // 这里使用模板生成，实际应该从真实数据源提取
    const bookmarkId = `bookmark-${folderId}-${index}`;

    return {
      id: bookmarkId,
      title: `${topic} - Example ${index + 1}`,
      url: `https://example.com/${topic.toLowerCase().replace(/\s+/g, '-')}/${index}`,
      description: `A comprehensive guide about ${topic}`,
      summary: `This article covers ${topic} in detail, including best practices and common pitfalls.`,
      tags: [topic, folderName.split('/')[0]],
      content: this.generateContent(topic),
      groundTruthFolderId: folderId,
      groundTruthConfidence: this.config.groundTruthConfidenceThreshold,
      source: 'synthetic',
      topics: [topic],
    };
  }

  /**
   * 生成内容
   */
  private generateContent(topic: string): string {
    return `
# ${topic}

This is a detailed article about ${topic}. It covers various aspects including:

- Introduction to ${topic}
- Key concepts and principles
- Best practices and patterns
- Common mistakes to avoid
- Real-world examples
- Advanced techniques

## Conclusion

Understanding ${topic} is essential for modern development.
    `.trim();
  }

  /**
   * 生成边缘案例
   */
  private async generateEdgeCases(_persona: UserPersona): Promise<TestBookmark[]> {
    const edgeCases: TestBookmark[] = [];

    // 案例1：完全不相关的内容
    edgeCases.push({
      id: `edge-case-unrelated-${Date.now()}`,
      title: '如何制作完美的意大利面',
      url: 'https://example.com/cooking/pasta',
      description: '详细的意大利面制作教程',
      summary: '从选材到烹饪，教你做出餐厅级别的意大利面',
      tags: ['cooking', 'recipe'],
      content: '意大利面制作步骤...',
      groundTruthFolderId: 'none', // 应该触发新建文件夹建议
      groundTruthConfidence: 0.0,
      source: 'edge-case',
      topics: ['cooking'],
    });

    return edgeCases;
  }

  /**
   * 生成相似内容测试
   */
  private async generateSimilarContent(_persona: UserPersona): Promise<TestBookmark[]> {
    const similarContent: TestBookmark[] = [];

    // 为硬核开发者生成相似但应该区分的内容
    if (_persona.type === 'hardcore-dev') {
      // React Hooks vs Server Components
      similarContent.push(
        {
          id: `similar-hooks-${Date.now()}`,
          title: 'Understanding useEffect Hook in React',
          url: 'https://example.com/react/useeffect',
          description: 'Deep dive into useEffect hook',
          summary: 'Learn how to use useEffect for side effects in React components',
          tags: ['react', 'hooks'],
          groundTruthFolderId: 'folder-react-hooks',
          groundTruthConfidence: 0.95,
          source: 'similar-content',
          topics: ['useEffect', 'hooks'],
        },
        {
          id: `similar-rsc-${Date.now()}`,
          title: 'React Server Components: A New Paradigm',
          url: 'https://example.com/react/server-components',
          description: 'Introduction to React Server Components',
          summary: 'Explore the new React Server Components architecture',
          tags: ['react', 'server-components'],
          groundTruthFolderId: 'folder-react-server-components',
          groundTruthConfidence: 0.95,
          source: 'similar-content',
          topics: ['RSC', 'server-components'],
        }
      );
    }

    return similarContent;
  }
}
