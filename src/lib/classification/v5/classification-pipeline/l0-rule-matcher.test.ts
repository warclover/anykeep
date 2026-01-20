/**
 * 智能分类 v5.0 - L0 规则匹配器测试
 */

import { L0RuleMatcher, type Rule } from "./l0-rule-matcher";
import type { LoggerService } from "../shared/logger";
import type { ClassificationRequest } from "./types";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("L0RuleMatcher", () => {
  let matcher: L0RuleMatcher;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (
    overrides?: Partial<ClassificationRequest>,
  ): ClassificationRequest => ({
    userId: "user-1",
    bookmarkId: "bookmark-1",
    title: "Test Bookmark",
    url: "https://example.com/page",
    ...overrides,
  });

  describe("match", () => {
    it("应该匹配URL域名规则", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://github.com/user/repo",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-github");
      expect(result.ruleName).toBe("GitHub Rule");
    });

    it("应该匹配标题关键词规则", () => {
      const rules: Rule[] = [
        {
          name: "React Rule",
          folderId: "folder-react",
          titleKeywords: ["react", "reactjs"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        title: "Learn React Hooks",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-react");
    });

    it("应该匹配标签规则", () => {
      const rules: Rule[] = [
        {
          name: "JavaScript Rule",
          folderId: "folder-js",
          tags: ["javascript", "js"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        tags: ["javascript", "tutorial"],
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-js");
    });

    it("无匹配规则时应该返回 matched=false", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://example.com/page",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(false);
    });
  });

  describe("addRule", () => {
    it("应该能够添加新规则", () => {
      matcher = new L0RuleMatcher(mockLogger);

      const rule: Rule = {
        name: "Test Rule",
        folderId: "folder-test",
        urlDomains: ["test.com"],
        confidence: 0.9,
      };

      matcher.addRule(rule);

      const rules = matcher.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe("Test Rule");
    });
  });

  describe("L0 规则匹配 - 边界情况", () => {
    it("应该处理多个规则，返回第一个匹配的规则", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
        {
          name: "GitLab Rule",
          folderId: "folder-gitlab",
          urlDomains: ["gitlab.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://github.com/user/repo",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-github");
      expect(result.ruleName).toBe("GitHub Rule");
    });

    it("应该处理子域名匹配", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://api.github.com/repos",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-github");
    });

    it("应该处理大小写不敏感的标题关键词匹配", () => {
      const rules: Rule[] = [
        {
          name: "React Rule",
          folderId: "folder-react",
          titleKeywords: ["react"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        title: "REACT Tutorial for Beginners",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-react");
    });

    it("应该处理大小写不敏感的标签匹配", () => {
      const rules: Rule[] = [
        {
          name: "JavaScript Rule",
          folderId: "folder-js",
          tags: ["javascript"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        tags: ["JavaScript", "Tutorial"],
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-js");
    });

    it("应该处理无效的 URL", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "not-a-valid-url",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(false);
    });

    it("应该处理空标签数组", () => {
      const rules: Rule[] = [
        {
          name: "JavaScript Rule",
          folderId: "folder-js",
          tags: ["javascript"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        tags: [],
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(false);
    });

    it("应该处理未定义的标签", () => {
      const rules: Rule[] = [
        {
          name: "JavaScript Rule",
          folderId: "folder-js",
          tags: ["javascript"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        tags: undefined,
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(false);
    });

    it("应该处理组合规则（URL + 标题 + 标签）", () => {
      const rules: Rule[] = [
        {
          name: "GitHub React Rule",
          folderId: "folder-github-react",
          urlDomains: ["github.com"],
          titleKeywords: ["react"],
          tags: ["javascript"],
          confidence: 0.98,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      // 只匹配 URL
      const request1 = createMockRequest({
        url: "https://github.com/user/repo",
        title: "Vue Tutorial",
        tags: ["python"],
      });

      const result1 = matcher.match(request1);
      expect(result1.matched).toBe(true);

      // 只匹配标题
      const request2 = createMockRequest({
        url: "https://example.com",
        title: "React Hooks",
        tags: ["python"],
      });

      const result2 = matcher.match(request2);
      expect(result2.matched).toBe(true);

      // 只匹配标签
      const request3 = createMockRequest({
        url: "https://example.com",
        title: "Python Tutorial",
        tags: ["javascript"],
      });

      const result3 = matcher.match(request3);
      expect(result3.matched).toBe(true);
    });

    it("应该处理空规则列表", () => {
      matcher = new L0RuleMatcher(mockLogger, []);

      const request = createMockRequest({
        url: "https://github.com/user/repo",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(false);
    });

    it("应该处理部分匹配的关键词", () => {
      const rules: Rule[] = [
        {
          name: "React Rule",
          folderId: "folder-react",
          titleKeywords: ["react"],
          confidence: 0.9,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        title: "Understanding ReactJS and Redux",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.folderId).toBe("folder-react");
    });

    it("应该返回正确的置信度", () => {
      const rules: Rule[] = [
        {
          name: "High Confidence Rule",
          folderId: "folder-high",
          urlDomains: ["github.com"],
          confidence: 0.99,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://github.com/user/repo",
      });

      const result = matcher.match(request);

      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(0.99);
    });

    it("应该记录调试日志", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://github.com/user/repo",
      });

      matcher.match(request);

      expect(mockLogger.debug).toHaveBeenCalledWith("开始L0规则匹配", {
        bookmarkId: "bookmark-1",
        ruleCount: 1,
      });
    });

    it("应该记录匹配成功日志", () => {
      const rules: Rule[] = [
        {
          name: "GitHub Rule",
          folderId: "folder-github",
          urlDomains: ["github.com"],
          confidence: 0.95,
        },
      ];

      matcher = new L0RuleMatcher(mockLogger, rules);

      const request = createMockRequest({
        url: "https://github.com/user/repo",
      });

      matcher.match(request);

      expect(mockLogger.info).toHaveBeenCalledWith("L0规则匹配成功", {
        ruleName: "GitHub Rule",
        folderId: "folder-github",
      });
    });
  });
});
