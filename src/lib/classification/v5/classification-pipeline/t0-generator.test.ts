/**
 * 智能分类 v5.0 - T0 生成器测试
 */

import { T0Generator } from './t0-generator';
import type { LoggerService } from '../shared/logger';
import type { EmbeddingService } from '../shared/embedding';
import { L0RuleMatcher } from './l0-rule-matcher';
import { HybridRetriever } from './hybrid-retriever';
import { LLMCaller } from './llm-caller';
import type { ClassificationRequest } from './types';

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
  generateEmbedding: jest.fn().mockResolvedValue(new Array(1024).fill(0.1)),
} as any;

// Mock L0 Matcher
const mockL0Matcher = {
  match: jest.fn(),
} as any;

// Mock Hybrid Retriever
const mockHybridRetriever = {
  retrieve: jest.fn(),
} as any;

// Mock LLM Caller
const mockLLMCaller = {
  shouldCallLLM: jest.fn(),
} as any;

describe('T0Generator', () => {
  let generator: T0Generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new T0Generator(
      mockLogger,
      mockEmbeddingService,
      mockL0Matcher,
      mockHybridRetriever,
      mockLLMCaller
    );
  });

  const createMockRequest = (): ClassificationRequest => ({
    userId: 'user-1',
    bookmarkId: 'bookmark-1',
    title: 'Test Bookmark',
    url: 'https://example.com',
  });

  describe('generate', () => {
    it('L0规则匹配成功时应该直接返回', async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: true,
        folderId: 'folder-1',
        confidence: 0.95,
      });

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.folderId).toBe('folder-1');
      expect(result.confidence).toBe(0.95);
      expect(result.needsT1).toBe(false);
      expect(mockHybridRetriever.retrieve).not.toHaveBeenCalled();
    });

    it('L0规则未匹配时应该使用混合检索', async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: false,
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        {
          folderId: 'folder-2',
          folderName: 'Folder 2',
          fusedScore: 0.85,
        },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(false);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.folderId).toBe('folder-2');
      expect(result.confidence).toBe(0.85);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(mockHybridRetriever.retrieve).toHaveBeenCalled();
    });

    it('应该正确判断是否需要T1纠正', async () => {
      mockL0Matcher.match.mockReturnValueOnce({
        matched: false,
      });

      mockHybridRetriever.retrieve.mockResolvedValueOnce([
        {
          folderId: 'folder-3',
          folderName: 'Folder 3',
          fusedScore: 0.7, // 低置信度
        },
      ]);

      mockLLMCaller.shouldCallLLM.mockReturnValueOnce(true);

      const request = createMockRequest();
      const result = await generator.generate(request);

      expect(result.needsT1).toBe(true);
      expect(result.t1Reason).toBeDefined();
    });
  });
});
