#!/usr/bin/env ts-node
/**
 * AnyKeep 代码审查脚本
 * 检查：失效功能、死代码、类型错误、空函数、缺失组件、未调用 API、重复定义、功能冲突等
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  category: string;
  issues: Issue[];
}

interface Issue {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
}

const results: AuditResult[] = [];
const srcDir = path.join(process.cwd(), 'src');

// 递归获取所有文件
function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过 node_modules 和 .next 等目录
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(path.relative(srcDir, fullPath));
        }
      }
    }
  }
  
  walk(dir);
  return files;
}

// 1. 检查未使用的导入
function checkUnusedImports(): Issue[] {
  const issues: Issue[] = [];
  // 这个需要更复杂的 AST 分析，先标记为待实现
  return issues;
}

// 2. 检查空函数
function checkEmptyFunctions(): Issue[] {
  const issues: Issue[] = [];
  const files = getAllFiles(srcDir, ['.ts', '.tsx']);
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // 检查空函数体
    const emptyFunctionRegex = /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*[^{]*\{[\s\n]*\}/g;
    const emptyArrowRegex = /(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{?\s*\}?;?/g;
    
    lines.forEach((line, index) => {
      if (emptyFunctionRegex.test(line) || emptyArrowRegex.test(line)) {
        issues.push({
          file,
          line: index + 1,
          severity: 'warning',
          message: '发现空函数',
          code: line.trim(),
        });
      }
    });
  }
  
  return issues;
}

// 3. 检查 TODO/FIXME 标记
function checkTODOs(): Issue[] {
  const issues: Issue[] = [];
  const files = getAllFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          file,
          line: index + 1,
          severity: 'info',
          message: line.trim(),
          code: line.trim(),
        });
      }
    });
  }
  
  return issues;
}

// 4. 检查重复的类型定义
function checkDuplicateTypes(): Issue[] {
  const issues: Issue[] = [];
  const typeMap = new Map<string, { file: string; line: number }[]>();
  const files = getAllFiles(srcDir, ['.ts', '.tsx']);
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // 检查 type 和 interface 定义
    lines.forEach((line, index) => {
      const typeMatch = line.match(/(?:export\s+)?(?:type|interface)\s+(\w+)/);
      if (typeMatch) {
        const typeName = typeMatch[1];
        if (!typeMap.has(typeName)) {
          typeMap.set(typeName, []);
        }
        typeMap.get(typeName)!.push({ file, line: index + 1 });
      }
    });
  }
  
  // 找出重复定义
  typeMap.forEach((locations, typeName) => {
    if (locations.length > 1) {
      locations.forEach(loc => {
        issues.push({
          file: loc.file,
          line: loc.line,
          severity: 'warning',
          message: `类型 ${typeName} 在多个文件中定义`,
          code: typeName,
        });
      });
    }
  });
  
  return issues;
}

// 5. 检查 API 路由
function checkAPIRoutes(): Issue[] {
  const issues: Issue[] = [];
  const apiDir = path.join(srcDir, 'app', 'api');
  
  if (!fs.existsSync(apiDir)) {
    return issues;
  }
  
  const routeFiles = getAllFiles(apiDir, ['.ts']).filter(f => f.endsWith('route.ts'));
  const routeMap = new Map<string, { file: string; references: string[] }>();
  
  // 收集所有 API 路由
  routeFiles.forEach((file: string) => {
    // file 是相对于 srcDir 的路径，需要转换为 API 路由路径
    // 例如: app/api/bookmarks/route.ts -> /api/bookmarks
    const routePath = '/' + file.replace(/^app\/api\//, 'api/').replace(/\/route\.ts$/, '').replace(/\\/g, '/');
    routeMap.set(routePath, { file, references: [] });
  });
  
  // 在代码中搜索对这些路由的调用
  const allFiles = getAllFiles(srcDir, ['.ts', '.tsx']);
  routeMap.forEach((info, route) => {
    const routePatterns = [
      route,
      `/api${route.replace(/^\/api/, '')}`,
      `'${route}'`,
      `"${route}"`,
      `\`${route}\``,
    ];
    
    allFiles.forEach((file: string) => {
      try {
        const filePath = path.join(srcDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 检查是否包含路由调用
        if (routePatterns.some(pattern => content.includes(pattern))) {
          info.references.push(file);
        }
      } catch (error) {
        // 忽略读取错误
      }
    });
    
    if (info.references.length === 0 && !route.includes('[') && !route.includes('[')) {
      issues.push({
        file: info.file,
        severity: 'warning',
        message: `API 路由 ${route} 可能未被使用`,
      });
    }
  });
  
  return issues;
}

// 6. 检查组件导出和使用
function checkComponents(): Issue[] {
  const issues: Issue[] = [];
  const componentsDir = path.join(srcDir, 'components');
  
  if (!fs.existsSync(componentsDir)) {
    return issues;
  }
  
  const componentFiles = getAllFiles(componentsDir, ['.tsx', '.ts']);
  const componentMap = new Map<string, { file: string; exported: boolean }>();
  
  componentFiles.forEach((file: string) => {
    try {
      // file 是相对于 componentsDir 的路径
      const filePath = path.join(componentsDir, file);
      if (!fs.existsSync(filePath)) {
        return; // 跳过不存在的文件
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const componentName = path.basename(file, path.extname(file));
      
      // 检查是否有导出
      const hasExport = /export\s+(default\s+)?(function|const|class)\s+/.test(content);
      componentMap.set(componentName, { file: `components/${file}`, exported: hasExport });
    } catch (error) {
      // 忽略读取错误
    }
  });
  
  // 检查组件是否被使用（简化版，只检查导入）
  const allFiles = getAllFiles(srcDir, ['.ts', '.tsx']);
  componentMap.forEach((info, componentName) => {
    if (!info.exported) return;
    
    let used = false;
    for (const file of allFiles) {
      if (file.includes(info.file)) continue; // 跳过组件自身
      
      try {
        const filePath = path.join(srcDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 检查导入语句
        if (content.includes(componentName) && (content.includes('from') || content.includes('import'))) {
          used = true;
          break;
        }
      } catch (error) {
        // 忽略读取错误
      }
    }
    
    if (!used) {
      issues.push({
        file: info.file,
        severity: 'info',
        message: `组件 ${componentName} 可能未被使用`,
      });
    }
  });
  
  return issues;
}

// 9. 检查新旧版本共存
function checkVersionCoexistence(): Issue[] {
  const issues: Issue[] = [];
  const files = getAllFiles(srcDir, ['.ts', '.tsx']);
  const versionFiles: string[] = [];
  
  files.forEach((file: string) => {
    try {
      // 检查文件名中的版本号
      if (file.match(/v\d+|V\d+/)) {
        versionFiles.push(file);
      }
      
      const filePath = path.join(srcDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 检查代码中的 @deprecated 标记
      if (content.includes('@deprecated') || content.includes('已废弃')) {
        issues.push({
          file,
          severity: 'warning',
          message: '发现废弃标记，可能需要清理',
        });
      }
    } catch (error) {
      // 忽略
    }
  });
  
  // 检查是否有 v1/v2 共存
  const v1Files = versionFiles.filter(f => /v1|V1/.test(f));
  const v2Files = versionFiles.filter(f => /v2|V2/.test(f));
  
  if (v1Files.length > 0 && v2Files.length > 0) {
    v1Files.forEach(file => {
      issues.push({
        file,
        severity: 'info',
        message: '发现旧版本文件，可能与新版本共存',
      });
    });
  }
  
  return issues;
}

// 主函数
function main() {
  console.log('开始代码审查...\n');
  
  // 执行各项检查
  results.push({
    category: '空函数',
    issues: checkEmptyFunctions(),
  });
  
  results.push({
    category: 'TODO/FIXME 标记',
    issues: checkTODOs(),
  });
  
  results.push({
    category: '重复类型定义',
    issues: checkDuplicateTypes(),
  });
  
  results.push({
    category: '未使用的 API 路由',
    issues: checkAPIRoutes(),
  });
  
  results.push({
    category: '未使用的组件',
    issues: checkComponents(),
  });
  
  results.push({
    category: '新旧版本共存',
    issues: checkVersionCoexistence(),
  });
  
  // 生成报告
  console.log('审查结果：\n');
  let totalIssues = 0;
  
  results.forEach(result => {
    if (result.issues.length > 0) {
      console.log(`\n## ${result.category} (${result.issues.length} 个问题)`);
      result.issues.slice(0, 10).forEach(issue => {
        console.log(`- [${issue.severity}] ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        if (issue.message) console.log(`  ${issue.message}`);
      });
      if (result.issues.length > 10) {
        console.log(`  ... 还有 ${result.issues.length - 10} 个问题`);
      }
      totalIssues += result.issues.length;
    }
  });
  
  console.log(`\n总计发现 ${totalIssues} 个问题`);
  
  // 保存详细报告
  const reportPath = path.join(process.cwd(), 'CODE_AUDIT_REPORT.md');
  const report = generateMarkdownReport(results);
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n详细报告已保存到: ${reportPath}`);
}

function generateMarkdownReport(results: AuditResult[]): string {
  let report = '# AnyKeep 代码审查报告\n\n';
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  let totalIssues = 0;
  results.forEach(result => {
    totalIssues += result.issues.length;
  });
  
  report += `## 摘要\n\n`;
  report += `- 总计发现问题: ${totalIssues}\n`;
  results.forEach(result => {
    if (result.issues.length > 0) {
      report += `- ${result.category}: ${result.issues.length}\n`;
    }
  });
  report += '\n';
  
  results.forEach(result => {
    if (result.issues.length === 0) return;
    
    report += `## ${result.category}\n\n`;
    report += `共发现 ${result.issues.length} 个问题\n\n`;
    
    // 按严重程度分组
    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = result.issues.filter(i => i.severity === 'warning');
    const infos = result.issues.filter(i => i.severity === 'info');
    
    if (errors.length > 0) {
      report += `### 错误 (${errors.length})\n\n`;
      errors.forEach(issue => {
        report += `- **${issue.file}**${issue.line ? `:${issue.line}` : ''}\n`;
        report += `  - ${issue.message}\n`;
        if (issue.code) report += `  - 代码: \`${issue.code}\`\n`;
      });
      report += '\n';
    }
    
    if (warnings.length > 0) {
      report += `### 警告 (${warnings.length})\n\n`;
      warnings.slice(0, 50).forEach(issue => {
        report += `- **${issue.file}**${issue.line ? `:${issue.line}` : ''}\n`;
        report += `  - ${issue.message}\n`;
        if (issue.code) report += `  - 代码: \`${issue.code}\`\n`;
      });
      if (warnings.length > 50) {
        report += `\n... 还有 ${warnings.length - 50} 个警告\n`;
      }
      report += '\n';
    }
    
    if (infos.length > 0) {
      report += `### 信息 (${infos.length})\n\n`;
      infos.slice(0, 50).forEach(issue => {
        report += `- **${issue.file}**${issue.line ? `:${issue.line}` : ''}\n`;
        report += `  - ${issue.message}\n`;
      });
      if (infos.length > 50) {
        report += `\n... 还有 ${infos.length - 50} 个信息项\n`;
      }
      report += '\n';
    }
  });
  
  return report;
}

// 直接执行
main();
