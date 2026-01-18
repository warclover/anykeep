/**
 * 智能分类 v5.0 - T1 纠正器测试
 */

import { T1Corrector } from './t1-corrector';
import { LLMCaller } from './llm-caller';
import type { LoggerService } from '../shared/logger';
import type { ClassificationRequest, T0Result, T1Result } from './types';

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock LLMCaller
const mockLLMCaller = {
  callLLM: jest.fn(),
} as any;

describe('T1Corrector', () => {
  let corrector: T1Corrector;

  beforeEach(() => {
    jest.clearAllMocks();
    corrector = new T1Corrector(mockLogger, mockLLMCaller);
  });

  const mockRequest: ClassificationRequest = {
    userId: 'user-1',
    bookmarkId: 'bookmark-1',
    title: 'Test Bookmark',
    description: 'Test Description',
    summary: 'Test Summary',
    tags: ['tag1', 'tag2'],
    url: 'https://example.com',
  };

  const mockT0Result: T0Result = {
    folderId: 'folder-1',
    confidence: 0.65,
    candidates: [
      {
        folderId: 'folder-1',
        folderName: 'Folder 1',
        similarity: 0.85,
      },
      {
        folderId: 'folder-2',
        folderName: 'Folder 2',
        similarity: 0.75,
      },
    ],
    needsT1: true,
    t1Reason: 'low_confidence',
    latencyMs: 450,
  };

  const mockT1Result: T1Result = {
    folderId: 'folder-2',
    confidence: 0.92,
    reasoning: 'Based on content analysis, Folder 2 is more appropriate',
    latencyMs: 3500,
  };

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(corrector).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({ service: 'T1Corrector' });
    });
  });

  describe('correct', () => {
    it('应该成功执行T1纠正', async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      const result = await corrector.correct(mockRequest, mockT0Result);

      expect(result).toEqual(mockT1Result);
      expect(mockLLMCaller.callLLM).toHaveBeenCalledWith({
        bookmark: mockRequest,
        candidates: [
          {
            folderId: 'folder-1',
            folderName: 'Folder 1',
            score: 0.85,
          },
          {
            folderId: 'folder-2',
            folderName: 'Folder 2',
            score: 0.75,
          },
        ],
      });
    });

    it('应该记录开始日志', async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, mockT0Result);

      expect(mockLogger.info).toHaveBeenCalledWith('开始T1纠正', {
        bookmarkId: 'bookmark-1',
        t0FolderId: 'folder-1',
        t0Confidence: 0.65,
        t1Reason: 'low_confidence',
      });
    });

    it('应该记录完成日志', async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, mockT0Result);

      expect(mockLogger.info).toHaveBeenCalledWith('T1纠正完成', {
        bookmarkId: 'bookmark-1',
        t1FolderId: 'folder-2',
        t1Confidence: 0.92,
        latencyMs: 3500,
      });
    });

    it('应该正确转换候选列表格式', async () => {
      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, mockT0Result);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toEqual([
        {
          folderId: 'folder-1',
          folderName: 'Folder 1',
          score: 0.85,
        },
        {
          folderId: 'folder-2',
          folderName: 'Folder 2',
          score: 0.75,
        },
      ]);
    });

    it('应该处理向量冲突触发的T1纠正', async () => {
      const t0ResultWithConflict: T0Result = {
        ...mockT0Result,
        t1Reason: 'vector_conflict',
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultWithConflict);

      expect(mockLogger.info).toHaveBeenCalledWith('开始T1纠正', {
        bookmarkId: 'bookmark-1',
        t0FolderId: 'folder-1',
        t0Confidence: 0.65,
        t1Reason: 'vector_conflict',
      });
    });

    it('应该处理手动请求触发的T1纠正', async () => {
      const t0ResultWithManual: T0Result = {
        ...mockT0Result,
        t1Reason: 'manual_request',
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultWithManual);

      expect(mockLogger.info).toHaveBeenCalledWith('开始T1纠正', {
        bookmarkId: 'bookmark-1',
        t0FolderId: 'folder-1',
        t0Confidence: 0.65,
        t1Reason: 'manual_request',
      });
    });

    it('应该传播LLM调用错误', async () => {
      const error = new Error('LLM API Error');
      mockLLMCaller.callLLM.mockRejectedValueOnce(error);

      await expect(corrector.correct(mockRequest, mockT0Result)).rejects.toThrow(
        'LLM API Error'
      );
    });

    it('应该处理空候选列表', async () => {
      const t0ResultEmpty: T0Result = {
        ...mockT0Result,
        candidates: [],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultEmpty);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toEqual([]);
    });

    it('应该处理单个候选', async () => {
      const t0ResultSingle: T0Result = {
        ...mockT0Result,
        candidates: [
          {
            folderId: 'folder-1',
            folderName: 'Folder 1',
            similarity: 0.85,
          },
        ],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultSingle);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toHaveLength(1);
    });

    it('应该处理多个候选', async () => {
      const t0ResultMultiple: T0Result = {
        ...mockT0Result,
        candidates: [
          { folderId: 'folder-1', folderName: 'Folder 1', similarity: 0.85 },
          { folderId: 'folder-2', folderName: 'Folder 2', similarity: 0.75 },
          { folderId: 'folder-3', folderName: 'Folder 3', similarity: 0.65 },
          { folderId: 'folder-4', folderName: 'Folder 4', similarity: 0.55 },
          { folderId: 'folder-5', folderName: 'Folder 5', similarity: 0.45 },
        ],
      };

      mockLLMCaller.callLLM.mockResolvedValueOnce(mockT1Result);

      await corrector.correct(mockRequest, t0ResultMultiple);

      const callArgs = mockLLMCaller.callLLM.mock.calls[0][0];
      expect(callArgs.candidates).toHaveLength(5);
    });
  });
});
