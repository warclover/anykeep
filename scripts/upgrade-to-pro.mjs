/**
 * 临时脚本：将用户升级到 Pro 会员
 * 使用方法：node scripts/upgrade-to-pro.mjs <email>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const email = process.argv[2] || 'warclover@163.com';

async function main() {
  console.log(`🔄 正在将 ${email} 升级到 Pro 会员...`);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. 查找用户
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('❌ 查询用户失败:', userError.message);
    process.exit(1);
  }

  const user = userData.users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ 未找到用户: ${email}`);
    process.exit(1);
  }

  console.log(`✅ 找到用户: ${user.id}`);

  // 2. 更新 profiles 表
  const { data, error } = await supabase
    .from('profiles')
    .update({ membership_type: 'PRO' })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ 更新失败:', error.message);
    process.exit(1);
  }

  console.log(`✅ 升级成功！`);
  console.log(`   用户: ${email}`);
  console.log(`   会员类型: ${data.membership_type}`);
}

main().catch(console.error);
