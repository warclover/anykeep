#!/usr/bin/env node
/**
 * 检查环境变量是否正确加载
 * 使用方法: node scripts/check-env.js
 */

require('dotenv').config({ path: '.env.local' });

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

console.log('🔍 检查环境变量...\n');

let allPresent = true;

for (const varName of requiredVars) {
  const value = process.env[varName];
  const isPresent = value && value.trim() !== '';
  
  if (isPresent) {
    // 只显示前 20 个字符，隐藏敏感信息
    const displayValue = value.length > 20 
      ? value.substring(0, 20) + '...' 
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`❌ ${varName}: 缺失或为空`);
    allPresent = false;
  }
}

console.log('\n' + '='.repeat(50));

if (allPresent) {
  console.log('✅ 所有必需的环境变量都已配置');
  console.log('\n💡 如果仍然报错，请尝试：');
  console.log('   1. 重启开发服务器 (Ctrl+C 然后 npm run dev)');
  console.log('   2. 清除 Next.js 缓存: rm -rf .next');
  console.log('   3. 检查 .env.local 文件格式（不要有引号、多余空格）');
} else {
  console.log('❌ 部分环境变量缺失');
  console.log('\n💡 请检查 .env.local 文件：');
  console.log('   1. 确保文件在项目根目录');
  console.log('   2. 确保格式正确: KEY=value（不要有引号）');
  console.log('   3. 确保没有多余的空格');
}

