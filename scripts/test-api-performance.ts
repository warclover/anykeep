/**
 * API 性能测试脚本
 * 测试缓存认证优化后的 API 性能
 *
 * 运行: npx tsx scripts/test-api-performance.ts
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  authLatencyMs?: number;
}

interface PerformanceReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageLatencyMs: number;
  results: TestResult[];
  authPerformance: {
    samples: number;
    averageMs: number;
    minMs: number;
    maxMs: number;
  };
}

const BASE_URL = "http://localhost:3000";

// 需要测试的 API 端点
const TEST_ENDPOINTS = [
  { method: "GET", path: "/api/bookmarks?limit=20" },
  { method: "GET", path: "/api/folders" },
  { method: "GET", path: "/api/smart-lists?includePresets=true" },
  // 注意：/api/messages/unread-count 已废弃，通知系统现在直接查询 Supabase
  // { method: "GET", path: "/api/messages/unread-count" },
  { method: "GET", path: "/api/classification/confirmations?status=pending" },
  { method: "GET", path: "/api/snapshots/quota" },
  { method: "GET", path: "/api/settings/notifications" },
  { method: "GET", path: "/api/classification/settings" },
  { method: "GET", path: "/api/classification/interests" },
  { method: "GET", path: "/api/user/settings" },
];

async function testEndpoint(
  method: string,
  path: string,
  cookie: string,
): Promise<TestResult> {
  const startTime = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
    });

    const latencyMs = Math.round(performance.now() - startTime);

    // 尝试解析响应以获取认证延迟
    let authLatencyMs: number | undefined;
    try {
      const data = await response.json();
      if (data._performance?.entries) {
        const authEntry = data._performance.entries.find(
          (e: { name: string }) =>
            e.name === "CachedAuth" || e.name === "GetUser",
        );
        if (authEntry) {
          authLatencyMs = Math.round(authEntry.duration);
        }
      }
    } catch {
      // 忽略解析错误
    }

    return {
      endpoint: path,
      method,
      status: response.status,
      latencyMs,
      success: response.ok,
      authLatencyMs,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      endpoint: path,
      method,
      status: 0,
      latencyMs,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runTests(cookie: string): Promise<PerformanceReport> {
  console.log("🚀 开始 API 性能测试...\n");

  const results: TestResult[] = [];

  // 先预热（第一次请求会触发编译）
  console.log("⏳ 预热中...");
  for (const endpoint of TEST_ENDPOINTS.slice(0, 3)) {
    await testEndpoint(endpoint.method, endpoint.path, cookie);
  }
  console.log("✓ 预热完成\n");

  // 正式测试
  console.log("📊 正式测试:");
  console.log("-".repeat(80));

  for (const endpoint of TEST_ENDPOINTS) {
    const result = await testEndpoint(endpoint.method, endpoint.path, cookie);
    results.push(result);

    const statusIcon = result.success ? "✓" : "✗";
    const authInfo = result.authLatencyMs
      ? ` (Auth: ${result.authLatencyMs}ms)`
      : "";
    console.log(
      `${statusIcon} ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(50)} ${result.latencyMs}ms${authInfo}`,
    );
  }

  // 计算统计信息
  const passedTests = results.filter((r) => r.success).length;
  const failedTests = results.filter((r) => !r.success).length;
  const averageLatencyMs = Math.round(
    results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length,
  );

  // 认证性能统计
  const authLatencies = results
    .map((r) => r.authLatencyMs)
    .filter((l): l is number => l !== undefined);

  const authPerformance =
    authLatencies.length > 0
      ? {
          samples: authLatencies.length,
          averageMs: Math.round(
            authLatencies.reduce((a, b) => a + b, 0) / authLatencies.length,
          ),
          minMs: Math.min(...authLatencies),
          maxMs: Math.max(...authLatencies),
        }
      : { samples: 0, averageMs: 0, minMs: 0, maxMs: 0 };

  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passedTests,
    failedTests,
    averageLatencyMs,
    results,
    authPerformance,
  };

  return report;
}

function printReport(report: PerformanceReport) {
  console.log("\n" + "=".repeat(80));
  console.log("📈 性能测试报告");
  console.log("=".repeat(80));

  console.log(`
时间: ${report.timestamp}
总测试数: ${report.totalTests}
通过: ${report.passedTests} ✓
失败: ${report.failedTests} ✗
平均延迟: ${report.averageLatencyMs}ms
`);

  if (report.authPerformance.samples > 0) {
    console.log("🔐 认证性能:");
    console.log(`   样本数: ${report.authPerformance.samples}`);
    console.log(`   平均: ${report.authPerformance.averageMs}ms`);
    console.log(`   最小: ${report.authPerformance.minMs}ms`);
    console.log(`   最大: ${report.authPerformance.maxMs}ms`);

    if (report.authPerformance.averageMs < 50) {
      console.log("\n   ✅ 认证缓存优化生效！(< 50ms)");
    } else if (report.authPerformance.averageMs < 200) {
      console.log("\n   ⚠️ 认证延迟较高，可能未完全生效");
    } else {
      console.log("\n   ❌ 认证延迟过高，优化可能未生效");
    }
  }

  // 列出失败的测试
  const failedResults = report.results.filter((r) => !r.success);
  if (failedResults.length > 0) {
    console.log("\n❌ 失败的测试:");
    failedResults.forEach((r) => {
      console.log(`   - ${r.method} ${r.endpoint}: ${r.error || r.status}`);
    });
  }

  // 列出慢请求 (> 1000ms)
  const slowResults = report.results.filter((r) => r.latencyMs > 1000);
  if (slowResults.length > 0) {
    console.log("\n🐌 慢请求 (> 1000ms):");
    slowResults.forEach((r) => {
      console.log(`   - ${r.method} ${r.endpoint}: ${r.latencyMs}ms`);
    });
  }
}

// 主函数
async function main() {
  // 从环境变量或硬编码获取 cookie（用于测试）
  const cookie = process.env.TEST_COOKIE || "";

  if (!cookie) {
    console.log(
      "⚠️ 未提供 TEST_COOKIE 环境变量，将测试未认证的请求（预期返回 401）\n",
    );
  }

  try {
    const report = await runTests(cookie);
    printReport(report);

    // 退出码
    process.exit(report.failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error("测试失败:", error);
    process.exit(1);
  }
}

main();
