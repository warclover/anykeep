/**
 * Golden Dataset 门禁测试
 *
 * 符合主方案规范：
 * - 30 Critical Cases: 必须 100% 通过（任何失败都阻断发版）
 * - 50 Important Cases: 必须 95% 通过（允许最多 2 个失败）
 *
 * @version 1.1.0
 * @since 2026-01-10
 */

import { HybridIntentClassifier } from "../hybrid-intent-classifier";
import type { IntentType } from "../types";

// ============================================
// 测试用例类型定义
// ============================================

interface TestCase {
  /** 用户输入 */
  input: string;
  /** 期望的意图 */
  expected: {
    type: IntentType;
    subType?: string;
  };
  /** 是否跳过（待改进的规则） */
  skip?: boolean;
  /** 跳过原因 */
  skipReason?: string;
}

interface TestResults {
  critical: {
    passed: number;
    failed: number;
    total: number;
    failedCases: string[];
  };
  important: {
    passed: number;
    failed: number;
    total: number;
    failedCases: string[];
  };
}

// ============================================
// 发版门禁配置
// ============================================

const RELEASE_GATE = {
  critical: { passRate: 100, maxRegression: 0 },
  important: { passRate: 95, maxRegression: 2 },
  overall: { passRate: 90 },
} as const;

// ============================================
// Critical Cases (30 个) - 必须 100% 通过
// ============================================

const CRITICAL_CASES: TestCase[] = [
  // ========== 搜索意图 (6 cases) ==========
  { input: "搜索 React", expected: { type: "query", subType: "search" } },
  {
    input: "找一下关于 AI 的文章",
    expected: { type: "query", subType: "search" },
  },
  {
    input: "查找 TypeScript 教程",
    expected: { type: "query", subType: "search" },
  },
  { input: "搜 JavaScript", expected: { type: "query", subType: "search" } },
  {
    input: "帮我找找前端相关的",
    expected: { type: "query", subType: "search" },
  },
  { input: "搜索Python教程", expected: { type: "query", subType: "search" } },

  // ========== 删除意图（高风险）(4 cases) ==========
  { input: "删除这个书签", expected: { type: "action", subType: "delete" } },
  { input: "删除这条收藏", expected: { type: "action", subType: "delete" } },
  { input: "把这个书签删除", expected: { type: "action", subType: "delete" } },
  { input: "删除选中的书签", expected: { type: "action", subType: "delete" } },

  // ========== 导出意图 (4 cases) ==========
  // 注: 使用 create:export 与 slot-schemas.ts 保持一致 (Code Review #8)
  { input: "导出为 Markdown", expected: { type: "create", subType: "export" } },
  { input: "导出所有收藏", expected: { type: "create", subType: "export" } },
  { input: "导出成 CSV", expected: { type: "create", subType: "export" } },
  { input: "把书签导出来", expected: { type: "create", subType: "export" } },

  // ========== 整理意图 (4 cases) ==========
  { input: "整理一下收藏", expected: { type: "organize", subType: "cleanup" } },
  { input: "帮我分类", expected: { type: "organize", subType: "classify" } },
  {
    input: "清理重复的书签",
    expected: { type: "organize", subType: "dedupe" },
  },
  { input: "去除重复", expected: { type: "organize", subType: "dedupe" } },

  // ========== 闲聊意图 (4 cases) ==========
  { input: "你好", expected: { type: "chitchat", subType: "greeting" } },
  { input: "谢谢", expected: { type: "chitchat", subType: "thanks" } },
  { input: "帮助", expected: { type: "chitchat", subType: "help" } },
  { input: "你能做什么", expected: { type: "chitchat", subType: "help" } },

  // ========== 统计意图 (4 cases) ==========
  { input: "有多少书签", expected: { type: "query", subType: "count" } },
  { input: "统计一下收藏数量", expected: { type: "query", subType: "count" } },
  { input: "书签总数是多少", expected: { type: "query", subType: "count" } },
  { input: "收藏了多少条", expected: { type: "query", subType: "count" } },

  // ========== 标签操作 (4 cases) ==========
  { input: "添加标签", expected: { type: "action", subType: "tag" } },
  { input: "给书签添加标签", expected: { type: "action", subType: "tag" } },
  { input: "加个标签", expected: { type: "action", subType: "tag" } },
  { input: "标记为重要", expected: { type: "action", subType: "tag" } },
];

// ============================================
// Important Cases (50 个) - 必须 95% 通过
// ============================================

const IMPORTANT_CASES: TestCase[] = [
  // ========== 口语化表达 (10 cases) ==========
  { input: "整理收藏", expected: { type: "organize", subType: "cleanup" } },
  { input: "删除收藏", expected: { type: "action", subType: "delete" } },
  { input: "列出书签", expected: { type: "query", subType: "list" } },
  { input: "列出收藏", expected: { type: "query", subType: "list" } },
  { input: "查看最近收藏", expected: { type: "query", subType: "list" } },
  { input: "显示所有书签", expected: { type: "query", subType: "list" } },
  { input: "清理收藏", expected: { type: "organize", subType: "cleanup" } },
  { input: "自动分类", expected: { type: "organize", subType: "classify" } },
  { input: "智能分类", expected: { type: "organize", subType: "classify" } },
  { input: "批量分类", expected: { type: "organize", subType: "classify" } },

  // ========== 移动操作 (8 cases) ==========
  { input: "移到工作文件夹", expected: { type: "organize", subType: "move" } },
  { input: "移动到学习", expected: { type: "organize", subType: "move" } },
  {
    input: "转移到其他文件夹",
    expected: { type: "organize", subType: "move" },
  },
  {
    input: "把书签挪到技术分类",
    expected: { type: "organize", subType: "move" },
  },
  { input: "移动书签到归档", expected: { type: "organize", subType: "move" } },
  { input: "移动这个书签", expected: { type: "organize", subType: "move" } },
  {
    input: "把它放到另一个文件夹",
    expected: { type: "organize", subType: "move" },
  },
  { input: "移动选中的书签", expected: { type: "organize", subType: "move" } },

  // ========== 摘要/分析 (8 cases) ==========
  { input: "生成摘要", expected: { type: "create", subType: "digest" } },
  { input: "总结一下", expected: { type: "create", subType: "digest" } },
  { input: "概括这篇文章", expected: { type: "create", subType: "digest" } },
  { input: "给我一个报告", expected: { type: "analyze", subType: "report" } },
  {
    input: "分析一下我的收藏",
    expected: { type: "analyze", subType: "insight" },
  },
  { input: "看看数据洞察", expected: { type: "analyze", subType: "insight" } },
  { input: "周报", expected: { type: "analyze", subType: "report" } },
  { input: "月度报告", expected: { type: "analyze", subType: "report" } },

  // ========== 学习相关 (8 cases) ==========
  {
    input: "开始复习",
    expected: { type: "learn", subType: "active_recall_start" },
  },
  { input: "复习一下知识", expected: { type: "learn", subType: "review" } },
  { input: "学习路径", expected: { type: "learn", subType: "path" } },
  { input: "制定学习计划", expected: { type: "learn", subType: "path" } },
  { input: "回顾知识", expected: { type: "learn", subType: "review" } },
  { input: "知识回顾", expected: { type: "learn", subType: "review" } },
  { input: "规划学习路径", expected: { type: "learn", subType: "path" } },
  {
    input: "今日复习",
    expected: { type: "learn", subType: "active_recall_start" },
  },

  // ========== 带时间范围 (8 cases) ==========
  { input: "最近收藏", expected: { type: "query", subType: "list" } },
  { input: "今天的收藏", expected: { type: "query", subType: "list" } },
  { input: "本周收藏", expected: { type: "query", subType: "list" } },
  { input: "列出最近添加的", expected: { type: "query", subType: "list" } },
  { input: "显示最近的书签", expected: { type: "query", subType: "list" } },
  { input: "查看今天添加的", expected: { type: "query", subType: "list" } },
  { input: "最近一周添加的", expected: { type: "query", subType: "list" } },
  { input: "近期添加的收藏", expected: { type: "query", subType: "list" } },

  // ========== 按平台筛选 (8 cases) ==========
  { input: "微信的收藏", expected: { type: "query", subType: "search" } },
  { input: "B站的视频", expected: { type: "query", subType: "search" } },
  { input: "小红书的文章", expected: { type: "query", subType: "search" } },
  { input: "知乎的问答", expected: { type: "query", subType: "search" } },
  { input: "GitHub 的仓库", expected: { type: "query", subType: "search" } },
  { input: "掘金的帖子", expected: { type: "query", subType: "search" } },
  { input: "公众号文章", expected: { type: "query", subType: "search" } },
  { input: "哔哩哔哩视频", expected: { type: "query", subType: "search" } },
];

// ============================================
// 测试执行器
// ============================================

describe("Golden Dataset - 门禁测试", () => {
  let classifier: HybridIntentClassifier;

  beforeAll(async () => {
    classifier = new HybridIntentClassifier({
      enableSemanticMatching: false, // 仅测试规则匹配
      enableLLMFallback: false,
      debug: false,
    });
  });

  describe("Critical Cases (30 个) - 必须 100% 通过", () => {
    const activeCases = CRITICAL_CASES.filter((tc) => !tc.skip);

    activeCases.forEach((testCase, index) => {
      it(`[C${String(index + 1).padStart(2, "0")}] "${testCase.input}" → ${testCase.expected.type}:${testCase.expected.subType || "*"}`, async () => {
        const result = await classifier.classify(testCase.input, {
          input: testCase.input,
        });

        expect(result.type).toBe(testCase.expected.type);
        if (testCase.expected.subType) {
          expect(result.subType).toBe(testCase.expected.subType);
        }
      });
    });
  });

  describe("Important Cases (50 个) - 必须 95% 通过", () => {
    const activeCases = IMPORTANT_CASES.filter((tc) => !tc.skip);

    activeCases.forEach((testCase, index) => {
      it(`[I${String(index + 1).padStart(2, "0")}] "${testCase.input}" → ${testCase.expected.type}:${testCase.expected.subType || "*"}`, async () => {
        const result = await classifier.classify(testCase.input, {
          input: testCase.input,
        });

        expect(result.type).toBe(testCase.expected.type);
        if (testCase.expected.subType) {
          expect(result.subType).toBe(testCase.expected.subType);
        }
      });
    });
  });
});

// ============================================
// 发版门禁检查函数
// ============================================

export interface ReleaseDecision {
  canRelease: boolean;
  reason: string;
  metrics: {
    criticalPassed: number;
    criticalTotal: number;
    importantPassed: number;
    importantTotal: number;
    overallPassRate: number;
  };
  failedCritical?: string[];
  failedImportant?: string[];
}

/**
 * 检查发版门禁
 */
export function checkReleaseGate(results: TestResults): ReleaseDecision {
  const criticalPassRate = results.critical.passed / results.critical.total;
  const importantPassRate = results.important.passed / results.important.total;
  const overallPassRate =
    (results.critical.passed + results.important.passed) /
    (results.critical.total + results.important.total);

  const metrics = {
    criticalPassed: results.critical.passed,
    criticalTotal: results.critical.total,
    importantPassed: results.important.passed,
    importantTotal: results.important.total,
    overallPassRate: Math.round(overallPassRate * 100),
  };

  // Critical 必须 100% 通过
  if (criticalPassRate < 1.0) {
    return {
      canRelease: false,
      reason: `Critical Cases 通过率 ${(criticalPassRate * 100).toFixed(1)}% < 100%`,
      metrics,
      failedCritical: results.critical.failedCases,
    };
  }

  // Important 必须 95% 通过
  if (importantPassRate < RELEASE_GATE.important.passRate / 100) {
    return {
      canRelease: false,
      reason: `Important Cases 通过率 ${(importantPassRate * 100).toFixed(1)}% < 95%`,
      metrics,
      failedImportant: results.important.failedCases,
    };
  }

  return {
    canRelease: true,
    reason: "所有门禁检查通过",
    metrics,
  };
}

// 导出测试用例供其他地方使用
export { CRITICAL_CASES, IMPORTANT_CASES, RELEASE_GATE };
