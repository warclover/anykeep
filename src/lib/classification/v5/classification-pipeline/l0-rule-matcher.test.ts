/**
 * 智能分类 v5.0 - L0 规则匹配器测试
 */

import { L0RuleMatcher, type Rule } from './l0-rule-matcher';
import type { LoggerService } from '../shared/logger';
import type { ClassificationRequest } from './types';

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe('L0RuleMatcher', () => {
  let matcher: L0RuleMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (overrides?: Partial<ClassificationRequest>): ClassificationRequest => ({
    userId: 'user-1',
    bookmarkId: 'bookmark-1',
    title: 'Test Bookmark',
    url: 'https://example.com/page',
    ...overrides,
  });

  describe('match', () => {
    it('应该匹配URL域名规则', () => {
      const rules: Rule[] = [
        {
          name: 'GitHub Rule',
          folderId: 'folder-github',
          urlDomains: ['github.com'],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: 'https://github.com/user/repo',
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe('folder-github');
      expect(result.ruleName).toBe('GitHub Rule');
    });

    it('应该匹配标题关键词规则', () => {
      const rules: Rule[] = [
        {
          name: 'React Rule',
          folderId: 'folder-react',
          titleKeywords: ['react', 'reactjs'],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        title: 'Learn React Hooks',
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe('folder-react');
    });

    it('应该匹配标签规则', () => {
      const rules: Rule[] = [
        {
          name: 'JavaScript Rule',
          folderId: 'folder-js',
          tags: ['javascript', 'js'],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        tags: ['javascript', 'tutorial'],
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe('folder-js');
    });

    it('无匹配规则时应该返回 matched=false', () => {
      const rules: Rule[] = [
        {
          name: 'GitHub Rule',
          folderId: 'folder-github',
          urlDomains: ['github.com'],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: 'https://example.com/page',
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(false);
    });
  });

  describe('addRule', () => {
    it('应该能够添加新规则', () => {
      matcher = new L0RuleMatcher(mockLogger);

      const rule: Rule = {
        name: 'Test Rule',
        folderId: 'folder-test',
        urlDomains: ['test.com'],
        confidence: 0.9,
      };

      matcher.addRule(rule);

      const rules = matcher.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('Test Rule');
    });
  });
});
