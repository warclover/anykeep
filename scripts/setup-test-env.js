#!/usr/bin/env node
/**
 * 设置测试环境变量
 * 从 .env.local 复制 Supabase 配置到 .env.test.local
 *
 * 使用方法: node scripts/setup-test-env.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ENV_LOCAL = path.join(ROOT_DIR, '.env.local');
const ENV_TEST_LOCAL = path.join(ROOT_DIR, '.env.test.local');

// 需要复制的环境变量
const VARS_TO_COPY = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const vars = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      vars[match[1].trim()] = match[2].trim();
    }
  }

  return vars;
}

function main() {
  console.log('📋 设置 Jest 测试环境变量...\n');

  // 检查 .env.local 是否存在
  if (!fs.existsSync(ENV_LOCAL)) {
    console.error('❌ 错误: .env.local 文件不存在');
    console.log('   请先创建 .env.local 文件并配置 Supabase 凭据');
    process.exit(1);
  }

  // 解析 .env.local
  const localVars = parseEnvFile(ENV_LOCAL);

  // 检查必要的变量
  const missing = [];
  for (const varName of VARS_TO_COPY.slice(0, 2)) { // 前两个是必需的
    if (!localVars[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ 错误: .env.local 缺少必要的环境变量:');
    missing.forEach(v => console.log(`   - ${v}`));
    process.exit(1);
  }

  // 读取现有的 .env.test.local（如果存在）
  let testContent = fs.existsSync(ENV_TEST_LOCAL)
    ? fs.readFileSync(ENV_TEST_LOCAL, 'utf-8')
    : '';

  // 更新或添加变量
  for (const varName of VARS_TO_COPY) {
    const value = localVars[varName];
    if (!value) continue;

    const regex = new RegExp(`^${varName}=.*$`, 'm');
    const newLine = `${varName}=${value}`;

    if (regex.test(testContent)) {
      testContent = testContent.replace(regex, newLine);
      console.log(`✅ 更新: ${varName}`);
    } else {
      // 在 Supabase 配置部分后添加
      const marker = '# -------------------------------------------\n# Supabase';
      if (testContent.includes(marker)) {
        const insertPoint = testContent.indexOf('NEXT_PUBLIC_SUPABASE_URL=');
        if (insertPoint === -1) {
          testContent = testContent.replace(
            /^NEXT_PUBLIC_SUPABASE_URL=.*$/m,
            newLine
          );
        } else {
          testContent = testContent.replace(
            new RegExp(`^${varName}=.*$`, 'm'),
            newLine
          );
        }
      }
      console.log(`✅ 设置: ${varName}`);
    }
  }

  // 确保变量有值
  for (const varName of VARS_TO_COPY) {
    const value = localVars[varName];
    if (value) {
      const regex = new RegExp(`^${varName}=$`, 'm');
      testContent = testContent.replace(regex, `${varName}=${value}`);
    }
  }

  // 写入文件
  fs.writeFileSync(ENV_TEST_LOCAL, testContent);

  console.log('\n✨ 完成! .env.test.local 已配置');
  console.log('   现在可以运行: npm test');
}

main();
