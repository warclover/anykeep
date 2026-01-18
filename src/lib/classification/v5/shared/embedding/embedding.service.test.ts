/**
 * 智能分类 v5.0 - Embedding Service 测试
 */

import { EmbeddingService } from './embedding.service';
import { EmbeddingError } from './types';
import { createLogger } from '../logger';
import type { LoggerService } from '../logger';

// Mock OpenAI
jest.mock('openai');

describe('EmbeddingService', () => {
  let logger: LoggerService;
  let mockOpenAI: jest.Mocked<any>;

  beforeEach(() => {
    logger = createLogger();
    jest.spyOn(logger, 'debug').mockImplementation();
    jest.spyOn(logger, 'warn').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();

    // Mock OpenAI client
    const OpenAI = require('openai');
    mockOpenAI = {
      embeddings: {
        create: jest.fn(),
      },
    };
    OpenAI.mockImplementation(() => mockOpenAI);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });
      expect(service).toBeInstanceOf(EmbeddingService);
    });

    it('应该在缺少 API Key 时抛出错误', () => {
      expect(() => {
        new EmbeddingService(logger, { apiKey: '' });
      }).toThrow(EmbeddingError);
    });
  });

  describe('generateEmbedding', () => {
    it('应该成功生成 embedding', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      const mockEmbedding = new Array(1024).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { total_tokens: 10 },
      });

      const result = await service.generateEmbedding('测试文本');

      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.tokens).toBe(10);
      expect(result.model).toBe('text-embedding-3-small');
    });

    it('应该在文本为空时抛出错误', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      await expect(service.generateEmbedding('')).rejects.toThrow(
        EmbeddingError
      );
    });

    it('应该截断过长的文本', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      const longText = 'a'.repeat(10000);
      const mockEmbedding = new Array(1024).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { total_tokens: 10 },
      });

      await service.generateEmbedding(longText);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.stringMatching(/^a+$/),
        })
      );
      const calledInput = mockOpenAI.embeddings.create.mock.calls[0][0].input;
      expect(calledInput.length).toBeLessThanOrEqual(8000);
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('应该成功批量生成 embeddings', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      const mockEmbedding1 = new Array(1024).fill(0.1);
      const mockEmbedding2 = new Array(1024).fill(0.2);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [
          { embedding: mockEmbedding1 },
          { embedding: mockEmbedding2 },
        ],
        usage: { total_tokens: 20 },
      });

      const results = await service.generateBatchEmbeddings([
        '文本1',
        '文本2',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].embedding).toEqual(mockEmbedding1);
      expect(results[1].embedding).toEqual(mockEmbedding2);
    });

    it('应该在批量大小超过限制时抛出错误', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      const texts = new Array(2049).fill('文本');
      await expect(service.generateBatchEmbeddings(texts)).rejects.toThrow(
        EmbeddingError
      );
    });

    it('应该处理空数组', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      const results = await service.generateBatchEmbeddings([]);
      expect(results).toEqual([]);
    });
  });

  describe('重试机制', () => {
    it('应该在可重试错误时重试', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
        retryDelays: [10, 20, 30],
      });

      const mockEmbedding = new Array(1024).fill(0.1);
      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 },
        });

      const result = await service.generateEmbedding('测试文本');

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
        maxRetries: 2,
        retryDelays: [10, 20],
      });

      mockOpenAI.embeddings.create.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      await expect(service.generateEmbedding('测试文本')).rejects.toThrow(
        EmbeddingError
      );
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3); // 初始 + 2 次重试
    });

    it('应该在不可重试错误时立即失败', async () => {
      const service = new EmbeddingService(logger, {
        apiKey: 'test-key',
      });

      mockOpenAI.embeddings.create.mockRejectedValue(
        new Error('Invalid API key')
      );

      await expect(service.generateEmbedding('测试文本')).rejects.toThrow(
        EmbeddingError
      );
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(1);
    });
  });
});
