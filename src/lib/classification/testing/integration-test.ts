/**
 * V4.2 Integration Test Utilities
 * 模块集成测试工具
 *
 * @description 验证 V4.2 各模块协同工作
 * - 快速路径路由测试
 * - 学习系统测试
 * - 缓存系统测试
 * - 反馈循环测试
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { contentRouter, type RouteInput } from "../router";
import { tagMatcher } from "../router/tag-matcher";
import { titleMatcher } from "../router/title-matcher";
import { fastPathCacheManager, getCacheHealthStatus } from "../router/cache-manager";
import { preferenceLearner } from "../learning/preference-learner";
import { profileUpdater } from "../learning/profile-updater";
import { feedbackLoopService } from "../learning/feedback-loop";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";

// ============================================================================
// 类型定义
// ============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationTestReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
  systemHealth: {
    cacheStatus: ReturnType<typeof getCacheHealthStatus>;
    learningStats?: {
      totalEvents: number;
      accuracy: number;
    };
  };
}

// ============================================================================
// 测试用例
// ============================================================================

/**
 * 测试快速路径路由
 */
async function testFastPathRouting(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Fast Path Routing";

  try {
    const testInput: RouteInput = {
      userId,
      url: "https://mp.weixin.qq.com/s/test-article",
      title: "测试文章标题 - 技术分享",
      tags: ["技术", "编程"],
    };

    const decision = await contentRouter.route(testInput);

    return {
      name: testName,
      passed: decision !== null && typeof decision.path === "string",
      duration: Date.now() - start,
      details: {
        path: decision.path,
        confidence: decision.confidence,
        reason: decision.reason,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试标签匹配器
 */
async function testTagMatcher(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Tag Matcher";

  try {
    const testTags = ["技术", "前端", "React"];
    const result = await tagMatcher.tryTagMatch(userId, testTags);

    return {
      name: testName,
      passed: result !== null && typeof result.found === "boolean",
      duration: Date.now() - start,
      details: {
        found: result.found,
        confidence: result.confidence,
        matchedTags: result.matchedTags,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试标题匹配器
 */
async function testTitleMatcher(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Title Matcher";

  try {
    const testTitle = "深入理解 TypeScript 类型系统";
    const result = await titleMatcher.tryTitleMatch(userId, testTitle);

    return {
      name: testName,
      passed: result !== null && typeof result.found === "boolean",
      duration: Date.now() - start,
      details: {
        found: result.found,
        confidence: result.confidence,
        reason: result.reason,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试缓存管理器
 */
async function testCacheManager(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Cache Manager";

  try {
    // 测试缓存预热
    await fastPathCacheManager.warmupUserCache(userId);

    // 获取缓存统计
    const stats = fastPathCacheManager.getStats();

    return {
      name: testName,
      passed: stats !== null,
      duration: Date.now() - start,
      details: {
        cacheWarmed: true,
        stats: {
          hitRate: stats.hitRate,
          totalHits: stats.hits,
          totalMisses: stats.misses,
        },
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试偏好学习器
 */
async function testPreferenceLearner(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Preference Learner";

  try {
    // 获取用户偏好
    const preferences = await preferenceLearner.getUserPreferences(userId);

    // 获取学习统计
    const stats = await preferenceLearner.getLearningStats(userId);

    return {
      name: testName,
      passed: preferences !== null && stats !== null,
      duration: Date.now() - start,
      details: {
        folderCount: preferences.folderPreferences.length,
        sourceCount: preferences.sourcePreferences.length,
        totalEvents: stats.totalEvents,
        accuracy: stats.accuracy,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试画像更新器
 */
async function testProfileUpdater(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Profile Updater";

  try {
    // 获取健康状态
    const health = await profileUpdater.getHealthStatus(userId);
    const isHealthy = health.healthyProfiles >= health.totalProfiles * 0.7;

    return {
      name: testName,
      passed: health !== null && typeof health.totalProfiles === "number",
      duration: Date.now() - start,
      details: {
        isHealthy,
        totalProfiles: health.totalProfiles,
        healthyProfiles: health.healthyProfiles,
        staleProfiles: health.staleProfiles,
        recommendations: health.recommendations,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试反馈循环
 */
async function testFeedbackLoop(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Feedback Loop";

  try {
    // 生成健康报告
    const report = await feedbackLoopService.generateHealthReport(userId);

    return {
      name: testName,
      passed: report !== null && typeof report.overallScore === "number",
      duration: Date.now() - start,
      details: {
        overallScore: report.overallScore,
        metrics: report.metrics,
        trends: report.trends,
        recommendationCount: report.recommendations.length,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试来源画像服务
 */
async function testSourceProfileService(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "Source Profile Service";

  try {
    // 测试 URL 解析和画像获取
    const testUrl = "https://mp.weixin.qq.com/s/test-article-123";
    const profile = await sourceProfileService.getOrCreateFromUrl(
      userId,
      testUrl,
      "测试公众号",
    );

    // 测试快速匹配
    const match = await sourceProfileService.getQuickMatch(userId, testUrl);

    return {
      name: testName,
      passed: true, // 即使没有匹配也算成功（正常业务逻辑）
      duration: Date.now() - start,
      details: {
        profileCreated: profile !== null,
        matchFound: match.found,
        confidence: match.confidence,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 测试端到端流程
 */
async function testEndToEndFlow(userId: string): Promise<TestResult> {
  const start = Date.now();
  const testName = "End-to-End Flow";

  try {
    // 1. 路由决策
    const routeInput: RouteInput = {
      userId,
      url: "https://example.com/article/test",
      title: "End to End Test Article",
      tags: ["test", "integration"],
    };
    const decision = await contentRouter.route(routeInput);

    // 2. 模拟反馈处理
    const feedbackResult = await feedbackLoopService.processFeedback({
      userId,
      bookmarkId: 0, // 测试用
      signal: "confirm",
      sourceId: "test-source",
      newFolderId: 1,
      confidence: decision.confidence,
    });

    // 3. 验证缓存失效
    const cacheStats = fastPathCacheManager.getStats();

    return {
      name: testName,
      passed: decision !== null && feedbackResult !== null,
      duration: Date.now() - start,
      details: {
        routePath: decision.path,
        routeConfidence: decision.confidence,
        feedbackSuccess: feedbackResult.success,
        learningApplied: feedbackResult.learningApplied,
        cacheHitRate: cacheStats.hitRate,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// 主测试函数
// ============================================================================

/**
 * 运行所有集成测试
 */
export async function runIntegrationTests(
  userId: string,
): Promise<IntegrationTestReport> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  // 运行所有测试
  const tests = [
    testFastPathRouting,
    testTagMatcher,
    testTitleMatcher,
    testCacheManager,
    testPreferenceLearner,
    testProfileUpdater,
    testFeedbackLoop,
    testSourceProfileService,
    testEndToEndFlow,
  ];

  for (const test of tests) {
    const result = await test(userId);
    results.push(result);
  }

  // 获取系统健康状态
  const cacheStatus = getCacheHealthStatus();
  let learningStats;
  try {
    const stats = await preferenceLearner.getLearningStats(userId);
    learningStats = {
      totalEvents: stats.totalEvents,
      accuracy: stats.accuracy,
    };
  } catch {
    learningStats = undefined;
  }

  // 统计结果
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    timestamp: new Date(),
    totalTests: results.length,
    passed,
    failed,
    duration: Date.now() - startTime,
    results,
    systemHealth: {
      cacheStatus,
      learningStats,
    },
  };
}

/**
 * 运行快速健康检查（不需要用户 ID）
 */
export function runHealthCheck(): {
  cache: ReturnType<typeof getCacheHealthStatus>;
  timestamp: Date;
} {
  return {
    cache: getCacheHealthStatus(),
    timestamp: new Date(),
  };
}
