#!/usr/bin/env node
/**
 * 分析 TypeScript 类型错误
 * 用于 P0 修复前的错误分析和分类
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * 运行类型检查并捕获输出
 */
function runTypeCheck() {
  try {
    const output = execSync('npm run type-check 2>&1', {
      encoding: 'utf-8',
      cwd: projectRoot,
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.stderr || String(error),
    };
  }
}

/**
 * 解析 TypeScript 错误输出
 */
function parseTypeErrors(output) {
  const errors = [];
  const lines = output.split('\n');

  // TypeScript 错误格式: file.ts(line,col): error TS####: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      errors.push({
        file: match[1].replace(projectRoot + '/', ''),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: match[5],
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * 按文件分组错误
 */
function groupErrorsByFile(errors) {
  const grouped = {};
  for (const error of errors) {
    if (!grouped[error.file]) {
      grouped[error.file] = [];
    }
    grouped[error.file].push(error);
  }
  return grouped;
}

/**
 * 按错误代码分类
 */
function categorizeErrors(errors) {
  const categories = {
    typeMismatch: [], // TS2322, TS2345 等
    missingTypes: [], // TS2307, TS2304 等
    anyUsage: [], // TS7006, TS18046 等
    unused: [], // TS6133 等
    other: [],
  };

  for (const error of errors) {
    const code = error.code;
    if (['TS2322', 'TS2345', 'TS2349', 'TS2352'].includes(code)) {
      categories.typeMismatch.push(error);
    } else if (['TS2307', 'TS2304', 'TS2300'].includes(code)) {
      categories.missingTypes.push(error);
    } else if (['TS7006', 'TS18046', 'TS7008'].includes(code)) {
      categories.anyUsage.push(error);
    } else if (['TS6133', 'TS6138'].includes(code)) {
      categories.unused.push(error);
    } else {
      categories.other.push(error);
    }
  }

  return categories;
}

/**
 * 生成修复优先级
 */
function prioritizeErrors(errors) {
  const priority = {
    p0: [], // 阻塞性错误，必须修复
    p1: [], // 重要错误，建议修复
    p2: [], // 代码质量，可选修复
  };

  for (const error of errors) {
    const code = error.code;
    
    // P0: 类型不匹配、缺少类型定义、导入错误
    if (['TS2322', 'TS2345', 'TS2307', 'TS2304', 'TS2300'].includes(code)) {
      priority.p0.push(error);
    }
    // P1: any 类型、隐式 any
    else if (['TS7006', 'TS18046', 'TS7008'].includes(code)) {
      priority.p1.push(error);
    }
    // P2: 未使用的变量、代码风格
    else if (['TS6133', 'TS6138'].includes(code)) {
      priority.p2.push(error);
    }
    // 其他错误默认为 P1
    else {
      priority.p1.push(error);
    }
  }

  return priority;
}

/**
 * 生成报告
 */
function generateReport(errors, grouped, categories, priority) {
  const report = {
    summary: {
      totalErrors: errors.length,
      filesAffected: Object.keys(grouped).length,
      byCategory: {
        typeMismatch: categories.typeMismatch.length,
        missingTypes: categories.missingTypes.length,
        anyUsage: categories.anyUsage.length,
        unused: categories.unused.length,
        other: categories.other.length,
      },
      byPriority: {
        p0: priority.p0.length,
        p1: priority.p1.length,
        p2: priority.p2.length,
      },
    },
    errorsByFile: Object.entries(grouped).map(([file, fileErrors]) => ({
      file,
      count: fileErrors.length,
      errors: fileErrors.map((e) => ({
        line: e.line,
        code: e.code,
        message: e.message,
        priority: getErrorPriority(e.code),
      })),
    })),
    priority: {
      p0: priority.p0.map((e) => ({
        file: e.file,
        line: e.line,
        code: e.code,
        message: e.message,
      })),
      p1: priority.p1.map((e) => ({
        file: e.file,
        line: e.line,
        code: e.code,
        message: e.message,
      })),
      p2: priority.p2.map((e) => ({
        file: e.file,
        line: e.line,
        code: e.code,
        message: e.message,
      })),
    },
  };

  return report;
}

function getErrorPriority(code) {
  if (['TS2322', 'TS2345', 'TS2307', 'TS2304', 'TS2300'].includes(code)) {
    return 'P0';
  }
  if (['TS7006', 'TS18046', 'TS7008'].includes(code)) {
    return 'P1';
  }
  if (['TS6133', 'TS6138'].includes(code)) {
    return 'P2';
  }
  return 'P1';
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始分析 TypeScript 类型错误...\n');

  // 运行类型检查
  console.log('📝 运行类型检查...');
  const { success, output } = runTypeCheck();

  if (success) {
    console.log('✅ 类型检查通过，没有错误！');
    return;
  }

  // 解析错误
  console.log('🔎 解析错误...');
  const errors = parseTypeErrors(output);

  if (errors.length === 0) {
    console.log('⚠️  未找到标准格式的错误，请检查输出');
    console.log(output);
    return;
  }

  // 分析和分类
  const grouped = groupErrorsByFile(errors);
  const categories = categorizeErrors(errors);
  const priority = prioritizeErrors(errors);

  // 生成报告
  const report = generateReport(errors, grouped, categories, priority);

  // 保存报告
  const reportPath = join(projectRoot, 'type-errors-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // 输出摘要
  console.log('\n📊 错误分析摘要:');
  console.log(`   总错误数: ${report.summary.totalErrors}`);
  console.log(`   涉及文件: ${report.summary.filesAffected}`);
  console.log('\n📂 按类别分类:');
  console.log(`   类型不匹配: ${report.summary.byCategory.typeMismatch}`);
  console.log(`   缺少类型: ${report.summary.byCategory.missingTypes}`);
  console.log(`   any 使用: ${report.summary.byCategory.anyUsage}`);
  console.log(`   未使用: ${report.summary.byCategory.unused}`);
  console.log(`   其他: ${report.summary.byCategory.other}`);
  console.log('\n🎯 按优先级分类:');
  console.log(`   P0 (必须修复): ${report.summary.byPriority.p0}`);
  console.log(`   P1 (建议修复): ${report.summary.byPriority.p1}`);
  console.log(`   P2 (可选修复): ${report.summary.byPriority.p2}`);

  console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  console.log('\n💡 建议修复顺序:');
  console.log('   1. 先修复 P0 错误（阻塞性错误）');
  console.log('   2. 再修复 P1 错误（重要错误）');
  console.log('   3. 最后修复 P2 错误（代码质量）');
}

main();

