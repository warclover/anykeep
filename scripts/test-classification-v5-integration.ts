/**
 * 智能分类 v5.0 集成测试脚本
 *
 * 使用方法:
 * 1. 启动开发服务器: npm run dev
 * 2. 在另一个终端运行: npx ts-node scripts/test-classification-v5-integration.ts
 *
 * @version 1.0.0
 * @since 2026-01-18
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env.local 文件
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// =============================================================================
// 配置
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 测试用户凭证(需要在 .env.local 中配置)
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

// =============================================================================
// 颜色输出辅助函数
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// =============================================================================
// 测试结果统计
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const testResults: TestResult[] = [];

function recordTest(name: string, passed: boolean, error?: string, duration: number = 0) {
  testResults.push({ name, passed, error, duration });
}

function printSummary() {
  log('\n' + '='.repeat(80), 'gray');
  log('测试总结', 'blue');
  log('='.repeat(80), 'gray');

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const total = testResults.length;

  log(`\n总计: ${total} 个测试`, 'blue');
  logSuccess(`通过: ${passed}`);
  if (failed > 0) {
    logError(`失败: ${failed}`);
  }

  if (failed > 0) {
    log('\n失败的测试:', 'red');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  - ${r.name}`, 'red');
        if (r.error) {
          log(`    ${r.error}`, 'gray');
        }
      });
  }

  log('\n' + '='.repeat(80), 'gray');
}

// =============================================================================
// 认证辅助函数
// =============================================================================

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (error) {
      logError(`认证失败: ${error.message}`);
      return null;
    }

    if (!data.session) {
      logError('认证失败: 未获取到会话');
      return null;
    }

    logSuccess('认证成功');
    return data.session.access_token;
  } catch (error) {
    logError(`认证异常: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// =============================================================================
// 测试用例
// =============================================================================

/**
 * 测试 Metrics API
 */
async function testMetricsAPI(token: string) {
  log('\n--- 测试 Metrics API ---', 'blue');

  const testCases = [
    {
      name: 'Metrics API - 默认时间范围',
      url: `${API_BASE_URL}/api/classification/v5/metrics`,
    },
    {
      name: 'Metrics API - 7天时间范围',
      url: `${API_BASE_URL}/api/classification/v5/metrics?timeRange=7d`,
    },
    {
      name: 'Metrics API - 30天时间范围',
      url: `${API_BASE_URL}/api/classification/v5/metrics?timeRange=30d`,
    },
  ];

  for (const testCase of testCases) {
    const startTime = Date.now();
    try {
      const response = await fetch(testCase.url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.text();
        recordTest(testCase.name, false, `HTTP ${response.status}: ${error}`, duration);
        logError(`${testCase.name} - 失败 (${duration}ms)`);
        continue;
      }

      const data = await response.json();

      // 验证响应结构
      if (!data.t0 || !data.t1 || !data.overall) {
        recordTest(testCase.name, false, '响应结构不正确', duration);
        logError(`${testCase.name} - 失败: 响应结构不正确 (${duration}ms)`);
        continue;
      }

      recordTest(testCase.name, true, undefined, duration);
      logSuccess(`${testCase.name} - 通过 (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      recordTest(
        testCase.name,
        false,
        error instanceof Error ? error.message : String(error),
        duration
      );
      logError(`${testCase.name} - 异常 (${duration}ms)`);
    }
  }
}

/**
 * 测试 T1 Stream API
 */
async function testT1StreamAPI(token: string) {
  log('\n--- 测试 T1 Stream API ---', 'blue');

  // 注意: T1 Stream API 是 SSE 端点,需要特殊处理
  logWarning('T1 Stream API 测试需要实际的书签ID和T1队列记录');
  logInfo('跳过 T1 Stream API 自动化测试,建议手动测试');

  // 如果需要测试,可以使用以下代码:
  // const testBookmarkId = 123; // 替换为实际的书签ID
  // const url = `${API_BASE_URL}/api/classification/v5/t1-stream?bookmarkId=${testBookmarkId}`;
  // 使用 EventSource 或类似工具来测试 SSE 端点
}

/**
 * 测试数据库表结构
 */
async function testDatabaseTables() {
  log('\n--- 测试数据库表结构 ---', 'blue');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 测试 classification_metrics_v5 表
    const { error: metricsError } = await supabase
      .from('classification_metrics_v5')
      .select('*')
      .limit(1);

    if (metricsError) {
      recordTest('数据库表 - classification_metrics_v5', false, metricsError.message);
      logError(`classification_metrics_v5 表访问失败: ${metricsError.message}`);
    } else {
      recordTest('数据库表 - classification_metrics_v5', true);
      logSuccess('classification_metrics_v5 表访问成功');
    }

    // 测试 classification_t1_queue_v5 表
    const { error: queueError } = await supabase
      .from('classification_t1_queue_v5')
      .select('*')
      .limit(1);

    if (queueError) {
      recordTest('数据库表 - classification_t1_queue_v5', false, queueError.message);
      logError(`classification_t1_queue_v5 表访问失败: ${queueError.message}`);
    } else {
      recordTest('数据库表 - classification_t1_queue_v5', true);
      logSuccess('classification_t1_queue_v5 表访问成功');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordTest('数据库表测试', false, errorMessage);
    logError(`数据库表测试异常: ${errorMessage}`);
  }
}

// =============================================================================
// 主函数
// =============================================================================

async function main() {
  log('='.repeat(80), 'blue');
  log('智能分类 v5.0 集成测试', 'blue');
  log('='.repeat(80), 'blue');

  // 检查环境变量
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logError('缺少 Supabase 配置,请检查 .env.local 文件');
    process.exit(1);
  }

  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    logWarning('缺少测试用户凭证,将跳过需要认证的测试');
    logInfo('请在 .env.local 中配置 TEST_USER_EMAIL 和 TEST_USER_PASSWORD');
  }

  // 测试数据库表结构
  await testDatabaseTables();

  // 如果有测试用户凭证,进行需要认证的测试
  if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
    const token = await getAuthToken();

    if (token) {
      await testMetricsAPI(token);
      await testT1StreamAPI(token);
    } else {
      logError('认证失败,跳过需要认证的测试');
    }
  }

  // 打印测试总结
  printSummary();

  // 根据测试结果设置退出码
  const failed = testResults.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
main().catch((error) => {
  logError(`测试执行异常: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
