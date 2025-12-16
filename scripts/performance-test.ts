/**
 * 性能回归测试脚本
 * @version V4.2.24 - 验证性能优化效果
 *
 * 运行方式：
 * 1. 启动开发服务器：npm run dev
 * 2. 运行测试：npx ts-node scripts/performance-test.ts
 *
 * 或使用 Playwright MCP 工具手动测试
 */

// ============================================
// 性能基准指标（优化前）
// ============================================

export const BASELINE_METRICS = {
  // 来自 PERFORMANCE_OPTIMIZATION_PLAN.md 的初始诊断数据
  homepage: {
    TTFB: 2320, // ms
    FCP: 612, // ms
    LCP: 11235, // ms (Time to First Render)
    apiRequests: 7, // 并发 API 请求数
  },
  detailPage: {
    TTFB: 458,
    LCP: 14476,
    FID: 2,
  },
  foldersPage: {
    FCP: 5112,
    LCP: 11428,
  },
  searchPage: {
    FCP: 3848,
  },
};

// ============================================
// 性能目标指标（优化后）
// ============================================

export const TARGET_METRICS = {
  // Core Web Vitals 目标（Google 推荐的 "Good" 等级）
  TTFB: 800, // < 800ms
  FCP: 1800, // < 1.8s
  LCP: 2500, // < 2.5s
  FID: 100, // < 100ms
  CLS: 0.1, // < 0.1
  INP: 200, // < 200ms

  // 业务指标目标
  apiRequests: 3, // 首页 API 请求数从 7+ 降至 2-3
  timeToFirstRender: 3000, // < 3s
};

// ============================================
// 预期优化幅度
// ============================================

export const EXPECTED_IMPROVEMENTS = {
  TTFB: -65, // -65%
  FCP: -60, // -60%
  LCP: -80, // -80%
  timeToFirstRender: -73, // -73%
  apiRequests: -70, // -70% (7 -> 2-3)
};

// ============================================
// 测试用例
// ============================================

export interface PerformanceTestResult {
  page: string;
  metrics: {
    TTFB?: number;
    FCP?: number;
    LCP?: number;
    FID?: number;
    CLS?: number;
    INP?: number;
    apiRequests?: number;
    timeToFirstRender?: number;
  };
  baseline: typeof BASELINE_METRICS.homepage;
  improvements: Record<string, number>;
  passed: boolean;
}

/**
 * 计算改善百分比
 */
export function calculateImprovement(
  baseline: number,
  current: number,
): number {
  return Math.round(((current - baseline) / baseline) * 100);
}

/**
 * 检查指标是否达标
 */
export function checkMetricPassed(metricName: string, value: number): boolean {
  const target = TARGET_METRICS[metricName as keyof typeof TARGET_METRICS];
  if (target === undefined) return true;
  return value <= target;
}

/**
 * 生成测试报告
 */
export function generateReport(results: PerformanceTestResult[]): string {
  const lines: string[] = [
    "# 性能回归测试报告",
    "",
    `测试时间：${new Date().toISOString()}`,
    "",
    "## 测试结果概览",
    "",
    "| 页面 | TTFB | FCP | LCP | 状态 |",
    "| ---- | ---- | --- | --- | ---- |",
  ];

  for (const result of results) {
    const status = result.passed ? "✅ 通过" : "❌ 需优化";
    lines.push(
      `| ${result.page} | ${result.metrics.TTFB ?? "-"}ms | ${result.metrics.FCP ?? "-"}ms | ${result.metrics.LCP ?? "-"}ms | ${status} |`,
    );
  }

  lines.push("");
  lines.push("## 改善详情");
  lines.push("");

  for (const result of results) {
    lines.push(`### ${result.page}`);
    lines.push("");
    lines.push("| 指标 | 基准值 | 当前值 | 改善 | 目标 | 状态 |");
    lines.push("| ---- | ------ | ------ | ---- | ---- | ---- |");

    for (const [key, value] of Object.entries(result.metrics)) {
      if (value === undefined) continue;

      const baselineValue =
        result.baseline[key as keyof typeof result.baseline];
      const improvement = baselineValue
        ? calculateImprovement(baselineValue as number, value)
        : 0;
      const target = TARGET_METRICS[key as keyof typeof TARGET_METRICS];
      const passed = target ? value <= target : true;
      const status = passed ? "✅" : "❌";

      lines.push(
        `| ${key} | ${baselineValue ?? "-"} | ${value} | ${improvement}% | ${target ?? "-"} | ${status} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================
// Playwright 测试代码（供 MCP 使用）
// ============================================

/**
 * 在 Playwright 中运行的性能测试代码
 *
 * 使用方法：
 * 1. 使用 mcp__Playwright__browser_navigate 导航到目标页面
 * 2. 使用 mcp__Playwright__browser_evaluate 执行以下代码获取指标
 */
export const PLAYWRIGHT_MEASURE_CODE = `
async () => {
  // 等待页面完全加载
  await new Promise(r => setTimeout(r, 3000));

  // 获取 Performance Timing
  const timing = performance.timing;
  const navEntry = performance.getEntriesByType('navigation')[0];

  // 获取 Paint Timing
  const paintEntries = performance.getEntriesByType('paint');
  const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');

  // 获取 LCP
  let lcp = 0;
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  if (lcpEntries.length > 0) {
    lcp = lcpEntries[lcpEntries.length - 1].startTime;
  }

  // 统计 API 请求数
  const apiRequests = performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/api/'))
    .length;

  return {
    TTFB: navEntry ? Math.round(navEntry.responseStart) : timing.responseStart - timing.navigationStart,
    FCP: fcp ? Math.round(fcp.startTime) : null,
    LCP: lcp ? Math.round(lcp) : null,
    apiRequests,
    loadTime: timing.loadEventEnd - timing.navigationStart,
  };
}
`;

// 导出供命令行使用
if (require.main === module) {
  console.log("性能测试配置已加载");
  console.log("\n基准指标：", JSON.stringify(BASELINE_METRICS, null, 2));
  console.log("\n目标指标：", JSON.stringify(TARGET_METRICS, null, 2));
  console.log("\n使用 Playwright MCP 工具执行实际测试");
}
