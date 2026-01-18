/**
 * 智能分类 v5.0 - 双源向量构建器测试
 */

import { DualSourceBuilder, type BookmarkData, type BehaviorData } from './dual-source-builder';
import type { LoggerService } from '../shared/logger';
import type { EmbeddingService } from '../shared/embedding';

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock Embedding Service
const mockEmbeddingService: EmbeddingService = {
  generateEmbedding: jest.fn(),
} as any;

describe('DualSourceBuilder', () => {
  let builder: DualSourceBuilder;
  const testEmbedding = new Array(1024).fill(0.1);

  beforeEach(() => {
    jest.clearAllMocks();
    (mockEmbeddingService.generateEmbedding as jest.Mock).mockResolvedValue(testEmbedding);
    builder = new DualSourceBuilder(mockLogger, mockEmbeddingService);
  });

  const createMockBookmark = (id: string): BookmarkData => ({
    id,
    title: `Bookmark ${id}`,
    description: `Description ${id}`,
    summary: `Summary ${id}`,
    tags: ['tag1', 'tag2'],
  });

  const createMockBehavior = (bookmarkId: string, weight: number = 1): BehaviorData => ({
    bookmarkId,
    actionType: 'view',
    timestamp: new Date(),
    weight,
  });

  describe('build', () => {
    it('应该成功构建双源向量', async () => {
      const bookmarks = [createMockBookmark('1'), createMockBookmark('2')];
      const behaviors = [createMockBehavior('1'), createMockBehavior('2')];

      const result = await builder.build('folder-1', bookmarks, behaviors);

      expect(result.contentEmbedding).toEqual(testEmbedding);
      expect(result.behaviorEmbedding).toEqual(testEmbedding);
      expect(result.contentSourceCount).toBe(2);
      expect(result.behaviorSourceCount).toBe(2);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('空文件夹应该返回零向量', async () => {
      const result = await builder.build('folder-1', [], []);

      expect(result.contentEmbedding).toEqual(new Array(1024).fill(0));
      expect(result.behaviorEmbedding).toEqual(new Array(1024).fill(0));
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('无行为数据时应该返回零行为向量', async () => {
      const bookmarks = [createMockBookmark('1')];

      const result = await builder.build('folder-1', bookmarks, []);

      expect(result.contentEmbedding).toEqual(testEmbedding);
      expect(result.behaviorEmbedding).toEqual(new Array(1024).fill(0));
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
    });
  });
});
