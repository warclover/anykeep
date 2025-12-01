#!/usr/bin/env node
/**
 * 验证 P0 修复是否成功
 * 运行所有检查并生成验证报告
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * 运行命令并捕获结果
 */
function runCommand(command, description) {
  console.log(`\n🔍 ${description}...`);
  const startTime = Date.now();
  
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      cwd: projectRoot,
      stdio: 'pipe',
    });
    const duration = Date.now() - startTime;
    return {
      success: true,
      output,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      output: error.stdout || error.stderr || String(error),
      duration,
      exitCode: error.status || 1,
    };
  }
}

/**
 * 检查类型错误数量
 */
function countTypeErrors(output) {
  const errorRegex = /error TS\d+:/g;
  const matches = output.match(errorRegex);
  return matches ? matches.length : 0;
}

/**
 * 检查 ESLint 错误数量
 */
function countLintErrors(output) {
  const errorRegex = /✖ \d+ problem/;
  const match = output.match(errorRegex);
  if (match) {
    const problemMatch = match[0].match(/\d+/);
    return problemMatch ? parseInt(problemMatch[0], 10) : 0;
  }
  return 0;
}

/**
 * 检查测试结果
 */
function parseTestResults(output) {
  const passedMatch = output.match(/(\d+) passed/);
  const failedMatch = output.match(/(\d+) failed/);
  const totalMatch = output.match(/Tests:\s+(\d+)/);
  
  return {
    passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
    failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
    total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
  };
}

/**
 * 主验证函数
 */
function main() {
  console.log('🚀 开始验证 P0 修复...\n');
  console.log('='.repeat(60));

  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: {
      allPassed: true,
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
    },
  };

  // 1. 类型检查
  const typeCheck = runCommand('npm run type-check', '类型检查');
  const typeErrorCount = countTypeErrors(typeCheck.output);
  results.checks.typeCheck = {
    success: typeCheck.success && typeErrorCount === 0,
    errorCount: typeErrorCount,
    duration: typeCheck.duration,
    output: typeCheck.output.substring(0, 500), // 只保存前500字符
  };
  results.summary.totalChecks++;
  if (results.checks.typeCheck.success) {
    results.summary.passedChecks++;
    console.log(`✅ 类型检查通过 (${typeCheck.duration}ms)`);
  } else {
    results.summary.allPassed = false;
    results.summary.failedChecks++;
    console.log(`❌ 类型检查失败: ${typeErrorCount} 个错误 (${typeCheck.duration}ms)`);
  }

  // 2. ESLint 检查
  const lintCheck = runCommand('npm run lint', 'ESLint 检查');
  const lintErrorCount = countLintErrors(lintCheck.output);
  results.checks.lint = {
    success: lintCheck.success && lintErrorCount === 0,
    errorCount: lintErrorCount,
    duration: lintCheck.duration,
    output: lintCheck.output.substring(0, 500),
  };
  results.summary.totalChecks++;
  if (results.checks.lint.success) {
    results.summary.passedChecks++;
    console.log(`✅ ESLint 检查通过 (${lintCheck.duration}ms)`);
  } else {
    results.summary.allPassed = false;
    results.summary.failedChecks++;
    console.log(`❌ ESLint 检查失败: ${lintErrorCount} 个错误 (${lintCheck.duration}ms)`);
  }

  // 3. 构建检查
  const buildCheck = runCommand('npm run build', '构建检查');
  results.checks.build = {
    success: buildCheck.success,
    duration: buildCheck.duration,
    output: buildCheck.output.substring(0, 500),
  };
  results.summary.totalChecks++;
  if (results.checks.build.success) {
    results.summary.passedChecks++;
    console.log(`✅ 构建成功 (${buildCheck.duration}ms)`);
  } else {
    results.summary.allPassed = false;
    results.summary.failedChecks++;
    console.log(`❌ 构建失败 (${buildCheck.duration}ms)`);
  }

  // 4. 测试检查
  const testCheck = runCommand('npm run test', '测试检查');
  const testResults = parseTestResults(testCheck.output);
  results.checks.test = {
    success: testCheck.success && testResults.failed === 0,
    results: testResults,
    duration: testCheck.duration,
    output: testCheck.output.substring(0, 500),
  };
  results.summary.totalChecks++;
  if (results.checks.test.success) {
    results.summary.passedChecks++;
    console.log(`✅ 测试通过: ${testResults.passed}/${testResults.total} (${testCheck.duration}ms)`);
  } else {
    results.summary.allPassed = false;
    results.summary.failedChecks++;
    console.log(`❌ 测试失败: ${testResults.failed}/${testResults.total} 失败 (${testCheck.duration}ms)`);
  }

  // 5. 检查配置文件
  const configCheck = {
    success: true,
    issues: [],
  };
  
  const configPath = join(projectRoot, 'next.config.mjs');
  if (existsSync(configPath)) {
    const configContent = require('fs').readFileSync(configPath, 'utf-8');
    
    if (configContent.includes('ignoreBuildErrors: true')) {
      configCheck.success = false;
      configCheck.issues.push('TypeScript 错误检查被禁用');
    }
    
    if (configContent.includes('ignoreDuringBuilds: true')) {
      configCheck.success = false;
      configCheck.issues.push('ESLint 检查被禁用');
    }
  }
  
  results.checks.config = configCheck;
  results.summary.totalChecks++;
  if (configCheck.success) {
    results.summary.passedChecks++;
    console.log(`✅ 配置文件检查通过`);
  } else {
    results.summary.allPassed = false;
    results.summary.failedChecks++;
    console.log(`❌ 配置文件问题: ${configCheck.issues.join(', ')}`);
  }

  // 生成报告
  const reportPath = join(projectRoot, 'fix-verification-report.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // 输出总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 验证总结:');
  console.log(`   总检查项: ${results.summary.totalChecks}`);
  console.log(`   通过: ${results.summary.passedChecks}`);
  console.log(`   失败: ${results.summary.failedChecks}`);
  
  if (results.summary.allPassed) {
    console.log('\n✅ 所有检查通过！P0 修复成功！');
    process.exit(0);
  } else {
    console.log('\n❌ 部分检查失败，请修复后重试');
    console.log(`📄 详细报告: ${reportPath}`);
    process.exit(1);
  }
}

main();

